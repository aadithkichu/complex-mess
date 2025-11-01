import pool from './db.js';

/**
 * Finds the currently active cycle.
 * @returns {object | null} The cycle object or null if none is active.
 */
export const getCurrentCycle = async () => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM cycles 
       WHERE start_date <= NOW() AND end_date >= NOW() 
       LIMIT 1`
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Error fetching current cycle:", error);
    return null;
  }
};