import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;
const originalUrl = process.env.DATABASE_URL;

if (!originalUrl) {
  console.log("No DATABASE_URL found");
  process.exit(1);
}

const variations = [
  // 1. Original connection string
  originalUrl,
  
  // 2. Original with options parameter
  originalUrl + (originalUrl.includes('?') ? '&' : '?') + 'options=project%3Degrqcyyczcnhxqrgfprh',
  
  // 3. Changing port to 5432 (direct) but keeping pooler host
  originalUrl.replace(':6543', ':5432'),
  
  // 4. Changing port to 5432 (direct) and changing username to just postgres
  originalUrl.replace(':6543', ':5432').replace('postgres.egrqcyyczcnhxqrgfprh:', 'postgres:'),
  
  // 5. Direct host name if project ref is egrqcyyczcnhxqrgfprh
  originalUrl.replace('aws-0-eu-west-1.pooler.supabase.com:6543', 'db.egrqcyyczcnhxqrgfprh.supabase.co:5432').replace('postgres.egrqcyyczcnhxqrgfprh:', 'postgres:'),
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
