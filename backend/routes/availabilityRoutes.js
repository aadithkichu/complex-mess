import express from 'express';
import { 
    getAvailabilitySummary, 
    setSlotAvailability, 
    setFullDayAvailability 
} from '../controllers/availabilityController.js';

const router = express.Router();
// GET /api/availability/summary
router.get('/summary', getAvailabilitySummary);

// POST /api/availability/slot
router.post('/slot', setSlotAvailability);

// POST /api/availability/fullday
router.post('/fullday', setFullDayAvailability);

export default router;

