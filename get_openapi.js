import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/`;
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': process.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`
      }
    });
    console.log("Status:", res.status);
    if (res.status === 200) {
      const data = await res.json();
      console.log("OpenAPI Title:", data.info?.title);
      console.log("Paths:", Object.keys(data.paths || {}));
    } else {
      const text = await res.text();
      console.log("Text:", text);
    }
  } catch (e) {
    console.error(e);
  }
}

run();
