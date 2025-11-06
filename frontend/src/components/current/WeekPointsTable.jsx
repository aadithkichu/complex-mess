import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { apiCalculateAndGetStandings } from '../../services/api.js';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import UserDetailsModal from '../config/UserDetailsModal.jsx';

const getPriorityColor = (urgency) => {
  if (urgency <= 0) return 'bg-green-50 text-green-800';
  if (urgency > 2.0) return 'bg-red-100 text-red-800';
  if (urgency > 0.5) return 'bg-yellow-100 text-yellow-800';
  return 'bg-white text-gray-800';
};

export default function WeekPointsTable({ cycleId , refreshTrigger}) {
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState(null);

  useEffect(() => {
    if (!cycleId) {
      setLoading(false);
      return;
    }
    const fetchStandings = async () => {
      setLoading(true);
      try {
        const data = await apiCalculateAndGetStandings(cycleId);
        setStandings(data);
      } catch (err) {
        toast.error(`Error fetching standings: ${err.message}`);
        setStandings([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStandings();
  }, [cycleId, refreshTrigger]);

  // Use useMemo to calculate and rank the data
  const processedStandings = useMemo(() => {
    if (!Array.isArray(standings)) {
      return [];
    }

    // 1. Map over the data, convert strings to numbers, and calculate ratio
    const calculatedData = standings.map(user => {
        // --- THIS IS THE FIX ---
        // Convert the database strings to numbers
        const objective = parseFloat(user.point_objective) || 0;
        const taken = parseFloat(user.points_taken) || 0;
        // --- END FIX ---

        // Calculate Ratio (for display)
        let ratio = 0;
        if (objective > 0) {
          ratio = Math.pow(taken, 4/3) / objective;
        } else if (taken > 0) {
          ratio = Infinity; 
        }

        return { 
          ...user,
          
          // Overwrite the original string props with the new number props
          point_objective: objective,
          points_taken: taken,
          ratio,
          // We trust urgency_weight and periods_remaining are already numbers
          // from the backend calculation
        };
      });
      
    // 2. Rank by RATIO (ascending) - This is the change
    return calculatedData.sort((a, b) => {
        // Handle Infinity (users who did work without an objective go to the bottom)
        if (a.ratio === Infinity) return 1;
        if (b.ratio === Infinity) return -1;
        
        // Ascending sort (a - b)
        return b.ratio-a.ratio; 
    });

  }, [standings]);

  if (loading) return <p>Loading standings...</p>;

  return (
    <>
    <div className="overflow-x-auto border rounded-md shadow-sm bg-white">
      <table className="min-w-full">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase w-10">Rank</th>
            <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
            <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase">Objective</th>
            <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase">Taken</th>
            <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase">Ratio</th>
            <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase">Urgency (W)</th>
            <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase">Periods Left</th>
            <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase">Credit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {processedStandings.map((user, index) => {
            const rowColor = getPriorityColor(user.urgency_weight);
            
            return (
              <tr key={user.user_id} className={`${rowColor}`}>
                <td className="p-3 text-sm font-medium">{index + 1}</td>
                <td 
                    className="p-3 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    onClick={() => setSelectedUserId(user.user_id)}
                  >
                    {user.name}
                  </td>
                <td className="p-3 text-sm text-center">{user.point_objective.toFixed(2)}</td>
                <td className="p-3 text-sm text-center">{user.points_taken.toFixed(2)}</td>
                <td className="p-3 text-sm text-center font-bold">
                  {isFinite(user.ratio) ? user.ratio.toFixed(3) : 'Inf'}
                </td>
                <td className="p-3 text-sm text-center font-bold">
                  {user.urgency_weight.toFixed(4)}
                </td>
                <td className="p-3 text-sm text-center">
                  {user.periods_remaining}
                </td>
                <td className="p-3 text-sm text-center">
                  {user.credits_earned > 0 ? (
                    <CheckCircleIcon className="h-5 w-5 text-green-600 mx-auto" title={`Earned ${user.credits_earned} credit(s)`} />
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {selectedUserId && (
        <UserDetailsModal 
          userId={selectedUserId} 
          onClose={() => setSelectedUserId(null)} 
        />
      )}
    </>
  );
}