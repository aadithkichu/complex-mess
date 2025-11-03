import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { apiGetAllCycles, apiCreateNewCycle, apiUpdateCycleDates, apiChangeCycleMode, apiDeleteCycle } from '../../services/api.js';
import toast from 'react-hot-toast';

// Mapping for display purposes
const PERIOD_OPTIONS = ['Morning', 'Noon', 'Evening'];
// Helper for validation
const PERIOD_ORDER = { 'Morning': 1, 'Noon': 2, 'Evening': 3 };

const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    return dateString.split('T')[0];
}

export default function Settings() {
  const { isLoggedIn } = useAuth();
  const [allCycles, setAllCycles] = useState([]); // Array of ALL cycles
  const [selectedCycleId, setSelectedCycleId] = useState(null); // The cycle being viewed/edited
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
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
    fetchAllCycles();
  }, []);

  const fetchAllCycles = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGetAllCycles(); // Use the new API
      setAllCycles(result);
      
      // Set the selected cycle to the active one or the newest one
      const activeCycle = result.find(c => c.is_active);
      if (activeCycle) {
          setSelectedCycleId(activeCycle.cycle_id);
      } else if (result.length > 0) {
          // Select the latest cycle by ID if no active flag exists
          setSelectedCycleId(result[0].cycle_id); 
      }
      
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
  
