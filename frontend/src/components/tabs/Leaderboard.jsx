// This component will show weekly, monthly, quarterly stats
export default function Leaderboard() {
  return (
    <div>
      <h2 className="text-2xl font-bold">Leaderboard & History</h2>
      <p>This page will show all-time stats, including:
        <ul className="list-disc pl-5">
          <li>All-time points earned</li>
          <li>All-time credits earned (from completing objectives)</li>
          <li>Filters for weekly, monthly, and quarterly rankings</li>
        </ul>
      </p>
      {/* You'll add components here for historical charts and tables */}
    </div>
  );
}