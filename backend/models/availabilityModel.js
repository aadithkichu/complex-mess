import pool from '../utils/db.js';

export class AvailabilityModel {

    /**
     * Fetches the summary of availability for all users.
     * Returns the exact structure the frontend grid needs.
     */
    static async getSummary() {
        const sql = `
            SELECT
                day_of_week,
                time_of_day,
                COUNT(user_id) AS count,
                -- Use GROUP_CONCAT to get a comma-separated list of user IDs
                GROUP_CONCAT(user_id) AS users
            FROM
                member_availability
            GROUP BY
                day_of_week, time_of_day;
        `;
        
        const [rows] = await pool.execute(sql);

        // 1. Initialize an empty grid structure
        const summary = {};
        for (let day = 0; day <= 6; day++) {
            summary[day] = {
                'Morning': { count: 0, users: [] },
                'Noon':    { count: 0, users: [] },
                'Evening': { count: 0, users: [] }
            };
        }

        // 2. Fill the grid with data from the database
        for (const row of rows) {
            const day = row.day_of_week;
            const period = row.time_of_day;
            
            summary[day][period] = {
                count: parseInt(row.count, 10),
                // Split the comma-separated string into an array of numbers
                users: row.users ? row.users.split(',').map(Number) : []
            };
        }

        return summary;
    }

    /**
     * Updates the availability for a single time slot.
     * It deletes all existing entries for that slot and re-inserts the new list.
     */
    static async setSlot(day, period, userIds) {
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();

            // 1. Delete all users from this slot
            const deleteSql = "DELETE FROM member_availability WHERE day_of_week = ? AND time_of_day = ?";
            await connection.execute(deleteSql, [day, period]);

            // 2. If there are users to add, insert them
            if (userIds && userIds.length > 0) {
                // Build a query like: INSERT INTO ... VALUES (1, 1, 'Noon'), (2, 1, 'Noon'), ...
                const values = userIds.map(userId => [userId, day, period]);
                const insertSql = "INSERT INTO member_availability (user_id, day_of_week, time_of_day) VALUES ?";
                
                await connection.query(insertSql, [values]);
            }

            // 3. Commit the transaction
            await connection.commit();
            
        } catch (error) {
            await connection.rollback();
            console.error("Error in setSlot transaction:", error);
            throw error; // Re-throw to be caught by the controller
        } finally {
            connection.release();
        }
    }

    /**
     * Updates the availability for a full day.
     * Deletes all entries for the day and re-inserts based on isChecked.
     */
    static async setFullDay(day, isChecked, allUserIds) {
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            // 1. Delete all users from this entire day
            const deleteSql = "DELETE FROM member_availability WHERE day_of_week = ?";
            await connection.execute(deleteSql, [day]);

            // 2. If the "Select All" box was checked, re-insert all users for all periods
            if (isChecked && allUserIds && allUserIds.length > 0) {
                const values = [];
                for (const userId of allUserIds) {
                    values.push([userId, day, 'Morning']);
                    values.push([userId, day, 'Noon']);
                    values.push([userId, day, 'Evening']);
                }
                
                const insertSql = "INSERT INTO member_availability (user_id, day_of_week, time_of_day) VALUES ?";
                await connection.query(insertSql, [values]);
            }

            // 3. Commit the transaction
            await connection.commit();
            
        } catch (error) {
            await connection.rollback();
            console.error("Error in setFullDay transaction:", error);
            throw error;
        } finally {
            connection.release();
        }
    }
}