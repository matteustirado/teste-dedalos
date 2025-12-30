import { getIO } from '../socket.js'; 
import pool from '../config/db.js';

// --- ESTADO DO MAESTRO ---
let estadoRadio = {
    musicaAtual: null,
    tempoAtualSegundos: 0,
    playlistAtiva: [],
    playlistAgendadaAtual: null,
    filaComercialManual: [],
    filaDePedidos: [],
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

// --- UTILITÁRIOS ---
const formatDateToYYYYMMDD = (date) => {
    if (!date) return null;
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const safeJsonParse = (input) => {
  if (Array.isArray(input)) return input;
  if (!input || typeof input !== 'string') return [];
  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("safeJsonParse - Erro no parse:", e);
    return [];
  }
};

// --- LOGICA DE BANCO DE DADOS ---
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

const atualizarStatusPedido = async (pedidoDbId, status) => {
    try {
         await pool.query("UPDATE jukebox_pedidos SET status = ?, tocado_em = NOW() WHERE id = ?", [status, pedidoDbId]);
    } catch (err) {
         console.error(`[Maestro] Erro ao atualizar status do pedido ${pedidoDbId}:`, err);
    }
}

// --- LOGICA DE CARREGAMENTO ---
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

// --- LOGICA PRINCIPAL DE REPRODUÇÃO ---

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

const tocarProximaMusica = async () => {
    estadoRadio.isCrossfading = false;
    estadoRadio.tempoAtualSegundos = 0; // Reseta inicialmente
    estadoRadio.musicaAtual = null;

    let proximaMusicaId = null;
    let origem = null;
    let pedidoInfo = null;

    // 1. Prioridade: Comercial Manual
    if (estadoRadio.filaComercialManual.length > 0) {
        proximaMusicaId = estadoRadio.filaComercialManual.shift();
        origem = 'COMERCIAL_MANUAL';
        estadoRadio.contadorComercial = 0;
        console.log(`[Maestro] Prioridade 1: Comercial Manual (ID: ${proximaMusicaId})`);
    }
    // 2. Prioridade: Comercial Automático (a cada 10 músicas)
    else if (estadoRadio.contadorComercial >= 10 && cacheComerciais.length > 0) {
        proximaMusicaId = cacheComerciais[Math.floor(Math.random() * cacheComerciais.length)];
        origem = 'COMERCIAL_AUTO';
        estadoRadio.contadorComercial = 0;
        console.log(`[Maestro] Prioridade 2: Comercial Automático (ID: ${proximaMusicaId})`);
    }
    // 3. Prioridade: Fila de Pedidos (Jukebox/DJ)
    else if (estadoRadio.filaDePedidos.length > 0) {
        const proximoPedido = estadoRadio.filaDePedidos.shift();
        proximaMusicaId = proximoPedido.trackId;
        origem = proximoPedido.tipo === 'DJ' ? 'DJ_PEDIDO' : 'JUKEBOX';
        pedidoInfo = proximoPedido;
        estadoRadio.contadorComercial++;
        console.log(`[Maestro] Prioridade 3: Fila de Pedidos (${origem}, ID: ${proximaMusicaId})`);
    }
    // 4. Prioridade: Playlist Ativa (Agendada ou Manual)
    else if (estadoRadio.playlistAtiva.length > 0) {
        proximaMusicaId = estadoRadio.playlistAtiva.shift();
        origem = 'PLAYLIST';
        estadoRadio.contadorComercial++;
        console.log(`[Maestro] Prioridade 4: Playlist Ativa (ID: ${proximaMusicaId})`);
    }
    // 5. Fallback (Último recurso)
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
            
            // CORREÇÃO CRÍTICA AQUI: Define o tempo inicial com o start_segundos da música
            estadoRadio.tempoAtualSegundos = trackInfo.start_segundos || 0;

            getIO().emit('maestro:tocarAgora', {
                 player: estadoRadio.playerAtivo,
                 musicaInfo: estadoRadio.musicaAtual
            });
            console.log(`[Maestro] Tocando agora (${origem}): "${trackInfo.titulo}" (Início: ${estadoRadio.tempoAtualSegundos}s)`);
            
            if (pedidoInfo && pedidoInfo.id) {
                const idStr = String(pedidoInfo.id);
                if (!idStr.startsWith('dj_') && !idStr.startsWith('jb_')) {
                    atualizarStatusPedido(pedidoInfo.id, 'TOCADO');
                }
            }
        } else {
            console.error(`[Maestro] ERRO: Track ID ${proximaMusicaId} não encontrada. Pulando.`);
            estadoRadio.musicaAtual = null;
            tocarProximaMusica(); 
        }
    } else {
        console.warn("[Maestro] Nenhuma música encontrada. Silêncio.");
        estadoRadio.musicaAtual = null;
        getIO().emit('maestro:pararTudo');
    }
    
    const filaVisual = await comporFilaVisual();
    getIO().emit('maestro:filaAtualizada', filaVisual);
};

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

        getIO().emit('maestro:progresso', {
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
                getIO().emit('maestro:iniciarCrossfade', {
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

// --- FUNÇÕES EXPORTADAS ---

export const verificarDisponibilidadeTrack = (trackId) => {
    const idToCheck = String(trackId);

    if (estadoRadio.musicaAtual && String(estadoRadio.musicaAtual.id) === idToCheck) {
        return { allowed: false, motivo: 'Esta música já está tocando agora!' };
    }

    const proximas5 = estadoRadio.filaDePedidos.slice(0, 5);
    const jaNasProximas = proximas5.some(p => String(p.trackId) === idToCheck);

    if (jaNasProximas) {
        return { allowed: false, motivo: 'Esta música já vai tocar em breve!' };
    }

    return { allowed: true };
};

export const adicionarPedidoNaFila = (pedidoObjeto) => {
    if (!pedidoObjeto.id) {
        pedidoObjeto.id = `dj_${Math.random().toString(36).substring(2, 9)}`;
    }
    
    estadoRadio.filaDePedidos.push(pedidoObjeto);
    const posicao = estadoRadio.filaComercialManual.length + estadoRadio.filaDePedidos.length;
    console.log(`[Maestro] Pedido (ID: ${pedidoObjeto.id}) adicionado à filaDePedidos. Posição: ${posicao}`);
    
    if (!estadoRadio.musicaAtual) {
         tocarProximaMusica();
    } else {
         comporFilaVisual().then(fila => getIO().emit('maestro:filaAtualizada', fila));
    }

    return posicao;
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

// Funções para o DJ Controller
const djCarregarPlaylistManual = async (playlistId) => {
    console.log(`[Maestro] DJ solicitou carregar playlist manual ID: ${playlistId}`);
    await carregarPlaylist(playlistId, false);
    
    if (!estadoRadio.musicaAtual) {
        tocarProximaMusica(); 
    } else {
        getIO().emit('maestro:filaAtualizada', await comporFilaVisual());
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
    
    getIO().emit('maestro:filaAtualizada', await comporFilaVisual());
    
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
        console.log(`[Maestro] Pedido ${pedidoRemovido.id} vetado.`);
        
        if (!String(pedidoRemovido.id).startsWith('dj_')) {
            atualizarStatusPedido(pedidoRemovido.id, 'VETADO');
        }
        itemVetado = true;
    } else {
         let comercialId = itemId.split('_')[1];
         let comercialIndex = estadoRadio.filaComercialManual.findIndex(id => id == comercialId);
         if (comercialIndex > -1) {
             estadoRadio.filaComercialManual.splice(comercialIndex, 1);
             console.log(`[Maestro] Comercial Manual vetado.`);
             itemVetado = true;
         }
    }

    if (itemVetado) {
        getIO().emit('maestro:filaAtualizada', await comporFilaVisual());
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
};

export const setOverlayRadio = (url) => {
    console.log(`[Maestro] Atualizando Overlay Global: ${url}`);
    estadoRadio.overlayUrl = url;
    getIO().emit('maestro:overlayAtualizado', url);
    getIO().emit('maestro:estadoCompleto', estadoRadio);
};

export const iniciarMaestro = async () => {
    console.log("[Maestro] Iniciando o Maestro da Rádio...");
    
    await carregarCacheConfig();
    
    const agora = new Date();
    ultimoSlotVerificado = (agora.getUTCHours() * 6) + Math.floor(agora.getUTCMinutes() / 10) - 1;

    iniciarTicker(); 
    
    getIO().on('connection', (socket) => {
        console.log(`[Maestro] Cliente ${socket.id} conectado.`);
        socket.emit('maestro:estadoCompleto', estadoRadio);
        comporFilaVisual().then(fila => socket.emit('maestro:filaAtualizada', fila));

        socket.on('dj:pularMusica', () => {
            console.log(`[Maestro] DJ ${socket.id} solicitou 'pularMusica'.`);
            tocarProximaMusica();
        });
        
        socket.on('dj:tocarComercialAgora', () => {
            djTocarComercialAgora();
        });
        
        socket.on('dj:vetarPedido', (itemId) => {
             djVetarPedido(itemId);
        });
        
        socket.on('dj:adicionarPedido', (trackId) => {
             djAdicionarPedido(trackId);
        });
        
        socket.on('dj:carregarPlaylistManual', (playlistId) => {
             djCarregarPlaylistManual(playlistId);
        });
    });
};

export const getEstadoRadio = () => {
    return estadoRadio;
}