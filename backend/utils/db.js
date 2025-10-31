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

// A simple function to test the connection
export const testDbConnection = async () => {
  try {
    console.log('Database connection successful!');
  } catch (error) {
    console.error('Database connection failed:', error);
  }
};

// Export the pool so your models can use it
export default pool;