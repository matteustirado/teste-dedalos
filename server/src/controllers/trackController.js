import pool from '../config/db.js'
import axios from 'axios'
import YtDlpWrap from 'yt-dlp-wrap'
import ffmpeg from 'fluent-ffmpeg'
import { getIO } from '../socket.js'; // ALTERAÇÃO: Importa o socket corretamente

const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/videos'
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
const ytDlpWrap = new YtDlpWrap.default()

const ALL_DAYS_ARRAY = [0, 1, 2, 3, 4, 5, 6];

const parseYoutubeUrl = (url) => {
  try {
    const videoUrl = new URL(url)
    if (videoUrl.hostname === 'youtu.be') {
      return videoUrl.pathname.slice(1)
    }
    if (videoUrl.hostname.includes('youtube.com')) {
      return videoUrl.searchParams.get('v')
    }
    return null
  } catch (error) {
    return null
  }
}

const parseISODuration = (isoDuration) => {
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/
  const matches = isoDuration.match(regex)

  const hours = parseInt(matches[1] || 0)
  const minutes = parseInt(matches[2] || 0)
  const seconds = parseInt(matches[3] || 0)

  return (hours * 3600) + (minutes * 60) + seconds
}

export const fetchYoutubeData = async (req, res) => {
  const { url } = req.body
  const youtubeId = parseYoutubeUrl(url)

  if (!youtubeId) {
    return res.status(400).json({ error: 'URL do YouTube inválida.' })
  }

  try {
    const [existing] = await pool.query('SELECT id FROM tracks WHERE youtube_id = ?', [youtubeId])
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Esta música já existe no acervo.' })
    }

    const response = await axios.get(YOUTUBE_API_URL, {
      params: {
        part: 'snippet,contentDetails',
        id: youtubeId,
        key: YOUTUBE_API_KEY
      }
    })

    if (response.data.items.length === 0) {
      return res.status(404).json({ error: 'Vídeo não encontrado no YouTube.' })
    }

    const item = response.data.items[0]
    const snippet = item.snippet
    const durationInSeconds = parseISODuration(item.contentDetails.duration)

    let thumbnailUrl = null;
    if (snippet.thumbnails) {
        thumbnailUrl = snippet.thumbnails.high?.url || snippet.thumbnails.medium?.url || snippet.thumbnails.default?.url || null;
    }

    const videoData = {
      youtube_id: youtubeId,
      titulo: snippet.title,
      artista: snippet.channelTitle,
      duracao_segundos: durationInSeconds,
      end_segundos: durationInSeconds,
      thumbnail_url: thumbnailUrl
    }

    res.json(videoData)

  } catch (err) {
    console.error("fetchYoutubeData - Erro:", err.message);
    const errorMsg = err.response?.data?.error || 'Erro ao buscar dados do YouTube.'
    res.status(500).json({ error: errorMsg })
  }
}

