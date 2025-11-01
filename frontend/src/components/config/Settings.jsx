import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { apiGetCycleSettings, apiCreateNewCycle, apiUpdateCycleDates, apiChangeCycleMode } from '../../services/api.js';

// Mapping for display purposes
const PERIOD_OPTIONS = ['Morning', 'Noon', 'Evening'];
// Helper for validation
const PERIOD_ORDER = { 'Morning': 1, 'Noon': 2, 'Evening': 3 };

export default function Settings() {
  const { isLoggedIn } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newCycleData, setNewCycleData] = useState({
    cycle_name: '',
    start_date: '',
    end_date: '',
    start_period: 'Morning',
    end_period: 'Evening',
    calculation_mode: 'Legacy',
  });
  const [overlapDetails, setOverlapDetails] = useState(null);

  // Load Settings Data
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGetCycleSettings();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handlers for Admin Inputs
  const handleInputChange = (e) => {
    setNewCycleData({ ...newCycleData, [e.target.name]: e.target.value });
  };
  
  const handleModeChange = async (mode) => {
    if (!data?.current) {
        alert('Cannot change mode: No cycle is currently active.');
        return;
    }
    try {
        await apiChangeCycleMode(mode);
        alert(`Mode changed to ${mode}!`);
        fetchSettings(); 
    } catch(err) {
        setError(err.message);
    }
  };

