// backend/controllers/taskController.js

import { TaskModel } from '../models/taskModel.js';

// --- PUBLIC: Get all task templates ---
export const getAllTemplates = async (req, res) => {
    try {
        const templates = await TaskModel.getAll();
        res.status(200).json(templates);
    } catch (error) {
        console.error('[taskController ERROR] getAllTemplates:', error);
        res.status(500).json({ message: error.message });
    }
};

// --- ADMIN: Create a new task template ---
export const createTemplate = async (req, res) => {
    try {
        const { task_name, time_of_day, points, default_headcount } = req.body;
        if (!task_name || !time_of_day || !points || !default_headcount) {
            return res.status(400).json({ message: 'Missing required fields.' });
        }
        
        const newId = await TaskModel.create(req.body);
        res.status(201).json({ message: 'Task template created successfully.', template_id: newId });
    } catch (error) {
        console.error('[taskController ERROR] createTemplate:', error);
        res.status(500).json({ message: error.message });
    }
};

// --- ADMIN: Update an existing task template ---
export const updateTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const { task_name, time_of_day, points, default_headcount } = req.body;
        if (!task_name || !time_of_day || !points || !default_headcount) {
            return res.status(400).json({ message: 'Missing required fields.' });
        }
        
        const updated = await TaskModel.update(id, req.body);
        if (!updated) {
            return res.status(404).json({ message: 'Task template not found.' });
        }
        res.status(200).json({ message: 'Task template updated successfully.' });
    } catch (error) {
        console.error('[taskController ERROR] updateTemplate:', error);
        res.status(500).json({ message: error.message });
    }
};

// --- ADMIN: Delete a task template ---
export const deleteTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await TaskModel.delete(id);
        if (!deleted) {
            return res.status(404).json({ message: 'Task template not found.' });
        }
        res.status(200).json({ message: 'Task template deleted successfully.' });
    } catch (error) {
        console.error('[taskController ERROR] deleteTemplate:', error);
        res.status(500).json({ message: error.message });
    }
};