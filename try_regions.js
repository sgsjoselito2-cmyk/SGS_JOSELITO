import dns from 'dns';

const project = 'rntyoitabtpqlqnwzerd';
const regions = [
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-central-2',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
  'sa-east-1', 'ca-central-1', 'ap-south-1'
];

async function check() {
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    try {
      const ip = await new Promise((resolve, reject) => {
        dns.resolve(host, (err, addresses) => {
          if (err) reject(err);
          else resolve(addresses[0]);
        });
      });
      console.log(`Region ${region} exists at IP ${ip}`);
    } catch (e) {
      // Ignored
    }
  }
}

check();
