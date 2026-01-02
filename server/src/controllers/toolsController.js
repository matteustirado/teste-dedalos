import pool from '../config/db.js';
import axios from 'axios';

// --- FUNÇÃO 1: SALVAR HISTÓRICO (Finalizar Promoção) ---
export const salvarHistorico = async (req, res) => {
    try {
        const { tipo, unidade, total_sorteados, total_resgatados, detalhes } = req.body;

        if (!tipo || !unidade) {
            return res.status(400).json({ error: "Campos obrigatórios: tipo e unidade" });
        }

        // Converte o objeto/array para string JSON antes de salvar
        const detalhesString = JSON.stringify(detalhes || []);

        const query = `
            INSERT INTO historico_promocoes 
            (tipo, unidade, total_sorteados, total_resgatados, detalhes)
            VALUES (?, ?, ?, ?, ?)
        `;

        await pool.query(query, [
            tipo, 
            unidade, 
            total_sorteados || 0, 
            total_resgatados || 0, 
            detalhesString
        ]);

        res.status(201).json({ message: "Histórico salvo com sucesso!" });

    } catch (error) {
        console.error("❌ Erro ao salvar histórico:", error);
        res.status(500).json({ error: "Erro interno ao salvar no banco." });
    }
};

// --- FUNÇÃO 2: LISTAR HISTÓRICO ---
export const listarHistorico = async (req, res) => {
    try {
        const { unidade, tipo } = req.params;

        const query = `
            SELECT * FROM historico_promocoes
            WHERE unidade = ? AND tipo = ?
            ORDER BY data_hora DESC
            LIMIT 50
        `;

        const [rows] = await pool.query(query, [unidade, tipo]);

        const historicoFormatado = rows.map(row => ({
            ...row,
            detalhes: typeof row.detalhes === 'string' ? JSON.parse(row.detalhes) : row.detalhes
        }));

        res.json(historicoFormatado);

    } catch (error) {
        console.error("❌ Erro ao listar histórico:", error);
        res.status(500).json({ error: "Erro interno ao buscar histórico." });
    }
};

// --- FUNÇÃO 3: BUSCAR CLIENTE (Proxy para API Externa) ---
export const buscarClientePorPulseira = async (req, res) => {
    const { pulseira } = req.params;
    
    // Tokens e URLs (hardcoded como fallback se não houver .env)
    const TOKEN = process.env.DEDALOS_API_TOKEN || "7a9e64071564f6fee8d96cd209ed3a4e86801552";
    const BASE_URL = "https://dedalosadm2-3dab78314381.herokuapp.com/";

    try {
        const endpoint = `${BASE_URL}api/entradasOne/${pulseira}/`;
        console.log(`[BACKEND] Proxy consultando pulseira ${pulseira}`);

        const response = await axios.get(endpoint, {
            headers: {
                "Authorization": `Token ${TOKEN}`,
                "Content-Type": "application/json"
            }
        });

        return res.status(200).json(response.data);

    } catch (error) {
        console.error("Erro na API Externa:", error.message);
        
        if (error.response) {
            // Se a API externa respondeu (ex: 404), repassa o erro
            return res.status(error.response.status).json(error.response.data);
        }
        
        return res.status(500).json({ message: "Erro interno ao conectar com API Dedalos." });
    }
};