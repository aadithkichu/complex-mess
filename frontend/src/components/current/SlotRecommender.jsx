import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { apiGetSlotRecommendations } from '../../services/api.js';
import { CalendarDaysIcon } from '@heroicons/react/24/solid';
import { format, parseISO } from 'date-fns';

// Helper to group recommendations by date
const groupRecommendationsByDate = (recommendations) => {
  return recommendations.reduce((acc, rec) => {
    const date = rec.date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(rec);
    return acc;
  }, {});
};

export default function SlotRecommender({ cycleId, refreshTrigger }) {
  const [recommendations, setRecommendations] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cycleId) {
      setLoading(false);
      return;
    }
    
    const fetchRecommendations = async () => {
      setLoading(true);
      try {
        const data = await apiGetSlotRecommendations(cycleId);
        setRecommendations(groupRecommendationsByDate(data));
      } catch (err) {
        toast.error(`Error fetching recommendations: ${err.message}`);
        setRecommendations({});
      } finally {
        setLoading(false);
      }
    };
    
    fetchRecommendations();
  }, [cycleId, refreshTrigger]);

  if (loading) {
    return <p>Generating recommendations...</p>;
  }

  const recommendationKeys = Object.keys(recommendations);

  return (
    <div className="p-4 border rounded-md shadow-sm bg-white">
      <h4 className="font-semibold text-md mb-3">Slot Recommendations</h4>
      <div className="overflow-y-auto max-h-96 border rounded-md">
        {recommendationKeys.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">
            No recommendations needed. All objectives may be met or all slots are taken.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {recommendationKeys.map(dateKey => (
              <li key={dateKey} className="p-3">
                <p className="font-bold text-sm text-indigo-700 flex items-center">
                  <CalendarDaysIcon className="h-4 w-4 mr-1.5" />
                  {format(parseISO(dateKey), 'EEEE, MMMM d')}
                </p>
                <ul className="pl-5 mt-2 space-y-1 list-disc list-outside">
                  {recommendations[dateKey].map((rec, index) => (
                    <li key={index} className="text-sm">
                      {/* --- MODIFICATION --- */}
                      <span className="font-semibold">{rec.period} ({rec.task_name}):</span>
                      <span className="ml-2 text-gray-700">{rec.user_name}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}