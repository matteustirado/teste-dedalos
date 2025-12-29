import express from 'express';
import * as jukeboxController from '../controllers/jukeboxController.js';

const router = express.Router();

// Rota para buscar o histórico de pedidos (usado na página RequestHistory)
router.get('/history', jukeboxController.getHistoricoPedidos);

export default router;