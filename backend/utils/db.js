import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// 1. Define the base configuration from .env
const baseConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// 2. Start with the base config
let poolConfig = baseConfig;

// 3. Check the environment:
// If NODE_ENV is 'development', run locally.
// If it's ANYTHING ELSE (undefined, 'production', etc.), run in production mode.
if (process.env.NODE_ENV !== 'development') {
  console.log('Running in PRODUCTION mode (NODE_ENV is not "development"). Enabling SSL for Aiven...');
  try {
    const caCert = fs.readFileSync(process.cwd() + '/ca.pem');
    
    // Add the SSL object to the config
    poolConfig = {
      ...baseConfig,
      ssl: {
        ca: caCert,
        rejectUnauthorized: true 
      }
    };
  } catch (err) {
    console.error('--- FATAL PRODUCTION ERROR ---');
    console.error('Could not read "ca.pem". Make sure the file exists.');
    console.error(err.message);
    process.exit(1); // Stop the app
  }
} else {
  console.log('Running in DEVELOPMENT mode. SSL is disabled.');
}

// 4. Create the pool using the correct config (with or without SSL)
const pool = mysql.createPool(poolConfig);

// --- FUNCTION TO TEST CONNECTION ---
export const testDbConnection = async () => {
  try {
    const [rows] = await pool.query('SELECT 1 + 1 AS solution');
    console.log(`Database connection successful! Test result: ${rows[0].solution}`);
  } catch (error) {
    console.error('Database connection failed:', error.message);
    throw error;
  }
};

// Export the pool so your models can use it
export default pool;