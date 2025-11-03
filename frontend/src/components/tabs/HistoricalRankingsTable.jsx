import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { apiGetHistoricalRankings } from '../../services/api.js';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/solid';

export default function HistoricalRankingsTable({ periodFilter }) {
    const [rankings, setRankings] = useState([]);
    const [loading, setLoading] = useState(true);
    // State for sorting
    const [sortConfig, setSortConfig] = useState({ key: 'totalCollected', direction: 'desc' });

    useEffect(() => {
        const fetchRankings = async () => {
            setLoading(true);
            try {
                const data = await apiGetHistoricalRankings(periodFilter);
                const rankingsArray = Array.isArray(data) ? data : [];
                setRankings(rankingsArray); // <-- Change is here
            } catch (err) {
                toast.error(`Failed to load historical rankings: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };
        fetchRankings();
    }, [periodFilter]);

    // Sorting logic
    const sortedRankings = useMemo(() => {
        let sortableItems = [...rankings];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key] || 0;
                const bValue = b[sortConfig.key] || 0;
                
                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                // Primary rank (index + 1) is based on total collected, 
                // so we don't need a secondary sort here.
                return 0;
            });
        }
        return sortableItems.map((user, index) => ({
            ...user,
            // Assign the new rank based on the array index (index + 1)
            rank: index + 1,
        }));
    }, [rankings, sortConfig]);

    const requestSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return null;
        if (sortConfig.direction === 'asc') return <ChevronUpIcon className="w-4 h-4 ml-1" />;
        return <ChevronDownIcon className="w-4 h-4 ml-1" />;
    };
    // Determine the title based on the filter
    const getTitle = () => {
        if (periodFilter.cycleId) return `Rankings for Cycle: ${periodFilter.cycleName}`;
        if (periodFilter.month) return `Rankings for ${periodFilter.year}-${periodFilter.month}`;
        if (periodFilter.year) return `Rankings for Year ${periodFilter.year}`;
        return "Overall Rankings";
    };

    if (loading) return <p className="text-gray-600">Loading rankings...</p>;
    
    return (
        <div className="p-4 border border-gray-300 rounded-md bg-white shadow-sm mt-6">
            <h4 className="text-lg font-semibold mb-3">{getTitle()}</h4>

            <div className="overflow-x-auto border rounded-md">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase w-10">Rank</th>
                            <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                            
                            {/* --- Total Points --- */}
                            <th 
                                className="p-3 text-center text-xs font-semibold text-gray-600 uppercase cursor-pointer group hover:bg-gray-100 transition-colors duration-150"
                                onClick={() => requestSort('totalCollected')}
                            >
                                <span className="flex items-center justify-center">
                                    Total Points {getSortIcon('totalCollected')}
                                    {getSortIcon('totalCollected') === null && (
                                        <ChevronDownIcon className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-40 transition-opacity" />
                                    )}
                                </span>
                            </th>
                            
                            {/* --- Total Credits --- */}
                            <th 
                                className="p-3 text-center text-xs font-semibold text-gray-600 uppercase cursor-pointer group hover:bg-gray-100 transition-colors duration-150"
                                onClick={() => requestSort('totalCredit')}
                            >
                                <span className="flex items-center justify-center">
                                    Total Credits {getSortIcon('totalCredit')}
                                    {getSortIcon('totalCredit') === null && (
                                        <ChevronDownIcon className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-40 transition-opacity" />
                                    )}
                                </span>
                            </th>
                            
                            {/* --- Total Orders --- */}
                            <th 
                                className="p-3 text-center text-xs font-semibold text-gray-600 uppercase cursor-pointer group hover:bg-gray-100 transition-colors duration-150"
                                onClick={() => requestSort('totalOrders')}
                            >
                                <span className="flex items-center justify-center">
                                    Total Orders {getSortIcon('totalOrders')}
                                    {getSortIcon('totalOrders') === null && (
                                        <ChevronDownIcon className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-40 transition-opacity" />
                                    )}
                                </span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {sortedRankings.length === 0 ? (
                            <tr><td colSpan="4" className="p-4 text-center text-sm text-gray-500">No data found for this period.</td></tr>
                        ) : (
                            sortedRankings.map((user, index) => (
                                <tr key={user.userId} className={index < 3 ? 'bg-yellow-50 font-bold' : 'bg-white'}>
                                    <td className="p-3 text-sm text-center">
                                        {user.rank}
                                    </td>
                                    <td className="p-3 text-sm">{user.name}</td>
                                    <td className="p-3 text-sm text-center">{user.totalCollected.toFixed(2)}</td>
                                    <td className="p-3 text-sm text-center">{user.totalCredit}</td>
                                    <td className="p-3 text-sm text-center">{user.totalOrders}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}