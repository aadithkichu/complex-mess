// frontend/src/services/api.js
import { format } from 'date-fns';
// Your backend URL
const API_URL = import.meta.env.VITE_API_URL; 

// --- Helper for consistent API fetching ---
const fetchApi = async (endpoint, options = {}) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    // CRITICAL: Ensure cookies are sent and received
    credentials: 'include', 
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

// Handle all errors here!
  if (!response.ok) {
    // 1. ATTEMPT to read the JSON body for the error details
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      // If reading JSON fails, use a generic message
      errorData = { message: `HTTP Error ${response.status}: ${response.statusText}` };
    }
    
    // 2. Throw the entire error data object, not just the message string.
    // The status code (409) is the key.
    const finalError = new Error(errorData.message || 'API request failed');
    // Attach the full error body to the new Error object for use in the component
    finalError.data = errorData; 
    finalError.status = response.status;

    throw finalError;
  }

  return response.json();
};

// ----------------------------------------------------
// --- Auth Service (routes/authRoutes.js) ---
// ----------------------------------------------------

export const apiLogin = (username, password) => {
  return fetchApi('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
};

export const apiLogout = () => {
  return fetchApi('/auth/logout', {
    method: 'POST',
    // No body needed; the server just destroys the session
  });
};

export const apiCheckSession = () => {
  // Uses GET /api/auth/me
  return fetchApi('/auth/me');
};


// ----------------------------------------------------
// --- User Service (routes/userRoutes.js) ---
// ----------------------------------------------------

export const apiGetAllUsers = () => {
  // Uses GET /api/users (Public)
  return fetchApi('/users');
};

export const apiCreateUser = (userData) => {
  // Uses POST /api/users (Admin-only)
  return fetchApi('/users', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
};

export const apiUpdateUser = (id, userData) => {
  // Uses PUT /api/users/:id (Admin-only)
  return fetchApi(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(userData),
  });
};

export const apiDeleteUser = (id) => {
  // Uses DELETE /api/users/:id (Admin-only)
  return fetchApi(`/users/${id}`, {
    method: 'DELETE',
  });
};

export const apiGetUserDetails = (id) => {
  // Uses GET /api/users/:id (Public, but provides detailed info)
  return fetchApi(`/users/${id}`);
};


// ----------------------------------------------------
// --- Cycle Service (routes/cycleRoutes.js) ---
// ----------------------------------------------------

export const apiGetCycleSettings = () => {
  // Uses GET /api/cycles (Public)
  return fetchApi('/cycles');
};

export const apiCreateNewCycle = (cycleData) => {
  // Uses POST /api/cycles (Admin-only)
  return fetchApi('/cycles', {
    method: 'POST',
    body: JSON.stringify(cycleData),
  });
};

export const apiUpdateCycleDates = (cycleId, dateData) => {
  // Uses PUT /api/cycles/:id (Admin-only)
  return fetchApi(`/cycles/${cycleId}`, {
    method: 'PUT',
    body: JSON.stringify(dateData),
  });
};

export const apiDeleteCycle = (cycleId) => {
  // Uses DELETE /api/cycles/:cycleId (Admin-only)
  return fetchApi(`/cycles/${cycleId}`, {
    method: 'DELETE',
  });
};

export const apiChangeCycleMode = (cycleId, newMode) => {
  // 1. Accepts cycleId as the first argument.
  // 2. Uses backticks (`) for the template literal.
  // 3. Sends the newMode in the request body.
  return fetchApi(`/cycles/mode/${cycleId}`, {
    method: 'PUT',
    body: JSON.stringify({ new_mode: newMode }),
  });
};

// ----------------------------------------------------
// --- Task Template Service (routes/taskRoutes.js) ---
// ----------------------------------------------------

export const apiGetTaskTemplates = () => {
  // Uses GET /api/tasks (Public)
  return fetchApi('/tasks');
};

export const apiCreateTaskTemplate = (taskData) => {
  // Uses POST /api/tasks (Admin-only)
  return fetchApi('/tasks', {
    method: 'POST',
    body: JSON.stringify(taskData),
  });
};

export const apiUpdateTaskTemplate = (id, taskData) => {
  // Uses PUT /api/tasks/:id (Admin-only)
  return fetchApi(`/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(taskData),
  });
};

export const apiDeleteTaskTemplate = (id) => {
  // Uses DELETE /api/tasks/:id (Admin-only)
  return fetchApi(`/tasks/${id}`, {
    method: 'DELETE',
  });
};

export const apiGetHistoricalStats = (userId, filters) => {
    // Construct query string from filters object
    const params = new URLSearchParams();
    
    if (filters.year && filters.year !== 'all') params.append('year', filters.year);
    if (filters.quarter) params.append('quarter', filters.quarter);
    if (filters.month) params.append('month', filters.month);

    const queryString = params.toString();
    
    // CONSTRUCT THE ENDPOINT PATH, starting from the slash (/)
    const endpoint = `/users/${userId}/history${queryString ? '?' + queryString : ''}`;

    // FIX: Use the central fetchApi helper
    return fetchApi(endpoint); 
};

export const apiGetAvailablePeriods = (userId) => {
    // Uses GET /api/user/:id/periods (Assumed new route)
    const endpoint = `/users/${userId}/periods`;
    return fetchApi(endpoint); 
};

// ----------------------------------------------------
// --- Availability Service (routes/availabilityRoutes.js) ---
// ----------------------------------------------------

export const apiGetAvailabilitySummary = () => {
  // Uses GET /api/availability/summary (Admin-only)
  return fetchApi('/availability/summary');
};

export const apiSetSlotAvailability = (day, period, userIds) => {
  // Uses POST /api/availability/slot (Admin-only)
  return fetchApi('/availability/slot', {
    method: 'POST',
    body: JSON.stringify({ day, period, userIds }),
  });
};

export const apiSetFullDayAvailability = (day, isChecked, allUserIds) => {
  // Uses POST /api/availability/fullday (Admin-only)
  return fetchApi('/availability/fullday', {
    method: 'POST',
    body: JSON.stringify({ day, isChecked, allUserIds }),
  });
};

// ----------------------------------------------------
// --- Cycle Service (routes/cycleRoutes.js) ---
// ----------------------------------------------------

export const apiGetAllCycles = () => {
  // Uses GET /api/cycles/all (NEW)
  // This should return all cycles, not just the active one
  return fetchApi('/cycles/all');
};

// ----------------------------------------------------
// --- Task Log Service (NEW) (routes/logRoutes.js) ---
// ----------------------------------------------------

export const apiGetTaskLogsForGrid = (cycleId, templateIds) => {
  // Uses GET /api/logbook/grid?cycleId=X&templates=1,2,3
  const params = new URLSearchParams();
  params.append('cycleId', cycleId);
  params.append('templates', templateIds.join(','));
  
  return fetchApi(`/logbook/grid?${params.toString()}`);
};

export const apiGetAvailableUsersForSlot = (dayKey, period, cycleId, templateId, date) => {
  // Uses GET /api/logbook/available?day=1&period=Noon&cycleId=...
  const params = new URLSearchParams();
  params.append('day', dayKey);
  params.append('period', period);
  params.append('cycleId', cycleId);
  params.append('templateId', templateId);
  params.append('date', date); // Already formatted yyyy-MM-dd
  
  return fetchApi(`/logbook/available?${params.toString()}`);
};

export const apiGetTaskLogForSlot = (cycleId, templateId, date) => {
  // Uses GET /api/logbook/slot?cycleId=X&templateId=Y&date=...
  const params = new URLSearchParams();
  params.append('cycleId', cycleId);
  params.append('templateId', templateId);
  params.append('date', format(date, 'yyyy-MM-dd'));
  
  return fetchApi(`/logbook/slot?${params.toString()}`);
};

export const apiLogTask = (payload) => {
  // Uses POST /api/logbook
  return fetchApi('/logbook', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

// 1. Rename function and change to POST
export const apiCalculateAndGetStandings = (cycleId) => {
  // Uses POST /api/standings/calculate
  return fetchApi('/standings/calculate', {
    method: 'POST',
    body: JSON.stringify({ cycleId }),
  });
};

export const apiGetSlotRecommendations = (cycleId) => {
  // Uses GET /api/recommendations/:cycleId
  return fetchApi(`/recommendations/${cycleId}`);
};

export const apiLockCycleAvailability = (cycleId) => {
  return fetchApi(`/cycles/${cycleId}/lock-availability`, {
    method: 'POST',
  });
};

// ----------------------------------------------------
// --- NEW: Leaderboard & Ranking Services ---
// ----------------------------------------------------

export const apiGetHistoricalRankings = (filters) => {
    const params = new URLSearchParams(filters);
    const queryString = params.toString();
    return fetchApi(`/users/rankings/history${queryString ? '?' + queryString : ''}`);
};

export const apiGetBestMonthlyRankings = () => {
    return fetchApi('/users/rankings/monthly-best');
};