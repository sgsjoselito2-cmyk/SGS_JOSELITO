import fetch from 'node-fetch';

async function run() {
  try {
    const res = await fetch('https://rntyoitabtpqlqnwzerd.supabase.co/rest/v1/', {
      headers: {
        'apikey': process.env.VITE_SUPABASE_ANON_KEY
      }
    });
    console.log("Status:", res.status);
    console.log("Headers:", [...res.headers.entries()]);
  } catch (e) {
    console.error(e);
  }
}

run();
