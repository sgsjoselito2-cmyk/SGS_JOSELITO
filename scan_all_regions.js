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

// Let's test all projects!
const projects = ['rntyoitabtpqlqnwzerd', 'egrqcyyczcnhxqrgfprh', 'avtrmcwcqgsbakgcnbkp'];

const regions = [
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-central-2', 'eu-north-1',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ap-southeast-1', 'ap-southeast-2', 'ap-southeast-3', 'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3',
  'sa-east-1', 'ca-central-1', 'ap-south-1', 'me-central-1', 'me-south-1', 'af-south-1', 'ap-east-1', 'ap-south-2'
];

async function scan() {
  for (const project of projects) {
    console.log(`\n=== SCANNING FOR PROJECT ${project} ===`);
    for (const region of regions) {
      const host = `aws-0-${region}.pooler.supabase.com`;
      const connStr = `postgres://postgres.${project}:${password}@${host}:6543/postgres`;
      
      const pool = new Pool({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 2000
      });
      
      try {
        const client = await pool.connect();
        console.log(`\n🎉 SUCCESS! Project ${project} in Region ${region}!`);
        const res = await client.query('SELECT NOW()');
        console.log('Result:', res.rows[0]);
        client.release();
      } catch (e) {
        if (e.message.includes('tenant/user') && e.message.includes('not found')) {
          // Tenant not found means wrong region
        } else {
          // Found the region but got password or other error
          console.log(`\n🎯 FOUND REGION: Project ${project} in ${region}! Error: ${e.message}`);
        }
      }
      await pool.end();
    }
  }
  console.log("Scan complete. No matching region found.");
}

scan();
