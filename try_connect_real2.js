import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;
const originalUrl = process.env.DATABASE_URL;

if (!originalUrl) {
  console.log("No DATABASE_URL found");
  process.exit(1);
}

const url = new URL(originalUrl);
const password = url.password;

const variations = [
  // 1. Correct project ref on port 5432 of the pooler
  `postgres://postgres.rntyoitabtpqlqnwzerd:${password}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`,
  // 2. Correct project ref on port 6543 of the pooler
  `postgres://postgres.rntyoitabtpqlqnwzerd:${password}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`,
];

async function testAll() {
  for (let i = 0; i < variations.length; i++) {
    const connStr = variations[i];
    console.log(`\nTesting variation ${i + 1}:`);
    const pool = new Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000
    });
    
    try {
      const client = await pool.connect();
      console.log(`Variation ${i + 1} SUCCESS!`);
      const res = await client.query('SELECT NOW()');
      console.log('Result:', res.rows[0]);
      client.release();
      await pool.end();
      return connStr;
    } catch (e) {
      console.log(`Variation ${i + 1} FAILED:`, e.message);
      await pool.end();
    }
  }
}

testAll();
