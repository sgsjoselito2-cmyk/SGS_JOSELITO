import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const getWeekNumber = (d) => {
  const dateCopy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  dateCopy.setUTCDate(dateCopy.getUTCDate() + 4 - (dateCopy.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(dateCopy.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((dateCopy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
};

const fetchAll = async (tableName) => {
  let allData = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await supabase.from(tableName).select('*').range(from, from + step - 1);
    if (error) throw error;
    allData = [...allData, ...data];
    if (data.length < step) break;
    from += step;
  }
  return allData;
};

async function run() {
  const activities = await fetchAll('activities');
  const history = await fetchAll('history');
  const masterSpeeds = await fetchAll('master_speeds');
  const allData = [...history, ...activities];

  const s23Data = allData.filter(a => {
    if (!a.fecha) return false;
    const d = new Date(a.fecha);
    return getWeekNumber(d) === 23 && d.getFullYear() === 2026 && a.area === 'sb-empaquetado-loncheado';
  });

  console.log("\n--- sb-empaquetado-loncheado IN S23 (Targeting 11103.7% Performance) ---");
  s23Data.forEach(a => {
    console.log(`Fecha: ${a.fecha} | Hora: ${a.horaInicio}-${a.horaFin} (${a.duracionMin} min) | Tipo: ${a.tipoTarea} | Cantidad: ${a.cantidad} | Formato: ${a.formato} | Operarios: ${JSON.stringify(a.operarios)} | TiempoTeoricoManual: ${a.tiempoTeoricoManual}`);
  });

  console.log("\n--- Master Speeds for sb-empaquetado-loncheado ---");
  masterSpeeds.filter(ms => ms.area === 'sb-empaquetado-loncheado').forEach(ms => {
    console.log(`Formato: ${ms.formato} | tiempoTeorico: ${ms.tiempoTeorico}`);
  });
}

run().catch(console.error);
