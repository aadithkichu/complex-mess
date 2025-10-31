// Import the database pool we just created
import pool from '../utils/db.js';

export class UserModel {
  
  static async getAll() {
    try {
      const [rows] = await pool.query('SELECT * FROM users');
      return rows;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw new Error('Failed to fetch users');
    }
  }

  // ... other functions like findById, create, etc.
}