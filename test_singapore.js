import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;
const originalUrl = process.env.DATABASE_URL;
const url = new URL(originalUrl);
const password = url.password;
const project = 'rntyoitabtpqlqnwzerd';
const region = 'ap-southeast-1';

const variations = [
  { port: 5432, host: `aws-0-${region}.pooler.supabase.com` },
  { port: 6543, host: `aws-0-${region}.pooler.supabase.com` },
  { port: 5432, host: `db.${project}.supabase.co` },
];

async function run() {
  for (const v of variations) {
    console.log(`\nTesting connection to ${v.host}:${v.port}...`);
    const connStr = `postgres://postgres.${project}:${password}@${v.host}:${v.port}/postgres`;
    const pool = new Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000 // 10 seconds
    });
    try {
      const client = await pool.connect();
      console.log(`🎉 SUCCESS connecting to ${v.host}:${v.port}!`);
      const res = await client.query('SELECT NOW()');
      console.log('Result:', res.rows[0]);
      client.release();
      await pool.end();
      return;
    } catch (e) {
      console.log(`Failed to connect to ${v.host}:${v.port}: ${e.message}`);
    }
    await pool.end();
  }
}

run();
