import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import pool from './src/config/db.js'
import trackRoutes from './src/routes/trackRoutes.js'
import playlistRoutes from './src/routes/playlistRoutes.js'
import scheduleRoutes from './src/routes/scheduleRoutes.js'
import jukeboxRoutes from './src/routes/jukeboxRoutes.js' 
import toolsRoutes from './src/routes/toolsRoutes.js' 
import scoreboardRoutes from './src/routes/scoreboardRoutes.js' // <--- [NOVO] Importação das rotas do placar
import path from 'path' 
import { fileURLToPath } from 'url'; 
import { createServer } from 'http';
import { Server } from 'socket.io';
import { iniciarMaestro, setOverlayRadio } from './src/controllers/conductorController.js'; 
import multer from 'multer'; 
import fs from 'fs'; 
import { initIO } from './src/socket.js'; 

dotenv.config()

const __filename = fileURLToPath(import.meta.url); 
const __dirname = path.dirname(__filename); 

const app = express()
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// INICIALIZA O SOCKET
initIO(io);

const port = process.env.PORT || 4000

// --- CONFIGURAÇÃO DE UPLOAD ---
// Garante que as pastas de upload existam
const overlayDir = path.join(__dirname, 'src/assets/upload/overlays');
const scoreboardDir = path.join(__dirname, 'src/assets/upload/scoreboard'); // <--- [NOVO]

if (!fs.existsSync(overlayDir)) {
    fs.mkdirSync(overlayDir, { recursive: true });
}
if (!fs.existsSync(scoreboardDir)) { // <--- [NOVO]
    fs.mkdirSync(scoreboardDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Lógica dinâmica para escolher a pasta com base no nome do campo do formulário
        if (file.fieldname === 'scoreboardImage') {
            cb(null, scoreboardDir); // Salva na pasta do placar
        } else {
            cb(null, overlayDir); // Padrão (overlays)
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        // Prefixo genérico para evitar confusão
        cb(null, 'file-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });
// -------------------------------------

app.use(cors())
app.use(morgan('dev'))
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir arquivos estáticos (Imagens acessíveis via URL)
app.use('/assets/upload/covers', express.static(path.join(__dirname, 'src/assets/upload/covers')));
app.use('/assets/upload/overlays', express.static(path.join(__dirname, 'src/assets/upload/overlays'))); 
app.use('/assets/upload/scoreboard', express.static(path.join(__dirname, 'src/assets/upload/scoreboard'))); // <--- [NOVO]

// Rotas da API
app.use('/api/tracks', trackRoutes)
app.use('/api/playlists', playlistRoutes)
app.use('/api/agendamentos', scheduleRoutes)
app.use('/api/jukebox', jukeboxRoutes) 
app.use('/api/tools', toolsRoutes)
app.use('/api/scoreboard', scoreboardRoutes) // <--- [NOVO] Rota principal do placar

// --- ROTA DE UPLOAD DE OVERLAY (Rádio) ---
app.post('/api/overlay', upload.single('overlay'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }
    const fileUrl = `/assets/upload/overlays/${req.file.filename}`;
    setOverlayRadio(fileUrl);
    res.json({ message: 'Overlay atualizado!', url: fileUrl });
});

app.delete('/api/overlay', (req, res) => {
    setOverlayRadio(null);
    res.json({ message: 'Overlay removido!' });
});

// --- ROTA DE UPLOAD DE IMAGEM DO PLACAR ---
// Usa o campo 'scoreboardImage' para cair na condicional do multer lá em cima
app.post('/api/scoreboard/upload', upload.single('scoreboardImage'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }
    const fileUrl = `/assets/upload/scoreboard/${req.file.filename}`;
    res.json({ message: 'Imagem enviada com sucesso!', url: fileUrl });
});
// ----------------------------------------

app.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT NOW() AS now')
    res.json({ message: 'Backend funcionando!', time: rows[0].now })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

io.on('connection', (socket) => {
  socket.on('jukebox:enviarSugestao', (data) => {
      import('./src/controllers/jukeboxController.js').then(ctrl => {
          ctrl.handleReceberSugestao(socket, data);
      }).catch(err => console.error("Erro ao carregar controller de sugestão:", err));
  });

  socket.on('jukebox:adicionarPedido', (data) => {
      import('./src/controllers/jukeboxController.js').then(ctrl => {
          ctrl.handleAdicionarPedido(socket, data);
      }).catch(err => console.error("Erro ao carregar controller de pedido:", err));
  });
});

iniciarMaestro();

httpServer.listen(port, () => {
  console.log(`Backend rodando (com Socket.io) na porta ${port}`)
})