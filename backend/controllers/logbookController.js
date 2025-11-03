import { LogbookModel } from '../models/logbookModel.js';
import { TaskModel } from '../models/taskModel.js';

// GET /api/logbook/grid
export const getTaskLogsForGrid = async (req, res) => {
    try {
        const { cycleId, templates } = req.query;
        if (!cycleId || !templates) {
            return res.status(400).json({ message: 'Missing cycleId or templates' });
        }
        const templateIds = templates.split(',').map(Number);
        const logs = await LogbookModel.getGridLogs(cycleId, templateIds);
        res.status(200).json(logs);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching grid logs', error: error.message });
    }
};

/// GET /api/logbook/available
export const getAvailableUsersForSlot = async (req, res) => {
    try {
        const { day, period, cycleId, templateId, date } = req.query;
        if (!day || !period || !cycleId || !templateId || !date) {
            return res.status(400).json({ message: 'Missing required query parameters' });
        }
        const users = await LogbookModel.getAvailableUsers(day, period, cycleId, templateId, date);
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching available users', error: error.message });
    }
};

export const getTaskLogForSlot = async (req, res) => {
    try {
        const { cycleId, templateId, date } = req.query;
        if (!cycleId || !templateId || !date) {
            return res.status(400).json({ message: 'Missing params' });
        }
        // date is already passed as 'YYYY-MM-DD' from the frontend
        const dateString = date; 
        
        const slotData = await LogbookModel.getSlotLog(cycleId, templateId, dateString);
        res.status(200).json(slotData);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching slot log', error: error.message });
    }
};

// POST /api/logbook
export const logTask = async (req, res) => {
    try {
        const {
            cycle_id,
            template_id,
            task_datetime, // This is now a 'YYYY-MM-DD HH:MM:SS' string from frontend
            user_ids, 
            is_done_by_other,
            notes
        } = req.body;

        // Extract the DATE part
        const dateString = task_datetime.substring(0, 10); // 'YYYY-MM-DD'
        
        // Fetch the template to get the TIME PERIOD
        const template = await TaskModel.getById(template_id);
        if (!template) {
            return res.status(404).json({ message: 'Task template not found' });
        }
        const period = template.time_of_day; // e.g., 'Morning'

        // 1. Clear any existing logs for this exact slot
        await LogbookModel.clearSlot(cycle_id, template_id, dateString);

        if (is_done_by_other) {
            // 2a. Log as "Done by Other"
            await LogbookModel.logOther(cycle_id, template_id, dateString, period, notes);
        } else if (user_ids && user_ids.length > 0) {
            // 2b. Log for specific users
            const totalPoints = parseFloat(template.points);
            const points_per_user = totalPoints;

            await LogbookModel.logUsers(cycle_id, template_id, dateString, period, user_ids, points_per_user, notes);
        }
        
        res.status(201).json({ message: 'Task logged successfully' });

    } catch (error) {
        res.status(500).json({ message: 'Error logging task', error: error.message });
    }
};