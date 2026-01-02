import express from 'express';
import { 
    salvarHistorico, 
    listarHistorico, 
    buscarClientePorPulseira // <--- Importante importar a nova função
} from '../controllers/toolsController.js';

const router = express.Router();

// Salvar histórico (Finalizar Promoção)
router.post('/history', salvarHistorico);

// Ler histórico
router.get('/history/:unidade/:tipo', listarHistorico);

// Buscar cliente (Proxy)
router.get('/client/:pulseira', buscarClientePorPulseira);

export default router;