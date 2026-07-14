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
const project = 'rntyoitabtpqlqnwzerd';

const regions = [
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-central-2',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
  'sa-east-1', 'ca-central-1', 'ap-south-1'
];

async function scan() {
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const connStr = `postgres://postgres.${project}:${password}@${host}:6543/postgres`;
    console.log(`Testing region ${region}...`);
    
    const pool = new Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 3000
    });
    
    try {
      const client = await pool.connect();
      console.log(`\n🎉 SUCCESS! Region is ${region}!`);
      const res = await client.query('SELECT NOW()');
      console.log('Result:', res.rows[0]);
      client.release();
      await pool.end();
      return;
    } catch (e) {
      if (e.message.includes('tenant/user') && e.message.includes('not found')) {
        // Tenant not found means wrong region
        // console.log(`Region ${region}: tenant not found`);
      } else {
        // Any other error means the tenant WAS found (correct region!), but maybe password failed
        console.log(`\n🎯 FOUND REGION: ${region}! Error is: ${e.message}`);
        await pool.end();
        return;
      }
    }
    await pool.end();
  }
  console.log("Scan complete. No region found.");
}

scan();