const handleCreateNewCycle = async (forceOverwrite = false) => {
    setError(null);
    setOverlapDetails(null);

    // --- 1. FRONTEND VALIDATION ---
    // --- 1. FRONTEND VALIDATION (MODIFIED) ---
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

      // --- NEW DURATION VALIDATION (Implements both of your new rules) ---
      const startPeriodNum = PERIOD_ORDER[newCycleData.start_period];
      const endPeriodNum = PERIOD_ORDER[newCycleData.end_period];

      // Calculate number of days, inclusive. (e.g., Mon to Mon = 1 day)
      const diffTime = endDate.getTime() - startDate.getTime();
      const numDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

      // Calculate total periods (inclusive)
      // Formula: (Total Days * 3) - (Periods skipped at start) - (Periods skipped at end)
      const totalPeriods = (numDays * 3) - (startPeriodNum - 1) - (3 - endPeriodNum);

      // Rule 1: Start must be strictly before end (duration must be at least 1)
      if (totalPeriods < 1) {
          setError('Start date/period must be strictly before the end date/period.');
          return;
      }

      // Rule 2: Duration must be less than 22 periods
      if (totalPeriods >= 22) {
          setError('Cycle duration must be less than 22 periods (e.g., Mon Morning to next Mon Morning is 22 periods and is invalid).');
          return;
      }
    // --- END VALIDATION ---

      const payload = { 
        ...newCycleData, 
        force_overwrite: forceOverwrite,
      };
      
      const result = await apiCreateNewCycle(payload); 

      toast.success(result.message);
      setNewCycleData({cycle_name: '', start_date: '', end_date: '', start_period: 'Morning', end_period: 'Evening', calculation_mode: 'Legacy'});
      setShowCreateForm(false); // <-- 2. Hide form on success
      fetchAllCycles(); 

    } catch (err) {
        if (err.status === 409 && err.data?.message === 'CYCLE_CONFLICT') {
            setOverlapDetails(err.data);
        } else {
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

  if (loading) return <p className="text-gray-600">Loading settings...</p>;
  const selectedCycle = allCycles.find(c => c.cycle_id === selectedCycleId);

if (allCycles.length === 0) {
    return (
        <div className="p-4 border border-gray-300 rounded-md bg-gray-50 shadow-sm">
            <p className="p-3 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded">
                No cycles found in the system. Please create the first cycle below.
            </p>
            <div className="mt-5 pt-4 border-t border-gray-300">
                <CreateCycleForm 
                    newCycleData={newCycleData}
                    handleInputChange={handleInputChange}
                    handleCreateNewCycle={handleCreateNewCycle}
                    overlapDetails={overlapDetails}
                    setOverlapDetails={setOverlapDetails}
                    error={error}
                    setError={setError}
                    // Since the form is not toggled, we don't need setShowCreateForm
                />
            </div>
        </div>
    );
  }

  
  return (
    <div className="p-4 border border-gray-300 rounded-md bg-gray-50 shadow-sm">
      {error && <div className="p-3 bg-red-100 text-red-700 border border-red-300 rounded mb-3">{error}</div>}

      {/* 1. MASTER CYCLE SELECTION & MANAGER */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
             {/* Master Dropdown */}
             <select
                 value={selectedCycleId || ''}
                 onChange={(e) => setSelectedCycleId(parseInt(e.target.value, 10))}
                 className="p-2 border rounded bg-white text-sm focus:ring-blue-500 focus:border-blue-500"
             >
                 {allCycles.map(cycle => (
                     <option key={cycle.cycle_id} value={cycle.cycle_id}>
                         {cycle.cycle_name} ({formatBoundary(cycle.start_date, cycle.start_period)}) {cycle.is_active ? ' (ACTIVE)' : ''}
                     </option>
                 ))}
             </select>
        </div>

        {selectedCycle && (
            <CycleManager 
                cycle={selectedCycle} 
                fetchAllCycles={fetchAllCycles}
                formatBoundary={formatBoundary}
                PERIOD_OPTIONS={PERIOD_OPTIONS}
                PERIOD_ORDER={PERIOD_ORDER}
            />
        )}
      </div>


      {/* 2. ADMIN ONLY: CREATE NEW CYCLE (TOGGLEABLE) */}
      {isLoggedIn && (
        <div className="mt-5 pt-4 border-t border-gray-300">
          
          {/* --- TOGGLE BUTTON --- */}
          {!showCreateForm ? (
            <button 
              onClick={() => setShowCreateForm(true)}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition duration-150"
            >
              + Create New Cycle
            </button>
          ) : (
             <CreateCycleForm 
                newCycleData={newCycleData}
                handleInputChange={handleInputChange}
                handleCreateNewCycle={handleCreateNewCycle}
                overlapDetails={overlapDetails}
                setOverlapDetails={setOverlapDetails}
                error={error}
                setError={setError}
                setShowCreateForm={setShowCreateForm}
            />
          )}
        </div>
      )}
    </div>
  );
}

// --- NEW COMPONENT: Renders the details and editing for the selected cycle ---
function CycleManager({ cycle, fetchAllCycles, formatBoundary, PERIOD_OPTIONS, PERIOD_ORDER }) {
    const { isLoggedIn } = useAuth();
    
    const getCurrentMode = (mode) => {
        const colorClass = mode === 'Group' ? 'text-green-600' : 'text-blue-600';
        return (
            <span className={`font-bold ml-2 ${colorClass}`}>
                ({mode})
            </span>
        );
    }
    
    const handleModeChange = async (mode) => {
        if (!isLoggedIn) return;
        try {
            // NOTE: apiChangeCycleMode now needs to take cycle.cycle_id
            await apiChangeCycleMode(cycle.cycle_id, mode); 
            toast.success(`Mode changed for ${cycle.cycle_name} to ${mode}!`);
            fetchAllCycles(); 
        } catch(err) {
            toast.error(err.message);
        }
    };
    
    return (
        <div className="p-3 border border-gray-300 rounded bg-white">
             
            {/* --- MODE SWITCH BUTTONS --- */}
            {isLoggedIn && (
                <div className="float-right flex space-x-2">
                    <button 
                        onClick={() => handleModeChange('Legacy')}
                        className={`font-bold py-1 px-3 rounded transition duration-150 text-xs ${cycle.calculation_mode === 'Legacy' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                        disabled={cycle.calculation_mode === 'Legacy'}
                    >
                        Set Legacy
                    </button>
                    <button 
                        onClick={() => handleModeChange('Group')}
                        className={`font-bold py-1 px-3 rounded transition duration-150 text-xs ${cycle.calculation_mode === 'Group' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                        disabled={cycle.calculation_mode === 'Group'}
                    >
                        Set Group
                    </button>
                </div>
            )}
            
            <span className="font-bold text-base">{cycle.cycle_name}</span>
            {cycle.is_active && <span className="text-sm text-green-600 ml-2">(Active)</span>}
            {getCurrentMode(cycle.calculation_mode)}
            
            <p className="text-sm text-gray-500 mt-1">
              Boundary: {formatBoundary(cycle.start_date, cycle.start_period)} to {formatBoundary(cycle.end_date, cycle.end_period)}
            </p>
            
            {/* Cycle Editor - Passes cycle as the prop */}
            {isLoggedIn && (
                <AdminCycleEditor 
                    currentCycle={cycle} 
                    fetchAllCycles={fetchAllCycles} 
                    PERIOD_OPTIONS={PERIOD_OPTIONS}
                    PERIOD_ORDER={PERIOD_ORDER}
                />
            )}
        </div>
    );
}

// --- Component for Editing Active Cycle Dates (Sub-Component - Updated) ---
function AdminCycleEditor({ currentCycle, fetchAllCycles, PERIOD_OPTIONS, PERIOD_ORDER }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        // Use the helper function to strip the time from the ISO string
        start_date: formatDateForInput(currentCycle.start_date),
        end_date: formatDateForInput(currentCycle.end_date),
        start_period: currentCycle.start_period,
        end_period: currentCycle.end_period,
        calculation_mode: currentCycle.calculation_mode,
    });
    const [editError, setEditError] = useState(null);
    const [externalOverlapDetails, setExternalOverlapDetails] = useState(null); 

    const handleEditChange = (e) => {
        setEditData({ ...editData, [e.target.name]: e.target.value });
    };

    const handleUpdate = async (forceOverwrite = false) => {
        // ... (Update logic remains the same) ...
        setEditError(null);
        setExternalOverlapDetails(null);

        try {
            // ... (Validation remains the same and is correct) ...
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
            // --- NEW DURATION VALIDATION (Implements both of your new rules) ---
            const startPeriodNum = PERIOD_ORDER[editData.start_period];
            const endPeriodNum = PERIOD_ORDER[editData.end_period];

            // Calculate number of days, inclusive. (e.g., Mon to Mon = 1 day)
            const diffTime = endDate.getTime() - startDate.getTime();
            const numDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

            // Calculate total periods (inclusive)
            const totalPeriods = (numDays * 3) - (startPeriodNum - 1) - (3 - endPeriodNum);

            // Rule 1: Start must be strictly before end (duration must be at least 1)
            if (totalPeriods < 1) {
                setEditError('Start date/period must be strictly before the end date/period.');
                return;
            }

            // Rule 2: Duration must be less than 22 periods
            if (totalPeriods >= 22) {
                setEditError('Cycle duration must be less than 22 periods (e.g., Mon Morning to next Mon Morning is 22 periods and is invalid).');
                return;
            }

            const payload = {
                ...editData, 
                force_overwrite: forceOverwrite,
            };
            
            const result = await apiUpdateCycleDates(currentCycle.cycle_id, payload);
            
            toast.success(result.message);
            setIsEditing(false);
            fetchAllCycles(); 

        } catch (err) {
            if (err.status === 409 && err.data?.message === 'EXTERNAL_CYCLE_CONFLICT') {
                 setExternalOverlapDetails(err.data);
            } else {
                setEditError(err.message);
            }
        }
    };
    
    const handleCancel = () => {
        setIsEditing(false);
        setEditError(null);
        setExternalOverlapDetails(null);
        // Reset local state to match currentCycle props
        setEditData({
            start_date: formatDateForInput(currentCycle.start_date),
            end_date: formatDateForInput(currentCycle.end_date),
            start_period: currentCycle.start_period,
            end_period: currentCycle.end_period,
            calculation_mode: currentCycle.calculation_mode,
        });
    }; // Closing brace is assumed to be here, based on context

    const handleDelete = async () => {
        if (!window.confirm(`WARNING: Are you absolutely sure you want to DELETE cycle: "${currentCycle.cycle_name}" (ID: ${currentCycle.cycle_id})? This will delete ALL associated task logs and targets.`)) {
            return;
        }

        try {
            await apiDeleteCycle(currentCycle.cycle_id);
            toast.success(`Cycle "${currentCycle.cycle_name}" deleted.`);
            fetchAllCycles(); // Refresh the list
        } catch (err) {
            toast.error(`Deletion failed: ${err.message}`);
        }
    };

    return (
        <div className="mt-3 pt-3 border-t border-gray-300">
            {editError && <div className="p-2 bg-red-100 text-red-700 border border-red-300 rounded mb-2 text-sm">{editError}</div>}
            
            {/* --- FIX 1: Overlap UI is placed here --- */}
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
                        Click "Confirm & Save" again to surgically trim the timeline.
                    </p>
                    <button onClick={() => handleUpdate(true)} className="mt-3 bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 px-4 rounded transition duration-150 text-sm">
                        Confirm & Save
                    </button>
                    <button onClick={() => setExternalOverlapDetails(null)} className="ml-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-1.5 px-4 rounded transition duration-150 text-sm">
                        Cancel
                    </button>
                 </div>
            ) : (
                <div>
                    {!isEditing ? (
                        <div className="flex space-x-2">
                             {/* MODIFICATION 2: Add Delete Button when not editing */}
                            <button 
                                className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-1 px-3 rounded text-xs transition duration-150"
                                onClick={() => setIsEditing(true)}
                            >
                                Edit Dates
                            </button>
                            <button 
                                className="bg-red-500 hover:bg-red-600 text-white font-medium py-1 px-3 rounded text-xs transition duration-150"
                                onClick={handleDelete}
                            >
                                Delete Cycle
                            </button>
                        </div>
                    ) : (
                        <div className="mt-2 space-y-3">
                            <p className="font-bold text-sm">Adjust Cycle Boundaries</p>
                            
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
                                <button onClick={handleCancel} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-1.5 px-4 rounded transition duration-150 text-sm">Cancel</button>
                            </div>
                            <p className="text-xs text-red-500 mt-2">
                                *Warning: Saving will adjust the cycle and delete conflicting data.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// --- NEW COMPONENT: Form for Creating a New Cycle (To keep the main component clean) ---
function CreateCycleForm({ newCycleData, handleInputChange, handleCreateNewCycle, overlapDetails, setOverlapDetails, error, setError, setShowCreateForm }) {
    
    return (
        <>
            <div className="flex justify-between items-center mb-3">
                <h4 className="text-lg font-semibold">Create/Overwrite New Cycle</h4>
                <button 
                  onClick={() => { setShowCreateForm(false); setError(null); setOverlapDetails(null); }}
                  className="text-sm text-gray-600 hover:text-red-600"
                >
                  Cancel
                </button>
            </div>
        
            {overlapDetails && (
                <div className="p-4 bg-red-100 text-red-700 border border-red-300 rounded mb-4">
                  <p className="font-bold">Conflict Detected!</p>
                  <p className="text-sm">The new cycle dates overlap with existing history. Confirm overwrite to surgically trim the timeline.</p>
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

            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleCreateNewCycle(false); }}>
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
        </>
    );
}