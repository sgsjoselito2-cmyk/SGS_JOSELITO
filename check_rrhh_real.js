import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const columns = [
    'id', 'fecha', 'comentarios', 'area', 'absentismo', 'ausentismo', 'last_modified',
    'totalMod', 'totalMoi', 'modBaja', 'moiBaja', 'ettBaja',
    'horas_teoricas', 'horas_reales', 'numero_absentismo', 'numero_ausentismo',
    'jefe_equipo', 'jornadas_perdidas', 'porcentaje', 'mod', 'moi',
    'jornadasPerdidasMod', 'jornadasPerdidasMoi', 'created_at'
  ];
  
  console.log('Testing column existence in top60_rrhh:');
  for (const col of columns) {
    const { error } = await supabase.from('top60_rrhh').select(col).limit(1);
    if (error) {
      console.log(`  - ${col}: FAILED (${error.message})`);
    } else {
      console.log(`  - ${col}: EXISTS!`);
    }
  }
}

test();
