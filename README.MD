# Complex Mess: A Dynamic Point & Duty Management System

**"Complex Mess"** is a full-stack web application designed to manage shared responsibilities—like a communal kitchen or "mess"—through a sophisticated, fair, and automated points system.

It goes beyond a simple chore list. It allows for the dynamic calculation of point "objectives" based on user availability and logged work, ensuring that members are held accountable in a fair and transparent way. The system can run in two different calculation modes, "Legacy" (availability-weighted) or "Group" (slot-based), to perfectly match your team's definition of "fairness."

This system is built for data integrity, using a cycle-based "snapshot" system to preserve historical availability, ensuring that all past and future calculations are accurate and immutable.

## 🚀 Key Features

  * **User Management:** Simple distinction between Admins (full control, real password) and Members (log work, set availability, `N/A_MEMBER_NO_LOGIN` placeholder).
  * **Cycle Management:** Admins can create, edit, and delete work cycles with precise start/end dates and periods (Morning, Noon, Evening).
  * **Availability Snapshot System:** A "Calc Objective" button for admins that "locks in" the global member availability for a specific cycle by creating a snapshot in `cycle_availability`. **All historical calculations** are run against this immutable snapshot, ensuring data integrity.
  * **Task Templates:** Admins can define all available jobs (e.g., "Mess Delivery," "Mess Cleaning"), their associated points, and the default number of people (headcount) required.
  * **Grid-Based Task Logging:** An interactive grid for logging completed tasks. Admins can select a date and period to log work, choose the users who completed it, or mark it as "Done by Other."
  * **Dynamic Objective Calculation:** The system's core. On-demand calculation of point objectives for all members based on one of two modes:
      * **Legacy Mode:** Distributes the total point pool based on a user's *percentage share* of the total availability.
      * **Group Mode:** Distributes points on a *per-slot* basis, dividing that slot's value only among the users available for it.
  * **Live Standings & Priority:** The main dashboard features a `WeekPointsTable` that auto-refreshes when work is logged. It displays:
      * **Urgency Weight (W):** A live-calculated priority score (`Points Remaining / Periods Remaining`).
      * **Rank:** Based on `urgency_weight`.
      * **Live Credit:** A `credits_earned` flag that is automatically set to `1` in the database when a user's `points_taken` meets their `point_objective`.
  * **Algorithmic Slot Recommender:** A "greedy" assignment algorithm that suggests which users should take which slots. It prioritizes the most urgent users and uses a "jump distance" to ensure work is distributed evenly, not all at once.
  * **Historical Leaderboard:** A full leaderboard page with a "Best This Month" banner and a sortable, filterable table to view rankings by cycle, month, or year.

## ⚙️ Tech Stack & Architecture

This project is a classic full-stack application with a React frontend and a Node.js/Express backend.

  * **Frontend:**

      * **Framework:** React (using Vite)
      * **UI:** TailwindCSS
      * **Icons:** Heroicons
      * **Date/Time:** `date-fns`

  * **Backend:**

      * **Runtime:** Node.js
      * **Framework:** Express.js
      * **Database:** MySQL (using `mysql2` driver)
      * **Session Management:** `express-session` with `express-mysql-session`
      * **Date/Time:** `luxon` (for complex timezone and period math)

## 📊 Database Schema

The system's logic is built on this relational schema:

  * `users`: Stores members. `password_hash = 'N/A_MEMBER_NO_LOGIN'` identifies a member.
  * `cycles`: Defines the time boundaries (start/end date + period) and `calculation_mode` for a cycle.
  * `task_templates`: The "menu" of all possible jobs (e.g., "Mess Delivery - Noon"), their `points`, and `default_headcount`.
  * `task_log`: The historical record of completed work. Links `cycle_id`, `template_id`, `user_id`, and `points_earned`.
  * `member_availability`: **The Global Table.** Members use this to set their current, global availability for the *next* cycle.
  * `cycle_availability`: **The Snapshot Table.** A read-only copy of `member_availability` that is locked to a specific `cycle_id`. **All calculations use this table.**
  * `cycle_targets`: **The Results Table.** Stores the calculated `point_objective`, `weight_percent`, and `credits_earned` for each user in each cycle.

## 🧮 Core Business Logic: The Calculation Engine

The most complex part of this system is the on-demand calculation triggered by the "Calc Objective" button.

### 1\. The "Total Point Pool" (T) Calculation

Both Legacy and Group modes use the same complex logic to define the total number of points (T) available for distribution in a cycle. This calculation **does not** use `task_log.points_earned` but instead uses `task_templates` and checks the `task_log` for *exceptions*.

The logic iterates through every `task_template` (T) for the cycle and calculates its contribution to the pool:

  * **Rule 1: No Log Entries**
      * If `task_log` has 0 entries for template T:
      * `Pool += template.points * template.default_headcount`
  * **Rule 2: One Log Entry**
      * If `task_log` has 1 entry for template T:
      * If `user_id IS NULL` ("Done by Other"): `Pool += 0`
      * If `user_id IS NOT NULL`: `Pool += template.points`
  * **Rule 3: Multiple Log Entries**
      * If `task_log` has N entries for template T:
      * `Pool += template.points * N`

### 2\. Distribution Mode: Legacy

The "Legacy" mode distributes the `totalPointsPool` (T) based on a user's *share of the work*, which is defined by their availability.

