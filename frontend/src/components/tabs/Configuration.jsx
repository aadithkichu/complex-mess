import AdminLogin from "../config/AdminLogin.jsx";
import Settings from "../config/Settings.jsx";
import PointDataTable from "../config/PointDataTable.jsx";
import UserList from "../config/UserList.jsx";
import MemberAvailabilityTable from "../config/MemberAvailabilityTable.jsx";

export default function Configuration() {
  return (
    <div className="space-y-8">
      
      {/* These components will be hidden by the hook if not logged in */}
      <Settings />
      <PointDataTable />
      <UserList />
      <MemberAvailabilityTable />
    </div>
  );
}