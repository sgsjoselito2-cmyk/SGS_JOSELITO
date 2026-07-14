import dns from 'dns';

dns.resolve4('db.rntyoitabtpqlqnwzerd.supabase.co', (err, addresses) => {
  if (err) {
    console.error("resolve4 error:", err);
  } else {
    console.log("resolve4 addresses:", addresses);
  }
});

dns.resolveCname('db.rntyoitabtpqlqnwzerd.supabase.co', (err, addresses) => {
  if (err) {
    console.error("resolveCname error:", err);
  } else {
    console.log("resolveCname addresses:", addresses);
  }
});
