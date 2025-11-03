import express from 'express';
import {
    getTaskLogsForGrid,
    getAvailableUsersForSlot,
    getTaskLogForSlot,
    logTask
} from '../controllers/logbookController.js';

const router = express.Router();

// GET /api/logbook/grid?cycleId=X&templates=1,2,3
router.get('/grid', getTaskLogsForGrid);

// GET /api/logbook/available?day=1&period=Noon
router.get('/available', getAvailableUsersForSlot);

// GET /api/logbook/slot?cycleId=X&templateId=Y&date=...
router.get('/slot', getTaskLogForSlot);

// POST /api/logbook
router.post('/', logTask);

export default router;