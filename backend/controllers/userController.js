import { UserModel } from '../models/userModel.js';
import { CycleModel } from '../models/cycleModel.js';
import { getNowInLocalTime, TIMEZONE} from '../utils/timeConstants.js'; // Import helpers
import { DateTime } from 'luxon'; // Import Luxon
import { calculatePriority } from '../utils/priorityCalculator.js';

// --- Get all members ---
export const getAllUsers = async (req, res) => {
  try {
    const users = await UserModel.getAll();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching users', error: error.message });
  }
};

// --- Add a new member ---
export const createUser = async (req, res) => {
  try {
    const { name} = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }
    const newUser = await UserModel.create({ name });
    res.status(201).json(newUser);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
      // Send a 409 Conflict status
      res.status(409).json({ message: 'This name is already taken.' });
    } else {
      // Send a generic 500 error for all other problems
      res.status(500).json({ message: 'Server error creating user', error: error.message });
    }
  }
};

export const getAvailablePeriods = async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        if (isNaN(userId)) {
            return res.status(400).json({ message: 'Invalid User ID format.' });
        }

        console.log(`[PERIODS LOG] Fetching available periods for User ID: ${userId}`);

        // Call the model function to get the cycle list
        const cyclePeriods = await UserModel.getUserCyclePeriods(userId);

        // The model returns an array like: [{ cycle_id: 1, start_date: '2024-10-01' }, ...]
        res.status(200).json({ periods: cyclePeriods });

    } catch (error) {
        console.error('[FATAL GET PERIODS ERROR]:', error);
        res.status(500).json({ message: 'Server error fetching available periods.', error: error.message });
    }
};

// userController.js (New function)

export const getHistoricalStats = async (req, res) => {
  console.log("[HISTORICAL STATS LOG] Fetching historical stats with params:", req.params, "and query:", req.query);
    try {
        const userId = parseInt(req.params.id); // Assuming the ID is passed in the URL, e.g., /api/user/:id/history

        // 1. Fetch Historical and Best Performance Stats (Logic moved here)
        const periodFilter = req.query || {}; 
        const targetUserId = userId; 

        // 1. Fetch raw cycle data for ALL users within the specified time filter
        const allCycleData = await UserModel.getHistoricalCycleDataForAllUsers(periodFilter);

        // 2.a (NEW) Pre-calculate ranks within each cycle
        // First, group all data by cycle_id
        const cycleData = {};
        allCycleData.forEach(record => {
            const cid = record.cycle_id;
            if (!cycleData[cid]) {
                cycleData[cid] = [];
            }
            const points = parseFloat(record.points_collected) || 0;
            cycleData[cid].push({
                userId: record.user_id,
                points_collected: points
            });
        });

        // (NEW) Now, create a map of ranks for each cycle
        const cycleRankMap = {}; // Will store { [cycle_id]: { [user_id]: rank } }
        
        for (const cycleId in cycleData) {
            const usersInCycle = cycleData[cycleId];
            
            // Sort users in this cycle by points descending
            usersInCycle.sort((a, b) => b.points_collected - a.points_collected);
            
            const ranks = {};
            usersInCycle.forEach((user, index) => {
                ranks[user.userId] = index + 1; // Assign 1-based rank
            });
            cycleRankMap[cycleId] = ranks;
        }

        // 2. Aggregate data by user and calculate period totals
        const userAggregates = {};

        allCycleData.forEach(record => {
            const uid = record.user_id;
            
            if (!userAggregates[uid]) {
                userAggregates[uid] = {
                    userId: uid,
                    totalCollected: 0,
                    totalCredit: 0,
                    cycles: [],
                    rankCollected: 'N/A', 
                    rankCredit: 'N/A',
                };
            }

            userAggregates[uid].totalCollected += parseFloat(record.points_collected);
            userAggregates[uid].totalCredit += record.credits_earned;
            const cycleKey = String(record.cycle_id);
            const userKey = String(record.user_id);
            
            // Check if the cycle exists, AND if the user exists in that cycle's rank map
            const cycleRank = (cycleRankMap[cycleKey] && cycleRankMap[cycleKey][userKey])
                ? cycleRankMap[cycleKey][userKey]
                : 'N/A';
            
            userAggregates[uid].cycles.push({
                cycle_id: record.cycle_id,
                cycle_name: record.cycle_name,
                start_date: record.start_date,
                point_objective: parseFloat(record.point_objective),
                points_collected: parseFloat(record.points_collected),
                credits_earned: record.credits_earned,
                ratio_rank: (record.point_objective > 0) 
                    ? (parseFloat(record.points_collected) / parseFloat(record.point_objective)).toFixed(4)
                    : (parseFloat(record.points_collected) > 0 ? 'INF' : 'N/A'),
                rank: cycleRank,
            });
        });

        // 3. Calculate Ranks for the entire Period (Year/Quarter/Month)
        const aggregatedUsers = Object.values(userAggregates);

        // Rank by Total Points Collected
        aggregatedUsers.sort((a, b) => b.totalCollected - a.totalCollected);
        aggregatedUsers.forEach((user, index) => { user.rankCollected = index + 1; });

        // Rank by Total Credits Earned
        aggregatedUsers.sort((a, b) => b.totalCredit - a.totalCredit);
        aggregatedUsers.forEach((user, index) => { user.rankCredit = index + 1; });
        // 4. Extract the current user's aggregated summary and cycle breakdown
        const currentUserSummary = aggregatedUsers.find(u => u.userId === targetUserId) || null;

        const historicalStats = {
            period_summary: currentUserSummary ? {
                total_points_collected: currentUserSummary.totalCollected.toFixed(2),
                total_credits_earned: currentUserSummary.totalCredit,
                rank_collected: currentUserSummary.rankCollected,
                rank_credit: currentUserSummary.rankCredit,
            } : null,
            cycle_breakdown: currentUserSummary ? currentUserSummary.cycles : [],
        };
        
        // Fetch Best Performance separately since it is an 'All Time' stat
        const bestPerformance = await UserModel.getUserBestPerformance(userId);

        // Respond with historical data and best performance (as it is often displayed nearby)
        res.status(200).json({
            historical_stats_summary: historicalStats,
            best_performance: bestPerformance,
        });

    } catch (error) {
        console.error('[FATAL GET HISTORICAL DETAILS ERROR]:', error);
        res.status(500).json({ message: 'Server error fetching historical details', error: error.message });
    }
};

