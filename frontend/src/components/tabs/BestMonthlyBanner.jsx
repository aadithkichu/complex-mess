// HistoricalRankingsTable.jsx (Updated METRIC_MAP and Rendering Logic)
import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { apiGetBestMonthlyRankings } from '../../services/api.js';
import { TrophyIcon, StarIcon, CreditCardIcon, ShoppingCartIcon } from '@heroicons/react/24/solid'; // Added ShoppingCartIcon

// 💡 NEW: Define the three banners and their sorting criteria
const BANNER_CONFIG = [
    { key: 'totalPoints', label: 'Best in Points', icon: StarIcon, color: 'text-yellow-400', secondaryMetric: 'totalMessOrders', tertiaryMetric: 'totalCredit', unit: 'Points' },
    { key: 'totalCredit', label: 'Best in Credits', icon: CreditCardIcon, color: 'text-indigo-400', secondaryMetric: 'totalPoints', tertiaryMetric: 'totalMessOrders', unit: 'Credits' },
    { key: 'totalMessOrders', label: 'Best in Orders', icon: ShoppingCartIcon, color: 'text-green-400', secondaryMetric: 'totalPoints', tertiaryMetric: 'totalCredit', unit: 'Orders' },
];

export default function BestMonthlyBanner() {
    const [rankings, setRankings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

    // 💡 NEW: Logic to find the top user for each of the three metrics
    const topPerformers = useMemo(() => {
        if (rankings.length === 0) return [];
        
        // Map the BANNER_CONFIG, finding the corresponding user object in the 'rankings' array
        return BANNER_CONFIG.map(config => {
            // Find the object in 'rankings' that corresponds to this metric
            const topUserMetric = rankings.find(r => r.metric === config.label.replace('Best in ', ''));
            
            // If found, attach the user data to the config
            return {
                ...config,
                // The structure from the API is { metric: 'Points', name: 'User A', totalPoints: 'X', ...}
                // We attach this data as 'topUser'
                topUser: topUserMetric || null, 
            };
        }).filter(item => item.topUser); // Filter out configs where no data was found
        
    }, [rankings]);

    useEffect(() => {
        const fetchRankings = async () => {
            try {
                // 🏆 CHANGE 1: Expect the API to return the array of the 3 top-metric objects.
                // Example: [{ metric: 'Points', name: 'A', ...}, { metric: 'Credits', name: 'B', ...}, ...]
                const data = await apiGetBestMonthlyRankings();
                
                // ❌ REMOVE the old data processing/mapping logic, as the API does this now.
                // ❌ REMOVED: const processedData = data.map(user => ({ ... }));
                
                setRankings(data); // Store the array of 3 top performers
            } catch (err) {
                toast.error("Failed to load overall top performers.");
            } finally {
                setLoading(false);
            }
        };
        fetchRankings();

        // Setup auto-slide timer (This part is correct)
        const timer = setInterval(() => {
            setCurrentBannerIndex(prev => (prev + 1) % BANNER_CONFIG.length);
        }, 3000); 

        return () => clearInterval(timer);
    }, []);

    if (loading) return <div className="h-40 bg-gray-700 rounded-lg p-6 flex items-center justify-center text-white">Loading All Time Top Performers...</div>;
    if (topPerformers.length === 0 || !topPerformers[0].topUser) {
        return (
            <div className="h-40 bg-gray-700 rounded-lg p-6 flex items-center justify-center text-white">
                <p className="text-lg font-semibold">No activity data found for the current month.</p>
            </div>
        );
    }
    
    // The current banner to display
    const currentBanner = topPerformers[currentBannerIndex];
    const topUser = currentBanner.topUser;
    const BannerIcon = currentBanner.icon;
    
    // Primary Metric (Large Font)
    const primaryValue = topUser[currentBanner.key];
    // Secondary/Tertiary Metrics (Small Font)
    const secondaryValue = topUser[currentBanner.secondaryMetric];
    const tertiaryValue = topUser[currentBanner.tertiaryMetric];

    return (
        <div className="relative h-70 bg-gray-800 rounded-lg shadow-xl overflow-hidden p-6 text-white transition-all duration-500">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-gradient-to-r from-green-900 to-indigo-800 opacity-80"></div>
            
            {/* Main Content */}
            <div className="relative flex flex-col justify-center h-full">
                {/* 1. Title and Name */}
                <div className="flex items-center mb-2">
                    <TrophyIcon className="w-10 h-8 text-yellow-500 mr-3 animate-pulse" />
                    <h4 className="text-1xl font-extrabold tracking-wider uppercase">{currentBanner.label}</h4>
                </div>
                
                <h2 className="text-6xl font-black text-white drop-shadow-lg mb-2">{topUser.name}</h2>
                
                {/* 2. Primary Metric (Very Large) */}
                <div className="flex items-center mt-2">
                    <BannerIcon className={`w-8 h-8 mr-3 ${currentBanner.color}`} />
                    <span className="text-5xl font-black transition-transform duration-500 transform drop-shadow-xl mr-4">
                        {primaryValue}
                    </span>
                    <span className="text-xl font-bold uppercase text-gray-300">{currentBanner.unit}</span>
                </div>

                <div className="flex space-x-6 text-sm mt-3 pt-3 border-t border-gray-600">
                    <p>
                        {/* 🏆 FIX 1: Dynamically determine the label for the secondary metric */}
                        <span className="font-semibold text-indigo-300">
                            {BANNER_CONFIG.find(c => c.key === currentBanner.secondaryMetric).label.replace('Best in ', 'Total ') || 'Secondary Metric'}:
                        </span> {secondaryValue}
                    </p>
                    <p>
                        {/* 🏆 FIX 2: Dynamically determine the label for the tertiary metric */}
                        <span className="font-semibold text-indigo-300">
                            {BANNER_CONFIG.find(c => c.key === currentBanner.tertiaryMetric).label.replace('Best in ', 'Total ') || 'Tertiary Metric'}:
                        </span> {tertiaryValue}
                    </p>
                </div>
            </div>
        </div>
    );
}