import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  const testId = 'temp-test-id-' + Math.random().toString(36).substr(2, 9);
  const testRow = {
    id: testId,
    fecha: '2026-06-24',
    area: 'TOP 60',
    comentarios: 'test'
  };

  console.log('Inserting test row:', testRow);
  const { data, error } = await supabase.from('top60_rrhh').insert(testRow).select();
  if (error) {
    console.error('Insert error:', error.message);
  } else {
    console.log('Insert SUCCESS! Returned row columns and values:');
    console.log(data);
    
    // Clean up
    await supabase.from('top60_rrhh').delete().eq('id', testId);
    console.log('Cleaned up test row.');
  }
}

testInsert();
