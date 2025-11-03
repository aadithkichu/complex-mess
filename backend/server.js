import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import session from 'express-session'; 
import MySQLStore from 'express-mysql-session'; 
import pool, { testDbConnection } from './utils/db.js';
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

const store = new MySQLStoreInstance({
    createDatabaseTable: true,
    checkExpirationInterval: 900000,
    expiration: 2592000000, // 30 days
    // The store will now use the pool's connection details
}, pool);
// --- Core Middleware ---
const isDevelopment = process.env.NODE_ENV === 'development';
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
    httpOnly: true,
    secure: !isDevelopment,                    // must be true on HTTPS (Render)
    sameSite: !isDevelopment ? 'None' : 'Lax', // allow cross-site cookies
    maxAge: 1000 * 60 * 60 * 60,                  // 1 hour
  },
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

app.listen(PORT, async () => {
  try {
    // 1. Test the database connection first
    await testDbConnection();
    
    // 2. If it succeeds, start the server
    console.log(`Server is running on http://localhost:${PORT}`);
  } catch (error) {
    // 3. If it fails, log the error and stop the app
    console.error('--- ❌ FAILED TO START SERVER ---');
    console.error('Database connection failed. Check .env variables on Render.');
    console.error(error.message);
    process.exit(1); // This stops the server from running in a broken state
  }
});

