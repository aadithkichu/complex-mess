// frontend/src/services/api.js

// Your backend URL
const API_URL = 'http://localhost:5001/api'; 

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

export const apiChangeCycleMode = (newMode) => {
  // Uses PUT /api/cycles/mode (Admin-only)
  return fetchApi('/cycles/mode', {
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