// --- Get a single member's details (UPDATED with Logging) ---
export const getUserDetails = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    console.log(`[USER DETAILS LOG] Starting fetch for User ID: ${userId}`);

    // 1-5. Base Info and Point Stats (unchanged)
    const baseInfo = await UserModel.getUserBaseInfo(userId);
    if (!baseInfo) {
      console.log(`[USER DETAILS LOG] User ID ${userId} not found.`);
      return res.status(404).json({ message: 'User not found' });
    }
    const taskHistory = await UserModel.getUserTaskHistory(userId);
    const currentCycle = await CycleModel.getCurrentActive();
    const totalCredit = await UserModel.getUserTotalCredit(userId);
    let availabilityData = [];
    let objective = 0;
    let earned = 0;
    let currentCycleRank = null;
    let detailedCycleMetrics = null;

    if (currentCycle) {
        availabilityData = await UserModel.getUserAvailability(userId, currentCycle.cycle_id);
        const targetData = await UserModel.getUserCurrentTarget(userId, currentCycle.cycle_id);
        objective = targetData?.point_objective || 0;
        earned = await UserModel.getUserCurrentEarned(userId, currentCycle.cycle_id);
        const allUserPoints = await UserModel.getAllUsersCurrentCyclePoints(currentCycle.cycle_id);

        // Sort and calculate rank based on the ratio (earned / objective)
        allUserPoints.sort((a, b) => {
            const ratioA = (a.objective > 0) ? a.earned / a.objective : (a.earned > 0 ? Infinity : 0);
            const ratioB = (b.objective > 0) ? b.earned / b.objective : (b.earned > 0 ? Infinity : 0);
            return ratioB - ratioA; // Descending order (higher ratio is better rank)
        });

        const userIndex = allUserPoints.findIndex(u => u.user_id == userId); // Use == for comparison
        currentCycleRank = userIndex !== -1 ? userIndex + 1 : 'N/A';

        detailedCycleMetrics = {
            cycle_id: currentCycle.cycle_id,
            cycle_name: currentCycle.cycle_name, 
            start_date: currentCycle.start_date,
            end_date: currentCycle.end_date,
            objective: objective, 
            earned: earned, 
            // ...
        };
    }
    const bestPerformance = await UserModel.getUserBestPerformance(userId);
    
    // ... (rest of base data processing) ...
    
    let currentStats = null;
    let priority = null;

    if (currentCycle) {
      
      const remaining = Math.max(0, objective - earned);

      currentStats = {
        cycle_name: currentCycle.cycle_name,
        objective: objective,
        earned: earned,
        remaining: remaining
      };

      // 6.1. Stabilize the end date (from ISO string to JS Date)
      const safeDateLuxon = DateTime.fromJSDate(currentCycle.end_date, { zone: TIMEZONE });
      
      if (!safeDateLuxon.isValid) {
          console.error("[USER DETAILS ERROR] Cycle end date is invalid:", currentCycle.end_date);
          throw new Error("Cycle end date retrieved from database is invalid.");
      }

      const cycleEndBoundary_JSDate = safeDateLuxon.startOf('day').toJSDate(); 
      const cycleEndPeriodStr = currentCycle.end_period;

      // 6.2. Call the shared helper function
      priority = calculatePriority(
          { availabilityData: availabilityData, points_remaining: remaining },
          cycleEndBoundary_JSDate,
          cycleEndPeriodStr
      );
      // --- END NEW LOGIC ---
    }

    const dayMap = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const availabilityDisplay = availabilityData.map(slot => `${dayMap[slot.day_of_week]}-${slot.time_of_day}`);

    // 7. Combine response
    res.status(200).json({
      ...baseInfo,
      // --- NEW HIGH-LEVEL STATS ---
      total_credit: totalCredit,
      cycle_rank: currentCycleRank,

      // --- NEW DETAILED CYCLE SECTION ---
      current_cycle: {
          ...detailedCycleMetrics,
          current_stats: currentStats, // Existing top-level stats moved under this section
          priority_calc: priority, // Existing priority calculation moved under this section
      },

      // --- NEW HISTORICAL/BEST SECTIONS ---// Assumes this is an array/object with aggregated stats
      best_performance: bestPerformance,

      // --- EXISTING DATA ---
      availability: availabilityDisplay,
      task_history: taskHistory,
      // NOTE: Remove the old 'current_stats' and 'priority_calc' from the top level 
      // as they are now nested under 'current_cycle' for better organization.
    });

  } catch (error) {
    console.error('[FATAL GET USER DETAILS ERROR]:', error);
    res.status(500).json({ message: 'Server error fetching user details', error: error.message });
  }
};

