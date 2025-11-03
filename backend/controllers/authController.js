// backend/controllers/authController.js

import bcrypt from 'bcryptjs';
import { AuthModel } from '../models/authModel.js'; // <-- NEW: Import AuthModel

export const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    // --- 1. Check .env variables ---
    const superAdminUsername = process.env.ADMIN_USERNAME;
    const superAdminHash = process.env.ADMIN_PASSWORD_HASH;

    if (!superAdminHash || !superAdminUsername) {
      console.error('ADMIN_USERNAME or ADMIN_PASSWORD_HASH not set in .env');
      return res.status(500).json({ message: 'Server configuration error.' });
    }

    // --- 2. Check Username ---
    if (username !== superAdminUsername) {
      // Not the admin user, reject immediately
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // --- 3. Check Password ---
    const isPasswordCorrect = await bcrypt.compare(password, superAdminHash);

    if (!isPasswordCorrect) {
      // Password was incorrect
      console.log('Invalid password attempt for SUPER ADMIN user:', username);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // --- 4. All checks passed. Create and save the session. ---
    req.session.isAdmin = true;
    req.session.userId = 'SUPER_ADMIN_001';

    req.session.save((err) => {
      if (err) {
        // This is the error from your log
        console.error('Session save error:', err);
        return res.status(500).json({ message: 'Server error: Could not save session.' });
      }

      // This is the *only* successful response
      return res.status(200).json({
        message: 'Super Admin login successful',
        user: { username: superAdminUsername, user_id: 'SUPER_ADMIN_001' },
      });
    });

  } catch (bcryptError) {
    // This catches any errors from 'await bcrypt.compare'
    console.error('Bcrypt error during login:', bcryptError);
    return res.status(500).json({ message: 'Server error during login processing.' });
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