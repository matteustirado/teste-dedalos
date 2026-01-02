import pool from '../config/db.js';
import { getIO } from '../socket.js';

// =====================================================================
// 📡 SENTINELA DE CHECK-INS (Monitoramento Ativo)
// =====================================================================

const CHECKIN_INTERVAL = 5000; // 5 segundos
let lastCheckinCount = { SP: null, BH: null };

// Configuração lida do .env do servidor (process.env)
const SENTINELA_CONFIG = {
    SP: {
        url: process.env.VITE_API_URL_SP,
        token: process.env.VITE_API_TOKEN_SP
    },
    BH: {
        url: process.env.VITE_API_URL_BH,
        token: process.env.VITE_API_TOKEN_BH
    }
};

const iniciarSentinela = () => {
    console.log("📡 Sentinela de Check-ins iniciado...");

    setInterval(async () => {
        const unidades = ['SP', 'BH'];

        for (const unidade of unidades) {
            const config = SENTINELA_CONFIG[unidade];
            // Se não tiver config no env, pula
            if (!config || !config.url || !config.token) continue;

            try {
                // Formata data YYYY-MM-DD
                const dataHoje = new Date().toISOString().split('T')[0];
                
                // Garante URL limpa e monta endpoint
                const baseUrl = config.url.replace(/\/$/, "");
                const endpoint = `${baseUrl}/api/entradasPorData/${dataHoje}`;

                // Faz a requisição para a API externa
                const response = await fetch(endpoint, {
                    headers: { "Authorization": `Token ${config.token}` }
                });

                if (response.ok) {
                    const dados = await response.json();
                    // API Dedalos retorna array ou objeto com results
                    const listaEntradas = Array.isArray(dados) ? dados : (dados.results || []);
                    const totalAtual = listaEntradas.length;

                    // 1. Primeira execução: Apenas define a linha de base
                    if (lastCheckinCount[unidade] === null) {
                        lastCheckinCount[unidade] = totalAtual;
                        continue;
                    }

                    // 2. Detectou aumento (Novo Check-in!)
                    if (totalAtual > lastCheckinCount[unidade]) {
                        console.log(`🚨 [Sentinela] NOVO CHECK-IN DETECTADO EM ${unidade}! (${lastCheckinCount[unidade]} -> ${totalAtual})`);
                        
                        const io = getIO();
                        
                        // DISPARA EVENTO PARA O FRONTEND (GAME/DISPLAY)
                        io.emit('checkin:novo', { 
                            unidade: unidade, // 'SP' ou 'BH'
                            total: totalAtual,
                            timestamp: new Date()
                        });

                        lastCheckinCount[unidade] = totalAtual;
                    }
                }
            } catch (error) {
                // Erros silenciosos de rede para não spamar o log
            }
        }
    }, CHECKIN_INTERVAL);
};

// Inicia o loop assim que o arquivo é carregado
iniciarSentinela();


// =====================================================================
// 🎮 CONTROLLERS DO SCOREBOARD (MANTIDOS IGUAIS)
// =====================================================================

export const getActiveConfig = async (req, res) => {
    const { unidade } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM scoreboard_active WHERE unidade = ?', [unidade.toUpperCase()]);
        if (rows.length === 0) return res.status(404).json({ error: 'Configuração não encontrada.' });
        
        const config = rows[0];
        if (typeof config.opcoes === 'string') config.opcoes = JSON.parse(config.opcoes);
        
        res.json(config);
    } catch (err) {
        console.error("Erro ao buscar config ativa:", err);
        res.status(500).json({ error: err.message });
    }
};

export const updateActiveConfig = async (req, res) => {
    const { unidade, titulo, layout, opcoes, status } = req.body;
    
    if (!unidade || !titulo || !opcoes) {
        return res.status(400).json({ error: "Dados incompletos." });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const opcoesString = JSON.stringify(opcoes);
        const unidadeUpper = unidade.toUpperCase();

        const sql = `
            INSERT INTO scoreboard_active (unidade, titulo, layout, opcoes, status)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            titulo = VALUES(titulo),
            layout = VALUES(layout),
            opcoes = VALUES(opcoes),
            status = VALUES(status)
        `;

        await connection.query(sql, [unidadeUpper, titulo, layout, opcoesString, status]);
        await connection.query('DELETE FROM scoreboard_votes WHERE unidade = ?', [unidadeUpper]);
        await connection.commit();

        const io = getIO();
        io.emit('scoreboard:config_updated', { unidade: unidadeUpper });
        io.emit('scoreboard:vote_updated', { unidade: unidadeUpper, votes: [] });

        console.log(`[Scoreboard] Configuração atualizada e votos zerados para ${unidadeUpper}`);
        res.json({ message: "Placar atualizado e votos reiniciados com sucesso!" });

    } catch (err) {
        await connection.rollback();
        console.error("Erro ao atualizar placar:", err);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
};

export const castVote = async (req, res) => {
    const { unidade, optionIndex } = req.body;
    const idx = optionIndex !== undefined ? optionIndex : null;

    if (!unidade || idx === null) {
        return res.status(400).json({ error: "Dados de voto inválidos." });
    }

    try {
        await pool.query('INSERT INTO scoreboard_votes (unidade, option_index) VALUES (?, ?)', [unidade.toUpperCase(), idx]);
        
        const io = getIO();
        const [rows] = await pool.query(
            'SELECT option_index, COUNT(*) as count FROM scoreboard_votes WHERE unidade = ? GROUP BY option_index', 
            [unidade.toUpperCase()]
        );
        
        io.emit('scoreboard:vote_updated', { unidade: unidade.toUpperCase(), votes: rows });

        res.json({ message: "Voto computado." });
    } catch (err) {
        console.error("Erro ao votar:", err);
        res.status(500).json({ error: err.message });
    }
};

export const getVotes = async (req, res) => {
    const { unidade } = req.params;
    try {
        const [rows] = await pool.query(
            'SELECT option_index, COUNT(*) as count FROM scoreboard_votes WHERE unidade = ? GROUP BY option_index', 
            [unidade.toUpperCase()]
        );
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

export const savePreset = async (req, res) => {
    const { titulo_preset, titulo_placar, layout, opcoes } = req.body;
    try {
        await pool.query(
            'INSERT INTO scoreboard_presets (titulo_preset, titulo_placar, layout, opcoes) VALUES (?, ?, ?, ?)',
            [titulo_preset, titulo_placar, layout, JSON.stringify(opcoes)]
        );
        res.json({ message: "Predefinição salva." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getPresets = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM scoreboard_presets ORDER BY id DESC');
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
        res.json({ message: "Predefinição excluída." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};