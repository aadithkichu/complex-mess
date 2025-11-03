import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import session from 'express-session'; 
import MySQLStore from 'express-mysql-session'; 
import pool from './utils/db.js'; // <-- Keep this for your Models

import authRoutes from './routes/authRoutes.js';   
import userRoutes from './routes/userRoutes.js';   
import cycleRoutes from './routes/cycleRoutes.js'; 
import taskRoutes from './routes/taskRoutes.js';
import availabilityRoutes from './routes/availabilityRoutes.js';
import logbookRoutes from './routes/logbookRoutes.js';
import standingRoutes from './routes/standingRoutes.js';
import recommendationRoutes from './routes/recommendationRoutes.js';

// 1. Ensure dotenv runs immediately at the top
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// --- Database Session Store Setup ---
const MySQLStoreInstance = MySQLStore(session);

// 2. Pass the DB connection details explicitly using environment variables
const sessionOptions = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,        // <-- Explicitly read user
    password: process.env.DB_PASS,    // <-- Explicitly read password
    database: process.env.DB_NAME,

    // ... other options ...
    createDatabaseTable: true,
    checkExpirationInterval: 900000,
    expiration: 2592000000, // 30 days
};

// 3. Initialize the store
const store = new MySQLStoreInstance(sessionOptions); 

// --- Core Middleware ---

// 4. CORS (Cross-Origin Resource Sharing)
app.use(cors({
  origin: ['http://localhost:5173','http://192.168.1.14:5173','https://complex-mess.vercel.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. Session Middleware
app.use(session({
  key: 'complex_mess_sid',
  secret: process.env.SESSION_SECRET,
  store: store, 
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 2592000000,
    httpOnly: true,
    secure: false, 
    sameSite: 'lax',
  }
}));


app.get('/', (req, res) => {
  res.json({ message: 'Hello from the Complex-Mess API!' });
});


app.use('/api/auth', authRoutes); // For logging in/out
app.use('/api/users', userRoutes); // For managing the member list
app.use('/api/cycles', cycleRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/logbook', logbookRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/standings', standingRoutes);

// ... (Server Startup) ...
app.listen(PORT, async () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