// --- Update a member ---
export const updateUser = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }
    const updated = await UserModel.update(req.params.id, { name });
    if (!updated) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ message: 'User updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error updating user', error: error.message });
  }
};

// --- Delete a member ---
export const deleteUser = async (req, res) => {
  try {
    const deleted = await UserModel.delete(req.params.id);
    if (!deleted) {
      return res.status(44).json({ message: 'User not found' });
    }
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error deleting user', error: error.message });
  }
};

export const getHistoricalRankings = async (req, res) => {
  console.log("[HISTORICAL RANKINGS LOG] Fetching historical rankings with filter:", req.query);
    try {
        const periodFilter = req.query || {}; 
        console.log("[HISTORICAL RANKINGS LOG] Fetching rankings with filter:", periodFilter);
        // 1. Fetch raw cycle data for ALL users within the specified time filter
        const allCycleData = await UserModel.getHistoricalCycleDataForAllUsers(periodFilter);

        // 2. Aggregate data by user and calculate period totals
        const userAggregates = {};
        allCycleData.forEach(record => {
            const uid = record.user_id;
            
            if (!userAggregates[uid]) {
                userAggregates[uid] = {
                    userId: uid,
                    name: record.name,
                    totalCollected: 0,
                    totalCredit: 0,
                    // 🏆 Initialize the new required field
                    totalOrders: 0, 
                };
            }
            userAggregates[uid].name = record.name;
            userAggregates[uid].totalCollected += parseFloat(record.points_collected) || 0;
            userAggregates[uid].totalCredit += record.credits_earned || 0;
            
            // 🏆 Aggregate the period-filtered orders
            // Summing up orders across all cycles/records retrieved in the current period.
            userAggregates[uid].totalOrders += record.total_mess_orders_in_period || 0;
        });
        console.log("DEBUG HISTORY: User Aggregates before Ranking:", userAggregates);

        // 3. Calculate Global Rank and finalize the list
        const rankings = Object.values(userAggregates);

        // Rank by Total Points Collected (Descending)
        rankings.sort((a, b) => b.totalCollected - a.totalCollected);
        rankings.forEach((user, index) => { user.rank = index + 1; });
        console.log("DEBUG HISTORY: Final Rankings:", rankings);
        res.status(200).json(rankings);

    } catch (error) {
        console.error('[FATAL GET HISTORICAL RANKINGS ERROR]:', error);
        res.status(500).json({ message: 'Server error fetching rankings', error: error.message });
    }
};

