import pool from '../utils/db.js';
import { DateTime } from 'luxon';
// --- 1. IMPORT NECESSARY HELPERS ---
import { calculatePriority } from '../utils/priorityCalculator.js'; // The external file!
import { getNowInLocalTime, TIMEZONE, TIME_PERIODS } from '../utils/timeConstants.js';

// NOTE: This constant must be defined in your module's scope
const MEMBER_NO_LOGIN_PASSWORD_HASH = 'N/A_MEMBER_NO_LOGIN';

export class StandingModel {

    static async recalculateLegacy(cycleId) {
        const connection = await pool.getConnection();
        try {
             await connection.beginTransaction();
            // --- 1. CALCULATE THE STATIC "TOTAL POINTS POOL" (T) ---
            
            // 1.1. Fetch Cycle Info
            const [cycleRow] = await connection.execute(
                "SELECT start_date, end_date, start_period, end_period FROM cycles WHERE cycle_id = ?",
                [cycleId]
            );
            if (!cycleRow.length) {
                throw new Error("Cycle not found for legacy calculation.");
            }
            const { start_date, end_date, start_period, end_period } = cycleRow[0];
            const startDateStr = DateTime.fromJSDate(start_date).toISODate();
            const endDateStr = DateTime.fromJSDate(end_date).toISODate();

            // 1.2. Fetch all templates and availability
            const [templatesRows] = await connection.execute("SELECT template_id, points, time_of_day , default_headcount FROM task_templates");
            const [availabilitiesRows] = await connection.execute(
                `SELECT u.user_id, ma.day_of_week, ma.time_of_day
                 FROM cycle_availability ma -- <-- CHANGED
                 JOIN users u ON ma.user_id = u.user_id
                 WHERE u.password_hash = ?
                   AND ma.cycle_id = ?`, // <-- ADDED
                [MEMBER_NO_LOGIN_PASSWORD_HASH, cycleId]
            );
            
            const [logRows] = await connection.execute(
                "SELECT template_id, user_id, task_date FROM task_log WHERE cycle_id = ?",
                [cycleId]
            );

            // --- 2. CREATE LOOKUP MAPS ---
            const slotAvailabilityMap = new Map(); // Key: 'Day:Period', Value: [Users]
            availabilitiesRows.forEach(row => {
                const key = `${row.day_of_week}:${row.time_of_day}`;
                if (!slotAvailabilityMap.has(key)) slotAvailabilityMap.set(key, []);
                slotAvailabilityMap.get(key).push(row.user_id);
            });

            // Key: "template_id:YYYY-MM-DD", Value: [{user_id: 1}, {user_id: null}]
            const logMap = new Map();
            for (const log of logRows) {
                const dateKey = DateTime.fromJSDate(log.task_date).toISODate();
                const key = `${log.template_id}:${dateKey}`;
                if (!logMap.has(key)) logMap.set(key, []);
                logMap.get(key).push(log);
            }

            // --- 3. PART 1: CALCULATE TOTAL POINT POOL (T) ---
            let totalPointsPool = 0;
            const startDateLuxon = DateTime.fromISO(startDateStr, { zone: TIMEZONE }).startOf('day');
            const endDateLuxon = DateTime.fromISO(endDateStr, { zone: TIMEZONE }).startOf('day');
            const PERIODS = ['Morning', 'Noon', 'Evening'];
            const PERIOD_ORDER = { 'Morning': 1, 'Noon': 2, 'Evening': 3 };

            let cursor = startDateLuxon;
            while (cursor <= endDateLuxon) {
                const dayOfWeek = cursor.weekday === 7 ? 0 : cursor.weekday;
                const currentDateString = cursor.toISODate();
                
                const eligiblePeriods = PERIODS.filter(period => {
                    const periodNum = PERIOD_ORDER[period];
                    if (currentDateString === startDateStr && periodNum < PERIOD_ORDER[start_period]) return false; 
                    if (currentDateString === endDateStr && periodNum > PERIOD_ORDER[end_period]) return false;
                    return true;
                });
                
                for (const period of eligiblePeriods) {
                    // Check if at least one user is available for this slot
                    const availableUserIds = slotAvailabilityMap.get(`${dayOfWeek}:${period}`) || [];
                    const count = availableUserIds.length;

                    // If NOBODY is available, this slot contributes 0 points to the pool
                    if (count === 0) {
                        continue;
                    }

                    // If users ARE available, calculate this slot's point value
                    let pointsForThisSlot = 0;
                    const templatesForPeriod = templatesRows.filter(t => t.time_of_day === period);

                    for (const template of templatesForPeriod) {
                        const templateId = template.template_id;
                        const templatePoints = parseFloat(template.points) || 0;
                        const templateHeadcount = parseInt(template.default_headcount) || 1;

                        const logKey = `${templateId}:${currentDateString}`;
                        const entries = logMap.get(logKey) || [];
                        const num_entries = entries.length;
                        
                        let pointsForThisTemplate = 0;
                        if (num_entries === 0) {
                            
                            pointsForThisTemplate = (templatePoints * templateHeadcount);
                        } else if (num_entries === 1) {
                            pointsForThisTemplate = (entries[0].user_id === null) ? 0 : templatePoints;
                            console.log(`[DEBUG LEGACY ${cycleId}] 2. Single entry for template ${templateId} on ${currentDateString}: user_id=${entries[0].user_id}, points=${pointsForThisTemplate}`);
                        } else {
                            pointsForThisTemplate = (templatePoints * num_entries);
                            console.log(`[DEBUG LEGACY ${cycleId}] 3. Multiple entries (${num_entries}) for template ${templateId} on ${currentDateString}: points=${pointsForThisTemplate}`);
                        }
                        pointsForThisSlot += pointsForThisTemplate;
                    }

                    // Add this slot's total value to the cycle's pool
                    totalPointsPool += pointsForThisSlot;
                }
                cursor = cursor.plus({ days: 1 }).startOf('day');
            }
            console.log(`[DEBUG LEGACY ${cycleId}] 4. Total Points Pool (T) calculated: ${totalPointsPool}`);

            let totalAvailabilitySlotsInCycle = 0;
            const userSlotsMap = new Map(); // Key: user_id, Value: count
            
            // Initialize map for all available users
            availabilitiesRows.forEach(row => {
                if (!userSlotsMap.has(row.user_id)) userSlotsMap.set(row.user_id, 0);
            });

            cursor = startDateLuxon; // Reset cursor
            while (cursor <= endDateLuxon) {
                const dayOfWeek = cursor.weekday === 7 ? 0 : cursor.weekday;
                const currentDateString = cursor.toISODate();
                
                const eligiblePeriods = PERIODS.filter(period => {
                    const periodNum = PERIOD_ORDER[period];
                    if (currentDateString === startDateStr && periodNum < PERIOD_ORDER[start_period]) return false; 
                    if (currentDateString === endDateStr && periodNum > PERIOD_ORDER[end_period]) return false;
                    return true;
                });

                for (const period of eligiblePeriods) {
                    const availableUserIds = slotAvailabilityMap.get(`${dayOfWeek}:${period}`) || [];
                    const count = availableUserIds.length;
                    
                    if (count > 0) {
                        // Add to the total slots for distribution
                        totalAvailabilitySlotsInCycle += count;
                        
                        // Add to each user's individual slot count
                        for (const userId of availableUserIds) {
                            userSlotsMap.set(userId, userSlotsMap.get(userId) + 1);
                        }
                    }
                }
                cursor = cursor.plus({ days: 1 }).startOf('day');
            }

            // 4.2. Get ALL non-admin users (to zero out those with 0 slots)
            const [allUsersRows] = await connection.execute(
                `SELECT user_id FROM users WHERE password_hash = ?`,
                 [MEMBER_NO_LOGIN_PASSWORD_HASH]
            );
            
            // 4.3. Handle scenarios where calculation is impossible
            if (totalAvailabilitySlotsInCycle === 0 || totalPointsPool === 0) {
                console.log(`[DEBUG LEGACY ${cycleId}] 3. (Zero Case) Pool or total slots is 0. Setting all non-admin objectives to 0.`);
                await connection.execute(
                    `INSERT INTO cycle_targets (cycle_id, user_id, weight_percent, point_objective)
                     SELECT ?, user_id, 0, 0 FROM users
                     WHERE password_hash = ?
                     ON DUPLICATE KEY UPDATE weight_percent = 0, point_objective = 0`,
                    [cycleId, MEMBER_NO_LOGIN_PASSWORD_HASH]
                );
                return; // Exit function
            }

            // 4.4. Prepare data for bulk update (Distribution logic)
            const updateData = [];
            const optedOutUserIds = [];

            for (const userRow of allUsersRows) {
                const userId = userRow.user_id;
                const user_slots = userSlotsMap.get(userId) || 0;

                if (user_slots > 0) {
                    const weight_percent = user_slots / totalAvailabilitySlotsInCycle;
                    const point_objective = totalPointsPool * weight_percent;
                    updateData.push([cycleId, userId, weight_percent, point_objective.toFixed(2)]);
                } else {
                    optedOutUserIds.push(userId);
                }
            }

            // 4.5. Bulk update (Opt-In)
            if (updateData.length > 0) {
                const updateSql = `
                    INSERT INTO cycle_targets (cycle_id, user_id, weight_percent, point_objective)
                    VALUES ?
                    ON DUPLICATE KEY UPDATE
                        weight_percent = VALUES(weight_percent),
                        point_objective = VALUES(point_objective)
                `;
                await connection.query(updateSql, [updateData]);
            }

            // 4.6. Set objectives for users opted out (0 slots)
            if (optedOutUserIds.length > 0) {
                const placeholders = optedOutUserIds.map(() => '?').join(',');
                await connection.execute(
                    `UPDATE cycle_targets SET point_objective = 0, weight_percent = 0 
                     WHERE cycle_id = ? AND user_id IN (${placeholders})`,
                    [cycleId, ...optedOutUserIds]
                );
            }
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
    /**
     * Re-calculates objectives using Group mode (Slot-Based Allocation).
     */
    static async recalculateGroup(cycleId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Fetch Cycle Info (Dates/Periods)
            const [cycleRow] = await connection.execute(
                "SELECT start_date, end_date, start_period, end_period FROM cycles WHERE cycle_id = ?",
                [cycleId]
            );
            if (!cycleRow.length) {
                await connection.rollback();
                return;
            }
            const { start_date, end_date, start_period, end_period } = cycleRow[0];
            const startDateStr = DateTime.fromJSDate(start_date).toISODate();
            const endDateStr = DateTime.fromJSDate(end_date).toISODate();


            // 2. Fetch all templates and availability
            const [templatesRows] = await connection.execute("SELECT template_id, points, time_of_day , default_headcount FROM task_templates");
            const [availabilitiesRows] = await connection.execute(
                `SELECT u.user_id, ma.day_of_week, ma.time_of_day
                 FROM cycle_availability ma -- <-- CHANGED
                 JOIN users u ON ma.user_id = u.user_id
                 WHERE u.password_hash = ?
                   AND ma.cycle_id = ?`, // <-- ADDED
                [MEMBER_NO_LOGIN_PASSWORD_HASH, cycleId]
            );
            // Fetch task logs (we need date, user_id, and template_id)
            const [logRows] = await connection.execute(
                "SELECT template_id, user_id, task_date FROM task_log WHERE cycle_id = ?",
                [cycleId]
            );

            // 3. Initialize Objective Map (Temporary Table Logic)
            const [allUsersRows] = await connection.execute(
                "SELECT user_id FROM users WHERE password_hash = ?", 
                [MEMBER_NO_LOGIN_PASSWORD_HASH]
            );
            
            const userObjectiveMap = new Map();
            allUsersRows.forEach(row => userObjectiveMap.set(row.user_id, 0));

            // Create Availability Map (Day:Period -> [Users])
            const slotAvailabilityMap = new Map(); 
            availabilitiesRows.forEach(row => {
                const key = `${row.day_of_week}:${row.time_of_day}`;
                if (!slotAvailabilityMap.has(key)) slotAvailabilityMap.set(key, []);
                slotAvailabilityMap.get(key).push(row.user_id);
            });

            // --- 4. NEW: Create Task Log Map ---
            // Key: "template_id:YYYY-MM-DD", Value: [{user_id: 1}, {user_id: null}]
            const logMap = new Map();
            for (const log of logRows) {
                const dateKey = DateTime.fromJSDate(log.task_date).toISODate(); // "YYYY-MM-DD"
                const key = `${log.template_id}:${dateKey}`;
                if (!logMap.has(key)) logMap.set(key, []);
                logMap.get(key).push(log);
            }
            
            // --- 5. Setup Date Iteration ---
            const startDateLuxon = DateTime.fromISO(startDateStr, { zone: TIMEZONE }).startOf('day');
            const endDateLuxon = DateTime.fromISO(endDateStr, { zone: TIMEZONE }).startOf('day');
            const PERIODS = ['Morning', 'Noon', 'Evening'];
            const PERIOD_ORDER = { 'Morning': 1, 'Noon': 2, 'Evening': 3 };

            // 6. Iterate Day-by-Day (Total Allocation Logic)
            let cursor = startDateLuxon;
            while (cursor <= endDateLuxon) {
                const dayOfWeek = cursor.weekday === 7 ? 0 : cursor.weekday;
                const currentDateString = cursor.toISODate(); // "YYYY-MM-DD"
                
                const eligiblePeriods = PERIODS.filter(period => {
                    const periodNum = PERIOD_ORDER[period];
                    if (currentDateString === startDateStr && periodNum < PERIOD_ORDER[start_period]) return false; 
                    if (currentDateString === endDateStr && periodNum > PERIOD_ORDER[end_period]) return false;
                    return true;
                });
                
                // 7. Iterate through eligible periods and distribute points
                eligiblePeriods.forEach(period => {
                    
                    // --- 7a. THIS IS YOUR NEW POOL CALCULATION LOGIC ---
                    let totalPointsForThisSlot = 0;
                    
                    // Find all templates that run in this period (e.g., "Delivery-Morning", "Cleaning-Morning")
                    const templatesForPeriod = templatesRows.filter(t => t.time_of_day === period);

                    for (const template of templatesForPeriod) {
                        const templateId = template.template_id;
                        const templatePoints = parseFloat(template.points) || 0;
                        const templateHeadcount = parseInt(template.default_headcount) || 1;

                        // Find the log entries for *this template* on *this date*
                        const logKey = `${templateId}:${currentDateString}`;
                        const entries = logMap.get(logKey) || [];
                        const num_entries = entries.length;

                        let pointsForThisTemplate = 0;
                        if (num_entries === 0) {
                            // Rule 1: No entries -> (points * headcount)
                            pointsForThisTemplate = (templatePoints * templateHeadcount);
                        } else if (num_entries === 1) {
                            // Rule 2: One entry
                            const entry = entries[0];
                            if (entry.user_id === null) {
                                // If "Done by Other", add 0
                                pointsForThisTemplate = 0; 
                            } else {
                                // If done by a user, add points
                                pointsForThisTemplate = templatePoints;
                            }
                        } else {
                            // Rule 3: num_entries > 1 -> (points * num_entries)
                            pointsForThisTemplate = (templatePoints * num_entries);
                        }
                        
                        totalPointsForThisSlot += pointsForThisTemplate;
                    }
                    // --- END OF NEW POOL CALCULATION ---
                    
                    
                    // 7b. Distribute the calculated pool (Unchanged logic)
                    const availableUserIds = slotAvailabilityMap.get(`${dayOfWeek}:${period}`) || [];
                    const count = availableUserIds.length;
                    
                    if (count > 0 && totalPointsForThisSlot > 0) {
                        const pointsToAdd = totalPointsForThisSlot / count; 
                        
                        for (const userId of availableUserIds) {
                            if (userObjectiveMap.has(userId)) {
                                userObjectiveMap.set(userId, userObjectiveMap.get(userId) + pointsToAdd);
                            }
                        }
                    }
                });
                
                cursor = cursor.plus({ days: 1 }).startOf('day');
            }
            
            // 6. Prepare final bulk update data
            const finalUpdateData = Array.from(userObjectiveMap.entries()).map(([userId, objective]) => {
                return [cycleId, userId, 0, objective]; // weight_percent is 0
            });

            // 7. Bulk insert/update the cycle_targets table
            if (finalUpdateData.length > 0) {
                const updateSql = `
                    INSERT INTO cycle_targets (cycle_id, user_id, weight_percent, point_objective)
                    VALUES ?
                    ON DUPLICATE KEY UPDATE
                        weight_percent = VALUES(weight_percent),
                        point_objective = VALUES(point_objective)
                `;
                await connection.query(updateSql, [finalUpdateData]);
            }
            
            // 8. Zero out objectives for system/admin accounts
             await connection.execute(
                 `UPDATE cycle_targets SET point_objective = 0, weight_percent = 0 
                  WHERE cycle_id = ? AND user_id NOT IN (
                    SELECT user_id FROM users WHERE password_hash = ?
                  )`,
                 [cycleId, MEMBER_NO_LOGIN_PASSWORD_HASH]
             );

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
    /**
     * Gets the full standings data AND calculates live priority.
     */
    static async getByCycle(cycle, cycleId) {
        const creditUpdateSql = `
            UPDATE cycle_targets ct
            LEFT JOIN (
                SELECT user_id, SUM(points_earned) AS total_taken
                FROM task_log
                WHERE cycle_id = ?
                GROUP BY user_id
            ) AS tasks ON ct.user_id = tasks.user_id
            SET 
                ct.credits_earned = IF(
            COALESCE(tasks.total_taken, 0) >= GREATEST(ct.point_objective, 1), 
            1, 
            0
        )
            WHERE 
                ct.cycle_id = ?;
        `;
        // We run this update *before* the SELECT to ensure the data we fetch is fresh.
        await pool.execute(creditUpdateSql, [cycleId, cycleId]);
        // --- 1. Get Base Data (Targets and Tasks) ---
        const params = [cycleId, cycleId];
        const sql = `
            SELECT
                u.user_id,
                u.name,
                ct.point_objective,
                ct.credits_earned,
                COALESCE(tasks.points_taken, 0) AS points_taken
            FROM users u
            INNER JOIN cycle_targets ct 
                ON u.user_id = ct.user_id AND ct.cycle_id = ?
            LEFT JOIN (
                SELECT user_id, SUM(points_earned) as points_taken
                FROM task_log
                WHERE cycle_id = ?
                GROUP BY user_id
            ) AS tasks ON u.user_id = tasks.user_id
            WHERE ct.point_objective > 0
        `;
        const [users] = await pool.execute(sql, params);

        const [availabilities] = await pool.execute(
            `SELECT user_id, day_of_week, time_of_day 
             FROM cycle_availability
             WHERE cycle_id = ?`, // <-- ADDED
             [cycleId]
        );
        
        const availabilityMap = new Map();
        for (const avail of availabilities) {
            if (!availabilityMap.has(avail.user_id)) {
                availabilityMap.set(avail.user_id, []);
            }
            availabilityMap.get(avail.user_id).push(avail);
        }

        const now = getNowInLocalTime(); // Uses the helper function above
        
        const safeDateLuxon = DateTime.fromJSDate(cycle.end_date, { zone: TIMEZONE });

        // 2. Critical Safety Check: If the date is invalid, set it to a known future value (or throw/return)
        if (!safeDateLuxon.isValid) {
            console.error("[CRITICAL STANDING MODEL ERROR] Cycle end date is invalid:", cycle.end_date);
            // If the date is invalid, we cannot proceed. Throwing an error is the safest action.
            throw new Error("Cycle end date retrieved from database is invalid.");
        }

        // 3. Extract the clean YYYY-MM-DD string
        const cycleEndDateStr = safeDateLuxon.toISODate();

        // 4. Use the stabilized date object for the helper call
        const cycleEndBoundary_JSDate = safeDateLuxon.startOf('day').toJSDate(); 
        const cycleEndPeriodStr = cycle.end_period;

        if (isNaN(cycleEndBoundary_JSDate.getTime())) {
            console.error("[CRITICAL STANDING MODEL ERROR] Failed to create valid end date from DB data:", cycle.end_date);
            // Optionally throw or return an empty array here if the cycle data is critical
        }

    
        // --- 3. Process each user ---
        const processedStandings = users.map(user => {
            const objective = parseFloat(user.point_objective) || 0;
            const taken = parseFloat(user.points_taken) || 0;
            const points_remaining = Math.max(0, objective - taken);
            
            const availabilityData = availabilityMap.get(user.user_id) || [];
            
            // --- 4. CALL THE COPIED HELPER FUNCTION ---
            const priorityData = calculatePriority(
                { availabilityData: availabilityData, points_remaining: points_remaining }, 
                cycleEndBoundary_JSDate,
                cycleEndPeriodStr // Pass the stabilized JS Date object
            );
            
            let ratio = 0;
            if (objective > 0) {
                ratio = taken / objective;
            } else if (taken > 0) {
                ratio = Infinity;
            }

            const credits_earned = (taken >= Math.max(objective, 1)) ? 1 : 0;

            return {
                ...user,
                point_objective: objective,
                points_taken: taken,
                credits_earned: credits_earned,
                ...priorityData, // Adds urgency_weight, periods_remaining, etc.
                ratio: ratio
            };
        });

        return processedStandings;
    }
}