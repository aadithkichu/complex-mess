import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import toast from 'react-hot-toast';
import { 
  apiGetTaskTemplates, 
  apiCreateTaskTemplate, 
  apiUpdateTaskTemplate, 
  apiDeleteTaskTemplate 
} from '../../services/api.js';

// --- TaskRow Component (No Changes Needed) ---
function TaskRow({ task, isAdmin, onSave, onDelete }) {
  const [isEditing, setIsEditing] =useState(false);
  const [data, setData] = useState(task);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setData(task); // Reset changes
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      await onSave(data.template_id, data);
      setIsEditing(false);
    } catch (err) {
      toast.error(`Error saving: ${err.message}`);
    }
  };

  if (!isAdmin) {
    // --- VIEWER (READ-ONLY) ROW ---
    return (
      <tr className="border-b border-gray-200">
        <td className="p-3 text-sm">{data.task_name}</td>
        <td className="p-3 text-sm">{data.time_of_day}</td>
        <td className="p-3 text-sm text-center">{data.points}</td>
        <td className="p-3 text-sm text-center">{data.default_headcount}</td>
      </tr>
    );
  }

  if (isEditing) {
    // --- ADMIN (EDITING) ROW ---
    return (
      <tr className="border-b border-gray-200 bg-blue-50">
        <td className="p-2">
          <input type="text" name="task_name" value={data.task_name} onChange={handleChange} className="w-full p-1 border rounded" />
        </td>
        <td className="p-2">
          <select name="time_of_day" value={data.time_of_day} onChange={handleChange} className="w-full p-1 border rounded bg-white">
            <option>Morning</option>
            <option>Noon</option>
            <option>Evening</option>
          </select>
        </td>
        <td className="p-2">
          <input type="number" step="0.1" name="points" value={data.points} onChange={handleChange} className="w-20 p-1 border rounded" />
        </td>
        <td className="p-2">
          <input type="number" step="1" name="default_headcount" value={data.default_headcount} onChange={handleChange} className="w-20 p-1 border rounded" />
        </td>
        <td className="p-2 text-right">
          <button onClick={handleSave} className="text-xs bg-green-600 text-white py-1 px-2 rounded hover:bg-green-700 mr-2">Save</button>
          <button onClick={handleCancel} className="text-xs bg-gray-500 text-white py-1 px-2 rounded hover:bg-gray-600">Cancel</button>
        </td>
      </tr>
    );
  }


  return (
    <tr className="border-b border-gray-200 hover:bg-gray-50">
      <td className="p-3 text-sm">{data.task_name}</td>
      <td className="p-3 text-sm">{data.time_of_day}</td>
      <td className="p-3 text-sm text-center">{data.points}</td>
      <td className="p-3 text-sm text-center">{data.default_headcount}</td>
      <td className="p-3 text-right">
        <button onClick={handleEdit} className="text-xs bg-blue-600 text-white py-1 px-2 rounded hover:bg-blue-700 mr-2">Edit</button>
        <button onClick={() => onDelete(data.template_id)} className="text-xs bg-red-600 text-white py-1 px-2 rounded hover:bg-red-700">Delete</button>
      </td>
    </tr>
  );
}

// --- The main component (MODIFIED) ---
export default function PointDataTable() {
  const { isLoggedIn } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // ... (useEffect, fetchTasks, handleSave, handleDelete, handleTaskCreated functions remain the same) ...
  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const data = await apiGetTaskTemplates();
      setTasks(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (id, data) => {
    await apiUpdateTaskTemplate(id, data);
    fetchTasks();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this task? This cannot be undone.')) {
      try {
        await apiDeleteTaskTemplate(id);
        fetchTasks();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleTaskCreated = () => {
    fetchTasks();
    setShowCreateForm(false);
  };


  if (loading) return <p>Loading point data...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    // --- 1. WRAPPED IN A BOX ---
    // This div now wraps the entire component in a styled box.
    <div className="p-4 border border-gray-300 rounded-md bg-white shadow-sm mt-6">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-lg font-semibold">Point Data (Task List)</h4>
        {isLoggedIn && !showCreateForm && (
          <button 
            onClick={() => setShowCreateForm(true)}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-3 rounded text-sm transition duration-150"
          >
            + Create New Task
          </button>
        )}
      </div>
      
      <div className="overflow-y-auto max-h-96 border border-gray-300 rounded-md shadow-inner bg-white">
        <table className="min-w-full">
          {/* --- MODIFICATION ---
            1. Added 'sticky top-0' to make the header stay
               at the top *within the scrollable div*.
          */}
          <thead className="sticky top-0 bg-gray-100 border-b border-gray-300">
            <tr>
              <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Task Name</th>
              <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Time of Day</th>
              <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Points</th>
              <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Headcount</th>
              {isLoggedIn && <th className="p-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {tasks.map(task => (
              <TaskRow Address
                key={task.template_id} 
                task={task} 
                isAdmin={isLoggedIn}
                onSave={handleSave}
                onDelete={handleDelete}
              />
            ))}
          </tbody>
        </table>
      </div>
      
      {isLoggedIn && showCreateForm && (
        <CreateTaskForm 
          onTaskCreated={handleTaskCreated}
          onCancel={() => setShowCreateForm(false)} 
        />
      )}
    </div>
  );
}

// --- Form for creating a new task (No Changes) ---
function CreateTaskForm({ onTaskCreated, onCancel }) {
  const [data, setData] = useState({
    task_name: '',
    time_of_day: 'Morning',
    points: 1.0,
    default_headcount: 1
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiCreateTaskTemplate(data);
      toast.success('Task created!');
      setData({ task_name: '', time_of_day: 'Morning', points: 1.0, default_headcount: 1 }); // Reset form
      onTaskCreated(); // Call parent handler (which hides form)
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 p-4 border border-gray-200 rounded bg-gray-50">
      <div className="flex justify-between items-center mb-3">
        <h5 className="font-semibold">Create New Task</h5>
        <button 
          type="button" 
          onClick={onCancel}
          className="text-sm text-gray-600 hover:text-red-600"
        >
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <input name="task_name" value={data.task_name} onChange={handleChange} placeholder="Task Name" required className="p-2 border rounded text-sm" />
        <select name="time_of_day" value={data.time_of_day} onChange={handleChange} className="p-2 border rounded bg-white text-sm">
          <option>Morning</option>
          <option>Noon</option>
          <option>Evening</option>
        </select>
        <input type="number" step="0.1" name="points" value={data.points} onChange={handleChange} placeholder="Points" required className="p-2 border rounded text-sm" />
        <input type="number" step="1" name="default_headcount" value={data.default_headcount} onChange={handleChange} placeholder="Headcount" required className="p-2 border rounded text-sm" />
        <button type="submit" className="bg-green-600 text-white p-2 rounded hover:bg-green-700 text-sm">Create</button>
      </div>
    </form>
  );
}