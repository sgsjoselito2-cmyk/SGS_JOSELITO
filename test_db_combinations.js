import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.log("No DATABASE_URL");
  process.exit(1);
}

const parsed = new URL(dbUrl);
const password = parsed.password;

const projects = ['egrqcyyczcnhxqrgfprh', 'rntyoitabtpqlqnwzerd'];
const variations = [];

for (const proj of projects) {
  variations.push({
    name: `Direct postgres of ${proj}`,
    url: `postgres://postgres:${password}@db.${proj}.supabase.co:5432/postgres`
  });
  variations.push({
    name: `Pooler ${proj} on port 6543`,
    url: `postgres://postgres.${proj}:${password}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`
  });
  variations.push({
    name: `Pooler ${proj} on port 5432`,
    url: `postgres://postgres.${proj}:${password}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`
  });
  // Also try using the raw DATABASE_URL
  if (proj === 'egrqcyyczcnhxqrgfprh') {
    variations.push({
      name: `Raw DATABASE_URL`,
      url: dbUrl
    });
  }
}

async function test() {
  for (const v of variations) {
    console.log(`\nTesting connection for: ${v.name}`);
    const pool = new Pool({
      connectionString: v.url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 4000
    });
    try {
      const client = await pool.connect();
      console.log(`=> SUCCESS!`);
      const res = await client.query('SELECT NOW()');
      console.log('Result:', res.rows[0]);
      client.release();
      await pool.end();
      return;
    } catch (e) {
      console.log(`=> FAILED: ${e.message}`);
      await pool.end();
    }
  }
}

test();
