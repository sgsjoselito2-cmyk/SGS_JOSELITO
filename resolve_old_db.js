import dns from 'dns';

dns.resolve4('db.egrqcyyczcnhxqrgfprh.supabase.co', (err, addresses) => {
  if (err) {
    console.error("resolve4 egrqcyyczcnhxqrgfprh error:", err);
  } else {
    console.log("resolve4 egrqcyyczcnhxqrgfprh addresses:", addresses);
  }
});
