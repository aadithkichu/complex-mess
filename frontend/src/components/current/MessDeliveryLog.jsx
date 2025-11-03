import React from 'react';
import TaskLoggingGrid from './TaskLoggingGrid.jsx';

export default function MessDeliveryLog({ cycle, templates , onLogSuccess}) {
  return (
    <TaskLoggingGrid
      cycle={cycle}
      templates={templates}
      title="Mess Delivery Log"
      onLogSuccess={onLogSuccess}
    />
  );
}