const analyzeLoudness = async (trackId, youtubeId) => {
  console.log(`[Loudness] Iniciando análise para track ID: ${trackId} (YT: ${youtubeId})`)

  try {
    const videoUrl = `http://www.youtube.com/watch?v=${youtubeId}`

    const rawOutput = await ytDlpWrap.execPromise([
      videoUrl,
      '--dump-single-json',
      '--no-warnings',
      '--quiet'
    ])

    const jsonStartIndex = rawOutput.indexOf('{')

    if (jsonStartIndex === -1) {
      throw new Error('Nenhum JSON válido encontrado na saída do yt-dlp.')
    }

    const jsonString = rawOutput.substring(jsonStartIndex)
    const metadata = JSON.parse(jsonString)

    const audioFormat = metadata.formats.find(
      f => f.acodec !== 'none' && f.vcodec === 'none' && (f.ext === 'm4a' || f.ext === 'opus')
    ) || metadata.formats.find(f => f.acodec !== 'none' && f.vcodec === 'none')

    if (!audioFormat) {
      throw new Error('Nenhum formato de áudio adequado foi encontrado.')
    }

    const audioUrl = audioFormat.url

    const loudness = await new Promise((resolve, reject) => {
      let loudnessValue = null

      ffmpeg(audioUrl)
        .withAudioFilter('ebur128')
        .on('stderr', (stderrLine) => {
          if (stderrLine.includes('I:')) {
            const match = stderrLine.match(/I:\s*(-?[\d\.]+)\s*LUFS/)
            if (match && match[1]) {
              loudnessValue = parseFloat(match[1])
            }
          }
        })
        .on('error', (err) => {
          reject(new Error(`Erro no FFmpeg: ${err.message}`))
        })
        .on('end', () => {
          if (loudnessValue !== null) {
            resolve(loudnessValue)
          } else {
            reject(new Error('Análise do FFmpeg concluída, mas valor de loudness não foi extraído.'))
          }
        })
        .format('null')
        .save('-')
    })

    await pool.query(
      'UPDATE tracks SET loudness_lufs = ?, status_processamento = "PROCESSADO" WHERE id = ?',
      [loudness, trackId]
    )
    console.log(`[Loudness] Sucesso (Track ${trackId}): ${loudness} LUFS`)
    
    // ALTERAÇÃO: Atualiza a lista na tela quando terminar de processar
    try { getIO().emit('acervo:atualizado'); } catch(e) {}

  } catch (err) {
    console.error(`[Loudness] Falha (Track ${trackId}):`, err.message)
    try {
      await pool.query(
        'UPDATE tracks SET status_processamento = "ERRO" WHERE id = ?',
        [trackId]
      )
      // ALTERAÇÃO: Atualiza a lista na tela em caso de erro também
      try { getIO().emit('acervo:atualizado'); } catch(e) {}
    } catch (dbError) {
      console.error(`[Loudness] Falha ao marcar ERRO no DB (Track ${trackId}):`, dbError.message)
    }
  }
}

export const addTrack = async (req, res) => {
  const {
    youtube_id,
    titulo,
    artista,
    artistas_participantes,
    album,
    ano, 
    gravadora,
    diretor,
    thumbnail_url,
    duracao_segundos,
    start_segundos,
    end_segundos,
    is_commercial,
    dias_semana 
  } = req.body;

  if (!youtube_id || !titulo || !artista) {
    return res.status(400).json({ error: 'YouTube ID, Título e Artista são obrigatórios.'})
  }

  let processedAno = null; 
  if (ano !== '' && ano != null) {
    const anoInt = parseInt(ano, 10);
    if (!isNaN(anoInt)) { processedAno = anoInt; }
  }
  
  const diasSemanaArray = (Array.isArray(dias_semana) && dias_semana.length > 0)
    ? dias_semana
    : ALL_DAYS_ARRAY;
  
  let stringifiedDiasSemana;
  try {
      stringifiedDiasSemana = JSON.stringify(diasSemanaArray);
  } catch (stringifyErr) {
     console.error("Erro Crítico: Falha ao stringificar diasSemanaArray em addTrack:", stringifyErr);
     stringifiedDiasSemana = JSON.stringify(ALL_DAYS_ARRAY);
  }

  try {
    const newTrack = {
      youtube_id,
      titulo,
      artista,
      artistas_participantes: JSON.stringify(artistas_participantes || []),
      album,
      ano: processedAno, 
      gravadora,
      diretor,
      thumbnail_url: thumbnail_url || null,
      duracao_segundos,
      start_segundos,
      end_segundos,
      is_commercial,
      dias_semana: stringifiedDiasSemana,
      status_processamento: 'PENDENTE'
    }

    const [result] = await pool.query('INSERT INTO tracks SET ?', newTrack)

    // ALTERAÇÃO: Emite evento para atualizar o frontend
    getIO().emit('acervo:atualizado');

    res.status(201).json({ message: 'Música adicionada! Iniciando análise de áudio.', id: result.insertId })

    analyzeLoudness(result.insertId, youtube_id)

  } catch (err) {
    console.error("addTrack - Erro durante INSERT:", err);
    res.status(500).json({ error: 'Erro ao salvar dados no banco.' })
  }
}


const safeJsonParse = (input) => {
  if (Array.isArray(input)) {
    return input;
  }

  if (!input || typeof input !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("safeJsonParse - Erro no parse da string:", e, "- String original:", input);
    return [];
  }
};

