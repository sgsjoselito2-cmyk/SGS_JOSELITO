import dns from 'dns';

dns.resolve4('aws-0-eu-west-1.pooler.supabase.com', (err, addresses) => {
  if (err) {
    console.error("resolve4 pooler error:", err);
  } else {
    console.log("resolve4 pooler addresses:", addresses);
  }
});
