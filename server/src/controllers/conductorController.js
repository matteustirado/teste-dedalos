import { io } from '../../server.js';
import pool from '../config/db.js';

// --- ESTADO DO MAESTRO ---
let estadoRadio = {
    musicaAtual: null,
    tempoAtualSegundos: 0,
    playlistAtiva: [],
    playlistAgendadaAtual: null,
    filaComercialManual: [],
    filaDePedidos: [], // Fila principal
    contadorComercial: 0,
    isCrossfading: false,
    playerAtivo: 'A',
    overlayUrl: null
};

let cacheComerciais = [];
let cacheFallbacks = {};

const TICK_INTERVAL_MS = 250;
let ticker = null;
let ultimoSlotVerificado = -1;

const formatDateToYYYYMMDD = (date) => {
    if (!date) return null;
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const iniciarTicker = () => {
    if (ticker) clearInterval(ticker);
    console.log(`[Maestro] Iniciando Ticker (${TICK_INTERVAL_MS}ms).`);

    ticker = setInterval(async () => {
        
        const agora = new Date();
        const hora = agora.getUTCHours();
        const minutos = agora.getUTCMinutes();
        const slotAtual = (hora * 6) + Math.floor(minutos / 10);
        
        if (slotAtual !== ultimoSlotVerificado) {
            console.log(`[Maestro Ticker] Novo slot detectado: ${slotAtual} (${hora}:${minutos} UTC)`);
            ultimoSlotVerificado = slotAtual;
            await verificarAgendamento(agora, slotAtual);
        }
        
        if (!estadoRadio.musicaAtual) {
            await tocarProximaMusica(); 
            return;
        }

        estadoRadio.tempoAtualSegundos += (TICK_INTERVAL_MS / 1000);

        const { tempoAtualSegundos, musicaAtual, isCrossfading, playerAtivo } = estadoRadio;
        const fimMusicaSegundos = musicaAtual.end_segundos ?? musicaAtual.duracao_segundos; 

        io.emit('maestro:progresso', {
            tempoAtual: tempoAtualSegundos,
            tempoTotal: fimMusicaSegundos
        });
        
        const tempoCrossfade = 4;
        if (!isCrossfading && tempoAtualSegundos >= (fimMusicaSegundos - tempoCrossfade)) {
            estadoRadio.isCrossfading = true;
            console.log(`[Maestro Ticker] Tempo de Crossfade atingido (T-${tempoCrossfade}s).`);
            
            const proximoPlayer = playerAtivo === 'A' ? 'B' : 'A';
            const proximaMusicaInfo = await obterProximaMusicaInfo();
            
            if (proximaMusicaInfo) {
                console.log(`[Maestro Ticker] Emitindo 'maestro:iniciarCrossfade'. Próxima música: ${proximaMusicaInfo.titulo}`);
                io.emit('maestro:iniciarCrossfade', {
                    playerAtivo: playerAtivo,
                    proximoPlayer: proximoPlayer,
                    proximaMusica: proximaMusicaInfo
                });
            } else {
                 console.log("[Maestro Ticker] Crossfade: Fim da fila, sem próxima música.");
            }
        }

        if (tempoAtualSegundos >= fimMusicaSegundos) {
            console.log(`[Maestro Ticker] Música "${musicaAtual.titulo}" terminou.`);
            await tocarProximaMusica();
        }

    }, TICK_INTERVAL_MS);
};

const tocarProximaMusica = async () => {
    estadoRadio.isCrossfading = false;
    estadoRadio.tempoAtualSegundos = 0;
    estadoRadio.musicaAtual = null;

    let proximaMusicaId = null;
    let origem = null;
    let pedidoInfo = null;

    if (estadoRadio.filaComercialManual.length > 0) {
        proximaMusicaId = estadoRadio.filaComercialManual.shift();
        origem = 'COMERCIAL_MANUAL';
        estadoRadio.contadorComercial = 0;
        console.log(`[Maestro] Prioridade 1: Comercial Manual (ID: ${proximaMusicaId})`);
    }
    else if (estadoRadio.contadorComercial >= 10 && cacheComerciais.length > 0) {
        proximaMusicaId = cacheComerciais[Math.floor(Math.random() * cacheComerciais.length)];
        origem = 'COMERCIAL_AUTO';
        estadoRadio.contadorComercial = 0;
        console.log(`[Maestro] Prioridade 2: Comercial Automático (ID: ${proximaMusicaId})`);
    }
    else if (estadoRadio.filaDePedidos.length > 0) {
        const proximoPedido = estadoRadio.filaDePedidos.shift();
        proximaMusicaId = proximoPedido.trackId;
        origem = proximoPedido.tipo === 'DJ' ? 'DJ_PEDIDO' : 'JUKEBOX';
        pedidoInfo = proximoPedido;
        estadoRadio.contadorComercial++;
        console.log(`[Maestro] Prioridade 3: Fila de Pedidos (${origem}, ID: ${proximaMusicaId})`);
    }
    else if (estadoRadio.playlistAtiva.length > 0) {
        proximaMusicaId = estadoRadio.playlistAtiva.shift();
        origem = 'PLAYLIST';
        estadoRadio.contadorComercial++;
        console.log(`[Maestro] Prioridade 4: Playlist Ativa (ID: ${proximaMusicaId})`);
    }
    else {
        console.log("[Maestro] Fila e Playlist vazias. Verificando Fallback...");
        const diaSemana = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"][new Date().getUTCDay()];
        const fallbackPlaylistId = cacheFallbacks[diaSemana];
        
        if (fallbackPlaylistId) {
            console.log(`[Maestro] Acionando Fallback: ${diaSemana} (ID: ${fallbackPlaylistId})`);
            await carregarPlaylist(fallbackPlaylistId, false);
            if (estadoRadio.playlistAtiva.length > 0) {
                proximaMusicaId = estadoRadio.playlistAtiva.shift();
                origem = 'FALLBACK';
                estadoRadio.contadorComercial = 1;
            }
        } else {
            console.warn(`[Maestro] NENHUM FALLBACK encontrado para ${diaSemana}!`);
        }
    }

    if (proximaMusicaId) {
        const trackInfo = await buscarDetalhesTrack(proximaMusicaId);
        if (trackInfo) {
            estadoRadio.musicaAtual = trackInfo;
            estadoRadio.playerAtivo = estadoRadio.playerAtivo === 'A' ? 'B' : 'A';
            
            io.emit('maestro:tocarAgora', {
                 player: estadoRadio.playerAtivo,
                 musicaInfo: estadoRadio.musicaAtual
            });
            console.log(`[Maestro] Tocando agora (${origem}): "${trackInfo.titulo}" (Player ${estadoRadio.playerAtivo})`);
            
            if (pedidoInfo && pedidoInfo.id) {
                // Se o ID for numérico (do banco), atualiza o status
                if (!String(pedidoInfo.id).startsWith('jb_') && !String(pedidoInfo.id).startsWith('dj_')) {
                    atualizarStatusPedido(pedidoInfo.id, 'TOCADO');
                }
            }
        } else {
            console.error(`[Maestro] ERRO: Track ID ${proximaMusicaId} (Origem: ${origem}) não encontrada no DB. Pulando.`);
            estadoRadio.musicaAtual = null;
            tocarProximaMusica();
        }
    } else {
        console.warn("[Maestro] Nenhuma música encontrada. Silêncio.");
        estadoRadio.musicaAtual = null;
        io.emit('maestro:pararTudo');
    }
    
    io.emit('maestro:filaAtualizada', await comporFilaVisual());
};

// Esta função agora é chamada pelo JukeboxController (do server.js)
export const adicionarPedidoNaFila = (pedidoObjeto) => {
    // Se o pedido veio do banco, ele já tem ID. Se veio do DJ (memória), geramos um ID temporário.
    if (!pedidoObjeto.id) {
        pedidoObjeto.id = `dj_${Math.random().toString(36).substring(2, 9)}`;
    }
    
    estadoRadio.filaDePedidos.push(pedidoObjeto);
    const posicao = estadoRadio.filaComercialManual.length + estadoRadio.filaDePedidos.length;
    console.log(`[Maestro] Pedido (ID: ${pedidoObjeto.id}) adicionado à filaDePedidos. Posição: ${posicao}`);
    
    // Se não estiver tocando nada, inicia o processo
    if (!estadoRadio.musicaAtual) {
         tocarProximaMusica();
    } else {
         // Se já estiver tocando, apenas atualiza a visualização da fila
         comporFilaVisual().then(fila => io.emit('maestro:filaAtualizada', fila));
    }

    return posicao;
};

const safeJsonParse = (input) => {
  if (Array.isArray(input)) { return input; }
  if (!input || typeof input !== 'string') { return []; }
  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("safeJsonParse - Erro no parse:", e);
    return [];
  }
};

