// backend/models/authModel.js

import pool from '../utils/db.js';

export class AuthModel {
    
    // Finds a user (member) by their username (name column)
    static async getUserByUsername(username) {
        try {
            const [rows] = await pool.query(
                `SELECT user_id, name, password_hash 
                 FROM users 
                 WHERE name = ?`, 
                [username]
            );
            // Return the first user found (should only be one since name is UNIQUE)
            return rows[0]; 
        } catch (error) {
            throw error;
        }
    }
    
    // Finds a user (member) by their ID (used for checkSession)
    static async getUserById(userId) {
        try {
            const [rows] = await pool.query(
                `SELECT user_id, name 
                 FROM users 
                 WHERE user_id = ?`, 
                [userId]
            );
            return rows[0];
        } catch (error) {
            throw error;
        }
    }
}