import pool from '../config/db.js';
import { io } from '../../server.js'; // Importação essencial para o tempo real
import ytdl from 'ytdl-core'; // Biblioteca padrão para info do YouTube

// --- LISTAR TODAS AS MÚSICAS ---
export const getTracks = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM tracks ORDER BY created_at DESC');
        
        // Garante que campos JSON voltem como objetos (caso o driver MySQL não converta autom.)
        const processedRows = rows.map(track => ({
            ...track,
            artistas_participantes: typeof track.artistas_participantes === 'string' 
                ? JSON.parse(track.artistas_participantes) 
                : track.artistas_participantes,
            dias_semana: typeof track.dias_semana === 'string' 
                ? JSON.parse(track.dias_semana) 
                : track.dias_semana
        }));

        res.json(processedRows);
    } catch (error) {
        console.error("Erro ao buscar músicas:", error);
        res.status(500).json({ error: "Erro ao carregar o acervo." });
    }
};

// --- IMPORTAR (SALVAR) NOVA MÚSICA ---
export const importTrack = async (req, res) => {
    const {
        youtube_id, titulo, artista, artistas_participantes,
        album, ano, gravadora, diretor, thumbnail_url,
        duracao_segundos, start_segundos, end_segundos,
        is_commercial, dias_semana
    } = req.body;

    try {
        const [result] = await pool.query(
            `INSERT INTO tracks (
                youtube_id, titulo, artista, artistas_participantes,
                album, ano, gravadora, diretor, thumbnail_url,
                duracao_segundos, start_segundos, end_segundos,
                is_commercial, dias_semana, status_processamento
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PROCESSADO')`,
            [
                youtube_id, 
                titulo, 
                artista, 
                JSON.stringify(artistas_participantes || []),
                album || null, 
                ano || null, 
                gravadora || null, 
                diretor || null, 
                thumbnail_url,
                duracao_segundos, 
                start_segundos || 0, 
                end_segundos || duracao_segundos,
                is_commercial ? 1 : 0, 
                JSON.stringify(dias_semana || [0,1,2,3,4,5,6])
            ]
        );

        // [IMPORTANTE] Avisa a todos os clientes (Jukebox) que o acervo mudou
        io.emit('acervo:atualizado');
        
        res.status(201).json({ message: 'Música adicionada com sucesso!', id: result.insertId });
    } catch (error) {
        console.error("Erro ao salvar música:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Esta música já existe no acervo (YouTube ID duplicado).' });
        }
        res.status(500).json({ error: 'Erro interno ao salvar música.' });
    }
};

// --- ATUALIZAR MÚSICA EXISTENTE ---
export const updateTrack = async (req, res) => {
    const { id } = req.params;
    const {
        titulo, artista, artistas_participantes,
        album, ano, gravadora, diretor,
        start_segundos, end_segundos,
        is_commercial, dias_semana
    } = req.body;

    try {
        await pool.query(
            `UPDATE tracks SET 
                titulo=?, artista=?, artistas_participantes=?,
                album=?, ano=?, gravadora=?, diretor=?,
                start_segundos=?, end_segundos=?,
                is_commercial=?, dias_semana=?
             WHERE id=?`,
            [
                titulo, 
                artista, 
                JSON.stringify(artistas_participantes || []),
                album || null, 
                ano || null, 
                gravadora || null, 
                diretor || null,
                start_segundos, 
                end_segundos,
                is_commercial ? 1 : 0, 
                JSON.stringify(dias_semana),
                id
            ]
        );

        // [IMPORTANTE] Avisa a todos os clientes que houve alteração
        io.emit('acervo:atualizado');

        res.json({ message: 'Música atualizada com sucesso!' });
    } catch (error) {
        console.error("Erro ao atualizar música:", error);
        res.status(500).json({ error: 'Erro ao atualizar música.' });
    }
};

// --- EXCLUIR MÚSICA ---
export const deleteTrack = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM tracks WHERE id = ?', [id]);
        
        // [IMPORTANTE] Avisa que uma música foi removida
        io.emit('acervo:atualizado');

        res.json({ message: 'Música excluída com sucesso.' });
    } catch (error) {
        console.error("Erro ao excluir:", error);
        res.status(500).json({ error: "Erro ao excluir música." });
    }
};

// --- EXCLUIR EM LOTE ---
export const deleteTracksBatch = async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Nenhum ID fornecido.' });
    }

    try {
        // Cria string de placeholders (?,?,?) baseado no tamanho do array
        const placeholders = ids.map(() => '?').join(',');
        await pool.query(`DELETE FROM tracks WHERE id IN (${placeholders})`, ids);

        // [IMPORTANTE] Avisa sobre a exclusão em massa
        io.emit('acervo:atualizado');

        res.json({ message: 'Músicas excluídas com sucesso.' });
    } catch (error) {
        console.error("Erro ao excluir lote:", error);
        res.status(500).json({ error: 'Erro ao excluir músicas.' });
    }
};

// --- BUSCAR DADOS DO YOUTUBE (Para preencher o formulário) ---
export const fetchYoutubeData = async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL é obrigatória" });

    try {
        const info = await ytdl.getBasicInfo(url);
        
        const videoDetails = info.videoDetails;
        const thumbnail = videoDetails.thumbnails.sort((a, b) => b.width - a.width)[0]?.url;

        res.json({
            youtube_id: videoDetails.videoId,
            titulo: videoDetails.title,
            artista: videoDetails.author.name, // Tentativa automática, usuário pode editar
            duracao_segundos: parseInt(videoDetails.lengthSeconds),
            thumbnail_url: thumbnail
        });
    } catch (error) {
        console.error("Erro no ytdl:", error);
        res.status(500).json({ error: "Não foi possível obter dados do vídeo. Verifique a URL." });
    }
};