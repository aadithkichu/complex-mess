// backend/controllers/cycleController.js
import { CycleModel } from '../models/cycleModel.js';
import { TIME_PERIODS } from '../utils/timeConstants.js';
import pool from '../utils/db.js';

const isValidPeriod = (period) => TIME_PERIODS.hasOwnProperty(period);
const isValidDate = (dateString) => /^\d{4}-\d{2}-\d{2}$/.test(dateString);

// --- PUBLIC: Get Cycle Settings & Last Cycle Info ---
export const getCycleSettings = async (req, res) => {
    try {
        const currentCycle = await CycleModel.getCurrentActive();
        
        // --- THIS QUERY IS NOW CORRECTED ---
        // It finds the cycle that ended most recently *before* the current time.
        const [lastCycleRows] = await pool.query(
            `SELECT cycle_id, cycle_name, end_date, end_period 
             FROM cycles 
             WHERE 
                 -- Combine the date and the *hardcoded* end time for comparison
                 STR_TO_DATE(
                     CONCAT(end_date, ' ', 
                         CASE end_period 
                             WHEN 'Morning' THEN '11:00:00'
                             WHEN 'Noon' THEN '17:00:00'
                             WHEN 'Evening' THEN '23:59:59'
                         END
                     ), 
                     '%Y-%m-%d %H:%i:%s'
                 ) < NOW() -- Check if the cycle's end time is in the past
             ORDER BY 
                 end_date DESC, 
                 FIELD(end_period, 'Evening', 'Noon', 'Morning') -- Order by time (Evening is latest)
             LIMIT 1`
        );
        const lastCycle = lastCycleRows[0] || null; // Default to null if no past cycles found

        res.status(200).json({
            current: currentCycle,
            time_periods: CycleModel.getAllTimePeriods(), 
            last_cycle: lastCycle
        });

    } catch (error) {
        console.error('[FATAL CYCLE SETTINGS ERROR]:', error);
        res.status(500).json({ 
            message: 'Server error fetching cycle settings. See server logs for details.' 
        });
    }
};

// --- ADMIN: Create New Cycle (with "Surgical Trim" overwrite logic) ---
export const createNewCycle = async (req, res) => {
    const newCycleData = req.body;
    const { cycle_name, start_date, end_date, start_period, end_period, calculation_mode, force_overwrite } = newCycleData;

    // 1. Validation
    if (!cycle_name || !start_date || !end_date || !start_period || !end_period || !calculation_mode ||
        !isValidDate(start_date) || !isValidDate(end_date) || !isValidPeriod(start_period) || !isValidPeriod(end_period)) {
        return res.status(400).json({ message: 'Missing or invalid cycle fields.' });
    }
    try {
        // 2. Check for logical date/period errors
        const startDateObj = new Date(start_date);
        const endDateObj = new Date(end_date);

        if (startDateObj > endDateObj) {
            return res.status(400).json({ message: 'Start date cannot be after the end date.' });
        }

        if (startDateObj.getTime() === endDateObj.getTime()) {
            const periodOrder = { 'Morning': 1, 'Noon': 2, 'Evening': 3 };
            if (periodOrder[start_period] > periodOrder[end_period]) {
                return res.status(400).json({ message: 'Start period must be before or the same as the end period on the same day.' });
            }
        }
    } catch (error) {
        console.error('[CRITICAL CYCLE CREATION VALIDATION ERROR]', error);
        return res.status(500).json({ 
            message: 'A severe server error occurred during cycle creation validation.',
            debug: error.message
        });
    }
    
    try {
        // 2. Check for conflicts
        const overlappingCycles = await CycleModel.checkForOverlap(newCycleData);
        
        // 3. If overlap AND no force, return 409
        if (overlappingCycles.length > 0 && !force_overwrite) {
            return res.status(409).json({
                message: 'CYCLE_CONFLICT',
                details: 'This new cycle overlaps with existing history. Confirm overwrite to adjust the timeline.',
                overlapping_cycles: overlappingCycles.map(c => ({ 
                    cycle_id: c.cycle_id, 
                    cycle_name: c.cycle_name 
                }))
            });
        }
        
        // 4. If overlap AND force, perform the "Surgical Trim"
        if (overlappingCycles.length > 0 && force_overwrite) {
            await CycleModel.performSurgicalTrim(newCycleData, overlappingCycles);
        }
        
        // 5. Create the new cycle (Model.create is now simple)
        const newCycleId = await CycleModel.create(newCycleData);
        await CycleModel.initializeTargetsForNewCycle(newCycleId);
        
        res.status(201).json({ 
            message: 'New cycle created successfully. Timeline was surgically trimmed.', 
            cycle_id: newCycleId 
        });

    } catch (error) {
        console.error('[CRITICAL CYCLE CREATION ERROR]', error);
        res.status(500).json({ 
            message: 'A severe server error occurred during cycle creation.',
            debug: error.message
        });
    }
};

export const deleteCycle = async (req, res) => {
    try {
        const cycleId = req.params.cycleId;
        
        if (!cycleId || isNaN(parseInt(cycleId))) {
            return res.status(400).json({ message: 'Invalid Cycle ID.' });
        }

        const deleted = await CycleModel.deleteCycle(cycleId);

        if (!deleted) {
            return res.status(404).json({ message: 'Cycle not found or was already deleted.' });
        }

        res.status(200).json({ message: 'Cycle successfully deleted.' });
        
    } catch (error) {
        console.error('[FATAL CYCLE DELETE ERROR]:', error);
        res.status(500).json({ message: 'Server error deleting cycle.', error: error.message });
    }
};

