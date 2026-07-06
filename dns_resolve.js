import dns from 'dns';
import { promisify } from 'util';

const resolve4 = promisify(dns.resolve4);

async function testDns() {
  const hosts = [
    'aws-0-eu-west-1.pooler.supabase.com',
    'db.egrqcyyczcnhxqrgfprh.supabase.co',
    'db.rntyoitabtpqlqnwzerd.supabase.co',
    'rntyoitabtpqlqnwzerd.supabase.co'
  ];

  for (const host of hosts) {
    try {
      const ips = await resolve4(host);
      console.log(`${host} resolves to:`, ips);
    } catch (e) {
      console.log(`${host} FAILED to resolve:`, e.message);
    }
  }
}

testDns();
