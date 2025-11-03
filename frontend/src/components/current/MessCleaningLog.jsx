import React from 'react';
import TaskLoggingGrid from './TaskLoggingGrid.jsx';

export default function MessCleaningLog({ cycle, templates ,onLogSuccess}) {
  return (
    <TaskLoggingGrid
      cycle={cycle}
      templates={templates}
      title="Mess Cleaning Log"
      onLogSuccess={onLogSuccess}
    />
  );
}