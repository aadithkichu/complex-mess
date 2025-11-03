import express from 'express';
import { isAdmin } from '../middleware/auth.js';
import { 
  getAllUsers, 
  createUser, 
  getUserDetails, // <-- We need this controller
  updateUser, 
  deleteUser ,
  getHistoricalStats,
  getAvailablePeriods,
  getHistoricalRankings, getBestMonthlyRankings
} from '../controllers/userController.js';

import { 
    getAvailabilitySummary, 
    setSlotAvailability, 
    setFullDayAvailability 
} from '../controllers/availabilityController.js';

const router = express.Router();

// --- PUBLIC "VIEW" ROUTES ---
// Everyone can see the full list of members
router.get('/', getAllUsers);

// Everyone can view a single member's details


// --- ADMIN-ONLY "EDIT" ROUTES ---
// Only the logged-in admin can create, update, or delete
router.post('/', isAdmin, createUser);
router.get('/availability/summary', getAvailabilitySummary);
router.post('/availability/slot', setSlotAvailability);
router.post('/availability/fullday', setFullDayAvailability);
router.get('/rankings/history', getHistoricalRankings);
router.get('/rankings/monthly-best', getBestMonthlyRankings);
router.get('/:id', getUserDetails);
router.put('/:id', isAdmin, updateUser);
router.delete('/:id', isAdmin, deleteUser);
router.get('/:id/history', getHistoricalStats);
router.get('/:id/periods', getAvailablePeriods);
export default router;