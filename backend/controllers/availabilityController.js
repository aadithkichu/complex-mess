import { AvailabilityModel } from '../models/availabilityModel.js';
// GET /api/availability/summary
export const getAvailabilitySummary = async (req, res) => {
    try {
        const summary = await AvailabilityModel.getSummary();
        res.status(200).json(summary);
    } catch (error) {
        res.status(500).json({ message: "Error fetching availability summary", error: error.message });
    }
};

// POST /api/availability/slot
export const setSlotAvailability = async (req, res) => {
    try {
        const { day, period, userIds } = req.body;

        // Basic validation
        if (day === undefined || !period || !userIds) {
            return res.status(400).json({ message: "Missing required fields: day, period, userIds" });
        }

        await AvailabilityModel.setSlot(day, period, userIds);
        res.status(200).json({ message: "Slot updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error updating slot", error: error.message });
    }
};

// POST /api/availability/fullday
export const setFullDayAvailability = async (req, res) => {
    try {
        const { day, isChecked, allUserIds } = req.body;

        // Basic validation
        if (day === undefined || isChecked === undefined || !allUserIds) {
            return res.status(400).json({ message: "Missing required fields: day, isChecked, allUserIds" });
        }

        await AvailabilityModel.setFullDay(day, isChecked, allUserIds);
        res.status(200).json({ message: "Full day updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error updating full day", error: error.message });
    }
};