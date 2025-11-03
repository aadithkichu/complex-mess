import express from 'express';
import { calculateAndGetStandings } from '../controllers/standingController.js';

const router = express.Router();

router.post('/calculate',  calculateAndGetStandings);

export default router;