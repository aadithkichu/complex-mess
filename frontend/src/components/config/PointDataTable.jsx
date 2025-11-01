import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { 
  apiGetTaskTemplates, 
  apiCreateTaskTemplate, 
  apiUpdateTaskTemplate, 
  apiDeleteTaskTemplate 
} from '../../services/api.js';

// A single row in the table
function TaskRow({ task, isAdmin, onSave, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
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
      alert(`Error saving: ${err.message}`);
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
          <input type="number" name="points" value={data.points} onChange={handleChange} className="w-20 p-1 border rounded" />
        </td>
        <td className="p-2">
          <input type="number" name="default_headcount" value={data.default_headcount} onChange={handleChange} className="w-20 p-1 border rounded" />
        </td>
        <td className="p-2 text-right">
          <button onClick={handleSave} className="text-xs bg-green-600 text-white py-1 px-2 rounded hover:bg-green-700 mr-2">Save</button>
          <button onClick={handleCancel} className="text-xs bg-gray-500 text-white py-1 px-2 rounded hover:bg-gray-600">Cancel</button>
        </td>
      </tr>
    );
  }

  // --- ADMIN (VIEW) ROW ---
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

// The main component
export default function PointDataTable() {
  const { isLoggedIn } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch all tasks on load
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

  // --- CRUD Handlers ---
  const handleSave = async (id, data) => {
    await apiUpdateTaskTemplate(id, data);
    fetchTasks(); // Refresh list
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this task? This cannot be undone.')) {
      try {
        await apiDeleteTaskTemplate(id);
        fetchTasks(); // Refresh list
      } catch (err) {
        setError(err.message);
      }
    }
  };

  if (loading) return <p>Loading point data...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div>
      <h4 className="text-lg font-semibold mb-3">Point Data (Task List)</h4>
      <div className="overflow-x-auto border border-gray-300 rounded-md shadow-sm">
        <table className="min-w-full bg-white">
          <thead className="bg-gray-100 border-b border-gray-300">
            <tr>
              <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Task Name</th>
              <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Time of Day</th>
              <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Points</th>
              <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Headcount</th>
              {isLoggedIn && <th className="p-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => (
              <TaskRow 
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
      {isLoggedIn && <CreateTaskForm onTaskCreated={fetchTasks} />}
    </div>
  );
}

// --- Form for creating a new task ---
function CreateTaskForm({ onTaskCreated }) {
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
      alert('Task created!');
      setData({ task_name: '', time_of_day: 'Morning', points: 1.0, default_headcount: 1 }); // Reset form
      onTaskCreated(); // Refresh parent list
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 p-4 border border-gray-300 rounded bg-gray-50">
      <h5 className="font-semibold mb-3">Create New Task</h5>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <input name="task_name" value={data.task_name} onChange={handleChange} placeholder="Task Name" required className="p-2 border rounded" />
        <select name="time_of_day" value={data.time_of_day} onChange={handleChange} className="p-2 border rounded bg-white">
          <option>Morning</option>
          <option>Noon</option>
          <option>Evening</option>
        </select>
        <input type="number" step="0.1" name="points" value={data.points} onChange={handleChange} placeholder="Points" required className="p-2 border rounded" />
        <input type="number" step="1" name="default_headcount" value={data.default_headcount} onChange={handleChange} placeholder="Headcount" required className="p-2 border rounded" />
        <button type="submit" className="bg-green-600 text-white p-2 rounded hover:bg-green-700">Create</button>
      </div>
    </form>
  );
}