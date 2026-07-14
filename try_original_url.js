import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;
const connectionString = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;

console.log("Using unmodified URL:", connectionString ? connectionString.replace(/:[^:@]+@/, ':***@') : "none");

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const client = await pool.connect();
    console.log("Connection SUCCESS!");
    const res = await client.query('SELECT NOW()');
    console.log("Result:", res.rows[0]);
    client.release();
  } catch (err) {
    console.error("Connection FAILED:", err.message);
  } finally {
    await pool.end();
  }
}

run();