export const listTracks = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tracks ORDER BY created_at DESC');
    
    const processedRows = rows.map(track => ({
      ...track,
      artistas_participantes: safeJsonParse(track.artistas_participantes),
      dias_semana: safeJsonParse(track.dias_semana)
    }));
    
    res.json(processedRows);
  } catch (err) {
    console.error("listTracks - Erro:", err);
    res.status(500).json({ error: err.message });
  }
};

export const updateTrack = async (req, res) => {
  const { id } = req.params
  const { 
    titulo,
    artista,
    artistas_participantes,
    album,
    ano, 
    gravadora,
    diretor,
    thumbnail_url,
    start_segundos,
    end_segundos,
    is_commercial,
    dias_semana 
  } = req.body;

  let processedAno = null; 
  if (ano !== '' && ano != null) {
     const anoInt = parseInt(ano, 10);
    if (!isNaN(anoInt)) { processedAno = anoInt; }
  }

  const diasSemanaArray = (Array.isArray(dias_semana) && dias_semana.length > 0)
    ? dias_semana
    : ALL_DAYS_ARRAY;

  let stringifiedDiasSemana;
  try {
      stringifiedDiasSemana = JSON.stringify(diasSemanaArray);
  } catch (stringifyErr) {
     console.error("Erro Crítico: Falha ao stringificar diasSemanaArray em updateTrack:", stringifyErr);
     stringifiedDiasSemana = JSON.stringify(ALL_DAYS_ARRAY);
  }

  try {
    const fieldsToUpdate = {
      titulo,
      artista,
      artistas_participantes: JSON.stringify(artistas_participantes || []),
      album,
      ano: processedAno, 
      gravadora,
      diretor,
      thumbnail_url: thumbnail_url || null,
      start_segundos,
      end_segundos,
      is_commercial,
      dias_semana: stringifiedDiasSemana
    }

    const [result] = await pool.query('UPDATE tracks SET ? WHERE id = ?', [fieldsToUpdate, id]);

    if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Música não encontrada para atualização.' });
    }

    // ALTERAÇÃO: Emite evento para atualizar o frontend
    getIO().emit('acervo:atualizado');

    res.json({ message: 'Música atualizada com sucesso!' });

  } catch (err) {
    console.error(`updateTrack (ID: ${id}) - Erro durante UPDATE:`, err);
    res.status(500).json({ error: 'Erro ao atualizar a música.' });
  }
}

export const deleteTrack = async (req, res) => {
  const { id } = req.params
  try {
    const [result] = await pool.query('DELETE FROM tracks WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Música não encontrada para deletar.' });
    }
    
    // ALTERAÇÃO: Emite evento para atualizar o frontend
    getIO().emit('acervo:atualizado');

    res.json({ message: 'Música deletada com sucesso!' });
  } catch (err) {
    console.error(`deleteTrack (ID: ${id}) - Erro:`, err);
    res.status(500).json({ error: 'Erro ao deletar a música.' });
  }
}

export const deleteMultipleTracks = async (req, res) => {
  const { ids } = req.body; 

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Nenhum ID válido fornecido para exclusão.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const numericIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));

    if (numericIds.length === 0) {
         await connection.rollback();
         return res.status(400).json({ error: 'IDs fornecidos são inválidos.' });
    }

    const placeholders = numericIds.map(() => '?').join(',');
    
    const [result] = await connection.query(
         `DELETE FROM tracks WHERE id IN (${placeholders})`,
         numericIds
    );
    
    await connection.commit();
    
    // ALTERAÇÃO: Emite evento para atualizar o frontend
    getIO().emit('acervo:atualizado');
    
    console.log(`Excluídas ${result.affectedRows} faixas.`);
    res.json({ message: `${result.affectedRows} mídias foram excluídas com sucesso!` });

  } catch (err) {
    await connection.rollback();
    console.error('Erro ao excluir mídias em lote:', err);
    res.status(500).json({ error: 'Erro interno ao excluir mídias.' });
  } finally {
    connection.release();
  }
};