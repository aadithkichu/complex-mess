import { createContext, useContext, useState, useEffect } from 'react';
import { apiLogin, apiLogout, apiCheckSession } from '../services/api.js'; // <-- Import API calls

const AuthContext = createContext();

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // New state for initial check

  // Check session status on initial load
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const data = await apiCheckSession();
        if (data.isLoggedIn) {
          setUser(data.user);
          setIsLoggedIn(true);
        }
      } catch (error) {
        // Log the error but don't stop the app
        console.error("Initial session check failed:", error);
      } finally {
        setIsLoading(false);
      }
    };
    checkLoginStatus();
  }, []);

  // --- LOGIN FUNCTION ---
  const login = async (username, password) => {
    try {
      const data = await apiLogin(username, password);
      // Success
      setUser(data.user);
      setIsLoggedIn(true);
      return { success: true };
    } catch (error) {
      // Failure (e.g., 401 Invalid credentials)
      console.error("Login failed:", error);
      return { success: false, error: error.message };
    }
  };

  // --- LOGOUT FUNCTION ---
  const logout = async () => {
    try {
      await apiLogout();
      // Clear state regardless of API response
      setUser(null);
      setIsLoggedIn(false);
    } catch (error) {
      console.error("Logout error (session still cleared locally):", error);
      setUser(null);
      setIsLoggedIn(false);
    }
  };

  const authValue = {
    user,
    isLoggedIn,
    isLoading, // Export the loading status
    login,     // Export the login function
    logout,    // Export the logout function
  };

  return <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);