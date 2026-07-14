import dns from 'dns';

dns.resolveAny('db.rntyoitabtpqlqnwzerd.supabase.co', (err, addresses) => {
  if (err) {
    console.error(err);
  } else {
    console.log(addresses);
  }
});
