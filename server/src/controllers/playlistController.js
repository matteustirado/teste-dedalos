import pool from '../config/db.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, '../assets/upload/covers');

if (!fs.existsSync(UPLOAD_DIR)){
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Erro: Apenas arquivos de imagem (jpeg, jpg, png, gif, webp) são permitidos!"));
  }
}).single('cover');

export const uploadMiddleware = (req, res, next) => {
    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                 return res.status(400).json({ error: "A imagem da capa não pode exceder 2MB." });
            }
            return res.status(400).json({ error: `Erro no upload: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
};


const parseAndValidateTrackIds = (tracksIdsInput) => {
    let tracksIdsArray = [];
    let error = null;

    console.log('Raw tracks_ids received:', tracksIdsInput);

    if (tracksIdsInput && typeof tracksIdsInput === 'string') {
        try {
            const cleanedString = tracksIdsInput
                .replace(/\s+/g, '')
                .replace(/,\s*]/, ']');
            console.log('Cleaned tracks_ids string:', cleanedString);

            tracksIdsArray = JSON.parse(cleanedString);
            console.log('Successfully parsed tracks_ids:', tracksIdsArray);
            if (!Array.isArray(tracksIdsArray)) {
                console.warn('Parsed tracks_ids is not an array:', tracksIdsArray);
                error = 'Formato inválido para lista de músicas.';
                tracksIdsArray = [];
            } else {
                 try {
                     tracksIdsArray = tracksIdsArray.map(id => Number(id)).filter(id => !isNaN(id));
                 } catch (numErr) {
                      console.error('Erro ao converter IDs para número:', numErr);
                      error = 'Erro interno ao processar IDs de músicas.';
                      tracksIdsArray = [];
                 }
            }
        } catch (e) {
            console.error('JSON.parse failed for tracks_ids:', e);
            error = `Erro ao processar lista de músicas: ${e.message}`;
            tracksIdsArray = [];
        }
    } else if (Array.isArray(tracksIdsInput)) {
         try {
             tracksIdsArray = tracksIdsInput.map(id => Number(id)).filter(id => !isNaN(id));
             if (tracksIdsArray.length !== tracksIdsInput.length) {
                 console.warn('Alguns IDs (recebidos como array) não puderam ser convertidos para número.');
                 error = 'Lista de músicas (recebida como array) contém IDs numéricos inválidos.';
                 tracksIdsArray = [];
             }
         } catch (numErr) {
             console.error('Erro ao converter IDs (recebidos como array) para número:', numErr);
             error = 'Erro interno ao processar IDs de músicas (recebidos como array).';
             tracksIdsArray = [];
         }
    } else {
        console.warn('tracks_ids received in unexpected format or missing:', tracksIdsInput);
        // Não definir erro aqui, permitir salvar playlist sem musicas se não for obrigatório
        // error = 'Lista de músicas ausente ou em formato inesperado.';
        tracksIdsArray = [];
    }

    // Validação final de obrigatoriedade (se necessário)
    // if (tracksIdsArray.length === 0 && !error) {
    //    error = 'Pelo menos uma música válida é obrigatória.';
    //}


    return { tracksIdsArray, error };
};

export const createPlaylist = async (req, res) => {
  const { name, description, tracks_ids } = req.body;
  const coverFile = req.file;

  const { tracksIdsArray, error: parseError } = parseAndValidateTrackIds(tracks_ids);

  // Ajuste na validação para permitir salvar sem musicas, se necessário, ou manter como antes
   if (!name /* || parseError || tracksIdsArray.length === 0 */ ) { // Descomente a parte do OU se musicas forem obrigatorias
    if (coverFile) {
        try { fs.unlinkSync(coverFile.path); } catch (e) { console.error("Erro ao limpar arquivo órfão (create):", e); }
    }
    const errorMessage = parseError
        ? `Falha ao processar lista de músicas: ${parseError}`
        : 'Nome da playlist é obrigatório.'; // Ajustar mensagem se musicas forem obrigatorias
    return res.status(400).json({ error: errorMessage });
  }
   // Se parseError existe mas musicas não são obrigatórias, ainda retorna erro
   if (parseError) {
      if (coverFile) {
        try { fs.unlinkSync(coverFile.path); } catch (e) { console.error("Erro ao limpar arquivo órfão (parse error create):", e); }
      }
      return res.status(400).json({ error: `Falha ao processar lista de músicas: ${parseError}` });
   }


  try {
    const imagePath = coverFile ? `/assets/upload/covers/${coverFile.filename}` : null;

    const newPlaylist = {
      nome: name,
      descricao: description,
      imagem: imagePath,
      tracks_ids: JSON.stringify(tracksIdsArray) // Salva o array (possivelmente vazio) como string JSON
    }

    const [result] = await pool.query('INSERT INTO playlists SET ?', newPlaylist)
    res.status(201).json({ message: 'Playlist criada com sucesso!', id: result.insertId, imagePath: imagePath })

  } catch (err) {
    console.error("Erro no DB ao criar playlist:", err);
    if (coverFile) {
        try { fs.unlinkSync(coverFile.path); } catch (e) { console.error("Erro ao limpar arquivo após erro no DB (create):", e); }
    }
    res.status(500).json({ error: 'Erro ao salvar a playlist no banco de dados.' })
  }
}

const safeJsonParse = (jsonString) => {
  // A limpeza só faz sentido se for string
  if (!jsonString || typeof jsonString !== 'string') {
       // Se já for array (ou null/undefined), retorna como está ou array vazio
       return Array.isArray(jsonString) ? jsonString.map(id => Number(id)).filter(id => !isNaN(id)) : [];
  }
  try {
    const cleanedString = jsonString
        .replace(/\s+/g, '')
        .replace(/,\s*]/, ']');
    const parsed = JSON.parse(cleanedString);
    return Array.isArray(parsed)
        ? parsed.map(id => Number(id)).filter(id => !isNaN(id))
        : [];
  } catch (e) {
    console.error("Erro no safeJsonParse:", e, "String original:", jsonString);
    return [];
  }
};


export const getAllPlaylists = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM playlists ORDER BY nome ASC');
    // Mapeia os resultados, chamando safeJsonParse para cada um
    const processedRows = rows.map(playlist => ({
      ...playlist,
      tracks_ids: safeJsonParse(playlist.tracks_ids) // Chama safeJsonParse aqui
    }));
    res.json(processedRows); // Envia os dados já processados
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Erro ao buscar playlists.' });
  }
};

export const getPlaylistById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM playlists WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Playlist não encontrada.' });
    }
    const playlist = rows[0];
    // Processa ANTES de enviar
    const processedPlaylist = {
        ...playlist,
        tracks_ids: safeJsonParse(playlist.tracks_ids) // Chama safeJsonParse aqui
    };
    res.json(processedPlaylist); // Envia o objeto já processado
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar a playlist.' });
  }
};

export const updatePlaylist = async (req, res) => {
  const { id } = req.params;
  const { name, description, tracks_ids, existingImagePath } = req.body;
  const coverFile = req.file;

  const { tracksIdsArray, error: parseError } = parseAndValidateTrackIds(tracks_ids);

  // Ajuste na validação para permitir salvar sem musicas, se necessário, ou manter como antes
  if (!name /* || parseError || tracksIdsArray.length === 0 */) { // Descomente a parte do OU se musicas forem obrigatorias
     if (coverFile) {
         try { fs.unlinkSync(coverFile.path); } catch (e) { console.error("Erro ao limpar arquivo órfão (update):", e); }
     }
     const errorMessage = parseError
        ? `Falha ao processar lista de músicas: ${parseError}`
        : 'Nome da playlist é obrigatório.'; // Ajustar mensagem se musicas forem obrigatorias
    return res.status(400).json({ error: errorMessage });
  }
   // Se parseError existe mas musicas não são obrigatórias, ainda retorna erro
   if (parseError) {
      if (coverFile) {
         try { fs.unlinkSync(coverFile.path); } catch (e) { console.error("Erro ao limpar arquivo órfão (parse error update):", e); }
      }
      return res.status(400).json({ error: `Falha ao processar lista de músicas: ${parseError}` });
   }


  try {
    let imagePath = existingImagePath;

    if (coverFile) {
        imagePath = `/assets/upload/covers/${coverFile.filename}`;
        if (existingImagePath) {
            const oldPath = path.join(__dirname, '..', existingImagePath);
             try {
                 if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                 }
             } catch (unlinkErr) {
                 console.error("Erro ao remover imagem antiga (update):", unlinkErr);
             }
        }
    }


    const updatedPlaylist = {
      nome: name,
      descricao: description,
      imagem: imagePath,
      tracks_ids: JSON.stringify(tracksIdsArray) // Salva o array (possivelmente vazio) como string JSON
    };

    const [result] = await pool.query('UPDATE playlists SET ? WHERE id = ?', [updatedPlaylist, id]);

    if (result.affectedRows === 0) {
       if (coverFile) {
           try { fs.unlinkSync(coverFile.path); } catch (e) { console.error("Erro ao limpar arquivo após playlist não encontrada (update):", e); }
       }
      return res.status(404).json({ error: 'Playlist não encontrada para atualização.' });
    }

    res.json({ message: 'Playlist atualizada com sucesso!', imagePath: imagePath });

  } catch (err) {
    console.error("Erro no DB ao atualizar playlist:", err);
     if (coverFile) {
         try { fs.unlinkSync(coverFile.path); } catch (e) { console.error("Erro ao limpar arquivo após erro no DB (update):", e); }
     }
    res.status(500).json({ error: 'Erro ao atualizar a playlist no banco de dados.' });
  }
};


export const deletePlaylist = async (req, res) => {
  const { id } = req.params;
  try {
     const [rows] = await pool.query('SELECT imagem FROM playlists WHERE id = ?', [id]);
     if (rows.length === 0) {
       return res.status(404).json({ error: 'Playlist não encontrada.' });
     }
     const imagePath = rows[0].imagem;

    const [result] = await pool.query('DELETE FROM playlists WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Playlist não encontrada para exclusão.' });
    }

     if (imagePath) {
         const fullPath = path.join(__dirname, '..', imagePath);
         try {
             if (fs.existsSync(fullPath)) {
                 fs.unlinkSync(fullPath);
             }
         } catch (unlinkErr) {
             console.error("Erro ao remover arquivo da playlist excluída:", unlinkErr);
         }
     }

    res.json({ message: 'Playlist excluída com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir a playlist.' });
  }
}