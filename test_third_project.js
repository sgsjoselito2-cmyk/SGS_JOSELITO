import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;
const password = 'SGS_Joselito-2026';
const project = 'avtrmcwcqgsbakgcnbkp';

async function run() {
  const hosts = [
    `aws-1-eu-west-1.pooler.supabase.com`,
    `aws-0-eu-west-1.pooler.supabase.com`,
    `db.${project}.supabase.co`
  ];
  for (const host of hosts) {
    const isPooler = host.includes('pooler');
    const port = isPooler ? 6543 : 5432;
    const user = isPooler ? `postgres.${project}` : `postgres`;
    const connStr = `postgres://${user}:${password}@${host}:${port}/postgres`;
    console.log(`Testing ${connStr.replace(password, '***')}...`);
    const pool = new Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000
    });
    try {
      const client = await pool.connect();
      console.log(`🎉 SUCCESS connecting to ${host}!`);
      const res = await client.query('SELECT NOW()');
      console.log('Result:', res.rows[0]);
      client.release();
      await pool.end();
      return;
    } catch (e) {
      console.log(`Failed for ${host}: ${e.message}`);
    }
    await pool.end();
  }
}

run();