const obterProximaMusicaInfo = async () => {
    let proximaMusicaId = null;
    
    if (estadoRadio.filaComercialManual.length > 0) {
        proximaMusicaId = estadoRadio.filaComercialManual[0];
    }
    else if (estadoRadio.contadorComercial + 1 >= 10 && cacheComerciais.length > 0) {
        proximaMusicaId = null;
    }
    else if (estadoRadio.filaDePedidos.length > 0) {
        proximaMusicaId = estadoRadio.filaDePedidos[0].trackId;
    }
    else if (estadoRadio.playlistAtiva.length > 0) {
        proximaMusicaId = estadoRadio.playlistAtiva[0];
    }
    else {
        const diaSemana = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"][new Date().getUTCDay()];
        const fallbackPlaylistId = cacheFallbacks[diaSemana];
        if (fallbackPlaylistId) {
            const fallbackTracks = await buscarTracksDaPlaylist(fallbackPlaylistId);
            if (fallbackTracks.length > 0) {
                proximaMusicaId = fallbackTracks[0];
            }
        }
    }
    
    if (proximaMusicaId) {
        return await buscarDetalhesTrack(proximaMusicaId);
    }
    return null;
};

export const comporFilaVisual = async () => {
    const proximas5 = [];
    
    for (const trackId of estadoRadio.filaComercialManual) {
        if (proximas5.length >= 5) break;
        const trackInfo = await buscarDetalhesTrack(trackId);
        proximas5.push({ 
            id: `comercial_${trackId}_${Math.random().toString(36).substring(2, 9)}`,
            titulo: trackInfo ? trackInfo.titulo : "Comercial",
            tipo: 'COMERCIAL_MANUAL', 
            unidade: 'DJ'
        });
    }

    for (const pedido of estadoRadio.filaDePedidos) {
        if (proximas5.length >= 5) break;
        const trackInfo = await buscarDetalhesTrack(pedido.trackId);
        proximas5.push({ 
            id: `pedido_${pedido.id}`,
            titulo: trackInfo ? trackInfo.titulo : "Música não encontrada",
            artista: trackInfo ? trackInfo.artista : "", 
            tipo: pedido.tipo, 
            unidade: pedido.unidade 
        });
    }
    
    for (const trackId of estadoRadio.playlistAtiva) {
         if (proximas5.length >= 5) break;
         const trackInfo = await buscarDetalhesTrack(trackId);
         proximas5.push({ 
             id: `pl_${trackId}`,
             titulo: trackInfo ? trackInfo.titulo : "Música não encontrada", 
             artista: trackInfo ? trackInfo.artista : "", 
             tipo: 'PLAYLIST', 
             unidade: '' 
         });
    }
    
    return proximas5;
};

