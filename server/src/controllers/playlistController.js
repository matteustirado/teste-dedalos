import pool from '../config/db.js'

export const createPlaylist = async (req, res) => {
  const { name, description, cover, tracks_ids } = req.body

  if (!name || !tracks_ids || !Array.isArray(tracks_ids)) {
    return res.status(400).json({ error: 'Nome e lista de IDs de músicas são obrigatórios.' })
  }

  try {
    const newPlaylist = {
      nome: name,
      descricao: description,
      imagem: cover, 
      tracks_ids: JSON.stringify(tracks_ids) 
    }

    const [result] = await pool.query('INSERT INTO playlists SET ?', newPlaylist)
    res.status(201).json({ message: 'Playlist criada com sucesso!', id: result.insertId })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao salvar a playlist no banco de dados.' })
  }
}

export const getAllPlaylists = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM playlists ORDER BY nome ASC')
    res.json(rows)
  } catch (err) {
    console.error(err.message) // Adicionado console.error para melhor debug
    res.status(500).json({ error: 'Erro ao buscar playlists.' }) // Mensagem mais genérica
  }
}

export const deletePlaylist = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query('DELETE FROM playlists WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Playlist não encontrada.' });
    }
    res.json({ message: 'Playlist excluída com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir a playlist.' });
  }
}