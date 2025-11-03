import React, { useState, useMemo, useEffect } from 'react';
import toast from 'react-hot-toast';
import { 
  addDays, 
  format, 
  differenceInDays, 
  parseISO, 
  isFuture, 
  isToday, 
  isValid, 
  isSameDay 
} from 'date-fns';
import LogTaskModal from './LogTaskModal.jsx';
import { apiGetTaskLogsForGrid } from '../../services/api.js';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

// Helper function to get all dates in the cycle
const getDatesInCycle = (startDate, endDate) => {
  // --- THIS IS NOW SAFE ---
  // We pass in 'yyyy-MM-dd' strings, so parseISO works correctly.
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  
  const dayCount = differenceInDays(end, start);
  const dates = [];

  for (let i = 0; i <= dayCount; i++) {
    dates.push(addDays(start, i));
  }
  return dates;
};

const PERIODS = ['Morning', 'Noon', 'Evening'];
// Create a map for period order
const PERIOD_ORDER = { 'Morning': 1, 'Noon': 2, 'Evening': 3 };

export default function TaskLoggingGrid({ cycle, templates, title,onLogSuccess }) {
  const [modalState, setModalState] = useState({
    isOpen: false,
    date: null,
    template: null,
  });
  
  const [loggedSlots, setLoggedSlots] = useState(new Set());
  const [loadingLogs, setLoadingLogs] = useState(true);

  // --- 1. Parse cycle start/end times ONCE ---
  const { cycleStartDate, cycleEndDate, cycleDates, isValidCycle, cycleStartDateString, cycleEndDateString } = useMemo(() => {
    // Check for all required props
    if (!cycle?.start_date || !cycle?.end_date || !cycle?.start_period || !cycle?.end_period) {
      return { isValidCycle: false };
    }

    // --- THIS IS THE FIX ---
    // 1. Parse the full DATETIME strings
    const fullStartDate = parseISO(cycle.start_date);
    const fullEndDate = parseISO(cycle.end_date);

    // 2. Check if the dates are valid
    if (!isValid(fullStartDate) || !isValid(fullEndDate)) {
        console.error(`[DEBUG ${title}] Invalid date strings:`, { 
            start_string: cycle.start_date, 
            end_string: cycle.end_date 
        });
        return { isValidCycle: false };
    }

    // 3. Extract *only* the date part (as 'yyyy-MM-dd')
    const startDateString = format(fullStartDate, 'yyyy-MM-dd');
    const endDateString = format(fullEndDate, 'yyyy-MM-dd');
    
    // 4. Create "midnight" date objects for calendar generation
    const cycleStartDateMidnight = parseISO(startDateString);
    const cycleEndDateMidnight = parseISO(endDateString);

    return {
      cycleStartDate: cycleStartDateMidnight,
      cycleEndDate: cycleEndDateMidnight,
      cycleDates: getDatesInCycle(startDateString, endDateString),
      isValidCycle: true,
      cycleStartDateString: startDateString, // Store the string
      cycleEndDateString: endDateString,  
    };
  }, [cycle, title]);


  // 2. Create a fast lookup map for templates
  const templateMap = useMemo(() => {
    const map = new Map();
    for (const period of PERIODS) {
      const template = (templates || []).find(t => t.time_of_day === period);
      if (template) {
        map.set(period, template);
      }
    }
    return map;
  }, [templates]);

  // --- 2. Helper function to check slot time validity ---
  const getSlotValidity = (date, period) => {
    if (!isValidCycle) return 'invalid'; 

    const dateString = format(date, 'yyyy-MM-dd');
    const periodNum = PERIOD_ORDER[period];
    const startPeriodNum = PERIOD_ORDER[cycle.start_period];
    const endPeriodNum = PERIOD_ORDER[cycle.end_period];
    
    const isStartDate = dateString === cycleStartDateString;
    // Check if the current slot date is the end date
    const isEndDate = dateString === cycleEndDateString;
    
    // 1. Check BEFORE Start Boundary
    // If it's the start day AND the slot is strictly BEFORE the start period
    if (isStartDate && periodNum < startPeriodNum) {
      return 'before';
    }
    
    // 2. Check AFTER End Boundary
    // If it's the end day AND the slot is strictly AFTER the end period
    if (isEndDate && periodNum > endPeriodNum) {
      return 'after';
    }

    return 'valid';
  };


  // 3. Fetch log data
  useEffect(() => {
    const fetchLogs = async () => {
      if (!cycle || !templates || templates.length === 0 || !isValidCycle) {
        setLoadingLogs(false);
        setLoggedSlots(new Set());
        return;
      }
      
      setLoadingLogs(true);
      try {
        const templateIds = templates.map(t => t.template_id);
        const logData = await apiGetTaskLogsForGrid(cycle.cycle_id, templateIds);
        
        const logSet = new Set();
        logData.forEach(log => {
          const parsedDate = parseISO(log.task_datetime);
          if (isValid(parsedDate)) {
            const logDate = format(parsedDate, 'yyyy-MM-dd');
            logSet.add(`${logDate}:${log.time_of_day}`);
          }
        });
        setLoggedSlots(logSet);

      } catch (err) {
        toast.error(`Error fetching ${title} logs: ${err.message}`);
      } finally {
        setLoadingLogs(false);
      }
    };
    fetchLogs();
  }, [cycle, templates, title, isValidCycle]);


  // 4. Handle cell click
  const handleCellClick = (date, period) => {
    // Validation 1: Future date
    if (isFuture(date) && !isToday(date)) {
      toast.error('Cannot log work for a future date.');
      return;
    }

    // Validation 2: Check if slot is in cycle
    if (getSlotValidity(date, period) !== 'valid') {
      toast.error('This time slot is outside the cycle\'s start/end time.');
      return;
    }
    
    // Validation 3: Template exists
    const template = templateMap.get(period);
    if (!template) {
      toast.error(`No '${title}' task defined for ${period}.`);
      return;
    }

    setModalState({
      isOpen: true,
      date: date,
      template: template,
    });

  };
  
  // 5. handleCloseModal
  const handleCloseModal = async (didSave = false) => {
    setModalState({ isOpen: false, date: null, template: null });
    if (didSave) {
      if (!cycle || !templates || templates.length === 0 || !isValidCycle) {
        return;
      }
      let localGridRefreshSuccess = false;
      setLoadingLogs(true);
      try {
          // Await the grid refresh (guarantees local checkmarks update first)
          const templateIds = templates.map(t => t.template_id);
          const logData = await apiGetTaskLogsForGrid(cycle.cycle_id, templateIds); 
          
          // Process and set the new state
          const logSet = new Set();
          logData.forEach(log => {
             const parsedDate = parseISO(log.task_datetime);
             if (isValid(parsedDate)) {
                const logDate = format(parsedDate, 'yyyy-MM-dd');
                logSet.add(`${logDate}:${log.time_of_day}`);
             }
          });
          setLoggedSlots(logSet);
          localGridRefreshSuccess = true;

      } catch (e) {
          toast.error("Failed to update grid checkmarks.");
      } finally {
          setLoadingLogs(false);
      }
      if (localGridRefreshSuccess && onLogSuccess) {
          try {
              // AWAIT the external promise (500ms delay)
              await onLogSuccess(); 
          } catch (e) {
              // Handle case where the delay/state update fails (unlikely, but safe)
              console.error("Standings refresh delay failed.");
          }
      }
    }
  };
  
  // Render a message if the cycle prop is invalid
  if (!isValidCycle) {
    return (
        <div className="p-4 border rounded-md bg-white shadow-sm">
            <h4 className="font-semibold text-md mb-3">{title}</h4>
            <p className="text-red-500">Error: The selected cycle has invalid dates or is missing start/end periods.</p>
        </div>
    );
  }

  return (
    <div className="p-4 border rounded-md bg-white shadow-sm">
      <h4 className="font-semibold text-md mb-3">{title}</h4>
      <div className="overflow-x-auto border rounded-md">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left text-xs font-semibold text-gray-600 uppercase w-24">Period</th>
              {cycleDates.map(date => (
                <th key={date.toString()} className="p-2 text-center text-xs font-semibold text-gray-600">
                  <div>{format(date, 'EEE')}</div>
                  <div>{format(date, 'd/M')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {PERIODS.map(period => {
              const templateExists = templateMap.has(period);
              
              return (
                <tr key={period}>
                  <td className="p-2 text-sm font-medium text-gray-800">{period}</td>
                  
                  {cycleDates.map(date => {
                    const isFutureDate = isFuture(date) && !isToday(date);
                    const slotValidity = getSlotValidity(date, period);
                    const isOutOfCycle = slotValidity !== 'valid';
                    const isClickable = templateExists && !isFutureDate && !isOutOfCycle;
                    
                    const dateString = format(date, 'yyyy-MM-dd');
                    const isLogged = loggedSlots.has(`${dateString}:${period}`);
                    
                    return (
                      <td 
                        key={date.toString()}
                        className={`
                          p-2 text-center h-16 relative
                          ${!templateExists ? 'bg-gray-100' : ''}
                          ${isClickable ? 'cursor-pointer hover:bg-indigo-50' : ''}
                          ${isFutureDate ? 'bg-gray-100 opacity-60' : ''}
                          ${isOutOfCycle ? 'bg-gray-200 opacity-60' : ''}
                          ${isLogged ? 'bg-green-50' : ''}
                          ${!isClickable && !isFutureDate && !isOutOfCycle ? 'opacity-50' : ''}
                        `}
                        onClick={() => isClickable && handleCellClick(date, period)}
                      >
                        {isLogged && (
                          <CheckCircleIcon className="h-6 w-6 text-green-500 m-auto" />
                        )}
                        {loadingLogs && isClickable && (
                          <div className="absolute inset-0 bg-white bg-opacity-50" />
                        )}
                      </td>
                    );
})}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {modalState.isOpen && (
        <LogTaskModal
          isOpen={modalState.isOpen}
          onClose={handleCloseModal}
          cycle={cycle}
          date={modalState.date}
          template={modalState.template}
        />
      )}
    </div>
  );
}