import React, { useState, useEffect } from 'react';
import { apiGetUserDetails , apiGetHistoricalStats , apiGetAvailablePeriods} from '../../services/api.js'; // Import the specific API
import toast from 'react-hot-toast'; 
import { 
  TrophyIcon, 
  StarIcon, 
  CreditCardIcon, 
  CalendarIcon, 
  ClockIcon, 
  CheckBadgeIcon ,
  FunnelIcon,
  ChartBarIcon
} from '@heroicons/react/24/solid'; // All necessary Heroicons are imported

// NOTE: This helper MUST be defined here or imported.
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const HistoricalStatsView = ({ userId, initialSummary }) => {
    // State to track which view is active: 'year' or 'month'
    const [filterMode, setFilterMode] = useState('year'); 
    const [yearOptions, setYearOptions] = useState([{ value: 'all', label: 'All Time' }]);
    const [monthOptions, setMonthOptions] = useState([]);
    const [loadingOptions, setLoadingOptions] = useState(true);
    
    // State to hold the currently selected period for filtering
    const [selectedPeriod, setSelectedPeriod] = useState({ 
        year: new Date().getFullYear().toString(),
        month: null
    }); 

    // Local state to hold the dynamically fetched data
    const [summaryData, setSummaryData] = useState(initialSummary);
    const [loading, setLoading] = useState(false);

    const periodSummary = summaryData?.period_summary;
    const cycleBreakdown = summaryData?.cycle_breakdown;
    useEffect(() => {
        const fetchPeriods = async () => {
            setLoadingOptions(true);
            try {
                // 1. Fetch raw cycle records from the new endpoint
                const response = await apiGetAvailablePeriods(userId);
                // FIX: Access the 'periods' array from the backend response structure
                const cycleRecords = response.periods || []; 
                
                // 2. Process data into unique years and months
                const uniqueYears = new Set(['all', new Date().getFullYear().toString()]); 
                const uniqueMonths = new Map();
                
                cycleRecords.forEach(cycle => {
                    const date = new Date(cycle.start_date);
                    const year = date.getFullYear().toString();
                    const monthIndex = date.getMonth() + 1; // 1-12
                    const monthYearKey = `${monthIndex}-${year}`;
                    
                    uniqueYears.add(year);
                    uniqueMonths.set(monthYearKey, { 
                        value: monthYearKey, 
                        label: date.toLocaleString('en-US', { month: 'short', year: 'numeric' }) 
                    });
                });
                
                // 3. Build and set Year Options (sorted descending)
                const processedYears = Array.from(uniqueYears)
                    .sort((a, b) => {
                        if (a === 'all') return -1;
                        if (b === 'all') return 1;
                        return b.localeCompare(a);
                    })
                    .map(y => ({ value: y, label: y === 'all' ? 'All Time' : y }));
                
                setYearOptions(processedYears);
                
                // 4. Build and set Month Options (sorted descending by date)
                const processedMonths = Array.from(uniqueMonths.values()).sort((a, b) => {
                    const [m1, y1] = a.value.split('-');
                    const [m2, y2] = b.value.split('-');
                    if (y1 !== y2) return y2 - y1;
                    return m2 - m1;
                });
                
                setMonthOptions(processedMonths);
                
                // Set initial period to the most recent year if not already set
                if (!selectedPeriod.year) {
                    setSelectedPeriod(prev => ({ ...prev, year: processedYears[0].value }));
                }

            } catch (error) {
                toast.error("Could not load historical period options.");
            } finally {
                setLoadingOptions(false);
            }
        };

        fetchPeriods();
    }, [userId]); // Runs only on initial load/userId change


    // --- EFFECT TO FETCH DATA ON FILTER CHANGE ---
    useEffect(() => {
        // Only run if the filter has a valid year or if we are requesting 'all'
        if (!selectedPeriod.year) return;
        
        const fetchFilteredStats = async () => {
            setLoading(true);
            
            // Build filter object to send to API
            const filters = {
                year: selectedPeriod.year === 'all' ? null : selectedPeriod.year,
                quarter: selectedPeriod.quarter,
                month: selectedPeriod.month,
            };

            try {
                // IMPORTANT: This API call needs to hit your backend endpoint 
                // using the user's ID and query parameters for filtering.
                const data = await apiGetHistoricalStats(userId, filters); 
                setSummaryData(data.historical_stats_summary);
            } catch (err) {
                toast.error(`Error filtering history: ${err.message}`);
                setSummaryData(null); 
            } finally {
                setLoading(false);
            }
        };
        fetchFilteredStats();

        // This effect runs whenever userId or selectedPeriod changes
    }, [userId, selectedPeriod]); 

    // --- Filter Handlers ---
    const handleYearChange = (e) => {
        const value = e.target.value;
        setFilterMode('year');
        setSelectedPeriod({ year: value, month: null });
    };

    const handleMonthChange = (e) => {
        const [month, year] = e.target.value.split('-');
        setFilterMode('month');
        setSelectedPeriod({ year, month:month });
    };

    


    return (
        <div className="border border-gray-200 p-4 rounded-lg bg-white mt-4 space-y-4">
            <h5 className="font-bold text-xl flex items-center text-gray-700">
                <CalendarIcon className="mr-2 h-6 w-6 text-indigo-500" /> Historical Performance
            </h5>

            {/* --- Filter Mode Tabs --- */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => {
                        // FIX: When switching to YEAR mode, explicitly set 'month' to null.
                        setFilterMode('year');
                        setSelectedPeriod(prev => ({ 
                            ...prev, 
                            month: null 
                        })); 
                        // The useEffect will run automatically because selectedPeriod changed.
                    }}
                    className={`px-4 py-2 text-sm font-medium ${
                        filterMode === 'year' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Year/All-Time Summary
                </button>
                <button
                    onClick={() => {
                        // FIX: When switching to month mode, if monthOptions exist, 
                        // set the initial filter to the most recent month's data.
                        setFilterMode('month');
                        if (monthOptions.length > 0) {
                            const [month, year] = monthOptions[0].value.split('-');
                            // This sets the filter and triggers the useEffect to fetch data for this specific month.
                            setSelectedPeriod({ year, month });
                        }
                    }}
                    className={`px-4 py-2 text-sm font-medium ${
                        filterMode === 'month' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Monthly Cycle Breakdown
                </button>
            </div>
            
            {/* --- YEAR/ALL-TIME SECTION --- */}
            {filterMode === 'year' && (
                <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                        <FunnelIcon className="h-5 w-5 text-gray-500" />
                        <select 
                            onChange={handleYearChange} 
                            value={selectedPeriod.year}
                            className="p-1 border border-gray-300 rounded text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            {yearOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        <span className="text-sm font-medium text-gray-600">Select Year/Period</span>
                    </div>

                    {loading ? (
                         <p className="text-sm text-gray-500 py-4">Loading stats for {selectedPeriod.year}...</p>
                    ) : (periodSummary) ? (
                        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200 grid grid-cols-2 gap-4">
                            {/* Aggregated Period Summary & Ranks */}
                            <div className="space-y-1">
                                <p className="text-md font-semibold text-indigo-700">Total Points Collected ({selectedPeriod.year})</p>
                                <p className="text-3xl font-black text-indigo-900">{periodSummary.total_points_collected || '0.00'}</p>
                                <p className="text-sm text-gray-500">Rank: <span className="font-bold text-indigo-600">#{periodSummary.rank_collected || 'N/A'}</span></p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-md font-semibold text-indigo-700">Total Credits Earned ({selectedPeriod.year})</p>
                                <p className="text-3xl font-black text-indigo-900">{periodSummary.total_credits_earned || '0'}</p>
                                <p className="text-sm text-gray-500">Rank: <span className="font-bold text-indigo-600">#{periodSummary.rank_credit || 'N/A'}</span></p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">No historical data found for the selected year/period.</p>
                    )}
                </div>
            )}
            
            {filterMode === 'month' && (
                <div className="space-y-4">
                    
                    {/* --- NEW CONDITIONAL WRAPPER --- */}
                    {loadingOptions ? (
                        <p className="text-sm text-gray-500 py-4">Loading period options...</p>
                    ) : (monthOptions.length > 0) ? (
                        <> {/* Fragment to hold all the content */}
                            <div className="flex items-center space-x-2">
                                <FunnelIcon className="h-5 w-5 text-gray-500" />
                                <select 
                                    onChange={handleMonthChange} 
                                    
                                    /* --- FIX: Simplified and safe value prop --- */
                                    /* We can safely use this because the tab's onClick handler */
                                    /* already sets selectedPeriod to the first month. */
                                    value={`${selectedPeriod.month}-${selectedPeriod.year}`}

                                    className="p-1 border border-gray-300 rounded text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    {monthOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                <span className="text-sm font-medium text-gray-600">Select Month</span>
                            </div>

                            {loading ? (
                                <p className="text-sm text-gray-500 py-4">Loading stats for selected month...</p>
                            ) : (periodSummary) ? (
                                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200 grid grid-cols-2 gap-4">
                                    {/* (Monthly totals) */}
                                    <div className="space-y-1">
                                        <p className="text-md font-semibold text-indigo-700">Total Points Collected (Month)</p>
                                        <p className="text-3xl font-black text-indigo-900">{periodSummary.total_points_collected || '0.00'}</p>
                                        <p className="text-sm text-gray-500">Rank: <span className="font-bold text-indigo-600">#{periodSummary.rank_collected || 'N/A'}</span></p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-md font-semibold text-indigo-700">Total Credits Earned (Month)</p>
                                        <p className="text-3xl font-black text-indigo-900">{periodSummary.total_credits_earned || '0'}</p>
                                        <p className="text-sm text-gray-500">Rank: <span className="font-bold text-indigo-600">#{periodSummary.rank_credit || 'N/A'}</span></p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500">No historical data found for the selected month.</p>
                            )}

                            <h6 className="font-semibold text-gray-700">
                                Cycle Breakdown for {selectedPeriod.month}/{selectedPeriod.year}
                            </h6>
                            
                            {loading ? (
                                <p className="text-sm text-gray-500 py-4">Loading cycles for the selected month...</p>
                            ) : (cycleBreakdown && cycleBreakdown.length > 0) ? (
                                <ul className="divide-y divide-gray-200 border rounded max-h-60 overflow-y-auto">
                                    {cycleBreakdown.map((cycle) => (
                                        <li key={cycle.cycle_id} className="p-3 hover:bg-gray-50">
                                            <p className="font-bold text-sm text-indigo-800">{cycle.cycle_name} (Start: {formatDate(cycle.start_date)})</p>
                                            <div className="grid grid-cols-4 text-xs mt-1 text-gray-600">
                                                <p>Collected: <span className="font-semibold text-green-600">{cycle.points_collected}</span></p>
                                                <p>Objective: <span className="font-semibold">{cycle.point_objective}</span></p>
                                                <p>Rank: <span className="font-bold text-indigo-600">#{cycle.rank || 'N/A'}</span></p>
                                                <p>Ratio Rank: <span className="font-black text-red-600">{cycle.ratio_rank}</span></p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-gray-500">No cycle data found for the selected month.</p>
                            )}
                        </>
                    ) : (
                        /* --- NEW: Message when no months are available --- */
                        <p className="text-sm text-gray-500">No monthly cycle data available.</p>
                    )}
                </div>
            )}
        </div>
    );
};


// ------------------------------------------------------------------
// --- USER DETAILS MODAL (Exported Component) ---
// ------------------------------------------------------------------
export default function UserDetailsModal({ userId, onClose }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!userId) {
          setLoading(false);
          return;
      }
      
      setLoading(true);
      setError(null);

      try {
        const data = await apiGetUserDetails(userId);
        setDetails(data);
      } catch (err) {
        setError(err.message);
        toast.error(`Error fetching user details: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [userId]);

  const currentCycleData = details?.current_cycle;
  const currentStats = currentCycleData?.current_stats;
  const priorityCalc = currentCycleData?.priority_calc;
  const bestPerformance = details?.best_performance;

  return (
    // Modal Overlay
    <div 
      className="fixed inset-0 bg-white bg-opacity-80 z-40 flex justify-center items-center"
      onClick={onClose} 
    >
      {/* Modal Content - Increased max-w-4xl for all details */}
      <div 
        className="bg-white rounded-lg shadow-2xl w-full max-w-4xl p-8 relative overflow-y-auto max-h-[90vh]" 
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-3xl text-gray-500 hover:text-gray-800"
        >
          &times;
        </button>
        
        {loading && <p className="text-center py-8">Loading comprehensive user details...</p>}
        {error && <p className="text-red-500 text-center py-8">{error}</p>}
        
        {details && !loading && (
          <div className="space-y-6">
            <h3 className="text-3xl font-extrabold mb-4 border-b pb-2 text-indigo-700">{details.name}</h3>
            
            {/* 1. NEW: HIGH-LEVEL SUMMARY: Total Credit and Rank */}
            <div className="grid grid-cols-2 gap-4 border p-4 rounded-lg bg-gray-50">
                <div className="p-3 bg-white rounded shadow-md">
                    <span className="text-sm uppercase text-gray-500 font-semibold flex items-center">
                        {/* FIX 2: Replaced FaRulerHorizontal with CreditCardIcon */}
                        <CreditCardIcon className="mr-2 h-4 w-4 text-pink-500"/> Total Lifetime Credit
                    </span>
                    <p className="text-4xl font-black text-pink-600 mt-1">{details.total_credit || '0.00'}</p>
                </div>
                <div className="p-3 bg-white rounded shadow-md">
                    <span className="text-sm uppercase text-gray-500 font-semibold flex items-center">
                        {/* FIX 3: Replaced FaTrophy with TrophyIcon */}
                        <TrophyIcon className="mr-2 h-4 w-4 text-yellow-600"/> Current Cycle Rank
                    </span>
                    <p className="text-4xl font-black text-yellow-700 mt-1">
                        {/* Note: Rank is now a top-level property */}
                        #{details.cycle_rank || 'N/A'}
                    </p>
                    <p className="text-lg font-semibold text-gray-600 mt-2">
                        {currentCycleData?.cycle_name || 'No Active Cycle'}
                    </p>
                </div>
            </div>

            {/* 2. NEW: DETAILED CURRENT CYCLE METRICS */}
            {currentCycleData ? (
                <div className="border border-indigo-200 p-4 rounded-lg bg-indigo-50">
                    <h4 className="text-xl font-bold mb-3 text-indigo-800 flex items-center">
                        {/* FIX 4: Replaced FaCalendarCheck with CheckBadgeIcon */}
                        <CheckBadgeIcon className="mr-2 h-5 w-5"/>Current Cycle: {currentCycleData.cycle_name}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {/* Urgency Weight (W) - Mapped to priorityCalc */}
                        <div className="p-2 bg-blue-100 rounded text-center">
                            <span className="text-xs uppercase text-blue-700 font-bold">Urgency Weight (W)</span>
                            <p className="text-xl font-bold">{priorityCalc?.urgency_weight || '0'}</p>
                        </div>
                        {/* Objective - Mapped to currentCycleData */}
                        <div className="p-2 bg-white rounded text-center">
                            <span className="text-xs uppercase text-gray-500">Objective</span>
                            <p className="text-xl font-bold">{currentCycleData.objective || '0'}</p>
                        </div>
                        {/* Earned - Mapped to currentCycleData */}
                        <div className="p-2 bg-white rounded text-center">
                            <span className="text-xs uppercase text-gray-500">Earned</span>
                            <p className="text-xl font-bold text-green-600">{currentCycleData.earned || '0'}</p>
                        </div>
                        {/* Points Remaining - Mapped to currentStats */}
                        <div className="p-2 bg-white rounded text-center">
                            <span className="text-xs uppercase text-gray-500">Remaining</span>
                            <p className="text-xl font-bold">{(parseFloat(currentStats?.remaining) || 0).toFixed(2)}</p>
                        </div>
                        {/* Periods Remaining - Mapped to priorityCalc */}
                        <div className="p-2 bg-white rounded text-center">
                            <span className="text-xs uppercase text-gray-500">Periods Left</span>
                            <p className="text-xl font-bold">{priorityCalc?.periods_remaining || '0'}</p>
                        </div>
                    </div>
                </div>
            ) : (
                <p className="text-lg text-gray-500">No active cycle data available.</p>
            )}

            <div className="pt-4 border-t">
                <h4 className="font-bold text-xl mb-3 flex items-center text-gray-700">
                    <StarIcon className="mr-2 h-5 w-5 text-orange-500"/> All-Time Best Performance
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Best Cycle (Points) */}
                    <div className="p-4 bg-orange-50 border-l-4 border-orange-400 rounded">
                        <p className="text-xs uppercase text-gray-500">Best Cycle (Points)</p>
                        <p className="text-2xl font-bold text-orange-700 mt-1">
                            {bestPerformance?.best_cycle?.points || '0'}
                        </p>
                        <p className="text-sm text-gray-500">{bestPerformance?.best_cycle?.cycle_name || 'No data'}
                          {bestPerformance?.best_cycle?.start_date && 
                                ` (${formatDate(bestPerformance?.best_cycle?.start_date)})`}
                        </p>
                    </div>
                    {/* Best Month (Points) */}
                    <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                        <p className="text-xs uppercase text-gray-500">Best Month (Points)</p>
                        <p className="text-2xl font-bold text-yellow-700 mt-1">
                            {bestPerformance?.best_month?.points || '0'}
                        </p>
                        <p className="text-sm text-gray-500">{bestPerformance?.best_month?.period || 'No data'}</p>
                    </div>
                    {/* Best Rank Achieved (Replaces Best Ratio) */}
                    <div className="p-4 bg-teal-50 border-l-4 border-teal-400 rounded">
                        <p className="text-xs uppercase text-gray-500 flex items-center">
                            <TrophyIcon className="h-4 w-4 mr-1 text-teal-600"/>
                            Best Rank Achieved
                        </p>
                        <p className="text-2xl font-bold text-teal-700 mt-1">
                           #{bestPerformance?.best_rank_cycle?.best_rank || 'N/A'}
                        </p>
                        <p className="text-sm text-gray-500">{bestPerformance?.best_rank_cycle?.cycle_name || 'No data'}</p>
                    </div>
                </div>
            </div>

            <HistoricalStatsView 
                userId={userId} 
                // The HistoricalStatsView component will now perform its own initial fetch 
                // based on the default filter (e.g., current year)
            />

            {/* --- Availability (Existing Section) --- */}
            <div className="border-t pt-4">
              <h5 className="font-semibold mb-2 flex items-center">
                 <ClockIcon className="mr-2 h-5 w-5 text-gray-600"/> Weekly Availability
              </h5>
              <div className="flex flex-wrap gap-2">
                {(details.availability || []).length > 0 ? ( 
                  details.availability.map((slot,index) => (
                    <span key={`${slot}-${index}`} className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                      {slot}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No availability set. This user cannot be prioritized.</p>
                )}
              </div>
            </div>

            {/* --- Task History (Existing Section) --- */}
            <div>
              <h5 className="font-semibold mb-2">Recent Task History</h5>
              <ul className="divide-y divide-gray-200 border rounded max-h-64 overflow-y-auto">
                {(details.task_history || []).length > 0 ? (
                  details.task_history.map((task, index) => (
                    <li key={task.task_name + task.task_datetime} className="flex justify-between items-center p-3 hover:bg-gray-50"> 
                      <div>
                        <p className="font-medium">{task.task_name} ({task.time_of_day})</p>
                        <p className="text-sm text-gray-500">{formatDate(task.task_datetime)}</p>
                      </div>
                      <span className="text-lg font-bold text-green-600">+{task.points_earned}</span>
                    </li>
                  ))
                ) : (
                  <p className="p-3 text-sm text-gray-500">No task history found.</p>
                )}
              </ul>
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
}