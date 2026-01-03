import pool from '../config/db.js';
import { getIO } from '../socket.js';
import { io as ioClient } from 'socket.io-client';

// =====================================================================
// 🛠️ HELPER: Busca Dados na API Dedalos (Reutilizável / Proxy)
// =====================================================================
const fetchFromDedalos = async (unidade) => {
    // Busca configs do ambiente apenas no momento da execução
    const config = {
        SP: { url: process.env.VITE_API_URL_SP, token: process.env.VITE_API_TOKEN_SP },
        BH: { url: process.env.VITE_API_URL_BH, token: process.env.VITE_API_TOKEN_BH }
    }[unidade.toUpperCase()];

    if (!config || !config.url) return null;

    try {
        const baseUrl = config.url.replace(/\/$/, "");
        
        // 1. Tenta endpoint direto de contador (se existir na sua API)
        let endpoint = `${baseUrl}/api/contador/`;
        let response = await fetch(endpoint, { headers: { "Authorization": `Token ${config.token}` } });
        
        // 2. Fallback: Se não achar contador, busca entradas do dia e conta o tamanho do array
        if (!response.ok) {
            const dataHoje = new Date().toISOString().split('T')[0];
            endpoint = `${baseUrl}/api/entradasPorData/${dataHoje}`;
            response = await fetch(endpoint, { headers: { "Authorization": `Token ${config.token}` } });
        }

        if (response.ok) {
            const data = await response.json();
            
            // Lógica para extrair o número dependendo do formato da resposta
            if (Array.isArray(data)) {
                // Se for [{contador: 100}], retorna 100. Se for lista de entradas, retorna length.
                if (data.length > 0 && data[0].contador !== undefined) return data[0].contador;
                return data.length;
            } else if (data.results) {
                return data.results.length;
            }
        }
        return null;
    } catch (error) {
        console.error(`[Dedalos API] Erro ao buscar dados de ${unidade}:`, error.message);
        return null;
    }
};

// =====================================================================
// 🔌 PONTE WEBSOCKET (Conexão em Tempo Real com Heroku)
// =====================================================================
const EXTERNAL_SOCKETS = {
    SP: 'https://placar-80b3f72889ba.herokuapp.com/',
    BH: 'https://placarbh-cf51a4a5b78a.herokuapp.com/'
};

const iniciarPonteRealTime = () => {
    console.log("🌉 Iniciando Ponte Real-Time com servidores externos...");

    Object.entries(EXTERNAL_SOCKETS).forEach(([unidade, url]) => {
        try {
            console.log(`[Ponte ${unidade}] Conectando a ${url}...`);
            
            const socket = ioClient(url, {
                transports: ['websocket', 'polling']
            });

            socket.on('connect', () => {
                console.log(`✅ [Ponte ${unidade}] Conectado ao servidor externo!`);
            });

            socket.on('disconnect', () => {
                console.warn(`❌ [Ponte ${unidade}] Desconectado.`);
            });

            // GATILHO PRINCIPAL (Vem do Heroku)
            socket.on('new_id', async (data) => {
                console.log(`⚡ [Ponte ${unidade}] CHECK-IN DETECTADO!`);
                
                // Busca o total atualizado na API para enviar junto (evita delay no front)
                const totalAtual = await fetchFromDedalos(unidade);
                
                const io = getIO();
                io.emit('checkin:novo', { 
                    unidade: unidade, 
                    total: totalAtual, // Envia o total já mastigado
                    origem: 'websocket_externo',
                    timestamp: new Date()
                });
            });

        } catch (error) {
            console.error(`[Ponte ${unidade}] Erro ao inicializar socket:`, error);
        }
    });
};

// =====================================================================
// 📡 SENTINELA (Backup via HTTP Polling)
// =====================================================================
const CHECKIN_INTERVAL = 10000; // 10 segundos (Backup pode ser mais lento)
let lastCheckinCount = { SP: null, BH: null };

const iniciarSentinela = () => {
    console.log("📡 Sentinela (Backup HTTP) iniciado...");

    setInterval(async () => {
        for (const unidade of ['SP', 'BH']) {
            const totalAtual = await fetchFromDedalos(unidade);

            if (totalAtual !== null) {
                // 1. Define base inicial
                if (lastCheckinCount[unidade] === null) {
                    lastCheckinCount[unidade] = totalAtual;
                    continue;
                }

                // 2. Detecta mudança (se o WebSocket falhou, o Sentinela pega)
                if (totalAtual > lastCheckinCount[unidade]) {
                    console.log(`🚨 [Sentinela] Diferença detectada em ${unidade}. Total: ${totalAtual}`);
                    
                    const io = getIO();
                    io.emit('checkin:novo', { 
                        unidade: unidade, 
                        total: totalAtual,
                        origem: 'sentinela_http',
                        timestamp: new Date()
                    });

                    lastCheckinCount[unidade] = totalAtual;
                }
            }
        }
    }, CHECKIN_INTERVAL);
};

// INICIALIZA OS SISTEMAS DE MONITORAMENTO
iniciarPonteRealTime();
iniciarSentinela();


// =====================================================================
// 🎮 CONTROLLERS DO SCOREBOARD
// =====================================================================

// [NOVO] Rota Proxy para o Frontend buscar contagem sem erro de CORS
export const getCrowdCount = async (req, res) => {
    const { unidade } = req.params;
    const count = await fetchFromDedalos(unidade);
    
    if (count !== null) {
        res.json({ count });
    } else {
        // Não quebra o front, apenas retorna null ou erro tratável
        res.status(500).json({ error: "Erro ao buscar contagem no Dedalos" });
    }
};

