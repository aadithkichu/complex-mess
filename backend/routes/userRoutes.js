import express from 'express';
import { isAdmin } from '../middleware/auth.js';
import { 
  getAllUsers, 
  createUser, 
  getUserDetails, // <-- We need this controller
  updateUser, 
  deleteUser 
} from '../controllers/userController.js';

const router = express.Router();

// --- PUBLIC "VIEW" ROUTES ---
// Everyone can see the full list of members
router.get('/', getAllUsers);

// Everyone can view a single member's details
router.get('/:id', getUserDetails);


// --- ADMIN-ONLY "EDIT" ROUTES ---
// Only the logged-in admin can create, update, or delete
router.post('/', isAdmin, createUser);
router.put('/:id', isAdmin, updateUser);
router.delete('/:id', isAdmin, deleteUser);

export default router;