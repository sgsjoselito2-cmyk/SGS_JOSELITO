import dotenv from 'dotenv';
dotenv.config();

for (const key in process.env) {
  if (key.includes('SUPABASE') || key.includes('DATABASE') || key.includes('KEY') || key.includes('PASS')) {
    const val = process.env[key];
    console.log(`${key}: ${val ? (val.substring(0, 10) + '...') : 'empty'}`);
  }
}