// --- NEW FUNCTION: Get Rankings for the Banner (Last Completed Month) ---
// --- REVISED FUNCTION: Get Overall Top Performers (Best in 3 Categories) ---
export const getBestMonthlyRankings = async (req, res) => {
    try {
        // Fetch ALL historical data (as requested for All-Time rankings)
        const allCycleData = await UserModel.getHistoricalCycleDataForAllUsers({});

        const userAggregates = {};
        allCycleData.forEach(record => {
            const uid = record.user_id;

            if (!userAggregates[uid]) {
                userAggregates[uid] = {
                    userId: uid,
                    // Name is retrieved from the DB, and totalMessOrders is now a separate field
                    name: record.name, 
                    totalPoints: 0,
                    totalCredit: 0,
                    completedCycles: new Set(),
                    totalMessOrders: parseInt(record.total_mess_orders || 0, 10), // 🏆 CHANGE 1: Assign the total count from the DB here
                };
            }
            
            userAggregates[uid].name = record.name;
            userAggregates[uid].totalPoints += parseFloat(record.points_collected) || 0;
            // ❌ REMOVED: totalMessOrders += 1; (It is now sourced from the DB query)
            
            if (record.credits_earned > 0) {
                userAggregates[uid].totalCredit += record.credits_earned;
                userAggregates[uid].completedCycles.add(record.cycle_id);
            }
        });

        // Convert aggregates to a final array of rankings
        const allUsersRankings = Object.values(userAggregates).map(u => ({
            ...u,
            completedCyclesCount: u.completedCycles.size,
        }));
        
        // --- 🏆 CHANGE 2: Determine the Top Performer for each of the 3 metrics ---
        
        const findTopPerformer = (rankings, key) => {
            if (rankings.length === 0) return null;
            
            // Sort by the primary metric key (descending)
            const sorted = [...rankings].sort((a, b) => (b[key] || 0) - (a[key] || 0));
            
            // Return the top user with all their metrics
            return {
                name: sorted[0].name,
                totalPoints: sorted[0].totalPoints.toFixed(2),
                totalCredit: sorted[0].totalCredit,
                totalMessOrders: sorted[0].totalMessOrders,
            };
        };

        const topPoints = findTopPerformer(allUsersRankings, 'totalPoints');
        const topCredits = findTopPerformer(allUsersRankings, 'totalCredit');
        const topOrders = findTopPerformer(allUsersRankings, 'totalMessOrders');

        // --- 🏆 CHANGE 3: Return the array of 3 top objects ---
        const bannerData = [
            { metric: 'Points', ...topPoints },
            { metric: 'Credits', ...topCredits },
            { metric: 'Orders', ...topOrders },
        ].filter(item => item.name); // Filter out any null entries if no data exists

        res.status(200).json(bannerData);

    } catch (error) {
        console.error('[FATAL GET OVERALL TOP PERFORMERS ERROR]:', error);
        res.status(500).json({ message: 'Server error fetching overall top performers', error: error.message });
    }
};