const buscarDetalhesTrack = async (trackId) => {
    try {
        const [rows] = await pool.query('SELECT * FROM tracks WHERE id = ?', [trackId]);
        if (rows.length > 0) {
            rows[0].artistas_participantes = safeJsonParse(rows[0].artistas_participantes);
            rows[0].dias_semana = safeJsonParse(rows[0].dias_semana);
            return rows[0];
        }
        return null;
    } catch (err) {
        console.error(`Erro ao buscar detalhes da track ${trackId}:`, err);
        return null;
    }
};

const buscarTracksDaPlaylist = async (playlistId) => {
     try {
        const [rows] = await pool.query('SELECT tracks_ids FROM playlists WHERE id = ?', [playlistId]);
        if (rows.length > 0) {
            return safeJsonParse(rows[0].tracks_ids);
        }
        return [];
     } catch (err) {
         console.error(`[Maestro] Erro ao buscar tracks da playlist ${playlistId}:`, err);
         return [];
     }
}

const carregarPlaylist = async (playlistId, isAgendada = true) => {
    const trackIds = await buscarTracksDaPlaylist(playlistId);
    if (trackIds.length > 0) {
        estadoRadio.playlistAtiva = trackIds;
        estadoRadio.playlistAgendadaAtual = isAgendada ? playlistId : null;
    } else {
        console.warn(`[Maestro] Tentativa de carregar playlist ID ${playlistId}, mas está vazia ou não existe.`);
        if (isAgendada) {
            estadoRadio.playlistAgendadaAtual = null;
        }
    }
}

