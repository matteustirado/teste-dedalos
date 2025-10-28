import pool from '../config/db.js'
import axios from 'axios'
import YtDlpWrap from 'yt-dlp-wrap'
import ffmpeg from 'fluent-ffmpeg'

const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/videos'
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
const ytDlpWrap = new YtDlpWrap.default()

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

    const videoData = {
      youtube_id: youtubeId,
      titulo: snippet.title,
      artista: snippet.channelTitle,
      duracao_segundos: durationInSeconds,
      end_segundos: durationInSeconds
    }

    res.json(videoData)

  } catch (err) {
    console.error(err.message)
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

  } catch (err) {
    console.error(`[Loudness] Falha (Track ${trackId}):`, err.message)
    try {
      await pool.query(
        'UPDATE tracks SET status_processamento = "ERRO" WHERE id = ?',
        [trackId]
      )
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
    duracao_segundos,
    start_segundos,
    end_segundos,
    is_commercial,
    dias_semana 
  } = req.body

  if (!youtube_id || !titulo || !artista) {
    return res.status(400).json({ error: 'YouTube ID, Título e Artista são obrigatórios.'})
  }

  let processedAno = null; 
  if (ano !== '' && ano != null) {
    const anoInt = parseInt(ano, 10);
    if (!isNaN(anoInt)) {
      processedAno = anoInt; 
    }
  }
  
  const diasSemanaArray = Array.isArray(dias_semana) ? dias_semana : [];

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
      duracao_segundos,
      start_segundos,
      end_segundos,
      is_commercial,
      dias_semana: JSON.stringify(diasSemanaArray), 
      status_processamento: 'PENDENTE'
    }

    const [result] = await pool.query('INSERT INTO tracks SET ?', newTrack)

    res.status(201).json({ message: 'Música adicionada! Iniciando análise de áudio.', id: result.insertId })

    analyzeLoudness(result.insertId, youtube_id)

  } catch (err) {
    console.error(err.message)
    res.status(500).json({ error: 'Erro ao salvar dados no banco.' })
  }
}

export const listTracks = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tracks ORDER BY created_at DESC')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

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
    start_segundos,
    end_segundos,
    is_commercial,
    dias_semana 
  } = req.body

  let processedAno = null; 
  if (ano !== '' && ano != null) {
     const anoInt = parseInt(ano, 10);
   if (!isNaN(anoInt)) {
      processedAno = anoInt;
    }
  }

  const diasSemanaArray = Array.isArray(dias_semana) ? dias_semana : [];

  try {
    const fieldsToUpdate = {
      titulo,
      artista,
      artistas_participantes: JSON.stringify(artistas_participantes || []),
      album,
      ano: processedAno, 
      gravadora,
      diretor,
      start_segundos,
      end_segundos,
      is_commercial,
      dias_semana: JSON.stringify(diasSemanaArray) 
    }

    await pool.query('UPDATE tracks SET ? WHERE id = ?', [fieldsToUpdate, id])
    res.json({ message: 'Música atualizada com sucesso!' })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao atualizar a música.' })
  }
}

export const deleteTrack = async (req, res) => {
  const { id } = req.params
  try {
    await pool.query('DELETE FROM tracks WHERE id = ?', [id])
    res.json({ message: 'Música deletada com sucesso!' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao deletar a música.' })
  }
}