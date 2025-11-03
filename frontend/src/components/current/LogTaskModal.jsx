import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { 
  apiGetAvailableUsersForSlot, // New API
  apiGetTaskLogForSlot,       // New API
  apiLogTask                  // New API
} from '../../services/api.js';

export default function LogTaskModal({ isOpen, onClose, cycle, date, template }) {
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [notes, setNotes] = useState('');
  const [isDoneByOther, setIsDoneByOther] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const maxSelection = template.default_headcount;

  useEffect(() => {
    const fetchData = async () => {
      if (!isOpen) return;
      
      setLoading(true);
      setIsDoneByOther(false); // Reset state
      setNotes('');
      
      try {
        const dayKey = date.getDay(); // 0 = Sunday, 1 = Monday...
        const period = template.time_of_day;
        const formattedDate = format(date, 'yyyy-MM-dd'); // Format the date for the API

        // 1. Get all users who are (available OR already logged)
        // --- THIS CALL IS MODIFIED ---
        const availableUsersData = await apiGetAvailableUsersForSlot(
          dayKey, 
          period, 
          cycle.cycle_id, 
          template.template_id, 
          formattedDate
        );
        setAvailableUsers(availableUsersData);

        // 2. Get users *already logged* for this task (this call is unchanged)
        const logData = await apiGetTaskLogForSlot(cycle.cycle_id, template.template_id, date);

        // Set the state based on what's already logged
        if (logData.is_done_by_other) {
          setIsDoneByOther(true);
          setSelectedUsers(new Set());
        } else {
          setSelectedUsers(new Set(logData.users.map(u => u.user_id)));
        }
        setNotes(logData.notes || '');

      } catch (err) {
        toast.error(`Error fetching user data: ${err.message}`);
        onClose(); // Close modal on error
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isOpen, cycle, date, template]); // Re-run when any prop changes

  const handleToggleUser = (userId) => {
    // If "Done by Other" is checked, uncheck it
    if (isDoneByOther) setIsDoneByOther(false);

    const newSet = new Set(selectedUsers);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      // Check if we're at the limit
      if (selectedUsers.size >= maxSelection) {
        toast.error(`You can only select up to ${maxSelection} ${maxSelection > 1 ? 'people' : 'person'}.`);
        return;
      }
      newSet.add(userId);
    }
    setSelectedUsers(newSet);
  };
  
  const handleToggleDoneByOther = () => {
    const wasOther = isDoneByOther;
    setIsDoneByOther(!wasOther);
    // If we are checking "Done by Other", clear user selections
    if (!wasOther) {
      setSelectedUsers(new Set());
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      const payload = {
        cycle_id: cycle.cycle_id,
        template_id: template.template_id,
        task_datetime: format(date, 'yyyy-MM-dd HH:mm:ss'),
        user_ids: Array.from(selectedUsers),
        is_done_by_other: isDoneByOther,
        notes: notes,
      };

      await apiLogTask(payload);
      
      toast.success('Task Logged!');
      return true; // Indicate success
    } catch (err) {
      toast.error(`Failed to log task: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  const handleCloseAndSave = async () => {
    const success = await handleSave();
    if (success) {
      onClose(true); 
    }
  };
  
  if (!isOpen) return null;

  return (
    // Modal Overlay
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center"
      onClick={onClose} 
    >
      {/* Modal Content */}
      <div 
        className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6 relative" 
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-gray-800">
          {template.task_name}
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          {format(date, 'EEEE, MMMM d')}
        </p>

        {loading ? (
          <p>Loading available users...</p>
        ) : (
          <>
            {/* --- User List --- */}
            <p className="text-sm font-semibold mb-2">
              Select who did this task (Max: {maxSelection}):
            </p>
            <div className="border rounded-md max-h-64 overflow-y-auto">
              <ul className="divide-y divide-gray-200">
                {availableUsers.map(user => (
                  <li key={user.user_id} className="p-3 hover:bg-gray-50">
                    <label className="flex items-center w-full">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        checked={selectedUsers.has(user.user_id)}
                        onChange={() => handleToggleUser(user.user_id)}
                        disabled={isDoneByOther} // Disable if "Done by Other"
                      />
                      <span className={`ml-3 text-sm ${isDoneByOther ? 'text-gray-400' : 'text-gray-800'}`}>
                        {user.name}
                      </span>
                    </label>
                  </li>
                ))}
                {availableUsers.length === 0 && (
                  <p className="p-3 text-sm text-gray-500">No members are available for this slot.</p>
                )}
              </ul>
            </div>

            {/* --- Other/Notes Section --- */}
            <div className="mt-4 space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  checked={isDoneByOther}
                  onChange={handleToggleDoneByOther}
                />
                <span className="ml-2 text-sm font-medium text-gray-700">
                  Done by Other / Not Done
                </span>
              </label>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes... (e.g., 'Swapped with X')"
                className="w-full p-2 border rounded text-sm"
                rows={2}
              />
            </div>

            {/* --- Action Buttons --- */}
            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={() => onClose(false)}
                className="py-2 px-4 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCloseAndSave}
                className="py-2 px-4 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Log'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}