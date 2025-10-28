import express from 'express';
import { createPlaylist, getAllPlaylists, deletePlaylist } from '../controllers/playlistController.js'; // Adicionar deletePlaylist

const router = express.Router();

router.post('/', createPlaylist);
router.get('/', getAllPlaylists);
router.delete('/:id', deletePlaylist); // Nova rota DELETE

export default router;