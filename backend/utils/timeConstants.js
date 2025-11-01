// backend/utils/timeConstants.js
import { DateTime } from 'luxon';

export const TIMEZONE = 'Asia/Kolkata'; // IST (Paravur, Kerala, India)

export const TIME_PERIODS = {
    Morning: { start_time: '06:00:00', end_time: '11:00:00' },
    Noon: { start_time: '11:00:01', end_time: '17:00:00' },
    Evening: { start_time: '17:00:01', end_time: '23:59:59' },
};

// Helper to get the current time in the local time zone
export const getNowInLocalTime = () => {
    return DateTime.now().setZone(TIMEZONE);
};

/**
 * Converts a JS Date object to a local YYYY-MM-DD string,
 * ignoring time zone conversions.
 * @param {Date} dateObj - The Date object (e.g., from mysql2)
 * @returns {string} - YYYY-MM-DD
 */
export const toLocalISOString = (dateObj) => {
    // We must use local getters to prevent time zone shift
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Combines date string and period string
export const getBoundaryDateTime = (date, period, isStart) => {
    if (!TIME_PERIODS[period]) {
        throw new Error(`Invalid time period: ${period}`);
    }
    const timePart = isStart 
        ? TIME_PERIODS[period].start_time 
        : TIME_PERIODS[period].end_time;
    return `${date} ${timePart}`;
};

// backend/utils/timeConstants.js

// Finds the correct period for a given HH:MM:SS time string
export const findPeriodForTime = (timeStr) => {
    if (timeStr >= TIME_PERIODS.Morning.start_time && timeStr <= TIME_PERIODS.Morning.end_time) {
        return 'Morning';
    }
    if (timeStr >= TIME_PERIODS.Noon.start_time && timeStr <= TIME_PERIODS.Noon.end_time) {
        return 'Noon';
    }
    if (timeStr >= TIME_PERIODS.Evening.start_time && timeStr <= TIME_PERIODS.Evening.end_time) {
        return 'Evening';
    }
    
    // CRITICAL FIX: If the time is in the gap (e.g., 00:00:00 to 05:59:59),
    // it does not belong to *any* period on this day.
    return null; 
};