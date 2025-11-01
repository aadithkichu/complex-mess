// backend/controllers/authController.js

import bcrypt from 'bcryptjs';
import { AuthModel } from '../models/authModel.js'; // <-- NEW: Import AuthModel

// --- LOGIN ---
export const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    // 1. Fetch user by username (name column in your users table)
    const user = await AuthModel.getUserByUsername(username);

    // 2. If no user is found OR password hash is 'N/A' (for non-login members)
    if (!user || user.password_hash === 'N/A_MEMBER_NO_LOGIN') {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 3. Securely compare password with the hash from the database
    const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);

    // 4. If password is correct, create the session
    if (isPasswordCorrect) {
      // Set the "admin" flag (since only members can log in)
      req.session.isAdmin = true; 
      req.session.userId = user.user_id; // Store the actual user ID
      
      res.status(200).json({ 
        message: 'Admin login successful', 
        user: { username: user.name, user_id: user.user_id } 
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
      console.log('Invalid password attempt for user:', username);
      console.log('Provided password:', password);
    }
  } catch (error) {
    console.error('Database Login Error:', error);
    res.status(500).json({ message: 'Server error during login. See server logs.' });
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