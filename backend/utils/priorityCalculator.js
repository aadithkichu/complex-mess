import { DateTime } from 'luxon';

// --- Replicating Constants from your timeConstants.js ---
const TIMEZONE = 'Asia/Kolkata'; 
const TIME_PERIODS = {
    Morning: { start_time: '06:00:00', end_time: '11:00:00' },
    Noon: { start_time: '11:00:01', end_time: '17:00:00' },
    Evening: { start_time: '17:00:01', end_time: '23:59:59' },
};
const getNowInLocalTime = () => DateTime.now().setZone(TIMEZONE);
const PERIODS = ['Morning', 'Noon', 'Evening'];
const PERIOD_ORDER = { 'Morning': 1, 'Noon': 2, 'Evening': 3 };
// --------------------------------------------------------


/**
 * Helper to determine which period a time string falls into.
 */
function findPeriodForTime(timeStr) { // Removed TIME_PERIODS parameter as it's defined in scope
    if (timeStr >= TIME_PERIODS.Morning.start_time && timeStr <= TIME_PERIODS.Morning.end_time) {
        return 'Morning';
    }
    if (timeStr >= TIME_PERIODS.Noon.start_time && timeStr <= TIME_PERIODS.Noon.end_time) {
        return 'Noon';
    }
    if (timeStr >= TIME_PERIODS.Evening.start_time && timeStr <= TIME_PERIODS.Evening.end_time) {
        return 'Evening';
    }
    return null;
}

/**
 * Finds the user's last available time slot before the cycle ends.
 */
function findLastAvailableSlotInCycle(availability, cycleEndDate, now, cycleEndPeriod) {
    if (!availability || availability.length === 0) return null;
    
    if (isNaN(cycleEndDate.getTime())) return null;
    
    // 1. Create boundary and current day objects (at midnight for calendar math)
    const cycleEndDay = DateTime.fromJSDate(cycleEndDate).setZone(TIMEZONE).startOf('day'); 
    const nowDay = now.startOf('day');
    
    
    // 2. Pre-process availability for quick lookup (Day => [Periods])
    const userAvailMap = new Map(); // Key: SQL Day Index (0-6), Value: [Periods]
    availability.forEach(slot => {
        if (!userAvailMap.has(slot.day_of_week)) {
            userAvailMap.set(slot.day_of_week, []);
        }
        userAvailMap.get(slot.day_of_week).push(slot.time_of_day);
    });
    // 3. Iterate backwards, day-by-day, from cycle end date
    let cursorDay = cycleEndDay;
    while (cursorDay >= nowDay) {
        const sqlDay = cursorDay.weekday === 7 ? 0 : cursorDay.weekday;
        
        // 4. Check if the user is available ANY period on this day
        if (userAvailMap.has(sqlDay)) {
            const availablePeriods = userAvailMap.get(sqlDay);
            
            // 5. Find the latest eligible period on this day
            let latestSlot = null;
            
            // Iterate periods backward (Evening -> Noon -> Morning)
            for (let i = PERIODS.length - 1; i >= 0; i--) {
                const period = PERIODS[i];
                const periodNum = PERIOD_ORDER[period];
                
                // CRITICAL VALIDATION CHECKS
                // a) Must be available for this period
                if (!availablePeriods.includes(period)) continue; 
                
                // b) Check cycle end boundary (Only if we are on the final day)
                if (cursorDay.toISODate() === cycleEndDay.toISODate() && periodNum > PERIOD_ORDER[cycleEndPeriod]) {
                    continue; 
                }
                
                const endTimePart = TIME_PERIODS[period].end_time;
                const endParts = endTimePart.split(':'); 
                const slotEndTime = cursorDay.set({ 
                    hour: parseInt(endParts[0]),
                    minute: parseInt(endParts[1]),
                    second: parseInt(endParts[2])
                });

                // 2. Check if the period has ALREADY ENDED
                // If the slot's end time is after 'now', it's a valid slot.
                if (slotEndTime >= now) {
                    
                    // 3. We found the latest valid slot. Return its START time.
                    latestSlot = slotEndTime;
                    
                    break; // Found the latest one, stop looping
                }
            }
            if (latestSlot) {
                return latestSlot;
            }
        }
        
        // Move to the previous day
        cursorDay = cursorDay.minus({ days: 1 });
    }

    return null; 
}

/**
 * Counts the number of mess periods between two times.
 */
function countPeriodsBetween(start, end, availability) { // Replaced TIME_PERIODS with availability
  if (!start || !end || end < start) return 0;
  let count = 0;
  let current = start.set({ second: 0, millisecond: 0 });
  // --- FIX: Create availableSlotsSet using the passed 'availability' list ---
  const availableSlotsSet = new Set(availability.map(slot => `${slot.day_of_week}:${slot.time_of_day}`));
  while (current <= end) {
    const period = findPeriodForTime(current.toFormat('HH:mm:ss')); // Call without TIME_PERIODS
    const dayOfWeek = current.weekday === 7 ? 0 : current.weekday;

    if (period) {
      const slotKey = `${dayOfWeek}:${period}`;
      if (availableSlotsSet.has(slotKey)) { // Check against user's actual availability
        count++;
      }
      
     if (period === "Morning") {
          current = current.set({ hour: 11, minute: 0, second: 0, millisecond: 0 }).plus({ seconds: 1 });
      } else if (period === "Noon") {
          current = current.set({ hour: 17, minute: 0, second: 0, millisecond: 0 }).plus({ seconds: 1 });
      } else {
          current = current.plus({ days: 1 }).set({ hour: 6, minute: 0, second: 0, millisecond: 0 });
      }
      
    } else {
      // --- FIX 3: Normalize milliseconds in gap logic ---
      current = current.set({ hour: 6, minute: 0, second: 0, millisecond: 0 });
    }
    if (count > 500) break;
  }
  return count;
}

/**
 * Main function to calculate priority (urgency_weight).
 */
export const calculatePriority = (userData, cycleEndBoundary, cycleEndPeriodStr) => {
    const now = getNowInLocalTime();
    const { availabilityData, points_remaining } = userData;
    let urgencyWeight = 0;
    let periodsRemaining = 0;
    let lastAvailableDayISO = null;
    // Call without TIME_PERIODS
    const lastAvailableSlot = findLastAvailableSlotInCycle(availabilityData, cycleEndBoundary, now, cycleEndPeriodStr);
    if (lastAvailableSlot) {
        // --- CRITICAL FIX: Pass the 'availabilityData' to the counting function ---
        periodsRemaining = countPeriodsBetween(now, lastAvailableSlot, availabilityData);
        if (points_remaining > 0 && periodsRemaining > 0) {
            urgencyWeight = (points_remaining / periodsRemaining);
        }
        lastAvailableDayISO = lastAvailableSlot.toISODate(); 
    }
    
    return {
        points_remaining: points_remaining,
        periods_remaining: periodsRemaining,
        urgency_weight: parseFloat(urgencyWeight.toFixed(4)) || 0,
        last_available_day: lastAvailableDayISO
    };
};