import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx'; // <-- Use the hook

export default function AdminLogin({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth(); // <-- Get the login function from the hook

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // --- Call the real login function ---
    const result = await login(username, password);
    setLoading(false);
    
    if (result.success) {
      onLoginSuccess(); // Close the navbar dropdown
    } else {
      setError(result.error || 'Login failed due to network error.');
    }
    // ------------------------------------
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-white text-gray-800">
      <h2 className="text-lg font-semibold mb-3">Admin Login</h2>
      
      {error && <p className="text-red-600 text-xs mb-2 p-1.5 bg-red-100 border border-red-300 rounded">{error}</p>}

      <label className="block mb-2">
        <span className="text-sm font-medium text-gray-700">Username</span>
        <input 
          type="text" 
          placeholder="admin" 
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="block w-full border border-gray-300 p-2 text-sm rounded mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </label>
      
      <label className="block mb-4">
        <span className="text-sm font-medium text-gray-700">Password</span>
        <input 
          type="password" 
          placeholder="••••••••" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="block w-full border border-gray-300 p-2 text-sm rounded mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </label>
      
      <button 
        type="submit"
        disabled={loading}
        className={`w-full font-bold p-2 rounded transition duration-150 text-sm ${
            loading ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}