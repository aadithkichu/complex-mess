import express from 'express';
import { getRecommendations } from '../controllers/recommendationController.js';

const router = express.Router();

// This is a read-only endpoint, but should be protected
router.get('/:cycleId', getRecommendations);

export default router;