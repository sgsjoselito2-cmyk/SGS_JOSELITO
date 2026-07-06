import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRrhhColumns() {
  const columnsToTest = [
    'id', 'fecha', 'absentismo', 'ausentismo', 'comentarios',
    'created_at', 'horas_teoricas', 'horas_reales'
  ];

  console.log('Testing "top60_rrhh" columns...');
  for (const col of columnsToTest) {
    const { error } = await supabase.from('top60_rrhh').select(col).limit(1);
    if (error) {
      console.log(`  top60_rrhh - ${col}: FAILED (${error.message})`);
    } else {
      console.log(`  top60_rrhh - ${col}: EXISTS!`);
    }
  }
}

testRrhhColumns();
