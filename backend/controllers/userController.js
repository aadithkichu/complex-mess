import { UserModel } from '../models/userModel.js';
import { getCurrentCycle } from '../utils/cycle.js';

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
    const { name, mess_active_until } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }
    const newUser = await UserModel.create({ name, mess_active_until });
    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ message: 'Server error creating user', error: error.message });
  }
};

// --- Get a single member ---
export const getUserDetails = async (req, res) => {
  try {
    const userId = req.params.id;

    // 1. Get the user's base info
    const baseInfo = await UserModel.getUserBaseInfo(userId);
    if (!baseInfo) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 2. Get the user's weekly availability
    const availability = await UserModel.getUserAvailability(userId);

    // 3. Get the user's recent task history
    const taskHistory = await UserModel.getUserTaskHistory(userId);
    
    // 4. Get the current cycle
    const currentCycle = await getCurrentCycle();
    
    let currentStats = null;
    let priority = null;

    if (currentCycle) {
      // 5. Get their stats *for this cycle*
      const targetData = await UserModel.getUserCurrentTarget(userId, currentCycle.cycle_id);
      const objective = targetData?.point_objective || 0;
      const earned = await UserModel.getUserCurrentEarned(userId, currentCycle.cycle_id);
      const remaining = objective - earned;

      currentStats = {
        cycle_name: currentCycle.cycle_name,
        objective: objective,
        earned: earned,
        remaining: remaining
      };

      // 6. Calculate priority
      if (baseInfo.mess_active_until) {
        const today = new Date();
        const endDate = new Date(baseInfo.mess_active_until);
        
        // Calculate days remaining (add 1 to include today)
        const diffTime = endDate.getTime() - today.getTime();
        const daysRemaining = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

        priority = {
          points_remaining: remaining,
          days_remaining: daysRemaining,
          // Calculate score, but don't divide by zero
          score: (remaining > 0 && daysRemaining > 0) ? (remaining / daysRemaining).toFixed(2) : 0
        };
      }
    }

    // 7. Combine everything into one response
    res.status(200).json({
      ...baseInfo,
      current_stats: currentStats,
      priority_calc: priority,
      availability: availability,
      task_history: taskHistory
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error fetching user details', error: error.message });
  }
};

// --- Update a member ---
export const updateUser = async (req, res) => {
  try {
    const { name, mess_active_until } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }
    const updated = await UserModel.update(req.params.id, { name, mess_active_until });
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