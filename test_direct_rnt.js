import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;
const originalUrl = process.env.DATABASE_URL;
const url = new URL(originalUrl);
const password = url.password;
const project = 'rntyoitabtpqlqnwzerd';

async function run() {
  const host = `db.${project}.supabase.co`;
  console.log(`Testing direct connection to ${host}:5432 with username 'postgres'...`);
  const connStr = `postgres://postgres:${password}@${host}:5432/postgres`;
  const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000 // 10 seconds
  });
  try {
    const client = await pool.connect();
    console.log(`🎉 SUCCESS connecting to ${host}:5432!`);
    const res = await client.query('SELECT NOW()');
    console.log('Result:', res.rows[0]);
    client.release();
    await pool.end();
  } catch (e) {
    console.log(`Failed to connect directly to ${host}:5432: ${e.message}`);
    await pool.end();
  }
}

run();
