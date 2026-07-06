import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const columns = ['jornadas_teoricas', 'jornadas_perdidas_baja', 'jornadas_perdidas_ausentismo', 'created_at'];
  console.log("Checking columns in top60_rrhh:");
  for (const col of columns) {
    const { error } = await supabase.from('top60_rrhh').select(col).limit(1);
    if (error) {
      console.log(`  - ${col}: FAILED (${error.message})`);
    } else {
      console.log(`  - ${col}: EXISTS!`);
    }
  }
}

check();
