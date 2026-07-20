import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TaskType = {
  PRODUCCION: 'P',
  ESPERAS: 'E',
  AVERIA: 'A',
  SIN_TRABAJO: 'S'
};

const getWeekNumber = (d) => {
  const dateCopy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  dateCopy.setUTCDate(dateCopy.getUTCDate() + 4 - (dateCopy.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(dateCopy.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((dateCopy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
};

const normalizeFormato = (formato) => {
  if (!formato) return '';
  return formato
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();
};

const parseTime = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const getIntervals = (acts) => acts
  .filter(a => a.horaInicio && a.horaFin)
  .map(a => ({ start: a.horaInicio, end: a.horaFin }));

const calculateUniqueMinutes = (intervals) => {
  if (intervals.length === 0) return 0;
  const segments = intervals.map(interval => {
    const [h1, m1] = (interval.start || '00:00').split(':').map(Number);
    const [h2, m2] = (interval.end || '00:00').split(':').map(Number);
    let startMin = (h1 || 0) * 60 + (m1 || 0);
    let endMin = (h2 || 0) * 60 + (m2 || 0);
    if (endMin < startMin) endMin += 24 * 60;
    return { start: startMin, end: endMin };
  });

  segments.sort((a, b) => a.start - b.start);

  const merged = [];
  if (segments.length > 0) {
    let current = { ...segments[0] };
    for (let i = 1; i < segments.length; i++) {
      if (segments[i].start <= current.end) {
        current.end = Math.max(current.end, segments[i].end);
      } else {
        merged.push(current);
        current = { ...segments[i] };
      }
    }
    merged.push(current);
  }

  return merged.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
};

const calculateUniqueMinutesMultiDay = (acts) => {
  const byDate = {};
  acts.forEach(a => {
    const d = a.fecha || 'unknown';
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(a);
  });
  let total = 0;
  Object.values(byDate).forEach(dayActs => {
    total += calculateUniqueMinutes(getIntervals(dayActs));
  });
  return total;
};

const mergeIntervals = (segments) => {
  if (segments.length === 0) return [];
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged = [];
  let current = { ...sorted[0] };
  
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start <= current.end) {
      current.end = Math.max(current.end, sorted[i].end);
    } else {
      merged.push(current);
      current = { ...sorted[i] };
    }
  }
  merged.push(current);
  return merged;
};

const subtractIntervals = (base, toExclude) => {
  let result = [...base];
  
  toExclude.forEach(ex => {
    const nextResult = [];
    result.forEach(b => {
      if (ex.end <= b.start || ex.start >= b.end) {
        nextResult.push(b);
      } else {
        if (ex.start > b.start) {
          nextResult.push({ start: b.start, end: ex.start });
        }
        if (ex.end < b.end) {
          nextResult.push({ start: ex.end, end: b.end });
        }
      }
    });
    result = nextResult;
  });
  
  return result;
};

const getIntervalsInMinutes = (intervals) => {
  return intervals.map(interval => {
    const [h1, m1] = (interval.start || '00:00').split(':').map(Number);
    const [h2, m2] = (interval.end || '00:00').split(':').map(Number);
    let startMin = (h1 || 0) * 60 + (m1 || 0);
    let endMin = (h2 || 0) * 60 + (m2 || 0);
    if (endMin < startMin) endMin += 24 * 60;
    return { start: startMin, end: endMin };
  }).sort((a, b) => a.start - b.start);
};

const calculateStats = (data, areaId = '', mermas = [], masterSpeeds = []) => {
  let totalPersonMinutes = 0;
  let totalParts = 0;
  let totalPartsNok = 0;
  let theoreticalTimeSum = 0;
  let sumDurationTotal = 0;
  let sumDurationP = 0;

  const aid = areaId.toLowerCase();
  const isLoncheadoArea = aid.includes('sb-loncheado') || aid.includes('loncheado');

  data.forEach(act => {
    let duration = Number(act.duracionMin ?? act.duration ?? act.duracion_min ?? 0);
    if (duration === 0 && act.horaInicio && act.horaFin) {
      const start = parseTime(act.horaInicio);
      const end = parseTime(act.horaFin);
      duration = end >= start ? (end - start) : (24 * 60 - start + end);
    }
    
    sumDurationTotal += duration;

    const nOps = Array.isArray(act.operarios) ? act.operarios.length : 1;
    totalPersonMinutes += duration * nOps;

    const tipo = act.tipoTarea || act.tipo_tarea;
    if (tipo === TaskType.PRODUCCION || tipo === 'P') {
      sumDurationP += duration;
      const cant = Number(act.cantidad ?? act.quantity ?? act.cantidad_ok ?? 0);
      const cantNok = Number(act.cantidadNok ?? act.quantity_nok ?? act.cantidad_nok ?? 0);
      totalParts += cant;
      totalPartsNok += cantNok;
      
      let teoManual = Number(act.tiempoTeoricoManual ?? act.tiempo_teorico ?? act.theo_time ?? 0);
      if (teoManual === 0) {
        const master = masterSpeeds.find(ms => normalizeFormato(ms.formato) === normalizeFormato(act.formato));
        if (master && master.tiempoTeorico > 0) {
          teoManual = 60 / master.tiempoTeorico;
        }
      }
      theoreticalTimeSum += teoManual * (cant + cantNok);
    }
  });

  const dataByDate = {};
  data.forEach(a => {
    const d = a.fecha || 'unknown';
    if (!dataByDate[d]) dataByDate[d] = [];
    dataByDate[d].push(a);
  });

  let uniqueTimeP = 0;
  let uniqueTimeA = 0;
  let uniqueTimeE = 0;

  Object.keys(dataByDate).forEach(date => {
    const dayActs = dataByDate[date];
    const dayProdActs = dayActs.filter(act => {
      const tipo = act.tipoTarea || act.tipo_tarea;
      return tipo === TaskType.PRODUCCION || tipo === 'P';
    });
    const dayAveriaActs = dayActs.filter(a => a.tipoTarea === TaskType.AVERIA);
    const dayEsperaActs = dayActs.filter(a => a.tipoTarea === TaskType.ESPERAS);

    const pInts = mergeIntervals(getIntervalsInMinutes(getIntervals(dayProdActs)));
    const aIntsRaw = mergeIntervals(getIntervalsInMinutes(getIntervals(dayAveriaActs)));
    const eIntsRaw = mergeIntervals(getIntervalsInMinutes(getIntervals(dayEsperaActs)));

    const machineAInts = subtractIntervals(aIntsRaw, pInts);
    const machineEInts = subtractIntervals(subtractIntervals(eIntsRaw, pInts), machineAInts);

    uniqueTimeP += pInts.reduce((s, i) => s + (i.end - i.start), 0);
    uniqueTimeA += machineAInts.reduce((s, i) => s + (i.end - i.start), 0);
    uniqueTimeE += machineEInts.reduce((s, i) => s + (i.end - i.start), 0);
  });

  const availability = ((uniqueTimeP + uniqueTimeE + uniqueTimeA) > 0 
    ? (uniqueTimeP / (uniqueTimeP + uniqueTimeE + uniqueTimeA)) * 100 
    : 0);

  const performanceGross = (uniqueTimeP > 0 ? (theoreticalTimeSum / uniqueTimeP) * 100 : 0);
  const performance = Math.min(100, performanceGross);
  const quality = (totalParts + totalPartsNok) > 0 ? (totalParts / (totalParts + totalPartsNok)) * 100 : 100;

  const finalAvailability = Math.min(100, availability > 0 ? availability : 0);
  const finalPerformance = Math.min(100, performance > 0 ? performance : 0);
  const finalQuality = Math.min(100, quality > 0 ? quality : 100);
  const oee = (finalAvailability * finalPerformance * finalQuality) / 10000;

  return {
    disponibilidad: finalAvailability.toFixed(1),
    rendimiento: finalPerformance.toFixed(1),
    rendimientoBruto: performanceGross.toFixed(1),
    calidad: finalQuality.toFixed(1),
    productividad: oee.toFixed(1),
    uniqueTimeP,
    uniqueTimeA,
    uniqueTimeE,
    totalParts,
    totalPartsNok,
    theoreticalTimeSum
  };
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
  const mermas = await fetchAll('mermas');
  const masterSpeeds = await fetchAll('master_speeds');

  const allData = [...history, ...activities];
  const targetWeeks = [22, 23, 24, 25, 26, 27, 28];

  console.log("\n--- sb-loncheado (LONCHEADO) ---");
  console.log("| Semana | Dispo (%) | Rendimiento Bruto (%) | Rendimiento Capado (%) | Calidad (%) | OEE (%) |");
  targetWeeks.forEach(wk => {
    const wkData = allData.filter(a => {
      if (!a.fecha) return false;
      const d = new Date(a.fecha);
      return getWeekNumber(d) === wk && d.getFullYear() === 2026 && a.area === 'sb-loncheado';
    });
    const wkMermas = mermas.filter(m => {
      if (!m.fecha) return false;
      const d = new Date(m.fecha);
      return getWeekNumber(d) === wk && d.getFullYear() === 2026 && m.area === 'sb-loncheado';
    });
    const stats = calculateStats(wkData, 'sb-loncheado', wkMermas, masterSpeeds);
    console.log(`| S${wk} | ${stats.disponibilidad}% | ${stats.rendimientoBruto}% | ${stats.rendimiento}% | ${stats.calidad}% | ${stats.productividad}% |`);
  });

  console.log("\n--- sb-empaquetado-loncheado (EMP. LONCHEADO) ---");
  console.log("| Semana | Dispo (%) | Rendimiento Bruto (%) | Rendimiento Capado (%) | Calidad (%) | OEE (%) |");
  targetWeeks.forEach(wk => {
    const wkData = allData.filter(a => {
      if (!a.fecha) return false;
      const d = new Date(a.fecha);
      return getWeekNumber(d) === wk && d.getFullYear() === 2026 && a.area === 'sb-empaquetado-loncheado';
    });
    const wkMermas = mermas.filter(m => {
      if (!m.fecha) return false;
      const d = new Date(m.fecha);
      return getWeekNumber(d) === wk && d.getFullYear() === 2026 && m.area === 'sb-empaquetado-loncheado';
    });
    const stats = calculateStats(wkData, 'sb-empaquetado-loncheado', wkMermas, masterSpeeds);
    console.log(`| S${wk} | ${stats.disponibilidad}% | ${stats.rendimientoBruto}% | ${stats.rendimiento}% | ${stats.calidad}% | ${stats.productividad}% |`);
  });
}

run().catch(console.error);