const verificarAgendamento = async (dataHoraAtual, slotAtual) => {
    const dataString = formatDateToYYYYMMDD(dataHoraAtual);
    
    try {
        console.log(`[Maestro] Verificando agendamento para ${dataString} no Slot: ${slotAtual}...`);
        const [rows] = await pool.query(
            "SELECT playlist_id FROM agendamentos WHERE data_agendamento = ? AND slot_index = ?",
            [dataString, slotAtual]
        );
        
        if (rows.length > 0) {
            const playlistIdAgendada = rows[0].playlist_id;
            
            if (playlistIdAgendada === null) {
                 console.log(`[Maestro] Agendamento para Slot ${slotAtual} é Tempo Vazio (NULL).`);
                 estadoRadio.playlistAtiva = [];
                 estadoRadio.playlistAgendadaAtual = null;
            }
            else if (playlistIdAgendada !== estadoRadio.playlistAgendadaAtual) {
                console.log(`[Maestro] AGENDAMENTO ATIVADO: Carregando Playlist ID ${playlistIdAgendada}.`);
                await carregarPlaylist(playlistIdAgendada, true);
                
                if (estadoRadio.filaDePedidos.length === 0) {
                    console.log("[Maestro] Agendamento interrompendo música atual (sem pedidos na fila).");
                    if (estadoRadio.musicaAtual) {
                         tocarProximaMusica();
                    }
                }
            }
        } else {
            console.log(`[Maestro] Nenhum agendamento encontrado para Slot ${slotAtual}.`);
            estadoRadio.playlistAgendadaAtual = null; 
        }
        
    } catch (err) {
        console.error("[Maestro] Erro ao verificar agendamento:", err);
    }
};

const atualizarStatusPedido = async (pedidoDbId, status) => {
    try {
         await pool.query("UPDATE jukebox_pedidos SET status = ?, tocado_em = NOW() WHERE id = ?", [status, pedidoDbId]);
    } catch (err) {
         console.error(`[Maestro] Erro ao atualizar status do pedido ${pedidoDbId}:`, err);
    }
}

const carregarCacheConfig = async () => {
    try {
        console.log("[Maestro] Carregando cache de configuração...");
        const [rows] = await pool.query("SELECT * FROM radio_config");
        
        const fallbackRow = rows.find(r => r.config_key === 'fallback_playlist_ids');
        if (fallbackRow && fallbackRow.config_value) {
            cacheFallbacks = Array.isArray(fallbackRow.config_value) ? {} : fallbackRow.config_value;
            console.log("[Maestro] Cache de Fallbacks carregado:", cacheFallbacks);
        } else {
            console.warn("[Maestro] Nenhuma configuração 'fallback_playlist_ids' encontrada no DB.");
        }

        console.log("[Maestro] Atualizando cache de comerciais (Regra 4)...");
        const [commercialRows] = await pool.query("SELECT id FROM tracks WHERE is_commercial = 1");
        cacheComerciais = commercialRows.map(r => r.id);
        
        await pool.query(
            "UPDATE radio_config SET config_value = ? WHERE config_key = 'commercial_track_ids'", 
            [JSON.stringify(cacheComerciais)]
        );
        console.log(`[Maestro] Cache de ${cacheComerciais.length} comerciais atualizado no DB e na memória.`);

    } catch (err) {
        console.error("[Maestro] Erro fatal ao carregar cache de configuração:", err);
    }
};

const djCarregarPlaylistManual = async (playlistId) => {
    console.log(`[Maestro] DJ solicitou carregar playlist manual ID: ${playlistId}`);
    await carregarPlaylist(playlistId, false);
    
    if (!estadoRadio.musicaAtual) {
        tocarProximaMusica(); 
    } else {
        io.emit('maestro:filaAtualizada', await comporFilaVisual());
    }
};

const djTocarComercialAgora = async () => {
    console.log(`[Maestro] DJ solicitou tocar comercial agora.`);
    if (cacheComerciais.length === 0) {
        console.warn("[Maestro] DJ pediu comercial, mas cache de comerciais está vazio.");
        return;
    }
    const comercialId = cacheComerciais[Math.floor(Math.random() * cacheComerciais.length)];
    estadoRadio.filaComercialManual.push(comercialId);
    
    io.emit('maestro:filaAtualizada', await comporFilaVisual());
    
    if (!estadoRadio.musicaAtual) {
         tocarProximaMusica();
    }
};

