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
            (
                -- Get available users FROM THE SNAPSHOT
                SELECT u.user_id, u.name
                FROM users u
                JOIN cycle_availability ma ON u.user_id = ma.user_id -- <-- CHANGED
                WHERE ma.day_of_week = ? 
                  AND ma.time_of_day = ?
                  AND ma.cycle_id = ? -- <-- ADDED
            )
            UNION
            (
                -- Get users already logged for this slot (in case they are no longer available)
                SELECT u.user_id, u.name
                FROM users u
                JOIN task_log tl ON u.user_id = tl.user_id
                WHERE tl.cycle_id = ? AND tl.template_id = ? AND tl.task_date = ?
            )
            ORDER BY name ASC
        `;
        // Parameters: dayKey, period, cycleId, templateId, dateString
        const [rows] = await pool.execute(sql, [dayKey, period, cycleId, cycleId , templateId, dateString]);
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