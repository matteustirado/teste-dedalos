import express from 'express';
import {
    getScheduleByDate,
    saveSchedule,
    getScheduleReport,
    getScheduleSummaryByMonth
} from '../controllers/scheduleController.js';

const router = express.Router();

router.get('/summary/:year/:month', getScheduleSummaryByMonth);

router.get('/:data', getScheduleByDate);

router.post('/', saveSchedule);

router.get('/relatorio/:data', getScheduleReport);


export default router;