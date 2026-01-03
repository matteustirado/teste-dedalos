import express from 'express';
import { 
    getPriceConfigByType, 
    updatePriceConfig, 
    getActiveDisplayPrice, 
    uploadPriceMedia,
    getHolidays,
    addHoliday,
    deleteHoliday
} from '../controllers/priceController.js';

const router = express.Router();

// Rotas de Feriados
router.get('/holidays/:unidade', getHolidays);
router.post('/holidays', addHoliday);
router.delete('/holidays/:id', deleteHoliday);

// Rotas de Configuração (Editor)
router.get('/config/:unidade/:tipo', getPriceConfigByType); // Busca tabela específica (padrao, fim_de_semana, etc)
router.post('/config', updatePriceConfig);

// Rota de Exibição (Display - Lógica Automática)
router.get('/display/:unidade', getActiveDisplayPrice); 

// Upload
router.post('/upload', uploadPriceMedia);

export default router;