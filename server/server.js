import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import pool from './src/config/db.js'
import trackRoutes from './src/routes/trackRoutes.js'
import playlistRoutes from './src/routes/playlistRoutes.js'

dotenv.config()

const app = express()
const port = process.env.PORT || 4000

app.use(cors())
app.use(morgan('dev'))
app.use(express.json())

app.use('/api/tracks', trackRoutes)
app.use('/api/playlists', playlistRoutes)

app.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT NOW() AS now')
    res.json({ message: 'Backend funcionando!', time: rows[0].now })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(port, () => {
  console.log(`Backend rodando na porta ${port}`)
})