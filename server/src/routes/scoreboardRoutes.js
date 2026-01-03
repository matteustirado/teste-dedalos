import express from 'express';
import { 
    getActiveConfig, 
    updateActiveConfig, 
    castVote, 
    getVotes, 
    resetVotes, 
    savePreset, 
    getPresets, 
    deletePreset,
    testarTrigger,
    getCrowdCount 
} from '../controllers/scoreboardController.js';

const router = express.Router();

// =====================================================================
// 🌡️ ROTA DE TERMÔMETRO (PROXY)
// =====================================================================
// O Frontend chama essa rota, e o Backend busca na API Dedalos externa
router.get('/crowd/:unidade', getCrowdCount);


// =====================================================================
// 🎮 ROTAS DE CONFIGURAÇÃO E JOGO
// =====================================================================

// Configuração Ativa (Game e Display)
router.get('/active/:unidade', getActiveConfig);
router.post('/active', updateActiveConfig);

// Votação
router.post('/vote', castVote);
router.get('/votes/:unidade', getVotes);
router.post('/reset-votes', resetVotes);

// Predefinições (Presets)
// [MODIFICADO] Adicionado o parâmetro /:unidade para filtrar os presets corretamente
router.get('/presets/:unidade', getPresets); 
router.post('/presets', savePreset);
router.delete('/presets/:id', deletePreset);

// =====================================================================
// 🧪 ROTA DE TESTES (ADMIN)
// =====================================================================
// Simula um check-in para testar a animação das telas
router.get('/test-trigger/:unidade', testarTrigger);

export default router;