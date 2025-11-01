import MessDeliveryLog from '../current/MessDeliveryLog';
import MessCleaningLog from '../current/MessCleaningLog';
import WeekPointsTable from '../current/WeekPointsTable';
import PriorityTable from '../current/PriorityTable';
import SlotRecommender from '../current/SlotRecommender';

export default function CurrentWeekStats() {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Log Mess Work</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <MessDeliveryLog />
        <MessCleaningLog />
      </div>
      
      <hr />
      <h2 className="text-2xl font-bold">Current Standings</h2>
      <WeekPointsTable />
      
      <hr />
      <h2 className="text-2xl font-bold">Priority & Recommendations</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <PriorityTable />
        <SlotRecommender />
      </div>
    </div>
  );
}