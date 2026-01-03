import pool from '../config/db.js';
import path from 'path';
import fs from 'fs';

// ==========================================
// 📅 LÓGICA DE FERIADOS
// ==========================================

export const getHolidays = async (req, res) => {
    const { unidade } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM holidays WHERE unidade = ? ORDER BY data_feriado ASC', [unidade.toUpperCase()]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const addHoliday = async (req, res) => {
    const { unidade, nome, data_feriado } = req.body;
    try {
        await pool.query('INSERT INTO holidays (unidade, nome, data_feriado) VALUES (?, ?, ?)', [unidade.toUpperCase(), nome, data_feriado]);
        res.json({ message: "Feriado adicionado!" });
    } catch (err) {
        res.status(500).json({ error: "Erro ao adicionar (Verifique se a data já existe)." });
    }
};

export const deleteHoliday = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM holidays WHERE id = ?', [id]);
        res.json({ message: "Feriado removido." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 💰 LÓGICA DE PREÇOS
// ==========================================

// --- GET (EDITOR): Busca uma configuração específica (Ex: Só FDS) ---
export const getPriceConfigByType = async (req, res) => {
    const { unidade, tipo } = req.params; // tipo: 'padrao', 'fim_de_semana', 'feriado'
    try {
        const [rows] = await pool.query('SELECT * FROM prices_active WHERE unidade = ? AND tipo = ?', [unidade.toUpperCase(), tipo]);
        
        if (rows.length === 0) {
            // Retorna objeto vazio padronizado se não achar
            return res.json({
                unidade: unidade.toUpperCase(),
                tipo: tipo,
                titulo_tabela: 'Nova Tabela',
                qtd_categorias: 3,
                modo_exibicao: 'tv',
                aviso_1: '', aviso_2: '', aviso_3: '', aviso_4: '', // <--- [ATUALIZADO] 4 Avisos
                categorias: []
            });
        }

        const config = rows[0];
        if (typeof config.categorias === 'string') config.categorias = JSON.parse(config.categorias);
        res.json(config);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- POST (EDITOR): Salva uma configuração específica ---
export const updatePriceConfig = async (req, res) => {
    // [ATUALIZADO] Recebe aviso_3 e aviso_4
    const { unidade, tipo, titulo_tabela, qtd_categorias, modo_exibicao, aviso_1, aviso_2, aviso_3, aviso_4, categorias } = req.body;

    if (!unidade || !tipo) return res.status(400).json({ error: "Dados incompletos." });

    try {
        const categoriasJson = JSON.stringify(categorias);
        const unidadeUpper = unidade.toUpperCase();

        const sql = `
            INSERT INTO prices_active (unidade, tipo, titulo_tabela, qtd_categorias, modo_exibicao, aviso_1, aviso_2, aviso_3, aviso_4, categorias)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            titulo_tabela = VALUES(titulo_tabela),
            qtd_categorias = VALUES(qtd_categorias),
            modo_exibicao = VALUES(modo_exibicao),
            aviso_1 = VALUES(aviso_1),
            aviso_2 = VALUES(aviso_2),
            aviso_3 = VALUES(aviso_3), -- <--- [NOVO]
            aviso_4 = VALUES(aviso_4), -- <--- [NOVO]
            categorias = VALUES(categorias)
        `;

        await pool.query(sql, [unidadeUpper, tipo, titulo_tabela, qtd_categorias, modo_exibicao, aviso_1, aviso_2, aviso_3, aviso_4, categoriasJson]);
        res.json({ message: "Tabela salva com sucesso!" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// --- GET (DISPLAY): O "Cérebro" que decide qual tabela mostrar ---
export const getActiveDisplayPrice = async (req, res) => {
    const { unidade } = req.params;
    const unidadeUpper = unidade.toUpperCase();
    
    // Data de hoje (Servidor)
    const hoje = new Date();
    // Ajuste fuso horário Brasil (-3) se necessário, ou usar string ISO Date YYYY-MM-DD
    const dataIso = hoje.toISOString().split('T')[0]; // YYYY-MM-DD
    const diaSemana = hoje.getDay(); // 0 = Domingo, 1 = Segunda ... 5 = Sexta, 6 = Sábado

    try {
        let tipoAtivo = 'padrao'; // Default: Seg a Qui

        // 1. Verifica se é FERIADO
        const [feriados] = await pool.query('SELECT * FROM holidays WHERE unidade = ? AND data_feriado = ?', [unidadeUpper, dataIso]);
        
        if (feriados.length > 0) {
            tipoAtivo = 'feriado';
        } else {
            // 2. Verifica se é FIM DE SEMANA (Sex, Sab, Dom)
            // Sex(5), Sab(6), Dom(0)
            if (diaSemana === 0 || diaSemana === 5 || diaSemana === 6) {
                tipoAtivo = 'fim_de_semana';
            }
        }

        // 3. Busca a tabela correta baseada na lógica acima
        const [rows] = await pool.query('SELECT * FROM prices_active WHERE unidade = ? AND tipo = ?', [unidadeUpper, tipoAtivo]);

        if (rows.length === 0) return res.status(404).json({ error: "Nenhuma tabela configurada." });

        const config = rows[0];
        if (typeof config.categorias === 'string') config.categorias = JSON.parse(config.categorias);
        
        // Adiciona info extra para o frontend saber o motivo
        config.debug_info = {
            data: dataIso,
            dia_semana: diaSemana,
            tipo_detectado: tipoAtivo
        };

        res.json(config);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const uploadPriceMedia = async (req, res) => {
    if (!req.files || !req.files.priceMedia) return res.status(400).json({ error: "Nenhum arquivo." });

    const file = req.files.priceMedia;
    const uploadPath = path.join(process.cwd(), 'public', 'uploads', 'prices');

    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

    const fileName = `price_${Date.now()}${path.extname(file.name)}`;
    file.mv(path.join(uploadPath, fileName), (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ url: `/uploads/prices/${fileName}` });
    });
};