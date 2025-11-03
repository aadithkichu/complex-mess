// backend/models/cycleModel.js
import pool from '../utils/db.js';
import { DateTime } from 'luxon';
import { 
    TIME_PERIODS, 
    getBoundaryDateTime, 
    getNowInLocalTime, 
    TIMEZONE,
    toLocalISOString,  // <-- This is the main bug fix
    findPeriodForTime 
} from '../utils/timeConstants.js'; 

const MEMBER_NO_LOGIN_PASSWORD_HASH = 'N/A_MEMBER_NO_LOGIN'; // Ensure this matches your actual hash

export class CycleModel {

    static async getAll() {
        const sql = "SELECT * FROM cycles ORDER BY start_date DESC";
        const [rows] = await pool.execute(sql);
        return rows;
    }

    // --- Helper: Get precise boundaries (Pure JS) ---
    static getCycleBoundaries(cycle) {
        // THE BUG FIX: Use toLocalISOString instead of .toISOString()
        const startDateString = toLocalISOString(cycle.start_date);
        const endDateString = toLocalISOString(cycle.end_date);

        const startBoundaryString = getBoundaryDateTime(startDateString, cycle.start_period, true);
        const endBoundaryString = getBoundaryDateTime(endDateString, cycle.end_period, false);

        const startBoundary = DateTime.fromSQL(startBoundaryString, { zone: TIMEZONE });
        const endBoundary = DateTime.fromSQL(endBoundaryString, { zone: TIMEZONE });

        return { 
            startBoundary: startBoundary.toJSDate(),
            endBoundary: endBoundary.toJSDate(),
            startBoundaryString, 
            endBoundaryString  
        };
    }

    static async snapshotAvailability(cycleId, connection) {
        const conn = connection || pool; // Use transaction if provided
        
        // 1. Delete all old snapshots for this cycle to start fresh
        await conn.execute(
            'DELETE FROM cycle_availability WHERE cycle_id = ?',
            [cycleId]
        );

        // 2. Copy the current global availability into the snapshot table
        const sql = `
            INSERT INTO cycle_availability (cycle_id, user_id, day_of_week, time_of_day)
            SELECT
                ? AS cycle_id, -- The target cycle_id
                ma.user_id,
                ma.day_of_week,
                ma.time_of_day
            FROM
                member_availability ma
            JOIN
                users u ON ma.user_id = u.user_id
            WHERE
                u.password_hash = ? -- Only non-admin users
        `;
        
        await conn.execute(sql, [cycleId, MEMBER_NO_LOGIN_PASSWORD_HASH]);
    }

    // --- Get current (active) cycle details ---
    static async getCurrentActive() {
        try {
            const [rows] = await pool.query(`SELECT * FROM cycles`);
            const now = getNowInLocalTime().toJSDate(); // Get NOW in IST
            
            for (const cycle of rows) {
                try {
                    // This now calculates boundaries correctly
                    const boundaries = this.getCycleBoundaries(cycle); 
                    if (boundaries.startBoundary <= now && boundaries.endBoundary >= now) {
                        return { ...cycle, ...boundaries }; // Found it
                    }
                } catch (boundaryError) {
                    console.error(`[CycleModel ERROR] Failed boundaries for cycle ID ${cycle.cycle_id}:`, boundaryError.message);
                    continue; 
                }
            }
            return null; // No active cycle found
        } catch (dbError) {
            console.error('[CycleModel FATAL ERROR] Failed to query all cycles:', dbError);
            throw new Error("Failed to retrieve active cycle data from database.");
        }
    } 

