// --- Imports ---
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

// --- Route Imports ---
// Import your route files here (e.g., job routes, user routes)
// import jobRoutes from './routes/jobRoutes.js';
// import userRoutes from './routes/userRoutes.js';

// --- Initialization ---
dotenv.config(); // Load environment variables from .env file
const app = express();
const PORT = process.env.PORT || 5001; // Use port from .env or default to 5001

// --- Core Middleware ---

// 1. CORS (Cross-Origin Resource Sharing)
// This is essential for your React frontend to talk to your backend
app.use(cors({
  origin: 'http://localhost:5173', // Your Vite dev server URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

// 2. JSON Body Parser
// Allows your server to accept and read JSON in request bodies
app.use(express.json());

// 3. (Optional) URL-encoded Parser
// Allows your server to read form data
app.use(express.urlencoded({ extended: true }));

// --- (Optional) Custom Middleware ---
// app.use(myLoggerMiddleware); // Example: for logging requests

// --- API Routes ---
// Mount your imported routes to a base path (e.g., /api)
// app.use('/api/jobs', jobRoutes);
// app.use('/api/users', userRoutes);

// A simple test route to make sure the server is working
app.get('/', (req, res) => {
  res.json({ message: 'Hello from the Complex-Mess API!' });
});

// --- Error Handling Middleware ---

// 1. 404 Not Found Handler
// This catches any request that doesn't match a defined route
app.use((req, res, next) => {
  res.status(404).json({ message: 'Error: Not Found' });
});

// 2. Global Error Handler
// This catches any error thrown in your controllers
app.use((err, req, res, next) => {
  console.error(err.stack); // Log the error for debugging
  res.status(500).json({ message: 'Error: Internal Server Error' });
});

// --- Server Startup ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});