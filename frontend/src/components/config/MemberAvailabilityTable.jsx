import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { UserGroupIcon } from '@heroicons/react/24/solid';
import AvailabilityModal from './AvailabilityModal.jsx'; // The modal component
import { 
    apiGetAllUsers, 
    apiGetAvailabilitySummary, 
    apiSetSlotAvailability, 
    apiSetFullDayAvailability 
} from '../../services/api.js'; // Import your REAL api functions

// Constants for the grid
const DAYS_OF_WEEK = [
    { name: 'Monday',    key: 1 },
    { name: 'Tuesday',   key: 2 },
    { name: 'Wednesday', key: 3 },
    { name: 'Thursday',  key: 4 },
    { name: 'Friday',    key: 5 },
    { name: 'Saturday',  key: 6 },
    { name: 'Sunday',    key: 0 }
];
const PERIODS = ['Morning', 'Noon', 'Evening'];

export default function MemberAvailabilityTable() {
    const [loading, setLoading] = useState(true);
    const [allUsers, setAllUsers] = useState([]); // All non-admin users
    const [availability, setAvailability] = useState({}); // The main data object
    
    // Modal state
    const [modalState, setModalState] = useState({
        isOpen: false,
        day: null,
        period: null,
    });
    
    // --- Data Fetching ---
    const fetchData = async () => {
        // Don't set loading to true here, to avoid flashing on refetch
        try {
            // Fetch users and availability in parallel
            const [usersData, availData] = await Promise.all([
                apiGetAllUsers(),
                apiGetAvailabilitySummary()
            ]);
            
            // Filter out admins from the user list
            const nonAdminUsers = usersData.filter(u => !u.is_admin);
            setAllUsers(nonAdminUsers);
            
            setAvailability(availData);
        } catch (err) {
            toast.error(`Error fetching data: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchData();
    }, []);

    // --- Memoized Values ---
    // This calculates the "All Day" checkbox state
    const allDayChecks = useMemo(() => {
        const checks = {};
        if (loading || allUsers.length === 0) return checks;

        for (const day of DAYS_OF_WEEK) {
            const dayKey = day.key;
            let isAllDay = true;
            // Ensure the availability data for the day exists before checking periods
            if (!availability[dayKey]) {
                isAllDay = false;
            } else {
                for (const period of PERIODS) {
                    // Check if the count for the slot equals the total number of non-admin users
                    if (availability[dayKey]?.[period]?.count !== allUsers.length) {
                        isAllDay = false;
                        break;
                    }
                }
            }
            checks[dayKey] = isAllDay;
        }
        return checks;
    }, [availability, allUsers, loading]);


    // --- Event Handlers ---
    const handleCellClick = (dayKey, period) => {
        setModalState({
            isOpen: true,
            day: dayKey,
            period: period,
        });
    };
    
    const handleCloseModal = () => {
        setModalState({ isOpen: false, day: null, period: null });
    };

    // This is called when the "Save" button in the modal is clicked
    const handleSaveSlot = async (newUserIds) => {
        const { day, period } = modalState;
        
        try {
            setLoading(true); // Show loading spinner
            await apiSetSlotAvailability(day, period, newUserIds);
            toast.success('Slot saved successfully!');
            handleCloseModal();
            // Refetch data to show new counts
            fetchData(); 
        } catch (err) {
            toast.error(`Failed to save: ${err.message}`);
            setLoading(false); // Stop loading on error
        }
    };

    // This is called when a "Select All Day" checkbox is clicked
    const handleSelectAllDay = async (dayKey, isChecked) => {
        const allUserIds = allUsers.map(u => u.user_id);
        const dayName = DAYS_OF_WEEK.find(d => d.key === dayKey).name;

        // Optimistic UI update for the checkbox
        const optimisticChecks = { ...localAllDayChecks, [dayKey]: isChecked };
        setAllDayChecks(optimisticChecks);

        try {
            setLoading(true); // Show loading spinner
            await apiSetFullDayAvailability(dayKey, isChecked, allUserIds);
            toast.success(`Set ${dayName} to ${isChecked ? 'All Day' : 'None'}`);
            // Refetch data to get the real counts
            fetchData();
        } catch (err) {
            toast.error(`Failed to update day: ${err.message}`);
            // Rollback optimistic update on failure by refetching
            fetchData(); 
        }
    };

    // Need a local state for optimistic "All Day" checks
    // This syncs the local state with the derived (memoized) state
    const [localAllDayChecks, setAllDayChecks] = useState({});
    useEffect(() => {
        setAllDayChecks(allDayChecks);
    }, [allDayChecks]);


    if (loading && !modalState.isOpen) {
        return (
            <div className="p-4 border border-gray-300 rounded-md bg-white shadow-sm mt-6">
                <p>Loading availability grid...</p>
            </div>
        );
    }

    return (
        <div className="p-4 border border-gray-300 rounded-md bg-white shadow-sm mt-6 relative">
            <h4 className="text-lg font-semibold mb-3">Member Availability</h4>
            
            {loading && (
                 <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center z-20">
                    <p>Updating...</p> {/* Simple loading overlay */}
                 </div>
            )}

            <div className="overflow-x-auto border border-gray-300 rounded-md shadow-inner bg-white">
                <table className="min-w-full">
                    <thead className="sticky top-0 bg-gray-100 border-b border-gray-300 z-10">
                        <tr>
                            <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-1/5">Day</th>
                            <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Morning</th>
                            <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Noon</th>
                            <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Evening</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {DAYS_OF_WEEK.map(day => (
                            <tr key={day.key} className="hover:bg-gray-50">
                                <td className="p-3 text-sm font-medium text-gray-800">
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            checked={localAllDayChecks[day.key] || false}
                                            onChange={(e) => handleSelectAllDay(day.key, e.target.checked)}
                                            disabled={loading} // Disable checkbox while loading
                                        />
                                        <span className="ml-2">{day.name}</span>
                                    </label>
                                </td>
                                {PERIODS.map(period => {
                                    const cellData = availability[day.key]?.[period];
                                    const count = cellData?.count || 0;
                                    
                                    return (
                                        <td 
                                            key={period}
                                            className={`p-3 text-center text-sm ${loading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                            onClick={() => !loading && handleCellClick(day.key, period)}
                                        >
                                            <div className="flex items-center justify-center">
                                                <UserGroupIcon className="h-4 w-4 text-gray-400 mr-1.5" />
                                                <span className={`font-bold ${count > 0 ? 'text-indigo-600' : 'text-gray-500'}`}>
                                                    {count}
                                                </span>
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {modalState.isOpen && (
                <AvailabilityModal
                    isOpen={modalState.isOpen}
                    onClose={handleCloseModal}
                    onSave={handleSaveSlot}
                    
                    // Pass data to the modal
                    dayName={DAYS_OF_WEEK.find(d => d.key === modalState.day).name}
                    period={modalState.period}
                    allUsers={allUsers}
                    initialSelectedIds={availability[modalState.day]?.[modalState.period]?.users || []}
                />
            )}
        </div>
    );
}