    // --- Check for Overlap (Pure JS Loop) ---
    static async checkForOverlap(newCycleData, excludeCycleId = null) {
        const query = 'SELECT * FROM cycles' + (excludeCycleId ? ` WHERE cycle_id != ?` : '');
        const params = excludeCycleId ? [excludeCycleId] : [];
        const [allCycles] = await pool.query(query, params);

        const newAbsoluteStart = new Date(getBoundaryDateTime(newCycleData.start_date, newCycleData.start_period, true));
        const newAbsoluteEnd = new Date(getBoundaryDateTime(newCycleData.end_date, newCycleData.end_period, false));
        
        const overlaps = [];
        for (const cycle of allCycles) {
            const existingBoundaries = this.getCycleBoundaries(cycle);
            if (newAbsoluteStart < existingBoundaries.endBoundary && newAbsoluteEnd > existingBoundaries.startBoundary) {
                overlaps.push(cycle);
            }
        }
        return overlaps;
    }

// backend/models/cycleModel.js

// backend/models/cycleModel.js

// --- Helper: The "Surgical Trim" function (CORRECTED) ---
static async performSurgicalTrim(newCycleData, overlappingCycles) {
    
    const newStartBoundary = DateTime.fromSQL(
        getBoundaryDateTime(newCycleData.start_date, newCycleData.start_period, true), 
        { zone: TIMEZONE }
    );
    const newEndBoundary = DateTime.fromSQL(
        getBoundaryDateTime(newCycleData.end_date, newCycleData.end_period, false), 
        { zone: TIMEZONE }
    );

    const newStartSQL = newStartBoundary.toFormat('yyyy-MM-dd HH:mm:ss');
    const newEndSQL = newEndBoundary.toFormat('yyyy-MM-dd HH:mm:ss');

    console.log(`[performSurgicalTrim] STARTING. Trimming for new cycle: "${newCycleData.cycle_name}"`);
    console.log(`[performSurgicalTrim] New boundaries: ${newStartSQL} TO ${newEndSQL}`);

    for (const cycle of overlappingCycles) {
        const existingBoundaries = this.getCycleBoundaries(cycle);
        const startsBefore = existingBoundaries.startBoundary < newStartBoundary;
        const endsAfter = existingBoundaries.endBoundary > newEndBoundary;

        // Case 1: Preceding Overlap (trim its end)
        if (startsBefore && !endsAfter) {
            console.log(`[performSurgicalTrim] -> CASE 1: Preceding Overlap detected for Cycle ID ${cycle.cycle_id}`);

            const newPrecedingEnd = newStartBoundary.minus({ seconds: 1 });
            let newPrecedingEndDate = newPrecedingEnd.toISODate(); // YYYY-MM-DD
            let newPrecedingEndPeriod = findPeriodForTime(newPrecedingEnd.toISOTime({ includeOffset: false }));

            // --- THIS IS THE BUG FIX ---
            if (newPrecedingEndPeriod === null) {
                // The time is 05:59:59 (or similar).
                // We must set the end date to the PREVIOUS day, at the end of the 'Evening' period.
                const prevDay = newStartBoundary.minus({ days: 1 });
                newPrecedingEndDate = prevDay.toISODate(); // e.g., 2025-10-28
                newPrecedingEndPeriod = 'Evening'; // e.g., Evening
                console.log(`[performSurgicalTrim] -> Adjusting for Morning gap. Setting end to PREVIOUS day.`);
            }
            // --- END BUG FIX ---

            console.log(`[performSurgicalTrim] -> Action: Trimming end of Cycle ID ${cycle.cycle_id} to ${newPrecedingEndDate} @ ${newPrecedingEndPeriod}`);
            
            await pool.query(
                `UPDATE cycles SET end_date = ?, end_period = ? WHERE cycle_id = ?`,
                [newPrecedingEndDate, newPrecedingEndPeriod, cycle.cycle_id]
            );
            await pool.query(`DELETE FROM task_log WHERE cycle_id = ? AND task_datetime >= ?`, [cycle.cycle_id, newStartSQL]);
            await pool.query(`DELETE FROM cycle_targets WHERE cycle_id = ?`, [cycle.cycle_id]);
        }
        
        // Case 2: Succeeding Overlap (trim its start)
        else if (!startsBefore && endsAfter) {
            console.log(`[performSurgicalTrim] -> CASE 2: Succeeding Overlap detected for Cycle ID ${cycle.cycle_id}`);
            
            const newSucceedingStart = newEndBoundary.plus({ seconds: 1 });
            let newSucceedingStartDate = newSucceedingStart.toISODate();
            let newSucceedingStartPeriod = findPeriodForTime(newSucceedingStart.toISOTime({ includeOffset: false }));

            // --- BUG FIX LOGIC (for gaps) ---
            if (newSucceedingStartPeriod === null) {
                // The time is in a gap (e.g., 00:00:00).
                // We must set the start date to the *same* day, at the 'Morning' period.
                newSucceedingStartDate = newSucceedingStart.toISODate();
                newSucceedingStartPeriod = 'Morning'; // Start of the next day
                console.log(`[performSurgicalTrim] -> Adjusting for Evening gap. Setting start to NEXT day Morning.`);
            }
            // --- END BUG FIX ---

            console.log(`[performSurgicalTrim] -> Action: Trimming start of Cycle ID ${cycle.cycle_id} to ${newSucceedingStartDate} @ ${newSucceedingStartPeriod}`);

            await pool.query(
                `UPDATE cycles SET start_date = ?, start_period = ? WHERE cycle_id = ?`,
                [newSucceedingStartDate, newSucceedingStartPeriod, cycle.cycle_id]
            );
            await pool.query(`DELETE FROM task_log WHERE cycle_id = ? AND task_datetime <= ?`, [cycle.cycle_id, newEndSQL]);
            await pool.query(`DELETE FROM cycle_targets WHERE cycle_id = ?`, [cycle.cycle_id]);
        }

        // Case 3: Engulfed Cycle (delete it)
        else {
            console.warn(`[performSurgicalTrim] -> CASE 3: Engulfed Overlap detected.`);
            console.warn(`[performSurgicalTrim] -> Action: Deleting entire Cycle ID ${cycle.cycle_id}`);
            
            await pool.query(`DELETE FROM cycle_targets WHERE cycle_id = ?`, [cycle.cycle_id]);
            await pool.query(`DELETE FROM task_log WHERE cycle_id = ?`, [cycle.cycle_id]);
            await pool.query(`DELETE FROM cycles WHERE cycle_id = ?`, [cycle.cycle_id]);
        }
    }
    console.log(`[performSurgicalTrim] FINISHED.`);
}

