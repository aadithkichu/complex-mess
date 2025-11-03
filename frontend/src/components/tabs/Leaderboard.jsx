import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { apiGetAllCycles } from '../../services/api.js'; 
import HistoricalRankingsTable from './HistoricalRankingsTable.jsx';
import BestMonthlyBanner from './BestMonthlyBanner.jsx';
import { FunnelIcon } from '@heroicons/react/24/solid';
import WeeksPointTable from '../current/WeekPointsTable.jsx';


// Helper to format option labels
const formatPeriodLabel = (p) => {
    if (p.cycle_name) return `Cycle: ${p.cycle_name}`;
    if (p.month) return `${p.month}-${p.year} (Month)`;
    return p.year;
};

export default function Leaderboard() {
    // State for filtering
    const [availablePeriods, setAvailablePeriods] = useState({ cycle: [], month: [], year: [] });
    const [selectedFilter, setSelectedFilter] = useState({ type: 'cycle', value: null });
    const [loadingPeriods, setLoadingPeriods] = useState(true);

    // Filter object passed to the HistoricalRankingsTable
    const periodFilter = useMemo(() => {
        if (!selectedFilter.value) return {};
        
        switch (selectedFilter.type) {
            case 'cycle':
               const cycle = availablePeriods.cycle.find(c => c.value === selectedFilter.value);
                return { 
                    cycleId: selectedFilter.value,
                    cycleName: cycle ? cycle.label : selectedFilter.value // Use the label (which is cycle_name)
                };
            case 'month':
                const [year, month] = selectedFilter.value.split('-');
                return { year, month };
            case 'year':
                return { year: selectedFilter.value };
            default:
                return {};
        }
    }, [selectedFilter]);

    // Fetch available periods on load (Cycles, Months, Years)
    useEffect(() => {
        const fetchPeriods = async () => {
            setLoadingPeriods(true);
            try {
                const response = await apiGetAllCycles(); 
                const cycleRecords = response || []; 
                
                const periods = { cycle: [], month: [], year: [] };
                const uniqueYears = new Set();
                
                cycleRecords.forEach(c => {
                    // Cycles
                    periods.cycle.push({ type: 'cycle', value: c.cycle_id, label: c.cycle_name });
                    
                    const date = new Date(c.start_date);
                    const year = date.getFullYear().toString();
                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                    const monthKey = `${year}-${month}`;
                    
                    // Months
                    if (!periods.month.find(p => p.value === monthKey)) {
                        periods.month.push({ type: 'month', value: monthKey, label: `${year}-${month}` });
                    }

                    // Years
                    uniqueYears.add(year);
                });
                
                // Sort years descending
                periods.year = Array.from(uniqueYears).map(y => ({ type: 'year', value: y, label: y })).sort((a, b) => b.value - a.value);
                
                setAvailablePeriods(periods);
                
                // Set default filter to the most recent cycle
                if (periods.cycle.length > 0) {
                    const defaultFilter = { type: 'cycle', value: periods.cycle[0].value };
                    setSelectedFilter(defaultFilter);
                }

            } catch (error) {
                toast.error("Could not load historical period options.");
            } finally {
                setLoadingPeriods(false);
            }
        };

        fetchPeriods();
    }, []); 

    const handleFilterChange = (e) => {
        const [type, value] = e.target.value.split('|');
        setSelectedFilter({ type, value });
    };

    // Calculate the controlled value for the <select>
    const selectValue = selectedFilter.type && selectedFilter.value
        ? `${selectedFilter.type}|${selectedFilter.value}`
        : ''; // Use empty string when not yet initialized

    return (
        <div className="space-y-6 mt-6">
            <h2 className="text-3xl font-extrabold text-gray-900">Leaderboard & Historical Rankings</h2>

            {/* --- 1. BANNER SECTION --- */}
            <BestMonthlyBanner />
            
            {/* --- 2. RANKING & FILTER SECTION --- */}
            <div className="border border-gray-300 p-4 rounded-lg bg-white shadow-sm">
                <h3 className="text-xl font-bold mb-3 flex items-center text-gray-700">
                    <FunnelIcon className="h-5 w-5 mr-2 text-indigo-500" /> Rankings Filter
                </h3>
                
                <label className="block max-w-sm">
                    <span className="text-sm font-medium text-gray-600">Select Ranking Period:</span>
                    <select
                        onChange={handleFilterChange}
                        // Use the correctly calculated 'selectValue'
                        value={selectValue}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        // Disable only if actively loading
                        disabled={loadingPeriods} 
                    >
                        {/* Render the Loading option when loading */}
                        {loadingPeriods && (
                            <option value="" disabled>Loading periods...</option>
                        )}
                        
                        {/* Render options ONLY when data is available */}
                        {availablePeriods.cycle.length > 0 && (
                            <>
                                <optgroup label="Cycles">
                                    {availablePeriods.cycle.map(p => (
                                        <option key={p.value} value={`cycle|${p.value}`}>{p.label}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Months">
                                    {availablePeriods.month.map(p => (
                                        <option key={p.value} value={`month|${p.value}`}>{p.label}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Years">
                                    {availablePeriods.year.map(p => (
                                        <option key={p.value} value={`year|${p.value}`}>{p.label}</option>
                                    ))}
                                </optgroup>
                            </>
                        )}
                        
                        {/* Fallback option if loading is finished but no cycles exist */}
                        {!loadingPeriods && availablePeriods.cycle.length === 0 && (
                            <option value="" disabled>No periods found.</option>
                        )}
                    </select>
                </label>
            </div>
            
            {periodFilter.cycleId ? (
                // 🎯 RENDER WEEKSPOINTTABLE when cycleId is present
                <WeeksPointTable cycleId={periodFilter.cycleId} />
            ) : (
                // RENDER GENERIC HISTORICAL TABLE otherwise (Month, Year, Overall)
                <HistoricalRankingsTable periodFilter={periodFilter} />
            )}
        </div>
    );
}