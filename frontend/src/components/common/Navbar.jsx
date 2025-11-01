import { Link } from 'react-router-dom';
import { useState } from 'react';
import AdminLogin from '../config/AdminLogin.jsx'; // <-- 1. Import the Login component
import { useAuth } from '../../hooks/useAuth.jsx'; // <-- 2. Import the Auth hook

export default function Navbar() {
  // 3. State to control the visibility of the dropdown
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { isLoggedIn, user, logout } = useAuth(); // <-- Get auth state

  // Function to run after a successful login (from the AdminLogin component)
  const handleLoginSuccess = () => {
    setIsDropdownOpen(false); // Close the dropdown after successful login
    // The useAuth hook will handle the rest
  };

  // Function to handle logout button press
  const handleLogout = () => {
    logout(); // Call the logout function from useAuth
  };

  return (
    <nav className="bg-gray-800 text-white p-4 shadow-lg border-b border-gray-700 z-10 relative">
      <div className="flex justify-between items-center max-w-7xl mx-auto">
        
        {/* Title/Link */}
        <Link to="/" className="text-xl font-bold hover:text-gray-300 transition-colors duration-150">
          Complex Mess
        </Link>
        
        {/* --- Login/Logout Section (Positioned Relative) --- */}
        <div className="relative">
          
          {isLoggedIn ? (
            // --- LOGGED IN STATE ---
            <div className="flex items-center space-x-4">
              <span className="text-sm">Hi, {user?.username || 'Admin'}</span>
              <button 
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-1.5 px-4 rounded text-sm transition duration-150"
              >
                Logout
              </button>
            </div>
          ) : (
            // --- LOGGED OUT STATE ---
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-4 rounded text-sm transition duration-150"
            >
              Login
            </button>
          )}

          {/* --- Dropdown Form (Positioned Absolute) --- */}
          {isDropdownOpen && !isLoggedIn && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl overflow-hidden">
              <AdminLogin onLoginSuccess={handleLoginSuccess} />
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}