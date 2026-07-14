import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
// Load productivity logic directly or write a small parser. Since Productivity is a TS file, we can either strip it or import it if the environment supports TS runtime.
// Let's check how other TS files are run in development.
// We can use ts-node or tsx to run typescript directly!
// Let's see if tsx is installed or run with tsx.
import { calculateProductivityRows } from './src/utils/productividad.js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Fetching data from Supabase...");
  
  // 1. Fetch all activities, history, and master speeds
  const { data: activities, error: actErr } = await supabase.from('activities').select('*');
  if (actErr) {
    console.error("Error fetching activities:", actErr);
    return;
  }
  
  const { data: history, error: histErr } = await supabase.from('history').select('*');
  if (histErr) {
    console.error("Error fetching history:", histErr);
    return;
  }
  
  const { data: masterSpeeds, error: speedErr } = await supabase.from('master_speeds').select('*');
  if (speedErr) {
    console.error("Error fetching master_speeds:", speedErr);
    return;
  }

  console.log(`Fetched ${activities?.length} active activities, ${history?.length} history records, and ${masterSpeeds?.length} master speeds.`);

  // 2. Calculate productivity rows for all data
  console.log("Calculating productivity rows...");
  const rows = calculateProductivityRows(activities || [], history || [], masterSpeeds || []);
  console.log(`Calculated ${rows.length} total productivity rows.`);

  if (rows.length === 0) {
    console.log("No productivity rows generated. Ensure there are production ('P' or 'PRODUCCION') activities with valid fecha, area, and formato.");
    return;
  }

  // 3. Upsert rows into 'resumen_productividad' in batches
  console.log("Upserting rows into 'resumen_productividad'...");
  let upsertSuccess = true;
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error: upsertErr } = await supabase.from('resumen_productividad').upsert(batch, { onConflict: 'fecha,area,producto' });
    if (upsertErr) {
      console.warn(`Error upserting batch starting at ${i}:`, upsertErr.message);
      console.warn("Notice: The 'resumen_productividad' table might not exist yet. Running with local calculations fallback.");
      upsertSuccess = false;
      break;
    } else {
      console.log(`Successfully upserted batch ${i} to ${Math.min(i + batchSize, rows.length)}`);
    }
  }

  // 4. Query sample rows to present to the user
  console.log("\n--- SAMPLE ROWS FROM 'resumen_productividad' ---");
  let sampleRows = [];
  if (upsertSuccess) {
    const { data: dbRows, error: selectErr } = await supabase
      .from('resumen_productividad')
      .select('*')
      .order('fecha', { ascending: false });

    if (selectErr) {
      console.error("Error fetching sample rows from DB:", selectErr.message);
      console.log("Falling back to local calculations.");
      sampleRows = [...rows].sort((a, b) => b.fecha.localeCompare(a.fecha));
    } else {
      sampleRows = dbRows;
      console.log(`Total rows currently in DB: ${sampleRows.length}`);
    }
  } else {
    console.log("Using locally calculated productivity rows for the report.");
    sampleRows = [...rows].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  
  const groupedByArea = {};
  for (const r of sampleRows) {
    if (!groupedByArea[r.area]) {
      groupedByArea[r.area] = [];
    }
    groupedByArea[r.area].push(r);
  }

  console.log("\nAreas found in database:", Object.keys(groupedByArea));

  // Let's pick 15 rows:
  const selectedRows = [];
  const areas = Object.keys(groupedByArea);
  
  // Prioritize sb-loncheado and sb-empaquetado-loncheado
  const prioritized = ['sb-loncheado', 'sb-empaquetado-loncheado'];
  const otherAreas = areas.filter(a => !prioritized.includes(a));
  const orderedAreas = [...prioritized.filter(a => areas.includes(a)), ...otherAreas];

  let addedCount = 0;
  let index = 0;
  while (addedCount < 15 && orderedAreas.length > 0) {
    let advanced = false;
    for (const area of orderedAreas) {
      const list = groupedByArea[area];
      if (list && list[index]) {
        selectedRows.push(list[index]);
        addedCount++;
        advanced = true;
      }
      if (addedCount >= 15) break;
    }
    if (!advanced) break;
    index++;
  }

  console.log(JSON.stringify(selectedRows, null, 2));

  // 5. Select 2 sample rows to detail and trace back to raw records
  console.log("\n--- DETAILED TRACING ---");
  const traces = selectedRows.slice(0, 2);
  for (const trace of traces) {
    console.log(`\nTrace details for: Date: ${trace.fecha} | Area: ${trace.area} | Product: ${trace.producto}`);
    const rawActs = [...(activities || []), ...(history || [])].filter(a => 
      a.fecha === trace.fecha && 
      a.area === trace.area && 
      a.formato === trace.producto &&
      (a.tipoTarea === 'P' || a.tipoTarea === 'PRODUCCION')
    );
    console.log("Raw items:");
    console.log(JSON.stringify(rawActs, null, 2));
  }
}

run();
