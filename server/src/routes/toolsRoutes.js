import express from 'express';
import { salvarHistorico, listarHistorico } from '../controllers/toolsController.js';

const router = express.Router();

// Rota para salvar (POST)
router.post('/history', salvarHistorico);

// Rota para ler (GET)
router.get('/history/:unidade/:tipo', listarHistorico);

export default router;