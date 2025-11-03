import { StandingModel } from '../models/standingModel.js';
import { CycleModel } from '../models/cycleModel.js';
import pool from '../utils/db.js';

// POST /api/standings/calculate
export const calculateAndGetStandings = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { cycleId } = req.body;
        if (!cycleId) {
            return res.status(400).json({ message: "Cycle ID is required" });
        }
        await connection.beginTransaction();
        // 1. Get the cycle
        const cycle = await CycleModel.getById(cycleId);
        if (!cycle) {
            return res.status(404).json({ message: "Cycle not found" });
        }
        await CycleModel.snapshotAvailability(cycleId, connection);

        // 2. Run the objective re-calculation
        if (cycle.calculation_mode === 'Legacy') {
            await StandingModel.recalculateLegacy(cycleId);
        } else if (cycle.calculation_mode === 'Group') {
            await StandingModel.recalculateGroup(cycleId);
        }
        await connection.commit();
        // 3. Fetch results AND calculate live priority
        const standings = await StandingModel.getByCycle(cycle, cycleId);

        res.status(200).json(standings);

    } catch (error) {
        await connection.rollback();
        console.error("Error calculating standings:", error);
        res.status(500).json({ message: "Error calculating standings", error: error.message });
    } finally {
        if (connection) connection.release();
    }
};