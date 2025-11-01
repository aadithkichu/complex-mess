// backend/routes/authRoutes.js

import express from 'express';
import { login, logout, checkSession } from '../controllers/authController.js';

const router = express.Router();

// @route   POST /api/auth/login
router.post('/login', login);

// @route   POST /api/auth/logout
router.post('/logout', logout);

// @route   GET /api/auth/me
router.get('/me', checkSession);

export default router;