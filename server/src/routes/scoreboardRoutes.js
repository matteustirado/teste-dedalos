import express from 'express';
import { 
    getActiveConfig, 
    updateActiveConfig, 
    castVote, 
    getVotes, 
    resetVotes, 
    savePreset, 
    getPresets, 
    deletePreset 
} from '../controllers/scoreboardController.js';

const router = express.Router();

// Configuração Ativa
router.get('/active/:unidade', getActiveConfig);
router.post('/active', updateActiveConfig);

// Votação
router.post('/vote', castVote);
router.get('/votes/:unidade', getVotes);
router.post('/reset-votes', resetVotes);

// Predefinições
router.get('/presets', getPresets);
router.post('/presets', savePreset);
router.delete('/presets/:id', deletePreset);

export default router;