drop database if exists complex_mess;
CREATE DATABASE IF NOT EXISTS complex_mess;
USE complex_mess;

-- ---
-- 1. `users` Table
-- ---
-- Stores admin accounts. The 'mess_active_until' column is
-- critical for your priority calculation.
-- ---
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    -- "last day of mess" - for the priority system
    mess_active_until DATE NULL, 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---
-- 2. `task_templates` Table ("Point Data")
-- ---
-- This is your "Point Data" master list.
-- It defines the 6 repeating jobs and their point values.
-- ---
CREATE TABLE IF NOT EXISTS task_templates (
    template_id INT AUTO_INCREMENT PRIMARY KEY,
    task_name VARCHAR(100) NOT NULL,
    time_of_day ENUM('Morning', 'Noon', 'Evening') NOT NULL,
    
    -- Using DECIMAL to handle "1.5" points
    points DECIMAL(5, 2) NOT NULL, 
    
    -- For your "Legacy Mode" default person count
    default_headcount INT NOT NULL DEFAULT 1
);

-- ---
-- 3. `member_availability` Table
-- ---
-- Stores each member's weekly mess preferences.
-- This is the main input for your "Group Mode" calculation.
-- ---
CREATE TABLE IF NOT EXISTS member_availability (
    availability_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    
    -- 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), 
    time_of_day ENUM('Morning', 'Noon', 'Evening') NOT NULL,

    -- Ensures a user can't be in the same slot twice
    UNIQUE KEY (user_id, day_of_week, time_of_day),
    
    -- If a user is deleted, remove their availability
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cycles (
    cycle_id INT AUTO_INCREMENT PRIMARY KEY,
    cycle_name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_period ENUM('Morning', 'Noon', 'Evening') NOT NULL, 
    end_period ENUM('Morning', 'Noon', 'Evening') NOT NULL,
    calculation_mode ENUM('Legacy', 'Group') NOT NULL
    -- total_points_pool is REMOVED.
    -- It will be calculated from task_log instead.
);

-- ---
-- 5. `cycle_targets` Table ("Points Objective")
-- ---
-- Stores the *result* of your complex calculations.
-- Each user gets one "point_objective" per cycle.
-- ---
CREATE TABLE IF NOT EXISTS cycle_targets (
    target_id INT AUTO_INCREMENT PRIMARY KEY,
    cycle_id INT NOT NULL,
    user_id INT NOT NULL,
    
    -- Stores the calculated "percentage weight" in Legacy mode
    weight_percent DECIMAL(5, 4) NULL, -- e.g., 0.3333
    
    -- The final "point objective" for this user in this cycle
    point_objective DECIMAL(8, 2) NOT NULL,
    credits_earned INT NOT NULL DEFAULT 0,

    UNIQUE KEY (cycle_id, user_id), -- A user has only one target per cycle
    FOREIGN KEY (cycle_id) REFERENCES cycles(cycle_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS task_log (
    task_id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Link to the cycle this task belongs to
    cycle_id INT NOT NULL, 
    
    -- Link to the job type (e.g., "Mess Delivery - Noon")
    template_id INT NOT NULL, 
    
    task_datetime DATETIME NOT NULL,
    
    -- 'Pending' = Not logged yet
    -- 'Completed' = Admin has confirmed the result
    status ENUM('Pending', 'Completed') NOT NULL DEFAULT 'Pending',
    
    -- Who actually did the job
    -- This is NULL if "Delivered by other"
    user_id INT NULL, 
    
    -- The actual points earned for this task
    -- 0 if "Delivered by other", 1.0 if "1 person", etc.
    points_earned DECIMAL(5, 2) DEFAULT 0,
    
    notes TEXT,

    FOREIGN KEY (cycle_id) REFERENCES cycles(cycle_id),
    FOREIGN KEY (template_id) REFERENCES task_templates(template_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);