    // --- Create a new cycle ---
    // backend/models/cycleModel.js

    // --- Create a new cycle ---
    static async create(newCycleData) {
        const { cycle_name, start_date, end_date, start_period, end_period, calculation_mode } = newCycleData;
        
        console.log(`[CycleModel LOG] Attempting to CREATE new cycle: "${cycle_name}"`);
        console.log(`[CycleModel LOG] -> Start: ${start_date} @ ${start_period}`);
        console.log(`[CycleModel LOG] -> End: ${end_date} @ ${end_period}`);
        console.log(`[CycleModel LOG] -> Mode: ${calculation_mode}`);

        try {
            const [result] = await pool.query(
                `INSERT INTO cycles (cycle_name, start_date, end_date, start_period, end_period, calculation_mode) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [cycle_name, start_date, end_date, start_period, end_period, calculation_mode]
            );
            
            console.log(`[CycleModel AUDIT] Successfully CREATED new cycle with ID: ${result.insertId}`);
            return result.insertId;

        } catch (error) {
            console.error(`[CycleModel FATAL CREATE ERROR] Failed to insert new cycle "${cycle_name}":`, error);
            throw new Error(`Database error during cycle creation: ${error.message}`);
        }
    }

    // --- Update the Cycle Row (NON-DESTRUCTIVE) ---
    static async updateCycleRow(cycleId, newCycleData) {
        const { start_date, end_date, start_period, end_period, calculation_mode } = newCycleData;
        await pool.query(
            `UPDATE cycles SET start_date = ?, end_date = ?, start_period = ?, end_period = ?, calculation_mode = ?
             WHERE cycle_id = ?`,
            [start_date, end_date, start_period, end_period, calculation_mode || 'Legacy', cycleId]
        );
        return true;
    }

    static async cleanupDataForUpdate(cycleId, newCycleData) {
        const connection = await pool.getConnection();

        // 1. Calculate the New Boundaries (as SQL DATETIME strings)
        // We use these boundaries to determine which *existing* logs are now invalid.
        const newCycleStartBoundary = getBoundaryDateTime(
            newCycleData.start_date, 
            newCycleData.start_period, 
            true // isStart
        );
        const newCycleEndBoundary = getBoundaryDateTime(
            newCycleData.end_date, 
            newCycleData.end_period, 
            false // isEnd
        );
        
        try {
            await connection.beginTransaction();

            // --- CRITICAL FIX: REWRITE SQL QUERY ---
            // We must CONCATENATE task_date and a hardcoded period end time 
            // to recreate a DATETIME for comparison.
            const deleteTasksSql = `
                DELETE FROM task_log
                WHERE cycle_id = ? 
                  AND (
                      -- Check if the task is BEFORE the new start boundary
                      STR_TO_DATE(
                          CONCAT(task_date, ' ', 
                              CASE time_period
                                  WHEN 'Morning' THEN '11:00:00'
                                  WHEN 'Noon' THEN '17:00:00'
                                  WHEN 'Evening' THEN '23:59:59'
                              END
                          ), 
                          '%Y-%m-%d %H:%i:%s'
                      ) < ? 
                      -- OR check if the task is AFTER the new end boundary
                      OR STR_TO_DATE(
                          CONCAT(task_date, ' ', 
                              CASE time_period
                                  WHEN 'Morning' THEN '06:00:00'
                                  WHEN 'Noon' THEN '11:00:01'
                                  WHEN 'Evening' THEN '17:00:01'
                              END
                          ), 
                          '%Y-%m-%d %H:%i:%s'
                      ) > ?
                  )
            `;

            // Note: We use the boundary strings calculated outside the loop.
            await connection.query(deleteTasksSql, [
                cycleId, 
                newCycleStartBoundary, 
                newCycleEndBoundary
            ]);
            
            // Delete cycle targets that might have been partially trimmed (Optional, but safe)
            await connection.execute(
                "DELETE FROM cycle_targets WHERE cycle_id = ?",
                [cycleId]
            );

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            console.error('[FATAL CLEANUP ERROR]:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    static async getById(cycleId) {
        const sql = "SELECT * FROM cycles WHERE cycle_id = ?";
        const [rows] = await pool.execute(sql, [cycleId]);
        return rows[0]; // Returns the full cycle object
    }

    static async deleteCycle(cycleId) {
        const [result] = await pool.execute(
            'DELETE FROM cycles WHERE cycle_id = ?', 
            [cycleId]
        );
        return result.affectedRows > 0;
    }
    static async initializeTargetsForNewCycle(newCycleId) {
        const sql = `
            INSERT INTO cycle_targets (cycle_id, user_id, point_objective, credits_earned)
            SELECT ?, user_id, 0.00, 0
            FROM users
            WHERE password_hash = ? -- Only non-admin members
        `;
        // Assuming MEMBER_NO_LOGIN_PASSWORD_HASH is correctly defined and imported
        await pool.execute(sql, [newCycleId, MEMBER_NO_LOGIN_PASSWORD_HASH]);
    }

    // --- Helper: Get all time periods for frontend ---
    static getAllTimePeriods() {
        return Object.keys(TIME_PERIODS);
    }
}