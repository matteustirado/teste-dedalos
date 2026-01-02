import pool from '../config/db.js';
import { getIO } from '../socket.js';

// --- CONFIGURAÇÃO ATIVA ---

export const getActiveConfig = async (req, res) => {
    const { unidade } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM scoreboard_active WHERE unidade = ?', [unidade.toUpperCase()]);
        if (rows.length === 0) return res.status(404).json({ error: 'Configuração não encontrada.' });
        
        // Parse do JSON de opções se vier como string
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
    
    // Validação básica
    if (!unidade || !titulo || !opcoes) {
        return res.status(400).json({ error: "Dados incompletos." });
    }

    try {
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

        await pool.query(sql, [unidadeUpper, titulo, layout, opcoesString, status]);

        // Ao mudar a configuração, resetamos os votos antigos para não misturar dados?
        // Por segurança, vamos apenas notificar. O Admin pode clicar em "Zerar Votos" separadamente se quiser.
        
        // Notifica via Socket que a configuração mudou (Telas atualizam sozinhas)
        const io = getIO();
        io.emit('scoreboard:config_updated', { unidade: unidadeUpper });

        res.json({ message: "Placar atualizado com sucesso!" });
    } catch (err) {
        console.error("Erro ao atualizar placar:", err);
        res.status(500).json({ error: err.message });
    }
};

// --- VOTOS ---

export const castVote = async (req, res) => {
    const { unidade, optionIndex } = req.body;

    if (!unidade || optionIndex === undefined) {
        return res.status(400).json({ error: "Dados de voto inválidos." });
    }

    try {
        await pool.query('INSERT INTO scoreboard_votes (unidade, option_index) VALUES (?, ?)', [unidade.toUpperCase(), optionIndex]);
        
        // Emite atualização em tempo real para o Placar (TV)
        const io = getIO();
        
        // Para otimizar, podíamos mandar só o novo voto, mas mandar o total garante consistência
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

// --- PRESETS (PREDEFINIÇÕES) ---

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