// --- VALIDATION ADDED ---
const handleCreateNewCycle = async (forceOverwrite = false) => {
    setError(null);
    setOverlapDetails(null);

    // --- 1. FRONTEND VALIDATION ---
    try {
      const startDate = new Date(newCycleData.start_date + 'T12:00:00');
      const endDate = new Date(newCycleData.end_date + 'T12:00:00');

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          setError('Invalid date format. Please use YYYY-MM-DD.');
          return;
      }

      if (startDate > endDate) {
          setError('Start date cannot be after the end date.');
          return;
      }

      if (startDate.getTime() === endDate.getTime()) {
          if (PERIOD_ORDER[newCycleData.start_period] > PERIOD_ORDER[newCycleData.end_period]) {
              setError('Start period must be before or the same as the end period on the same day.');
              return;
          }
      }
    // --- END VALIDATION ---

      const payload = { 
        ...newCycleData, 
        force_overwrite: forceOverwrite,
      };
      
      const result = await apiCreateNewCycle(payload); 
      
      alert(result.message);
      setNewCycleData(prev => ({...prev, cycle_name: '', start_date: '', end_date: ''}));
      fetchSettings(); 

    } catch (err) {
        if (err.status === 409 && err.data?.message === 'CYCLE_CONFLICT') {
            setOverlapDetails(err.data);
        } else {
            // This will catch backend validation errors too
            setError(err.message || 'An unknown network error occurred.');
        }
    }
};

  // Helper to render cycle boundaries cleanly
  const formatBoundary = (date, period) => {
      if (!date || !period) return 'N/A';
      
      const dateObj = new Date(date);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;

      return `${formattedDate} @ ${period}`;
  }

  // Helper to get Cycle Mode display
  const getCurrentMode = (mode) => {
      const colorClass = mode === 'Group' ? 'text-green-600' : 'text-blue-600';
      return (
        <span className={`font-bold ml-2 ${colorClass}`}>
            ({mode})
        </span>
      );
  }

  if (loading) return <p className="text-gray-600">Loading settings...</p>;

  // Destructure for easy access
  // Add a fallback for data in case API call fails but component renders
  const { current, last_cycle } = data || {};
  
  return (
    <div className="p-4 border border-gray-300 rounded-md bg-gray-50 shadow-sm">
      <h3 className="text-2xl font-semibold mb-4 border-b pb-2">System Configuration</h3>
      {error && <div className="p-3 bg-red-100 text-red-700 border border-red-300 rounded mb-3">{error}</div>}

      {/* ---------------------------------------------------- */}
      {/* 1. CURRENT CYCLE STATUS (Viewable by All) */}
      {/* ---------------------------------------------------- */}
      <div className="mb-5">
        <h4 className="text-lg font-semibold mb-2">Current Active Cycle</h4>
        {current ? (
          <div className="p-3 border border-gray-300 rounded bg-white">
            <span className="font-bold text-base">{current.cycle_name}</span>
            {getCurrentMode(current.calculation_mode)}
            <p className="text-sm text-gray-500 mt-1">
              Running from: {formatBoundary(current.start_date, current.start_period)} to {formatBoundary(current.end_date, current.end_period)}
            </p>
            {isLoggedIn && <AdminCycleEditor currentCycle={current} fetchSettings={fetchSettings} setError={setError} />}
          </div>
        ) : (
          <div className="p-3 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded">
            No cycle is currently active. The system is paused.
            {last_cycle && <p className="text-xs mt-1"> (Last cycle ended: {formatBoundary(last_cycle.end_date, last_cycle.end_period)})</p>}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. ADMIN ONLY: CREATE NEW CYCLE */}
      {/* ---------------------------------------------------- */}
      {isLoggedIn && (
        <div className="mt-5 pt-4 border-t border-gray-300">
          <h4 className="text-lg font-semibold mb-3">Create/Overwrite New Cycle</h4>
          
          {overlapDetails && (
            <div className="p-4 bg-red-100 text-red-700 border border-red-300 rounded mb-4">
              <p className="font-bold">Conflict Detected!</p>
              <p className="text-sm">The new cycle dates overlap with existing history. Confirm overwrite to delete all conflicting data.</p>
              <ul className="list-disc pl-5 mt-2 text-sm">
                {overlapDetails.overlapping_cycles.map(c => (
                    <li key={c.cycle_id}>Cycle #{c.cycle_id}: {c.cycle_name}</li>
                ))}
              </ul>
              <button 
                className="mt-3 bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 px-4 rounded transition duration-150 text-sm"
                onClick={() => handleCreateNewCycle(true)}
              >
                Confirm & Overwrite (Surgical Trim)
              </button>
            </div>
          )}

          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleCreateNewCycle(); }}>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Cycle Name</span>
              <input type="text" name="cycle_name" value={newCycleData.cycle_name} onChange={handleInputChange} required 
                     className="mt-1 block w-full border border-gray-300 p-2 rounded text-sm focus:ring-blue-500 focus:border-blue-500" />
            </label>
            
            <div className="flex space-x-4">
                <label className="block w-1/2">
                    <span className="text-sm font-medium text-gray-700">Start Date/Period</span>
                    <div className="flex space-x-2 mt-1">
                        <input type="date" name="start_date" value={newCycleData.start_date} onChange={handleInputChange} required 
                               className="block w-full border border-gray-300 p-2 rounded text-sm focus:ring-blue-500 focus:border-blue-500" />
                        <select name="start_period" value={newCycleData.start_period} onChange={handleInputChange} required
                                className="block w-full border border-gray-300 p-2 rounded text-sm focus:ring-blue-500 focus:border-blue-500 bg-white">
                            {PERIOD_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                </label>
                <label className="block w-1/2">
                    <span className="text-sm font-medium text-gray-700">End Date/Period</span>
                    <div className="flex space-x-2 mt-1">
                        <input type="date" name="end_date" value={newCycleData.end_date} onChange={handleInputChange} required 
                               className="block w-full border border-gray-300 p-2 rounded text-sm focus:ring-blue-500 focus:border-blue-500" />
                        <select name="end_period" value={newCycleData.end_period} onChange={handleInputChange} required
                                className="block w-full border border-gray-300 p-2 rounded text-sm focus:ring-blue-500 focus:border-blue-500 bg-white">
                            {PERIOD_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">Calculation Mode</span>
              <select name="calculation_mode" value={newCycleData.calculation_mode} onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 p-2 rounded text-sm focus:ring-blue-500 focus:border-blue-500 bg-white">
                <option value="Legacy">Legacy (Weight-based, Full Pool)</option>
                <option value="Group">Group (Slot-based, Group Pool)</option>
              </select>
            </label>

            <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition duration-150 mt-2">
                Create New Cycle
            </button>
          </form>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 3. ADMIN ONLY: MODE SWITCH BUTTONS */}
      {/* ---------------------------------------------------- */}
      {isLoggedIn && current && (
        <div className="mt-5 pt-4 border-t border-gray-300">
            <h4 className="text-lg font-semibold mb-3">Change Current Mode</h4>
            <div className="flex space-x-3">
                <button 
                    onClick={() => handleModeChange('Legacy')}
                    className={`font-bold py-1.5 px-4 rounded transition duration-150 text-sm ${current.calculation_mode === 'Legacy' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    disabled={current.calculation_mode === 'Legacy'}
                >
                    Set to Legacy Mode
                </button>
                <button 
                    onClick={() => handleModeChange('Group')}
                    className={`font-bold py-1.5 px-4 rounded transition duration-150 text-sm ${current.calculation_mode === 'Group' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    disabled={current.calculation_mode === 'Group'}
                >
                    Set to Group Mode
                </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
                Current mode: {current.calculation_mode}. Switching mode applies immediately to all future calculations.
            </p>
        </div>
      )}

    </div>
  );
}


// --- Component for Editing Active Cycle Dates (Sub-Component) ---
function AdminCycleEditor({ currentCycle, fetchSettings, setError }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        start_date: currentCycle.start_date.split('T')[0],
        end_date: currentCycle.end_date.split('T')[0],
        start_period: currentCycle.start_period,
        end_period: currentCycle.end_period,
        calculation_mode: currentCycle.calculation_mode, // Need this for the update
    });
    const [editError, setEditError] = useState(null);
    const [externalOverlapDetails, setExternalOverlapDetails] = useState(null); 

    const handleEditChange = (e) => {
        setEditData({ ...editData, [e.target.name]: e.target.value });
    };

    // --- VALIDATION ADDED ---
    const handleUpdate = async (forceOverwrite = false) => {
        setEditError(null);
        setExternalOverlapDetails(null);

        // --- 1. FRONTEND VALIDATION ---
        try {
            const startDate = new Date(editData.start_date + 'T12:00:00');
            const endDate = new Date(editData.end_date + 'T12:00:00');

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                setEditError('Invalid date format. Please use YYYY-MM-DD.');
                return;
            }

            if (startDate > endDate) {
                setEditError('Start date cannot be after the end date.');
                return;
            }

            if (startDate.getTime() === endDate.getTime()) {
                if (PERIOD_ORDER[editData.start_period] > PERIOD_ORDER[editData.end_period]) {
                    setEditError('Start period must be before or the same as the end period on the same day.');
                    return;
                }
            }
          // --- END VALIDATION ---

            const payload = {
                ...editData, 
                force_overwrite: forceOverwrite, // Pass the overwrite flag
            };
            
            const result = await apiUpdateCycleDates(currentCycle.cycle_id, payload);
            
            alert(result.message);
            setIsEditing(false);
            fetchSettings(); // Refresh parent data

        } catch (err) {
            if (err.status === 409 && err.data?.message === 'EXTERNAL_CYCLE_CONFLICT') {
                 setExternalOverlapDetails(err.data);
            } else {
                setEditError(err.message);
            }
        }
    };


    return (
        <div className="mt-3 pt-3 border-t border-gray-300">
            {editError && <div className="p-2 bg-red-100 text-red-700 border border-red-300 rounded mb-2 text-sm">{editError}</div>}
            
            {/* ---------------------------------------------------- */}
            {/* RENDER CONFLICT WARNING OR NORMAL UI */}
            {/* ---------------------------------------------------- */}
            {externalOverlapDetails ? (
                 <div className="p-3 bg-red-100 text-red-700 border border-red-300 rounded mb-3">
                    <p className="font-bold">Cannot Save: External Conflict!</p>
                    <p className="text-sm">The proposed new boundaries overlap with the following existing cycle(s):</p>
                    <ul className="list-disc pl-5 mt-2 text-xs">
                        {externalOverlapDetails.overlapping_cycles.map(c => (
                            <li key={c.cycle_id}>Cycle #{c.cycle_id}: {c.cycle_name}</li>
                        ))}
                    </ul>
                    <p className="text-sm mt-3 font-semibold">
                        Click "Save Changes" again to confirm and surgically trim the timeline.
                    </p>
                    {/* This button now passes 'true' to force the overwrite */}
                    <button onClick={() => handleUpdate(true)} className="mt-3 bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 px-4 rounded transition duration-150 text-sm">
                        Confirm & Save
                    </button>
                    <button onClick={() => setExternalOverlapDetails(null)} className="ml-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-1.5 px-4 rounded transition duration-150 text-sm">
                        Cancel
                    </button>
                 </div>
            ) : (
                // --- Normal Edit/View UI ---
                <div>
                    {!isEditing ? (
                        <button 
                            className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-1 px-3 rounded text-xs transition duration-150"
                            onClick={() => setIsEditing(true)}
                        >
                            Edit Dates
                        </button>
                    ) : (
                        <div className="mt-2 space-y-3">
                            <p className="font-bold text-sm">Adjust Current Cycle Boundaries (Destructive!)</p>
                            
                            {/* Input fields for editing */}
                            <div className="flex space-x-4">
                                <label className="block w-1/2">
                                    <span className="text-xs font-medium text-gray-700">New Start</span>
                                    <div className="flex space-x-2 mt-1">
                                        <input type="date" name="start_date" value={editData.start_date} onChange={handleEditChange} required 
                                               className="block w-full border border-gray-300 p-2 rounded text-sm focus:ring-blue-500 focus:border-blue-500" />
                                        <select name="start_period" value={editData.start_period} onChange={handleEditChange} required
                                                className="block w-full border border-gray-300 p-2 rounded text-sm focus:ring-blue-500 focus:border-blue-500 bg-white">
                                            {PERIOD_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                </label>
                                <label className="block w-1/2">
                                    <span className="text-xs font-medium text-gray-700">New End</span>
                                    <div className="flex space-x-2 mt-1">
                                        <input type="date" name="end_date" value={editData.end_date} onChange={handleEditChange} required 
                                               className="block w-full border border-gray-300 p-2 rounded text-sm focus:ring-blue-500 focus:border-blue-500" />
                                        <select name="end_period" value={editData.end_period} onChange={handleEditChange} required
                                                className="block w-full border border-gray-300 p-2 rounded text-sm focus:ring-blue-500 focus:border-blue-500 bg-white">
                                            {PERIOD_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                </label>
                            </div>
                            {/* Calculation mode can also be edited */}
                             <label className="block">
                                <span className="text-sm font-medium text-gray-700">Calculation Mode</span>
                                <select name="calculation_mode" value={editData.calculation_mode} onChange={handleEditChange}
                                        className="mt-1 block w-full border border-gray-300 p-2 rounded text-sm focus:ring-blue-500 focus:border-blue-500 bg-white">
                                    <option value="Legacy">Legacy</option>
                                    <option value="Group">Group</option>
                                </select>
                            </label>

                            <div className="flex space-x-2 pt-2">
                                <button onClick={() => handleUpdate(false)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 px-4 rounded transition duration-150 text-sm">Save Changes</button>
                                <button onClick={() => setIsEditing(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-1.5 px-4 rounded transition duration-150 text-sm">Cancel</button>
                            </div>
                            <p className="text-xs text-red-500 mt-2">
                                *Warning: Saving will DELETE ALL targets and logged tasks that fall outside the new time range.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}