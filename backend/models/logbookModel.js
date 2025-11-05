import pool from '../utils/db.js';

export class LogbookModel {

    // Fetches minimal data to show the green checkmark on the grid
    static async getGridLogs(cycleId, templateIds) {
        const sql = `
            SELECT DISTINCT
                task_date,
                time_period
            FROM task_log
            WHERE cycle_id = ? AND template_id IN (?)
        `;
        // Query must use task_date and time_period columns
        const [rows] = await pool.query(sql, [cycleId, templateIds]);
        
        // Map to the format the frontend Set expects: "YYYY-MM-DD:Period"
        return rows.map(row => ({
            task_datetime: row.task_date, // Re-use the key name for frontend compatibility
            time_of_day: row.time_period
        }));
    }

    // models/logbookModel.js

    /// models/logbookModel.js

    // Updated Union Query: Used by LogTaskModal to combine availability and existing logs
    static async getAvailableUsers(dayKey, period, cycleId, templateId, dateString) {
        const sql = `
           WITH SlotCheck AS (
                SELECT 
                    EXISTS (
                        SELECT 1
                        FROM cycle_availability ca
                        WHERE ca.day_of_week = ?  -- Param 1: dayKey
                        AND ca.time_of_day = ?  -- Param 2: period
                        AND ca.cycle_id = ?     -- Param 3: cycleId
                    ) AS is_active
            )

            -- 2. Get ALL users, but only if SlotCheck.is_active is true
            (
                SELECT u.user_id, u.name
                FROM users u
                CROSS JOIN SlotCheck sc
                WHERE sc.is_active = 1  -- <-- This part is GATED
            )
            UNION
            -- 3. Get users already logged (this part is NOT gated)
            (
                SELECT u.user_id, u.name
                FROM users u
                JOIN task_log tl ON u.user_id = tl.user_id
                WHERE tl.cycle_id = ?     -- Param 4: cycleId
                AND tl.template_id = ?  -- Param 5: templateId
                AND tl.task_date = ?    -- Param 6: dateString
            )
            ORDER BY name ASC;
        `;
        // Parameters: dayKey, period, cycleId, templateId, dateString
        const [rows] = await pool.execute(sql, [dayKey, period, cycleId, cycleId, templateId, dateString]);
        return rows;
    }

    static async getSlotLog(cycleId, templateId, dateString) {
        const sql = `
            SELECT user_id, notes, time_period
            FROM task_log
            WHERE cycle_id = ? AND template_id = ? AND task_date = ?
        `;
        // Query by task_date (dateString is 'YYYY-MM-DD')
        const [rows] = await pool.execute(sql, [cycleId, templateId, dateString]);

        if (rows.length === 0) {
            return { users: [], is_done_by_other: false, notes: '' };
        }
        
        // Check for the "Done by Other" case
        if (rows[0].user_id === null) {
            return { users: [], is_done_by_other: true, notes: rows[0].notes || '' };
        }

        // Otherwise, return the list of users
        return {
            users: rows.map(r => ({ user_id: r.user_id })),
            is_done_by_other: false,
            notes: rows[0].notes || ''
        };
    }

    // Deletes all entries for a slot. This is run before any new insert.
    static async clearSlot(cycleId, templateId, dateString) {
        const sql = `
            DELETE FROM task_log
            WHERE cycle_id = ? AND template_id = ? AND task_date = ?
        `;
        await pool.execute(sql, [cycleId, templateId, dateString]);
    }

    // Inserts a single "Done by Other" log
    static async logOther(cycleId, templateId, dateString, period, notes) {
        const sql = `
            INSERT INTO task_log (cycle_id, template_id, task_date, time_period, user_id, points_earned, notes)
            VALUES (?, ?, ?, ?, NULL, 0, ?)
        `;
        await pool.execute(sql, [cycleId, templateId, dateString, period, notes]);
    }

    static async logUsers(cycleId, templateId, dateString, period, userIds, pointsPerUser, notes) {
        const values = userIds.map(userId => [
            cycleId,
            templateId,
            dateString,
            period,
            userId,
            pointsPerUser,
            notes
        ]);
        
        const sql = `
            INSERT INTO task_log (cycle_id, template_id, task_date, time_period, user_id, points_earned, notes)
            VALUES ?
        `;
        await pool.query(sql, [values]);
    }
}