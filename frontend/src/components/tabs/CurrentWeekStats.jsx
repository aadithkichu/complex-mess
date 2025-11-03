import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
// 1. Import the APIs you'll need
import { apiGetAllCycles, apiGetTaskTemplates, apiLockCycleAvailability } from '../../services/api.js'; 

// Import the child components
import MessDeliveryLog from '../current/MessDeliveryLog';
import MessCleaningLog from '../current/MessCleaningLog';
import WeekPointsTable from '../current/WeekPointsTable';
import SlotRecommender from '../current/SlotRecommender';

export default function CurrentWeekStats() {
  // 2. Add state for cycles, templates, and loading
  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [taskTemplates, setTaskTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLocking, setIsLocking] = useState(false);
  const [standingsRefreshKey, setStandingsRefreshKey] = useState(0);
    const triggerStandingsRefresh = () => {
        return new Promise(resolve => {
            setTimeout(() => {
                setStandingsRefreshKey(prev => {
                    // Ensure state is updated, then resolve
                    const newKey = prev + 1;
                    return newKey;
                });
                // CRITICAL: Call resolve *outside* of the setter, but after a minimal wait,
                // or rely on the setter update being sufficient.
                // Since React state updates are batched, we MUST rely on the await in the child.
                resolve(); 
            }, 500); // <-- INCREASED DELAY for database safety
        });
    };
  // 3. Add useEffect to fetch all data on load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch all data in parallel
        const [cyclesData, templatesData] = await Promise.all([
          apiGetAllCycles(), // Fetches all cycles for the dropdown
          apiGetTaskTemplates() // Fetches all task types
        ]);
        
        setCycles(cyclesData);
        setTaskTemplates(templatesData);

        // Find and set the 'active' cycle as default
        const activeCycle = cyclesData.find(c => c.is_active);
        if (activeCycle) {
          setSelectedCycle(activeCycle);
        } else if (cyclesData.length > 0) {
          setSelectedCycle(cyclesData[0]); // Fallback to first cycle
        }
        
      } catch (err) {
        toast.error(`Error fetching data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // 4. Add a handler to change the active cycle
  const handleCycleChange = (e) => {
    const cycleId = parseInt(e.target.value, 10);
    const cycle = cycles.find(c => c.cycle_id === cycleId);
    setSelectedCycle(cycle);
  };

  const handleLockAvailability = async () => {
      if (!selectedCycle) return;
      
      if (!window.confirm("This will lock the current user availability for this cycle and recalculate all objectives. This may take a moment. Continue?")) {
          return;
      }
      
      setIsLocking(true);
      try {
          // Call the new snapshot API
          await apiLockCycleAvailability(selectedCycle.cycle_id);
          toast.success('Availability Snapshot Refreshed!');
          
      } catch (err) {
          toast.error(`Snapshot failed: ${err.message}`);
      } finally {
          setIsLocking(false);
      }
  };

  return (
    <div>
      {/* --- Main Current Week Box --- */}
      <div className="p-4 border border-gray-300 rounded-md bg-gray-50 shadow-sm">
        
        {/* 5. Add the Main Heading & Master Cycle Dropdown */}
        <div className="flex flex-wrap justify-between items-center mb-4 border-b pb-2 gap-2">
          <h3 className="text-2xl font-semibold">Current Week Stats</h3>
          
          {loading ? (
            <p>Loading cycles...</p>
          ) : (
            <select
              value={selectedCycle?.cycle_id || ''}
              onChange={handleCycleChange}
              className="p-2 border rounded bg-white text-sm focus:ring-indigo-500 focus:border-indigo-500"
              disabled={cycles.length === 0 || isLocking}
            >
              {cycles.length === 0 ? (
                <option>No cycles found</option>
              ) : (
                cycles.map(cycle => (
                  <option key={cycle.cycle_id} value={cycle.cycle_id}>
                    {cycle.cycle_name} {cycle.is_active ? '(Active)' : ''}
                  </option>
                ))
              )}
            </select>
          )}
          <button
              onClick={handleLockAvailability}
              disabled={isLocking || !selectedCycle}
              className="p-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-400"
            >
              {isLocking ? 'Calculating...' : 'Calc Objectives'}
            </button>
        </div>
        
        {/* 6. Render content only if a cycle and templates are loaded */}
        {!loading && selectedCycle && taskTemplates.length > 0 ? (
          <div className="space-y-8">
            
            {/* Section 1: Log Mess Work */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-800">Log Mess Work</h3>
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 7. Pass the needed props down to the log components */}
                <MessDeliveryLog 
                  cycle={selectedCycle} 
                  templates={taskTemplates.filter(t => t.task_name.toLowerCase().includes('delivery'))}
                  onLogSuccess={triggerStandingsRefresh}
                />
                <MessCleaningLog 
                  cycle={selectedCycle} 
                  templates={taskTemplates.filter(t => t.task_name.toLowerCase().includes('cleaning'))}
                  onLogSuccess={triggerStandingsRefresh}
                />
              </div>
            </div>
            
            {/* Section 2: Current Standings */}
            <div className="mt-6 pt-4 border-t border-gray-300">
              <h3 className="text-lg font-semibold text-gray-800">Current Standings</h3>
              <div className="mt-4">
                {/* 8. Pass cycleId to other components so they can fetch data */}
                <WeekPointsTable cycleId={selectedCycle.cycle_id} 
                refreshTrigger={standingsRefreshKey} />
              </div>
            </div>
            
            {/* Section 3: Priority & Recommendations */}
            <div className="mt-6 pt-4 border-t border-gray-300">
              <h3 className="text-lg font-semibold text-gray-800">Priority & Recommendations</h3>
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
                <SlotRecommender cycleId={selectedCycle.cycle_id} />
              </div>
            </div>
          </div>
        ) : (
          !loading && <p>Please select a cycle to view stats.</p>
        )}
      </div>
    </div>
  );
}