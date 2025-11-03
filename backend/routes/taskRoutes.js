// backend/routes/taskRoutes.js

import express from 'express';
import { isAdmin } from '../middleware/auth.js';
import { 
    getAllTemplates, 
    createTemplate, 
    updateTemplate, 
    deleteTemplate 
} from '../controllers/taskController.js';

const router = express.Router();

// --- PUBLIC ROUTE ---
// Everyone can view the list of tasks (Point Data)
router.get('/', getAllTemplates);

// --- ADMIN ONLY ROUTES ---
// Only the admin can create, update, or delete tasks
router.post('/', isAdmin, createTemplate);
router.put('/:id', isAdmin, updateTemplate);
router.delete('/:id', isAdmin, deleteTemplate);

export default router;