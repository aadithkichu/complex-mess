// backend/routes/cycleRoutes.js

import express from 'express';
import { isAdmin } from '../middleware/auth.js';
import { 
    getCycleSettings,  
    createNewCycle,    
    changeCycleMode,
    updateCycle,
    getAllCycles,
    deleteCycle,
    lockCycleAvailability          
} from '../controllers/cycleController.js';

const router = express.Router();

// PUBLIC ROUTE: Get the status of the current cycle and period options
router.get('/', getCycleSettings);
router.get('/all', getAllCycles);

// ADMIN ROUTES: 
// POST: Create a new cycle (handles conflict checks)
router.post('/', isAdmin, createNewCycle);

// PUT: Change the calculation mode of the currently active cycle
router.put('/mode/:cycleId', isAdmin, changeCycleMode); 

// PUT: Update the start/end dates and periods of the CURRENTLY ACTIVE cycle
router.put('/:id', isAdmin, updateCycle); 
router.delete('/:cycleId', deleteCycle);
router.post('/:cycleId/lock-availability', isAdmin, lockCycleAvailability);

export default router;