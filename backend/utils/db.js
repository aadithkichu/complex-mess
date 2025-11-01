import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Create a connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// --- CORRECTED FUNCTION TO TEST CONNECTION ---
export const testDbConnection = async () => {
  try {
    // 1. Execute a simple query to force a connection test.
    const [rows] = await pool.query('SELECT 1 + 1 AS solution');
    
    // 2. Log success based on the query result.
    console.log(`Database connection successful! Test result: ${rows[0].solution}`);
  } catch (error) {
    // 3. If the query fails (ECONNREFUSED, Access Denied, etc.), the error is caught here.
    console.error('Database connection failed:', error.message);
    
    // Optional: Re-throw the error to halt server startup if connection is mandatory
    throw error;
  }
};

// Export the pool so your models can use it
export default pool;