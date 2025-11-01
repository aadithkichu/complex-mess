import pool from '../utils/db.js';

export class UserModel {
  
  // --- Create a new member ---
  static async create({ name, mess_active_until }) {
    try {
      const [result] = await pool.query(
        'INSERT INTO users (name, password_hash, mess_active_until) VALUES (?, ?, ?)',
        [name, 'N/A_MEMBER_NO_LOGIN', mess_active_until || null]
      );
      return { id: result.insertId, name, mess_active_until };
    } catch (error) {
      throw error;
    }
  }

  // --- Get all members ---
  static async getAll() {
    try {
      const [rows] = await pool.query('SELECT user_id, name, mess_active_until FROM users');
      return rows;
    } catch (error) {
      throw error;
    }
  }

  // --- (Your existing create, getAll, update, delete functions are here) ---

// --- NEW FUNCTIONS FOR USER PROFILE ---

// Gets the user's base info (replaces your old getById)
static async getUserBaseInfo(userId) {
  try {
    const [rows] = await pool.query(
      'SELECT user_id, name, mess_active_until FROM users WHERE user_id = ?', 
      [userId]
    );
    return rows[0];
  } catch (error) {
    throw error;
  }
}

// Gets the user's target for the *current* cycle
static async getUserCurrentTarget(userId, cycleId) {
  try {
    const [rows] = await pool.query(
      'SELECT point_objective FROM cycle_targets WHERE user_id = ? AND cycle_id = ?', 
      [userId, cycleId]
    );
    return rows[0];
  } catch (error) {
    throw error;
  }
}

// Gets the user's total earned points for the *current* cycle
static async getUserCurrentEarned(userId, cycleId) {
  try {
    const [rows] = await pool.query(
      `SELECT SUM(points_earned) AS total_earned
       FROM task_log 
       WHERE user_id = ? AND cycle_id = ?`,
      [userId, cycleId]
    );
    // SUM can return NULL if no rows, so we default to 0
    return rows[0]?.total_earned || 0; 
  } catch (error) {
    throw error;
  }
}

// Gets the user's weekly availability
static async getUserAvailability(userId) {
  try {
    const [rows] = await pool.query(
      'SELECT day_of_week, time_of_day FROM member_availability WHERE user_id = ? ORDER BY day_of_week', 
      [userId]
    );
    // Format this into a cleaner array
    const dayMap = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return rows.map(slot => `${dayMap[slot.day_of_week]}-${slot.time_of_day}`);
  } catch (error) {
    throw error;
  }
}

// Gets the user's 5 most recent completed tasks
static async getUserTaskHistory(userId) {
  try {
    const [rows] = await pool.query(
      `SELECT t.task_name, t.time_of_day, tl.task_datetime, tl.points_earned
       FROM task_log tl
       JOIN task_templates t ON tl.template_id = t.template_id
       WHERE tl.user_id = ?
       ORDER BY tl.task_datetime DESC
       LIMIT 5`,
      [userId]
    );
    return rows;
  } catch (error) {
    throw error;
  }
}

  // --- Update a member ---
  static async update(userId, { name, mess_active_until }) {
     try {
      const [result] = await pool.query(
        'UPDATE users SET name = ?, mess_active_until = ? WHERE user_id = ?',
        [name, mess_active_until || null, userId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  // --- Delete a member ---
  static async delete(userId) {
     try {
      const [result] = await pool.query('DELETE FROM users WHERE user_id = ?', [userId]);
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }
}