import AdminLogin from '../config/AdminLogin.jsx';
import Settings from '../config/Settings.jsx';
import PointDataTable from '../config/PointDataTable.jsx'; // <-- This
import UserList from '../config/UserList.jsx';
import MemberAvailabilityTable from '../config/MemberAvailabilityTable.jsx';
import { useAuth } from '../../hooks/useAuth.jsx'; // <-- Import useAuth

export default function Configuration() {
  const { isLoggedIn } = useAuth(); // <-- Get login status

  return (
    <div>
      {/* --- Main Configuration Box --- */}
      {/* This box is always visible, but its content is dynamic */}
      <div className="p-4 border border-gray-300 rounded-md bg-gray-50 shadow-sm">
        <h3 className="text-2xl font-semibold mb-4 border-b pb-2">System Configuration</h3>
        
        {/* 1. Cycle Settings (Settings.jsx) */}
        {/* This component loads and shows public info even if not logged in */}
        <Settings />

        {/* 2. Point Data Table (Moved Inside) */}
        {/* This component will show its read-only state if not logged in */}
        <div className="mt-6 pt-4 border-t border-gray-300">
          <PointDataTable />
        </div>

        {/* 3. User List (Placeholder) */}
        
          <div className="mt-6 pt-4 border-t border-gray-300">
            <UserList />
          </div>

        {/* 4. Availability Table (Placeholder) */}
          <div className="mt-6 pt-4 border-t border-gray-300">
            <MemberAvailabilityTable />
          </div>
      </div>
    </div>
  );
}