const djVetarPedido = async (itemId) => {
    console.log(`[Maestro] DJ solicitou vetar item: ${itemId}`);
    let itemVetado = false;

    let pedidoIndex = estadoRadio.filaDePedidos.findIndex(p => `pedido_${p.id}` === itemId);
    if (pedidoIndex > -1) {
        const pedidoRemovido = estadoRadio.filaDePedidos.splice(pedidoIndex, 1)[0];
        console.log(`[Maestro] Pedido ${pedidoRemovido.id} (Track: ${pedidoRemovido.trackId}) vetado da filaDePedidos.`);
        
        // Verifica se é pedido de banco de dados (ID numérico) para atualizar status
        if (!String(pedidoRemovido.id).startsWith('dj_')) {
            atualizarStatusPedido(pedidoRemovido.id, 'VETADO');
        }
        itemVetado = true;
    } else {
         let comercialId = itemId.split('_')[1];
         let comercialIndex = estadoRadio.filaComercialManual.findIndex(id => id == comercialId);
         if (comercialIndex > -1) {
             estadoRadio.filaComercialManual.splice(comercialIndex, 1);
             console.log(`[Maestro] Comercial Manual (ID: ${comercialId}) vetado da filaComercialManual.`);
             itemVetado = true;
         }
    }

    if (itemVetado) {
        io.emit('maestro:filaAtualizada', await comporFilaVisual());
    }
};

const djAdicionarPedido = async (trackId) => {
     console.log(`[Maestro] DJ solicitou adicionar track ID: ${trackId} à fila.`);
     const pedidoObjeto = {
         id: `dj_${Math.random().toString(36).substring(2, 9)}`,
         trackId: trackId,
         pulseiraId: 'DJ',
         unidade: 'DJ',
         tipo: 'DJ'
     };
     
     adicionarPedidoNaFila(pedidoObjeto);
     
     io.emit('maestro:filaAtualizada', await comporFilaVisual());
     
     if (!estadoRadio.musicaAtual) {
         tocarProximaMusica();
    }
};

export const setOverlayRadio = (url) => {
    console.log(`[Maestro] Atualizando Overlay Global: ${url}`);
    estadoRadio.overlayUrl = url;
    io.emit('maestro:overlayAtualizado', url);
    io.emit('maestro:estadoCompleto', estadoRadio);
};

export const iniciarMaestro = async () => {
    console.log("[Maestro] Iniciando o Maestro da Rádio...");
    
    await carregarCacheConfig();
    
    const agora = new Date();
    ultimoSlotVerificado = (agora.getUTCHours() * 6) + Math.floor(agora.getUTCMinutes() / 10) - 1;

    iniciarTicker(); 
    
    io.on('connection', (socket) => {
        console.log(`[Maestro] Cliente ${socket.id} se conectou. Enviando estado atual.`);
        socket.emit('maestro:estadoCompleto', estadoRadio);
        comporFilaVisual().then(fila => socket.emit('maestro:filaAtualizada', fila));

        socket.on('dj:pularMusica', () => {
            console.log(`[Maestro] DJ ${socket.id} solicitou 'pularMusica'.`);
            tocarProximaMusica();
        });
        
        socket.on('dj:tocarComercialAgora', () => {
            console.log(`[Maestro] DJ ${socket.id} solicitou 'tocarComercialAgora'.`);
            djTocarComercialAgora();
        });
        
        socket.on('dj:vetarPedido', (itemId) => {
             console.log(`[Maestro] DJ ${socket.id} solicitou 'vetarPedido' (ID: ${itemId}).`);
             djVetarPedido(itemId);
        });
        
        socket.on('dj:adicionarPedido', (trackId) => {
             console.log(`[Maestro] DJ ${socket.id} solicitou 'adicionarPedido' (TrackID: ${trackId}).`);
             djAdicionarPedido(trackId);
        });
        
        socket.on('dj:carregarPlaylistManual', (playlistId) => {
             console.log(`[Maestro] DJ ${socket.id} solicitou 'carregarPlaylistManual' (PlaylistID: ${playlistId}).`);
             djCarregarPlaylistManual(playlistId);
        });
        
        // REMOVIDO: O ouvinte 'jukebox:adicionarPedido' foi retirado daqui 
        // porque agora o server.js -> jukeboxController.js lida com isso 
        // para salvar no banco de dados primeiro.
    });
};

export const getEstadoRadio = () => {
    return estadoRadio;
}