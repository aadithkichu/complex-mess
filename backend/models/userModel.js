import pool from '../utils/db.js';

export class UserModel {
  
  // --- Create a new member ---
  static async create({ name }) {
    try {
      const [result] = await pool.query(
        'INSERT INTO users (name, password_hash) VALUES (?, ?)',
        [name, 'N/A_MEMBER_NO_LOGIN', ]
      );
      return { id: result.insertId, name };
    } catch (error) {
      throw error;
    }
  }

static async getAll() {
    try {
      // This query now ONLY selects users who have the "N/A" password hash,
      // effectively filtering out the real admin account.
      const [rows] = await pool.query(
        `SELECT user_id, name
         FROM users 
         WHERE password_hash = 'N/A_MEMBER_NO_LOGIN'`,
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  // --- (Your existing create, getAll, update, delete functions are here) ---

// --- NEW FUNCTIONS FOR USER PROFILE ---

// Gets the user's base info (replaces your old getById)
static async getUserBaseInfo(userId) {
  try {
    const [rows] = await pool.query(
      'SELECT user_id, name FROM users WHERE user_id = ?', 
      [userId]
    );
    return rows[0];
  } catch (error) {
    throw error;
  }
}

// Gets the user's target for the *current* cycle
static async getUserCurrentTarget(userId, cycleId) {
  try {
    const [rows] = await pool.query(
      'SELECT point_objective FROM cycle_targets WHERE user_id = ? AND cycle_id = ?', 
      [userId, cycleId]
    );
    return rows[0];
  } catch (error) {
    throw error;
  }
}

static async getUserCyclePeriods(userId) {
    const sql = `
        SELECT
            ct.cycle_id,
            c.start_date
        FROM
            cycle_targets ct
        JOIN
            cycles c ON ct.cycle_id = c.cycle_id
        WHERE
            ct.user_id = ?
        ORDER BY
            c.start_date DESC;
    `;
    
    try {
        const [rows] = await pool.query(sql, [userId]); 
        return rows; 
    } catch (error) {
        console.error("Error fetching available cycle periods:", error);
        return [];
    }
}

// Gets the user's total earned points for the *current* cycle
static async getUserCurrentEarned(userId, cycleId) {
  try {
    const [rows] = await pool.query(
      `SELECT SUM(points_earned) AS total_earned
       FROM task_log 
       WHERE user_id = ? AND cycle_id = ?`,
      [userId, cycleId]
    );
    // SUM can return NULL if no rows, so we default to 0
    return rows[0]?.total_earned || 0; 
  } catch (error) {
    throw error;
  }
}

static async getUserTotalCredit(userId) {
    const sql = `
        SELECT
            COALESCE(SUM(ct.credits_earned), 0) AS totalCredit
        FROM
            cycle_targets ct
        WHERE
            ct.user_id = ?;
    `;
    
    try {
        const [rows] = await pool.execute(sql, [userId]);
        
        // The column 'credits_earned' is defined as INT, but aggregation may still
        // return a string/decimal depending on the SQL driver.
        return parseFloat(rows[0].totalCredit); 
    } catch (error) {
        console.error("Error fetching total credit from cycle_targets:", error);
        return 0;
    }
}
    static async getAllUsersCurrentCyclePoints(cycleId) {
        const sql = `
            SELECT
                ct.user_id,
                COALESCE(SUM(tl.points_earned), 0) AS earned,
                ct.point_objective AS objective
            FROM
                cycle_targets ct
            LEFT JOIN
                task_log tl ON ct.user_id = tl.user_id AND ct.cycle_id = tl.cycle_id
            WHERE
                ct.cycle_id = ?
                AND ct.point_objective > 0
                AND EXISTS (
                    SELECT 1
                    FROM cycle_availability ca
                    WHERE ca.user_id = ct.user_id
                    AND ca.cycle_id = ct.cycle_id
                )
            GROUP BY
                ct.user_id, ct.point_objective
            ORDER BY
                earned DESC;
        `;
        
        try {
            const [rows] = await pool.execute(sql, [cycleId]);
            return rows;
        } catch (error) {
            console.error("Error fetching all users cycle points:", error);
            return [];
        }
    }

    // userModel.js

// userModel.js

static async getHistoricalCycleDataForAllUsers(periodFilter = {}) {
    const { year, quarter, month } = periodFilter;
    
    // --- Dynamic WHERE Clause Construction ---
    let whereClause = `1=1`; // Start with a true condition
    const params = [];

    if (year) {
        whereClause += ` AND YEAR(c.start_date) = ?`;
        params.push(year);
    }
    if (quarter) {
        whereClause += ` AND QUARTER(c.start_date) = ?`;
        params.push(quarter);
    }
    if (month) {
        whereClause += ` AND MONTH(c.start_date) = ?`;
        params.push(month);
    }
    
    const sql = `
        SELECT
            ct.user_id,
            u.name,
            ct.cycle_id,
            c.cycle_name,
            c.start_date,
            ct.point_objective,
            ct.credits_earned,
            
            -- Calculate raw points collected (for ranking purposes)
            (SELECT COALESCE(SUM(tl.points_earned), 0)
             FROM task_log tl 
             WHERE tl.user_id = ct.user_id 
               AND tl.cycle_id = ct.cycle_id
            ) AS points_collected
             ,
             (
                SELECT COUNT(availability_id)
                FROM cycle_availability ca
                WHERE ca.user_id = ct.user_id
            ) AS total_mess_orders,
                (
                SELECT COUNT(availability_id)
                FROM cycle_availability ca
                WHERE ca.user_id = ct.user_id
                AND ca.cycle_id = ct.cycle_id
            ) AS total_mess_orders_in_period
            
        FROM
            cycle_targets ct
        JOIN
            cycles c ON ct.cycle_id = c.cycle_id
        JOIN 
            users u ON ct.user_id = u.user_id
        WHERE
            ${whereClause};
    `;
    
    try {
        const [rows] = await pool.query(sql, params); 
        return rows;
    } catch (error) {
        console.error("Error fetching historical data for all users:", error);
        return [];
    }
}

// This replaces the entire static async getUserBestPerformance(userId) function
static async getUserBestPerformance(userId) {

    // --- COMMON TABLE EXPRESSION (CTE) ---
    // This CTE builds a temporary table in memory with all the calculated data we need.
    const sql_cte = `
        WITH CyclePoints AS (
                -- 1. Calculate total points collected for ALL users in ALL cycles.
                -- We no longer need to join 'cycles' here, as 'task_log'
                -- already has the cycle_id.
                SELECT
                    cycle_id,
                    user_id,
                    SUM(points_earned) AS total_points_collected
                FROM
                    task_log
                -- We only need to group by cycle_id and user_id
                GROUP BY
                    cycle_id, user_id
            ),
        -- 2. Join calculated points with targets to get objectives and calculate ratios
        CycleRatios AS (
            SELECT
                ct.user_id,
                ct.cycle_id,
                c.cycle_name,
                c.start_date,
                -- Use COALESCE to treat 'null' sums (no tasks done) as 0
                COALESCE(cp.total_points_collected, 0) AS points_collected,
                ct.point_objective,
                CASE
                    WHEN ct.point_objective > 0 THEN (COALESCE(cp.total_points_collected, 0)*COALESCE(cp.total_points_collected) / ct.point_objective)
                    WHEN COALESCE(cp.total_points_collected, 0) > 0 THEN 9999999999 -- Represents Infinity
                    ELSE 0
                END AS ratio
            FROM
                cycle_targets ct
            JOIN
                cycles c ON ct.cycle_id = c.cycle_id
            LEFT JOIN -- Use LEFT JOIN in case a user has a target but 0 points
                CyclePoints cp ON ct.user_id = cp.user_id AND ct.cycle_id = cp.cycle_id
        )
    `;

    // --- 1. Best Cycle (by points_collected) ---
    // We use the CTE to find the cycle where the user had the most points.
    const bestCycleSql = sql_cte + `
        SELECT
            cr.cycle_name,
            DATE_FORMAT(cr.start_date, '%Y-%m-%d') AS start_date,
            cr.points_collected AS max_points
        FROM
            CycleRatios cr
        WHERE
            cr.user_id = ?
        ORDER BY
            cr.points_collected DESC, cr.start_date DESC
        LIMIT 1;
    `;

    // --- 2. Best Month (by SUM of points_collected) ---
    // We use the CTE, group by month, and SUM the calculated points.
    const bestMonthSql = sql_cte + `
        SELECT
            DATE_FORMAT(cr.start_date, '%Y-%m') AS month_period,
            SUM(cr.points_collected) AS total_points
        FROM
            CycleRatios cr
        WHERE
            cr.user_id = ?
        GROUP BY
            month_period
        ORDER BY
            total_points DESC
        LIMIT 1;
    `;

    // --- 3. Best Rank (by Ratio Rank) ---
    // We use the CTE, add a RANK() window function, and find the user's best rank.
    const bestRankSql = sql_cte + `
        , UserRanks AS (
            SELECT
                user_id,
                cycle_id,
                cycle_name,
                start_date,
                -- This ranks everyone inside each cycle
                RANK() OVER (
                    PARTITION BY cycle_id
                    ORDER BY ratio DESC
                ) AS ratio_rank
            FROM
                CycleRatios
        )
        -- Finally, select only the target user's ranks and find their best one
        SELECT
            ur.cycle_name,
            DATE_FORMAT(ur.start_date, '%Y-%m-%d') AS start_date,
            ur.ratio_rank AS best_rank
        FROM
            UserRanks ur
        WHERE
            ur.user_id = ?
        ORDER BY
            ur.ratio_rank ASC, ur.start_date DESC -- ASC so rank #1 is first
        LIMIT 1;
    `;

    try {
        // Run all queries in parallel
        const [cycleRows, monthRows, rankRows] = await Promise.all([
            pool.execute(bestCycleSql, [userId]),
            pool.execute(bestMonthSql, [userId]),
            pool.execute(bestRankSql, [userId])
        ]);

        const bestCycle = (cycleRows[0].length > 0) ? {
            cycle_name: cycleRows[0][0].cycle_name,
            points: parseFloat(cycleRows[0][0].max_points),
            start_date: cycleRows[0][0].start_date
        } : null;

        const bestMonth = (monthRows[0].length > 0) ? {
            period: monthRows[0][0].month_period,
            points: parseFloat(monthRows[0][0].total_points)
        } : null;

        const bestRankCycle = (rankRows[0].length > 0) ? {
            cycle_name: rankRows[0][0].cycle_name,
            start_date: rankRows[0][0].start_date,
            best_rank: parseInt(rankRows[0][0].best_rank)
        } : null;

        return { 
            best_cycle: bestCycle, 
            best_month: bestMonth,
            best_rank_cycle: bestRankCycle 
        };

    } catch (error) {
        console.error("Error fetching best performance:", error);
        return { best_cycle: null, best_month: null, best_rank_cycle: null };
    }
}

static async getUserAvailability(userId,cycleId) {
  try {
    const [rows] = await pool.query(
     `SELECT day_of_week, time_of_day 
       FROM cycle_availability 
       WHERE user_id = ? AND cycle_id = ? 
       ORDER BY day_of_week`, 
      [userId, cycleId]
    );
    // REMOVE THE MAPPING AND RETURN RAW ROWS
    return rows; 
  } catch (error) {
    throw error;
  }
}

// Gets the user's 5 most recent completed tasks
static async getUserTaskHistory(userId) {
  try {
    const [rows] = await pool.query(
      `SELECT 
                t.task_name, 
                t.time_of_day, 
                tl.task_date, 
                tl.time_period, 
                tl.points_earned
            FROM task_log tl
            JOIN task_templates t ON tl.template_id = t.template_id
            WHERE tl.user_id = ?
            ORDER BY 
                tl.task_date DESC, 
                FIELD(tl.time_period, 'Evening', 'Noon', 'Morning') DESC
            LIMIT 5;`,
      [userId]
    );
    return rows.map(row => ({
                ...row,
                // Re-create the 'task_datetime' field for the frontend
                task_datetime: new Date(row.task_date).toISOString() 
            }));
  } catch (error) {
    console.error("Error in getUserTaskHistory:", error);
    throw error;
  }
}

  // --- Update a member ---
  static async update(userId, { name }) {
     try {
      const [result] = await pool.query(
        'UPDATE users SET name = ? WHERE user_id = ?',
        [name, userId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  // --- Delete a member ---
  static async delete(userId) {
     try {
      const [result] = await pool.query('DELETE FROM users WHERE user_id = ?', [userId]);
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }
}