1.  **Calculate Total Slots (S\_total):** The system iterates through the entire cycle and counts every single available slot from the `cycle_availability` snapshot (e.g., 210 slots total).
2.  **Calculate User Slots (S\_user):** It iterates again and counts the slots for each specific user (e.g., Aadil: 21 slots).
3.  **Distribute:** `point_objective = (S_user / S_total) * T`

### 3\. Distribution Mode: Group

The "Group" mode distributes points on a per-slot basis, rewarding users for being available for tasks that *actually have points*.

1.  **Initialize Map:** A "temporary table" (`userObjectiveMap`) is created, setting all user objectives to 0.
2.  **Iterate Cycle:** The system loops through every Day/Period of the cycle (e.g., "2025-10-30 Morning").
3.  **Calculate Slot Pool (P\_slot):** It calculates the `totalPointsForThisSlot` using the complex "Total Point Pool" logic (Rule 1, 2, 3) from above, but *only* for that specific slot.
4.  **Find Available Users:** It finds all users available for that slot (e.g., 5 users are available for "2025-10-30 Morning").
5.  **Distribute:** `pointsPerUser = P_slot / 5`. This value is added to the `userObjectiveMap` for all 5 users.
6.  The loop repeats for all slots, and the final map is saved to the database.

### 4\. Priority Calculation (Urgency Weight)

Priority is calculated live for both the Standings Table and the User Details modal using the `priorityCalculator.js` helper.

`Urgency (W) = Points Remaining / Periods Remaining`

  * **Points Remaining:** `point_objective - points_taken`
  * **Periods Remaining:** A complex calculation that finds the user's *last available slot* in the `cycle_availability` snapshot, then counts how many of their available periods exist between `now()` and that last slot.

## 🔌 API Endpoints

All routes are prefixed with `/api`.

| Method | Path | Controller | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | | | |
| POST | `/auth/login` | `authController` | Logs in the admin. |
| POST | `/auth/logout` | `authController` | Logs out the admin. |
| GET | `/auth/me` | `authController` | Checks the current session. |
| **Users** | | | |
| GET | `/users` | `userController` | Gets all non-admin users. |
| POST | `/users` | `userController` | Creates a new user. |
| GET | `/users/:id` | `userController` | Gets detailed user info for the modal. |
| GET | `/users/:id/history` | `userController` | Gets historical stats for a user. |
| GET | `/users/rankings/history` | `userController` | Gets filterable rankings for the leaderboard. |
| GET | `/users/rankings/monthly-best` | `userController` | Gets top users for the banner. |
| **Cycles** | | | |
| GET | `/cycles/all` | `cycleController` | Gets all cycles for dropdowns. |
| GET | `/cycles` | `cycleController` | Gets current/last cycle for the Settings page. |
| POST | `/cycles` | `cycleController` | Creates a new cycle. |
| PUT | `/cycles/:id` | `cycleController` | Updates a cycle's dates/periods (Surgical Trim). |
| DELETE | `/cycles/:id` | `cycleController` | Deletes a cycle. |
| PUT | `/cycles/mode/:cycleId` | `cycleController` | Changes a cycle's calculation mode. |
| POST | `/cycles/:cycleId/run-calculations` | `calculationController` | **The "Calc Objective" Button.** Runs the snapshot and all recalculations. |
| **Availability** | | | |
| GET | `/availability/summary` | `availabilityController` | Gets the grid data for the *global* `member_availability` table. |
| POST | `/availability/slot` | `availabilityController` | Saves a single slot to the *global* table. |
| POST | `/availability/fullday` | `availabilityController` | Saves a full day to the *global* table. |
| **Tasks** | | | |
| GET | `/tasks` | `taskController` | Gets all task templates. |
| POST | `/tasks` | `taskController` | Creates a new task template. |
| **Logbook** | | | |
| POST | `/logbook` | `logbookController` | Logs a completed task. |
| GET | `/logbook/grid` | `logbookController` | Gets checkmark data for the task grid. |
| GET | `/logbook/available` | `logbookController` | Gets users for the "Log Task" modal. |
| **Standings** | | | |
| POST | `/standings/calculate` | `standingController` | *(Deprecated)* Replaced by `run-calculations`. Gets live standings. |
| **Recommendations** | | | |
| GET | `/recommendations/:cycleId` | `recommendationController` | Runs the greedy assignment algorithm. |

## 🚀 Getting Started

### Backend

1.  Navigate to the `backend` directory.
2.  Run `npm install` to install all dependencies (`express`, `mysql2`, `luxon`, etc.).
3.  Create a `.env` file in the `backend` directory.
4.  Add your MySQL connection details and a `SESSION_SECRET` to the `.env` file (e.g., `DB_HOST=...`, `DB_USER=...`, `DB_PASS=...`, `DB_NAME=...`).
5.  Run all the `CREATE TABLE` scripts (from your schema files) in your MySQL database to set up the tables.
6.  Run `npm run dev` (or `nodemon server.js`) to start the backend server, (default `http://localhost:5001`).

### Frontend

1.  Navigate to the `frontend` directory.
2.  Run `npm install` to install all dependencies (`react`, `date-fns`, `react-hot-toast`, etc.).
3.  **Crucial:** Open `frontend/src/services/api.js`.
4.  Change the `API_URL` constant to match your backend's IP address (e.g., `http://localhost:5001/api` for local testing, or `http://192.168.1.14:5001/api` for network testing).
5.  Run `npm run dev -- --host` to start the frontend server and expose it to your network (e.g., `http://192.168.1.14:5173`).
6.  Open the network URL on your phone or other device.