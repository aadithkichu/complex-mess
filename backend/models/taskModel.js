// backend/models/taskModel.js

import pool from '../utils/db.js';

export class TaskModel {

    static async getById(templateId) {
        const sql = "SELECT * FROM task_templates WHERE template_id = ?";
        const [rows] = await pool.execute(sql, [templateId]);
        return rows[0];
    }

    /**
     * @description Get all task templates
     * @returns {Promise<Array>} A list of all task templates
     */
    static async getAll() {
        try {
            const [rows] = await pool.query(
                'SELECT * FROM task_templates ORDER BY time_of_day, task_name'
            );
            return rows;
        } catch (error) {
            console.error('[TaskModel ERROR] Failed to get all templates:', error);
            throw new Error('Database error fetching task templates.');
        }
    }

    /**
     * @description Create a new task template
     * @param {object} taskData - { task_name, time_of_day, points, default_headcount }
     * @returns {Promise<number>} The ID of the newly inserted task
     */
    static async create({ task_name, time_of_day, points, default_headcount }) {
        try {
            const [result] = await pool.query(
                `INSERT INTO task_templates (task_name, time_of_day, points, default_headcount) 
                 VALUES (?, ?, ?, ?)`,
                [task_name, time_of_day, points, default_headcount]
            );
            return result.insertId;
        } catch (error) {
            console.error('[TaskModel ERROR] Failed to create template:', error);
            throw new Error('Database error creating task template.');
        }
    }

    /**
     * @description Update an existing task template
     * @param {number} templateId - The ID of the task to update
     * @param {object} taskData - { task_name, time_of_day, points, default_headcount }
     * @returns {Promise<boolean>} True if update was successful
     */
    static async update(templateId, { task_name, time_of_day, points, default_headcount }) {
        try {
            const [result] = await pool.query(
                `UPDATE task_templates 
                 SET task_name = ?, time_of_day = ?, points = ?, default_headcount = ? 
                 WHERE template_id = ?`,
                [task_name, time_of_day, points, default_headcount, templateId]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('[TaskModel ERROR] Failed to update template:', error);
            throw new Error('Database error updating task template.');
        }
    }

    /**
     * @description Delete a task template
     * @param {number} templateId - The ID of the task to delete
     * @returns {Promise<boolean>} True if deletion was successful
     */
    static async delete(templateId) {
        try {
            // Note: You may want to add a check here to prevent deletion
            // if the template is currently used in an active task_log.
            const [result] = await pool.query('DELETE FROM task_templates WHERE template_id = ?', [templateId]);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('[TaskModel ERROR] Failed to delete template:', error);
            // Handle foreign key constraint error (if task is in use)
            if (error.code === 'ER_ROW_IS_REFERENCED_2') {
                throw new Error('Cannot delete task: It is already used in the task log.');
            }
            throw new Error('Database error deleting task template.');
        }
    }
}