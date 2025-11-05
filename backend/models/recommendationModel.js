import pool from '../utils/db.js';
import { DateTime } from 'luxon';
import { TIMEZONE, TIME_PERIODS } from '../utils/timeConstants.js';
import { calculatePriority } from '../utils/priorityCalculator.js';

// Constant for non-admin hash
const MEMBER_NO_LOGIN_PASSWORD_HASH = 'N/A_MEMBER_NO_LOGIN';
const PERIOD_ORDER = { 'Morning': 1, 'Noon': 2, 'Evening': 3 };

// models/recommendationModel.js

export class RecommendationModel {

    static async generate(cycle) {
        const cycleId = cycle.cycle_id;
        const connection = await pool.getConnection();
        
        try {
            // --- 1. GET ALL NECESSARY DATA ---
            
            const [users] = await connection.execute(
                "SELECT user_id, name FROM users WHERE password_hash = ?", 
                [MEMBER_NO_LOGIN_PASSWORD_HASH]
            );
            const [targets] = await connection.execute(
                "SELECT user_id, point_objective FROM cycle_targets WHERE cycle_id = ?",
                [cycleId]
            );
            const [tasks] = await connection.execute(
                `SELECT user_id, SUM(points_earned) as points_taken
                 FROM task_log
                 WHERE cycle_id = ? AND user_id IS NOT NULL
                 GROUP BY user_id`,
                [cycleId]
            );
            const [availabilities] = await connection.execute(
                "SELECT user_id, day_of_week, time_of_day FROM cycle_availability WHERE cycle_id = ?",
                [cycleId]
            );
            const [templatesRows] = await connection.execute(
                "SELECT template_id, task_name, points, time_of_day, default_headcount FROM task_templates"
            );
            
            // Get logs (we need user_id to check for 'null')
            const [loggedRows] = await connection.execute(
                "SELECT template_id, task_date, user_id FROM task_log WHERE cycle_id = ?",
                [cycleId]
            );

            // --- 2. PRE-PROCESS DATA FOR ALGORITHM ---

            // Map availability (Key: 'user_id', Value: Set of 'Day:Period')
            const userAvailabilityMap = new Map();
            for (const user of users) {
                userAvailabilityMap.set(user.user_id, new Set());
            }
            for (const avail of availabilities) {
                if (userAvailabilityMap.has(avail.user_id)) {
                    userAvailabilityMap.get(avail.user_id).add(`${avail.day_of_week}:${avail.time_of_day}`);
                }
            }

            const slotAvailabilityMap = new Map(); // Key: 'Day:Period', Value: [user_ids]
            availabilities.forEach(row => {
                const key = `${row.day_of_week}:${row.time_of_day}`;
                if (!slotAvailabilityMap.has(key)) {
                    slotAvailabilityMap.set(key, []);
                }
                slotAvailabilityMap.get(key).push(row.user_id);
            });

            // Map points taken (Key: 'user_id', Value: points)
            const pointsTakenMap = new Map();
            tasks.forEach(task => pointsTakenMap.set(task.user_id, parseFloat(task.points_taken)));

            // --- MODIFIED: Log Map (Key: 'template_id:YYYY-MM-DD') ---
            // Value: { count: 2, isDoneByOther: false }
            const logMap = new Map();
            loggedRows.forEach(log => {
                const dateKey = DateTime.fromJSDate(log.task_date).toISODate();
                const key = `${log.template_id}:${dateKey}`;
                
                const data = logMap.get(key) || { count: 0, isDoneByOther: false };
                data.count++;
                if (log.user_id === null) { // Check for "Done by Other"
                    data.isDoneByOther = true;
                }
                logMap.set(key, data);
            });

            const now = DateTime.now().setZone(TIMEZONE);
            const cycleEndBoundary_JSDate = DateTime.fromJSDate(cycle.end_date, { zone: TIMEZONE }).startOf('day').toJSDate();

            // --- 3. CALCULATE PRIORITY FOR ALL USERS ---
            // (This logic remains the same)
            const userPriorityList = users.map(user => {
                const target = targets.find(t => t.user_id === user.user_id);
                const objective = parseFloat(target?.point_objective) || 0;
                const taken = pointsTakenMap.get(user.user_id) || 0;
                const points_remaining = Math.max(0, objective - taken);
                const availabilityData = availabilities.filter(a => a.user_id === user.user_id);
                
                const priorityData = calculatePriority(
                    { availabilityData, points_remaining },
                    cycleEndBoundary_JSDate,
                    cycle.end_period
                );
                
                return {
                    user_id: user.user_id,
                    name: user.name,
                    points_remaining: priorityData.points_remaining,
                    urgency_weight: priorityData.urgency_weight,
                    last_available_date: priorityData.last_available_day,
                };
            })
            .filter(u => u.urgency_weight > 0) 
            .sort((a, b) => b.urgency_weight - a.urgency_weight);
            
            // --- 4. BUILD THE "SLOT MASTER LIST" (NEW LOGIC) ---
            const slotMasterList = [];
            const startDateLuxon = DateTime.fromJSDate(cycle.start_date, { zone: TIMEZONE }).startOf('day');
            const endDateLuxon = DateTime.fromJSDate(cycle.end_date, { zone: TIMEZONE }).startOf('day');
            
            const PERIODS = ['Morning', 'Noon', 'Evening']; // Define PERIODS

            // 4a. Iterate from cycle start date
            let cursor = startDateLuxon; 
            while (cursor <= endDateLuxon) {
                const dayOfWeek = cursor.weekday === 7 ? 0 : cursor.weekday;
                const currentDateString = cursor.toISODate(); // 'YYYY-MM-DD'
                
                const eligiblePeriods = PERIODS.filter(period => {
                    const periodNum = PERIOD_ORDER[period];
                    if (currentDateString === startDateLuxon.toISODate() && periodNum < PERIOD_ORDER[cycle.start_period]) return false; 
                    if (currentDateString === endDateLuxon.toISODate() && periodNum > PERIOD_ORDER[cycle.end_period]) return false;
                    return true;
                });

                // 4b. For each eligible period on this day...
                for (const period of eligiblePeriods) {
                    
                    // --- YOUR LOGIC ---
                    // 1. Check if at least one user is available for this slot (Day + Period)
                    const availableUserIds = slotAvailabilityMap.get(`${dayOfWeek}:${period}`) || [];
                    if (availableUserIds.length > 0) {
                        // 2. Find all tasks (templates) for this period
                        const templatesForThisPeriod = templatesRows.filter(t => t.time_of_day === period);

                        for (const template of templatesForThisPeriod) {
                            
                            // 3. Check if this specific task is already logged
                            const slotKey = `${template.template_id}:${currentDateString}`;
                            const logData = logMap.get(slotKey) || { count: 0, isDoneByOther: false };

                            if (logData.count === 0 && !logData.isDoneByOther) {
                                // 4. If NO entries exist, add ALL slots for this task
                                const defaultHeadcount = parseInt(template.default_headcount) || 1;
                                const templatePoints = parseFloat(template.points) || 0;

                                for (let i = 0; i < defaultHeadcount; i++) {
                                    slotMasterList.push({
                                        key: `${slotKey}:${i}`, // "templateId:date:index"
                                        date: currentDateString,
                                        dayOfWeek: dayOfWeek,
                                        period: period,
                                        task_name: template.task_name,
                                        templatePoints: templatePoints, // Points per slot
                                    });
                                }
                            }
                        }
                    }
                    // --- END YOUR LOGIC ---
                }
                // 4e. Move to the next day
                cursor = cursor.plus({ days: 1 });
            }

            // Sort the entire list chronologically (this part is correct)
            slotMasterList.sort((a, b) => {
                if (a.date < b.date) return -1;
                if (a.date > b.date) return 1;
                const periodOrderA = PERIOD_ORDER[a.period];
                const periodOrderB = PERIOD_ORDER[b.period];
                return periodOrderA - periodOrderB;
            });
            const recommendations = [];
            const assignedSlots = new Set(); // Tracks unique slot keys ("2:2025-11-03:0")

            // 5a. Calculate the jump distance
            const numUsers = userPriorityList.length;
            const numSlots = slotMasterList.length;
            // Ensure we don't divide by zero if no users/slots
            const jumpDistance = (numUsers > 0 && numSlots > 0) 
                ? Math.ceil(numSlots / numUsers) 
                : 1;


            // 5b. Loop 1: Iterate through each user (Highest urgency first)
            for (const user of userPriorityList) {
                let pointsToClear = user.points_remaining;
                const userAvail = userAvailabilityMap.get(user.user_id);
                const lastAvailDate = user.last_available_date;

                if (pointsToClear <= 0) continue; // Skip user if they are already clear

                // 5c. Loop 2: This user's personal search loop
                // We start this user's search from the beginning of the slot list
                let currentIndex = 0; 
                while (pointsToClear > 0 && currentIndex < slotMasterList.length) {
                    
                    let slotFound = false;
                    
                    // 5d. Loop 3: Find the next available slot for this user
                    for (let j = currentIndex; j < slotMasterList.length; j++) {
                        const slot = slotMasterList[j];
                        if (lastAvailDate && slot.date > lastAvailDate) {
                            currentIndex = slotMasterList.length; // Force while loop exit
                            slotFound = true; // Prevent "user is done" break
                            break; 
                        }
                        const slotAvailKey = `${slot.dayOfWeek}:${slot.period}`;

                        // Check if slot is taken AND if user is available
                        if (!assignedSlots.has(slot.key) && userAvail.has(slotAvailKey)) {
                            
                            // --- ASSIGNMENT ---
                            recommendations.push({
                                date: slot.date,
                                period: slot.period,
                                task_name: slot.task_name,
                                user_name: user.name,
                            });
                            assignedSlots.add(slot.key);
                            pointsToClear -= slot.templatePoints;
                            // --- END ASSIGNMENT ---

                            // Set the new starting point for this user's *next* search
                            currentIndex = j + jumpDistance;
                            slotFound = true;
                            
                            // Break from the inner (j) loop to restart the search
                            break; 
                        }
                    }

                    // If the inner loop (j) finished without finding a slot,
                    // this user is done.
                    if (!slotFound) {
                        break; // Break from the while loop
                    }
                }
            }
            recommendations.sort((a, b) => {
                // 1. Compare by date string (a.date < b.date)
                if (a.date < b.date) return -1;
                if (a.date > b.date) return 1;
                
                // 2. Compare by period order (Morning < Noon < Evening)
                const periodOrderA = PERIOD_ORDER[a.period];
                const periodOrderB = PERIOD_ORDER[b.period];
                return periodOrderA - periodOrderB; 
            });
            return recommendations;

        } catch (error) {
            console.error("Error in RecommendationModel.generate:", error);
            throw error;
        } finally {
            if (connection) connection.release();
        }
    }
}