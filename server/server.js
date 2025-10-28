import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import pool from './src/config/db.js'
import trackRoutes from './src/routes/trackRoutes.js'
import playlistRoutes from './src/routes/playlistRoutes.js'
import path from 'path' 
import { fileURLToPath } from 'url'; 

dotenv.config()

const __filename = fileURLToPath(import.meta.url); 
const __dirname = path.dirname(__filename); 

const app = express()
const port = process.env.PORT || 4000

app.use(cors())
app.use(morgan('dev'))
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/assets/upload/covers', express.static(path.join(__dirname, 'src/assets/upload/covers')));


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