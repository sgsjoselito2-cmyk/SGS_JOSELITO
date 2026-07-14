import dotenv from 'dotenv';
dotenv.config();

const key = process.env.VITE_SUPABASE_ANON_KEY;
if (!key) {
  console.log("No VITE_SUPABASE_ANON_KEY");
} else {
  const parts = key.split('.');
  if (parts.length === 3) {
    const payload = Buffer.from(parts[1], 'base64').toString();
    console.log("Decoded payload:", JSON.parse(payload));
  } else {
    console.log("Invalid JWT format");
  }
}
