// backend/controllers/authController.js

import bcrypt from 'bcryptjs';
import { AuthModel } from '../models/authModel.js'; // <-- NEW: Import AuthModel

export const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  // --- Super Admin .env Check ---
  const superAdminUsername = process.env.ADMIN_USERNAME;
  const superAdminHash = process.env.ADMIN_PASSWORD_HASH;

  // Check if the .env variables are properly configured
  if (!superAdminHash || !superAdminUsername) {
    console.error('ADMIN_USERNAME or ADMIN_PASSWORD_HASH not set in .env');
    return res.status(500).json({ message: 'Server configuration error.' });
  }

  // Check if the login attempt is for the super admin
  if (username !== superAdminUsername) {
    // Not the admin user, reject immediately
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // --- At this point, username matches. Now check password. ---
  try {
    // Compare the provided password with the hash from .env
    const isPasswordCorrect = await bcrypt.compare(password, superAdminHash);

    if (isPasswordCorrect) {
      // Set session for Super Admin
      req.session.isAdmin = true;
      req.session.userId = 'SUPER_ADMIN_001'; // Static ID for the admin
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ message: 'Server error during session save.' });
        }

        // Now that the session is saved, send the response
        return res.status(200).json({
          message: 'Super Admin login successful',
          user: { username: superAdminUsername, user_id: 'SUPER_ADMIN_001' },
        });
      });
      
      return res.status(200).json({
        message: 'Super Admin login successful',
        user: { username: superAdminUsername, user_id: 'SUPER_ADMIN_001' },
      });
    } else {
      // Password was incorrect for the super admin account
      console.log('Invalid password attempt for SUPER ADMIN user:', username);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (bcryptError) {
    console.error('Bcrypt error during super admin login:', bcryptError);
    return res.status(500).json({ message: 'Server error during login.' });
  }
};

// --- LOGOUT ---
export const logout = (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ message: 'Failed to log out' });
    }
    res.clearCookie('complex_mess_sid');
    res.status(200).json({ message: 'Logged out successfully' });
  });
};

// --- CHECK SESSION ---
export const checkSession = async (req, res) => {
  if (req.session.isAdmin && req.session.userId) {
    try {
      const user = await AuthModel.getUserById(req.session.userId);
      if (user) {
        res.status(200).json({ 
          isLoggedIn: true, 
          user: { username: user.name, user_id: user.user_id } 
        });
        return;
      }
    } catch (e) {
      console.error("Session check database error:", e);
      // Fall through to return isLoggedIn: false if DB check fails
    }
  } 
  
  res.status(200).json({ isLoggedIn: false });
};