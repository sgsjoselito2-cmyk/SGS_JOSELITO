import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const tables = ['tipos_reclamacion', 'areas_causantes_calidad', 'plan_accion_calidad', 'top60_rrhh'];
  console.log("Checking tables via Supabase JS:");
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`  - ${table}: FAILED (${error.message})`);
    } else {
      console.log(`  - ${table}: EXISTS! Data:`, data);
    }
  }
}

check();
