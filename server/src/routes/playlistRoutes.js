import express from 'express';
import {
  createPlaylist,
  getAllPlaylists,
  getPlaylistById, 
  updatePlaylist,  
  deletePlaylist,
  uploadMiddleware 
} from '../controllers/playlistController.js';

const router = express.Router();

router.post('/', uploadMiddleware, createPlaylist);
router.get('/', getAllPlaylists);
router.get('/:id', getPlaylistById); 
router.put('/:id', uploadMiddleware, updatePlaylist); 
router.delete('/:id', deletePlaylist);

export default router;