// Rota de Teste Manual
export const testarTrigger = (req, res) => {
    const { unidade } = req.params;
    const unidadeUpper = unidade ? unidade.toUpperCase() : 'SP';
    
    try {
        const io = getIO();
        console.log(`🧪 [TESTE] Disparo manual para ${unidadeUpper}...`);
        
        io.emit('checkin:novo', { 
            unidade: unidadeUpper,
            total: 999, 
            novos: 1,
            timestamp: new Date()
        });

        res.json({ message: `Teste enviado para ${unidadeUpper}` });
    } catch (error) {
        console.error("Erro teste:", error);
        res.status(500).json({ error: "Erro interno." });
    }
};

export const getActiveConfig = async (req, res) => {
    const { unidade } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM scoreboard_active WHERE unidade = ?', [unidade.toUpperCase()]);
        if (rows.length === 0) return res.status(404).json({ error: 'Configuração não encontrada.' });
        
        const config = rows[0];
        if (typeof config.opcoes === 'string') config.opcoes = JSON.parse(config.opcoes);
        
        res.json(config);
    } catch (err) {
        console.error("Erro config:", err);
        res.status(500).json({ error: err.message });
    }
};

export const updateActiveConfig = async (req, res) => {
    const { unidade, titulo, layout, opcoes, status } = req.body;
    if (!unidade || !titulo || !opcoes) return res.status(400).json({ error: "Dados incompletos." });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const opcoesString = JSON.stringify(opcoes);
        const unidadeUpper = unidade.toUpperCase();

        const sql = `
            INSERT INTO scoreboard_active (unidade, titulo, layout, opcoes, status)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            titulo = VALUES(titulo), layout = VALUES(layout), opcoes = VALUES(opcoes), status = VALUES(status)
        `;

        await connection.query(sql, [unidadeUpper, titulo, layout, opcoesString, status]);
        // Zera votos ao mudar a configuração (opcional, mas recomendado)
        await connection.query('DELETE FROM scoreboard_votes WHERE unidade = ?', [unidadeUpper]);
        
        await connection.commit();

        const io = getIO();
        io.emit('scoreboard:config_updated', { unidade: unidadeUpper });
        io.emit('scoreboard:vote_updated', { unidade: unidadeUpper, votes: [] });

        res.json({ message: "Placar atualizado!" });
    } catch (err) {
        await connection.rollback();
        console.error("Erro update:", err);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
};

export const castVote = async (req, res) => {
    const { unidade, optionIndex } = req.body;
    if (!unidade || optionIndex === undefined) return res.status(400).json({ error: "Voto inválido." });

    try {
        await pool.query('INSERT INTO scoreboard_votes (unidade, option_index) VALUES (?, ?)', [unidade.toUpperCase(), optionIndex]);
        
        const io = getIO();
        // Retorna a contagem agrupada por índice
        const [rows] = await pool.query('SELECT option_index, COUNT(*) as count FROM scoreboard_votes WHERE unidade = ? GROUP BY option_index', [unidade.toUpperCase()]);
        
        io.emit('scoreboard:vote_updated', { unidade: unidade.toUpperCase(), votes: rows });
        res.json({ message: "Voto computado." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getVotes = async (req, res) => {
    const { unidade } = req.params;
    try {
        const [rows] = await pool.query('SELECT option_index, COUNT(*) as count FROM scoreboard_votes WHERE unidade = ? GROUP BY option_index', [unidade.toUpperCase()]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const resetVotes = async (req, res) => {
    const { unidade } = req.body;
    try {
        await pool.query('DELETE FROM scoreboard_votes WHERE unidade = ?', [unidade.toUpperCase()]);
        const io = getIO();
        io.emit('scoreboard:vote_updated', { unidade: unidade.toUpperCase(), votes: [] });
        res.json({ message: "Votos zerados." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- [MODIFICADO] Salvar Preset com Unidade ---
export const savePreset = async (req, res) => {
    const { unidade, titulo_preset, titulo_placar, layout, opcoes } = req.body;
    // Garante que a unidade esteja em maiúsculo, padrão SP
    const unidadeUpper = unidade ? unidade.toUpperCase() : 'SP';

    try {
        await pool.query(
            'INSERT INTO scoreboard_presets (unidade, titulo_preset, titulo_placar, layout, opcoes) VALUES (?, ?, ?, ?, ?)',
            [unidadeUpper, titulo_preset, titulo_placar, layout, JSON.stringify(opcoes)]
        );
        res.json({ message: "Preset salvo." });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
};

// --- [MODIFICADO] Buscar Presets filtrados por Unidade ---
export const getPresets = async (req, res) => {
    // Recebe a unidade via parâmetro (configurado na rota como /presets/:unidade)
    const { unidade } = req.params;
    const unidadeUpper = unidade ? unidade.toUpperCase() : 'SP';

    try {
        const [rows] = await pool.query(
            'SELECT * FROM scoreboard_presets WHERE unidade = ? ORDER BY id DESC', 
            [unidadeUpper]
        );
        const formatted = rows.map(r => ({ 
            ...r, 
            opcoes: (typeof r.opcoes === 'string') ? JSON.parse(r.opcoes) : r.opcoes 
        }));
        res.json(formatted);
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
};

export const deletePreset = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM scoreboard_presets WHERE id = ?', [id]);
        res.json({ message: "Preset excluído." });
    } catch (err) { res.status(500).json({ error: err.message }); }
};