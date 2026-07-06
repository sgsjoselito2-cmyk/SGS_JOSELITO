import dns from 'dns';
import { promisify } from 'util';

const resolveCname = promisify(dns.resolveCname);
const resolve = promisify(dns.resolve);

async function testDns() {
  const hosts = [
    'db.rntyoitabtpqlqnwzerd.supabase.co',
    'aws-0-eu-west-1.pooler.supabase.com',
  ];

  for (const host of hosts) {
    try {
      const cnames = await resolveCname(host);
      console.log(`${host} CNAME:`, cnames);
    } catch (e) {
      console.log(`${host} CNAME FAILED:`, e.message);
    }
  }
}

testDns();