// --- ADMIN: Update Active Cycle (with "Surgical Trim" overwrite logic) ---
export const updateCycle = async (req, res) => {
    const cycleId = req.params.id; 
    const newCycleData = req.body;
    const { start_date, end_date, start_period, end_period, calculation_mode, force_overwrite } = newCycleData;
    
    if (!start_date || !end_date || !start_period || !end_period || !calculation_mode) {
        return res.status(400).json({ message: 'All cycle fields are required for an update.' });
    }
    // --- NEW VALIDATION BLOCK ---
    try {
        // 2. Check for logical date/period errors
        const startDateObj = new Date(start_date);
        const endDateObj = new Date(end_date);

        if (startDateObj > endDateObj) {
            return res.status(400).json({ message: 'Start date cannot be after the end date.' });
        }

        if (startDateObj.getTime() === endDateObj.getTime()) {
            const periodOrder = { 'Morning': 1, 'Noon': 2, 'Evening': 3 };
            if (periodOrder[start_period] > periodOrder[end_period]) {
                return res.status(400).json({ message: 'Start period must be before or the same as the end period on the same day.' });
            }
        }
    } catch (error) {
        console.error('[CRITICAL CYCLE UPDATE VALIDATION ERROR]', error);
        return res.status(500).json({ 
            message: 'A severe server error occurred during cycle update validation.',
            debug: error.message
        });
    }

    try {
        const currentCycle = await CycleModel.getCurrentActive();
        if (!currentCycle || currentCycle.cycle_id.toString() !== cycleId) {
            return res.status(404).json({ message: 'Target cycle is not the currently active cycle.' });
        }

        // 1. Check for external overlap (excluding the cycle being edited)
        const overlappingCycles = await CycleModel.checkForOverlap(newCycleData, cycleId);

        // 2. If overlap AND no force, return 409
        if (overlappingCycles.length > 0 && !force_overwrite) {
             return res.status(409).json({
                message: 'EXTERNAL_CYCLE_CONFLICT',
                details: 'This date change extends the cycle into another existing cycle. Confirm overwrite to trim external data.',
                overlapping_cycles: overlappingCycles.map(c => ({ 
                    cycle_id: c.cycle_id, 
                    cycle_name: c.cycle_name 
                }))
            });
        }
        
        // 3. If overlap AND force, perform "Surgical Trim" on neighbors
        if (overlappingCycles.length > 0 && force_overwrite) {
            await CycleModel.performSurgicalTrim(newCycleData, overlappingCycles);
        }

        // 4. Update the cycle row itself
        await CycleModel.updateCycleRow(cycleId, newCycleData);

        // 5. Clean up the *internal* data of the cycle we just updated
        await CycleModel.cleanupDataForUpdate(cycleId, newCycleData);

        res.status(200).json({ 
            message: 'Cycle updated successfully. Timeline and internal data were adjusted.' 
        });

    } catch (error) {
        console.error('[FATAL CYCLE UPDATE ERROR]:', error);
        res.status(500).json({ 
            message: 'Server error updating cycle dates.', 
            debug: error.message 
        });
    }
};


export const lockCycleAvailability = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { cycleId } = req.params;
        
        await connection.beginTransaction();
        
        // 1. (Optional but recommended) Re-run objective calculations
        //     to ensure they are based on the latest snapshot.
        //     This assumes you have access to StandingModel.
        // await StandingModel.recalculateLegacy(cycleId, connection);
        // await StandingModel.recalculateGroup(cycleId, connection);
        
        // 2. Snapshot the availability
        await CycleModel.snapshotAvailability(cycleId, connection);
        
        await connection.commit();
        res.status(200).json({ message: 'Availability snapshot for cycle locked successfully.' });
    } catch (error) {
        await connection.rollback();
        console.error("Error locking cycle availability:", error);
        res.status(500).json({ message: 'Server error locking availability', error: error.message });
    } finally {
        if (connection) connection.release();
    }
};

export const getAllCycles = async (req, res) => {
    try {
        const cycles = await CycleModel.getAll();
        res.status(200).json(cycles);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching all cycles', error: error.message });
    }
};

// --- ADMIN: Change Mode of Active Cycle ---
export const changeCycleMode = async (req, res) => {
    // 1. Retrieve cycleId from URL parameters
    const cycleId = req.params.cycleId; 
    const { new_mode } = req.body;

    if (!cycleId || isNaN(parseInt(cycleId))) {
         return res.status(400).json({ message: 'Invalid or missing Cycle ID.' });
    }

    if (new_mode !== 'Legacy' && new_mode !== 'Group') {
        return res.status(400).json({ message: 'Invalid calculation mode.' });
    }
    
    try {
        // 2. Check if the cycle exists and get its name for the response
        const cycle = await CycleModel.getById(cycleId);
        
        if (!cycle) {
             // Use 404 since the target resource (cycle) wasn't found
             return res.status(404).json({ message: 'Target cycle not found.' });
        }
        
        // 3. Update the specific cycle using the ID from params
        await pool.query(
            'UPDATE cycles SET calculation_mode = ? WHERE cycle_id = ?',
            [new_mode, cycleId]
        );

        res.status(200).json({ 
            message: `Mode for cycle '${cycle.cycle_name}' updated to ${new_mode}.` 
        });

    } catch (error) {
        console.error('[FATAL CYCLE MODE CHANGE ERROR]:', error);
        res.status(500).json({ message: 'Server error updating cycle mode.', error: error.message });
    }
};