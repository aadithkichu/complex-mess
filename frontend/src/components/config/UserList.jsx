import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import toast from 'react-hot-toast'; // <-- 1. Import toast
import UserDetailsModal from './UserDetailsModal.jsx';
import { 
  apiGetAllUsers, 
  apiGetUserDetails, 
  apiCreateUser, 
  apiUpdateUser, // We will use this for a future "Edit" feature
  apiDeleteUser 
} from '../../services/api.js';

// --- Helper: Formats the YYYY-MM-DD date ---
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  // Use local date parts to avoid time zone bugs
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};


// ------------------------------------------------------------------
// --- 1. THE MAIN COMPONENT ---
// ------------------------------------------------------------------
export default function UserList() {
  const { isLoggedIn } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null); // For the modal

  // Fetch all users on component load
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await apiGetAllUsers();
      setUsers(data);
    } catch (err) {
      setError(err.message);
      toast.error(err.message); // <-- Use toast
    } finally {
      setLoading(false);
    }
  };

  // --- CRUD Handlers ---
  const handleDelete = async (e, userId) => {
    e.stopPropagation(); // Stop click from opening the modal
    if (window.confirm('Are you sure you want to delete this user? This will also delete their availability.')) {
      try {
        await apiDeleteUser(userId);
        toast.success('User deleted successfully.'); // <-- Use toast
        fetchUsers(); // Refresh list
      } catch (err) {
        setError(err.message);
        toast.error(err.message); // <-- Use toast
      }
    }
  };

  const handleUserCreated = () => {
    fetchUsers(); // Refresh list
    setShowCreateForm(false); // Hide form
  };

  if (loading) return <p>Loading user list...</p>;

  return (
    <div className="p-4 border border-gray-300 rounded-md bg-white shadow-sm mt-6">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-lg font-semibold">User List (Click row for stats)</h4>
        {isLoggedIn && !showCreateForm && (
          <button 
            onClick={() => setShowCreateForm(true)}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-3 rounded text-sm transition duration-150"
          >
            + Add New User
          </button>
        )}
      </div>

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      {/* --- User Table --- */}
      <div className="overflow-y-auto max-h-96 border border-gray-300 rounded-md shadow-inner bg-white">
        <table className="min-w-full">
          {/* --- MODIFICATION ---
            1. Added 'sticky top-0' to the thead to make the header stay
               at the top *within the scrollable div*.
          */}
          <thead className="sticky top-0 bg-gray-100 border-b border-gray-300">
            <tr>
              <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
              {isLoggedIn && <th className="p-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map(user => (
              <tr 
                key={user.user_id} 
                onClick={() => setSelectedUserId(user.user_id)} 
                className="hover:bg-gray-50 cursor-pointer"
              >
                <td className="p-3 text-sm font-medium text-gray-800">{user.name}</td>
                {isLoggedIn && (
                  <td className="p-3 text-right">
                    <button 
                      onClick={(e) => handleDelete(e, user.user_id)} 
                      className="text-xs bg-red-600 text-white py-1 px-2 rounded hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- Create User Form (Toggleable) --- */}
      {isLoggedIn && showCreateForm && (
        <CreateUserForm 
          onUserCreated={handleUserCreated}
          onCancel={() => setShowCreateForm(false)} 
        />
      )}
      
      {/* --- User Details Modal (Appears when user is clicked) --- */}
      {selectedUserId && (
        <UserDetailsModal 
          userId={selectedUserId} 
          onClose={() => setSelectedUserId(null)} 
        />
      )}
    </div>
  );
}


// ------------------------------------------------------------------
// --- 2. CREATE USER FORM (Sub-Component - Simplified) ---
// ------------------------------------------------------------------
function CreateUserForm({ onUserCreated, onCancel }) {
  const [name, setName] = useState('');
  // mess_active_until state is REMOVED

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Send only the name
      await apiCreateUser({ name });
      toast.success('User created!'); // <-- Use toast
      onUserCreated();
    } catch (err) {
      toast.error(`Error: ${err.message}`); // <-- Use toast
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 p-4 border border-gray-200 rounded bg-gray-50">
      <div className="flex justify-between items-center mb-3">
        <h5 className="font-semibold">Create New User</h5>
        <button type="button" onClick={onCancel} className="text-sm text-gray-600 hover:text-red-600">Cancel</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="block md:col-span-2">
          <span className="text-sm font-medium text-gray-700">Name</span>
          <input 
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="User's Name" 
            required 
            className="mt-1 p-2 border rounded w-full text-sm" 
          />
        </label>
        {/* mess_active_until input is REMOVED */}
        <button type="submit" className="self-end bg-green-600 text-white p-2 rounded hover:bg-green-700 text-sm">Create</button>
      </div>
    </form>
  );
}