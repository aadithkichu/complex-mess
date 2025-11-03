-- ======================================================
-- POPULATE DYNAMIC TABLES FOR complex_mess
-- Uses existing users and task_templates.
-- Skips admin users.
-- ======================================================

USE complex_mess;

-- -------------------------------
-- 1. Disable foreign key checks for truncation
-- -------------------------------
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE task_log;
TRUNCATE TABLE cycle_targets;
TRUNCATE TABLE member_availability;
TRUNCATE TABLE cycles;

SET FOREIGN_KEY_CHECKS = 1;

-- -------------------------------
-- 2. Reference Admins (assuming they exist)
-- -------------------------------
SET @AADITH_ID = (SELECT user_id FROM users WHERE name = 'Aadith' LIMIT 1);
SET @SOURAV_ID = (SELECT user_id FROM users WHERE name = 'Sourav' LIMIT 1);

-- -------------------------------
-- 3. Create New Cycle
-- -------------------------------
INSERT INTO cycles (cycle_name, start_date, end_date, start_period, end_period, calculation_mode)
VALUES 
('Current Active Cycle', '2025-10-27', '2025-11-02', 'Morning', 'Evening', 'Legacy');

SET @CURRENT_CYCLE = LAST_INSERT_ID();

-- -------------------------------
-- 4. Identify Non-admin Members
-- -------------------------------
-- You can adjust this condition based on how you tag non-admin users
-- For example: password_hash = 'N/A_MEMBER_NO_LOGIN' OR role = 'member'
CREATE TEMPORARY TABLE MemberIDs AS
SELECT user_id 
FROM users 
WHERE password_hash = 'N/A_MEMBER_NO_LOGIN';

-- -------------------------------
-- 5. Populate cycle_targets for all non-admins
-- -------------------------------
INSERT INTO cycle_targets (cycle_id, user_id, weight_percent, point_objective, credits_earned)
SELECT 
    @CURRENT_CYCLE, 
    user_id, 
    0.333,        -- example weight
    30.00,        -- example target points
    0
FROM MemberIDs;

-- -------------------------------
-- 6. Optional: Populate member_availability
-- (Each member available Mon–Fri, Morning)
-- -------------------------------
INSERT INTO member_availability (user_id, day_of_week, time_of_day)
SELECT M.user_id, D.day_of_week, 'Morning'
FROM MemberIDs M
JOIN (
    SELECT 1 AS day_of_week UNION ALL
    SELECT 2 UNION ALL
    SELECT 3 UNION ALL
    SELECT 4 UNION ALL
    SELECT 5
) AS D
ON TRUE;

-- -------------------------------
-- 7. Create Sample Task Logs
-- Using existing Morning templates
-- -------------------------------
SET @DELIVERY_MORNING_TPL = (
    SELECT template_id FROM task_templates 
    WHERE task_name = 'Mess Delivery' AND time_of_day = 'Morning' LIMIT 1
);
SET @CLEANING_MORNING_TPL = (
    SELECT template_id FROM task_templates 
    WHERE task_name = 'Mess Cleaning' AND time_of_day = 'Morning' LIMIT 1
);

INSERT INTO task_log (cycle_id, template_id, task_datetime, status, user_id, points_earned, notes)
VALUES
(
    @CURRENT_CYCLE, 
    @DELIVERY_MORNING_TPL, 
    '2025-10-27 08:00:00', 'Completed', 
    @AADITH_ID, 1.0, 'Delivered breakfast'
),
(
    @CURRENT_CYCLE, 
    @CLEANING_MORNING_TPL, 
    '2025-10-27 08:30:00', 'Completed', 
    @SOURAV_ID, 1.5, 'Morning cleaning done'
);

-- -------------------------------
-- 8. Clean up
-- -------------------------------
DROP TEMPORARY TABLE IF EXISTS MemberIDs;

SELECT '✅ Dynamic data populated successfully using existing users and task templates.' AS status;
