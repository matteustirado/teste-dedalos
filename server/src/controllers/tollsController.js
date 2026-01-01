import pool from '../config/db.js';

// Salvar um novo histórico
export const salvarHistorico = async (req, res) => {
    console.log("--> [TOOLS] Recebendo pedido de salvamento de histórico...");
    
    try {
        const { tipo, unidade, total_sorteados, total_resgatados, detalhes = [] } = req.body;
        
        // Validação básica
        if (!tipo || !unidade) {
            return res.status(400).json({ error: "Dados incompletos (tipo ou unidade faltando)." });
        }

        // Serializar JSON para salvar no banco
        const detalhesString = JSON.stringify(detalhes);

        const sql = `
            INSERT INTO historico_promocoes 
            (tipo, unidade, total_sorteados, total_resgatados, detalhes) 
            VALUES (?, ?, ?, ?, ?)
        `;
        
        const [result] = await pool.query(sql, [tipo, unidade, total_sorteados, total_resgatados, detalhesString]);
        
        // Conversão de BigInt para evitar travamento do JSON
        const insertId = result.insertId 
            ? (typeof result.insertId === 'bigint' ? result.insertId.toString() : result.insertId)
            : 0;

        console.log(`--> [TOOLS] Salvo com sucesso! ID: ${insertId}`);
        
        res.status(200).json({ id: insertId, message: "Histórico salvo com sucesso." });

    } catch (err) {
        console.error("--> [TOOLS] CRITICAL ERROR ao salvar:", err);
        res.status(500).json({ error: "Erro interno no servidor ao salvar.", details: err.toString() });
    }
};

// Buscar histórico
export const listarHistorico = async (req, res) => {
    try {
        const { unidade, tipo } = req.params;
        
        const sql = `
            SELECT * FROM historico_promocoes 
            WHERE unidade = ? AND tipo = ? 
            ORDER BY data_hora DESC 
            LIMIT 50
        `;
        
        const [rows] = await pool.query(sql, [unidade, tipo]);
        
        const formatado = rows.map(row => {
            // Conversão de ID BigInt
            if (row.id && typeof row.id === 'bigint') {
                row.id = row.id.toString();
            }

            // Parse seguro do JSON
            let parsedDetalhes = [];
            try {
                if (typeof row.detalhes === 'string') {
                    parsedDetalhes = JSON.parse(row.detalhes);
                } else if (row.detalhes) {
                    parsedDetalhes = row.detalhes;
                }
            } catch (e) {
                console.error("Erro parse JSON db:", e);
            }

            return { ...row, detalhes: parsedDetalhes };
        });
        
        res.json(formatado);

    } catch (err) {
        console.error("--> [TOOLS] Erro ao listar:", err);
        res.status(500).json({ error: "Erro ao buscar histórico." });
    }
};  