import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const normalizeFormato = (formato) => {
  if (!formato) return '';
  return formato
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();
};

async function run() {
  const { data: acts, error: err1 } = await supabase
    .from('activities')
    .select('*')
    .eq('area', 'movimiento-jamones')
    .eq('fecha', '2026-05-13');

  const { data: hist, error: err2 } = await supabase
    .from('history')
    .select('*')
    .eq('area', 'movimiento-jamones')
    .eq('fecha', '2026-05-13');

  const allData = [...acts, ...hist];

  const prod = allData.filter(a => a.tipoTarea === 'P');

  console.log(`\nFound ${prod.length} production records for movimiento-jamones on 2026-05-13:`);
  prod.forEach(p => {
    console.log(`ID: ${p.id} | Formato: "${p.formato}" | Cantidad: ${p.cantidad} | TiempoTeoricoManual: ${p.tiempoTeoricoManual}`);
  });

  const { data: ms, error: err3 } = await supabase
    .from('master_speeds')
    .select('*')
    .eq('area', 'movimiento-jamones');

  if (err3) throw err3;

  console.log(`\nFound ${ms.length} master speeds for movimiento-jamones:`);
  ms.forEach(m => {
    console.log(`ID: ${m.id} | Formato: "${m.formato}" | TiempoTeorico: ${m.tiempoTeorico}`);
  });
}

run().catch(console.error);
