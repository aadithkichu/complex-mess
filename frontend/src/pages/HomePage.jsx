import { useState } from 'react';
import Configuration from '../components/tabs/Configuration.jsx';
import CurrentWeekStats from '../components/tabs/CurrentWeekStats.jsx';
import Leaderboard from '../components/tabs/Leaderboard.jsx';

const TABS = {
  CONFIG: 'Configuration',
  CURRENT: 'Current Week',
  HISTORY: 'Leaderboard & History',
};

export default function HomePage() {
  const [activeTab, setActiveTab] = useState(TABS.CURRENT);

  const renderTabContent = () => {
    switch (activeTab) {
      case TABS.CONFIG:
        return <Configuration />;
      case TABS.CURRENT:
        return <CurrentWeekStats />;
      case TABS.HISTORY:
        return <Leaderboard />;
      default:
        return <CurrentWeekStats />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto mt-8">
      {/* --- GitHub-style Tab Bar --- */}
      <div className="flex items-center border-b border-gray-300 bg-white rounded-t-lg shadow-sm overflow-x-auto">
        {Object.values(TABS).map((tab) => (
          <button
            key={tab}
            className={`relative py-3 px-6 text-sm font-medium whitespace-nowrap transition-all
              ${activeTab === tab 
                ? 'text-[#0969da] border-b-2 border-[#0969da] bg-gray-50'
                : 'text-gray-700 hover:text-[#0969da] hover:bg-gray-100'
              }`
            }
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#0969da] rounded-t"></span>
            )}
          </button>
        ))}
      </div>

      {/* --- Tab Content --- */}
      <div className="bg-white border border-gray-300 border-t-0 rounded-b-lg p-6 shadow-sm">
        {renderTabContent()}
      </div>
    </div>
  );
}
