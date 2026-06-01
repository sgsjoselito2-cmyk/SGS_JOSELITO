import React, { useMemo, useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, Cell as RechartsCell
} from 'recharts';
import Markdown from 'react-markdown';
import { GoogleGenAI } from "@google/genai";
import { Activity, MasterSpeed, IncidenceMaster, OEEObjectives, TaskType } from '../types';
import { generateContentWithRetry } from '../src/utils/aiUtils';
import { calculateUniqueMinutes, mergeIntervals, getIntervalsInMinutes, subtractIntervals } from '../src/utils';
import { X } from 'lucide-react';

interface DashboardProps {
  activities: Activity[];
  history: Activity[];
  masterSpeeds: MasterSpeed[];
  incidenceMaster: IncidenceMaster[];
  oeeObjectives: OEEObjectives;
  allObjectives?: Record<string, OEEObjectives[]>;
  workshopName?: string;
  selectedArea?: string;
  mermas?: any[];
  selectedDate?: string;
  setSelectedDate?: (d: string) => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export const getWeekNumber = (d: Date) => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
};

// Helper to get formatted intervals for calculateUniqueMinutes
const getIntervals = (acts: Activity[]) => acts
  .filter(a => a.horaInicio && a.horaFin)
  .map(a => ({ start: a.horaInicio, end: a.horaFin! }));

export const calculateStats = (data: Activity[], areaId?: string, mermas: any[] = []) => {
  let totalPersonMinutes = 0;
  let totalParts = 0;
  let totalPartsNok = 0;
  let theoreticalTimeSum = 0;

  const aid = (areaId || '').toLowerCase();
  const isLoncheadoArea = aid.includes('sb-loncheado') || aid.includes('loncheado');

  const parseTime = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const prodActs = data.filter(act => {
    const tipo = act.tipoTarea || (act as any).tipo_tarea;
    return tipo === TaskType.PRODUCCION || tipo === 'P';
  });

  const sActs = data.filter(a => a.tipoTarea === TaskType.SIN_TRABAJO);
  const averiaActs = data.filter(a => a.tipoTarea === TaskType.AVERIA);
  const esperaActs = data.filter(a => a.tipoTarea === TaskType.ESPERAS);

  // Calculations that depend on individual records (Pieces and Theoretical Time)
  data.forEach(act => {
    let duration = Number(act.duracionMin ?? (act as any).duration ?? (act as any).duracion_min ?? 0);
    if (duration === 0 && act.horaInicio && act.horaFin) {
      const start = parseTime(act.horaInicio);
      const end = parseTime(act.horaFin);
      duration = end >= start ? (end - start) : (24 * 60 - start + end);
    }
    
    // Total person minutes for PPH (using operators count)
    const nOps = Array.isArray(act.operarios) ? act.operarios.length : 1;
    totalPersonMinutes += duration * nOps;

    const tipo = act.tipoTarea || (act as any).tipo_tarea;
    if (tipo === TaskType.PRODUCCION || tipo === 'P') {
      const cant = Number(act.cantidad ?? (act as any).quantity ?? (act as any).cantidad_ok ?? 0);
      const cantNok = Number(act.cantidadNok ?? (act as any).quantity_nok ?? (act as any).cantidad_nok ?? 0);
      totalParts += cant;
      totalPartsNok += cantNok;
      
      const actIsLoncheado = (act.area || aid).toLowerCase().includes('loncheado');
      const isLaser = (act.area || aid).toLowerCase().includes('laser');
      const teoManual = Number(act.tiempoTeoricoManual ?? (act as any).tiempo_teorico ?? (act as any).theo_time ?? 0);

      // Theoretical time per record (Σ Cantidad / Velocidad)
      if (isLaser) {
        theoreticalTimeSum += (teoManual > 0 ? (60 / teoManual) : 0);
      } else if (actIsLoncheado) {
        theoreticalTimeSum += (teoManual > 0 ? (cant + cantNok) / teoManual : 0);
      } else {
        theoreticalTimeSum += (teoManual * (cant + cantNok));
      }
    }
  });

  // Unique machine times (Clock hours, not man-hours) using priorities: P > A > E
  const pIntervals = mergeIntervals(getIntervalsInMinutes(getIntervals(prodActs)));
  const aIntervalsRaw = mergeIntervals(getIntervalsInMinutes(getIntervals(averiaActs)));
  const eIntervalsRaw = mergeIntervals(getIntervalsInMinutes(getIntervals(esperaActs)));

  // Machine is only stopped if NOT in Production
  const machineAIntervals = subtractIntervals(aIntervalsRaw, pIntervals);
  // Machine is only in Esperas if NOT in Production AND NOT in Averia
  const machineEIntervals = subtractIntervals(subtractIntervals(eIntervalsRaw, pIntervals), machineAIntervals);

  const uniqueTimeP = pIntervals.reduce((s, i) => s + (i.end - i.start), 0);
  const uniqueTimeA = machineAIntervals.reduce((s, i) => s + (i.end - i.start), 0);
  const uniqueTimeE = machineEIntervals.reduce((s, i) => s + (i.end - i.start), 0);
  const uniqueTotalTime = calculateUniqueMinutes(getIntervals(data));

  // Universal Formulas per User Request
  // Availability = P / (P + E + A)
  const availability = (uniqueTimeP + uniqueTimeE + uniqueTimeA) > 0 
    ? (uniqueTimeP / (uniqueTimeP + uniqueTimeE + uniqueTimeA)) * 100 
    : 0;

  // Performance = Theoretical / Production
  const performance = uniqueTimeP > 0 
    ? (theoreticalTimeSum / uniqueTimeP) * 100 
    : 0;

  const quality = (totalParts + totalPartsNok) > 0 ? (totalParts / (totalParts + totalPartsNok)) * 100 : 100;

  // Merma logic
  let merma1 = 0;
  let merma2 = 0;
  let subproducto = 0;
  if (isLoncheadoArea && mermas && mermas.length > 0) {
    let sumKgEntrada = 0;
    let sumKgMerma = 0;
    let sumKgTacos = 0;
    let sumKgPieles = 0;
    let sumKgHueco = 0;

    mermas.forEach(m => {
      sumKgEntrada += Number(m.kgEntrada !== undefined ? m.kgEntrada : (m.kg_entrada || 0));
      sumKgMerma += Number(m.kgMerma !== undefined ? m.kgMerma : (m.kg_merma || 0));
      sumKgTacos += Number(m.kgTacos !== undefined ? m.kgTacos : (m.kg_tacos || 0));
      sumKgPieles += Number(m.kgPieles !== undefined ? m.kgPieles : (m.kg_pieles || 0));
      sumKgHueco += Number(m.kgHueco !== undefined ? m.kgHueco : (m.kg_hueco || 0));
    });

    if (sumKgEntrada > 0) {
      merma1 = (sumKgMerma / sumKgEntrada) * 100;
      merma2 = ((sumKgMerma + sumKgTacos + sumKgPieles + sumKgHueco) / sumKgEntrada) * 100;
      subproducto = ((sumKgTacos + sumKgPieles + sumKgHueco) / sumKgEntrada) * 100;
    }
  }

  // PPH Calculations
  let pph = 0;
  let pph_blister = 0;
  let pph_sin_blister = 0;
  let pph_blister_emp = 0;
  let pph_sin_blister_cuchillo = 0;
  let pph_sin_marcar = 0;
  let pph_empaquetado_jabu = 0;
  let pph_jamones = 0;
  let pph_paletas = 0;
  let pph_manteca = 0;
  let cantidad_colgada = 0;
  const calcPPHFromMinutes = (m: number, qty: number) => m > 0 ? qty / (m / 60) : 0;

  if (aid.includes('sb-preparacion')) {
    const acts = data.filter(a => a.tipoTarea === TaskType.PRODUCCION && a.formato?.toUpperCase().includes('PESAR'));
    const pmInput = acts.reduce((sum, a) => sum + (a.duracionMin || 0) * (Array.isArray(a.operarios) ? a.operarios.length : 1), 0);
    const qtyInput = acts.reduce((sum, a) => sum + (a.cantidad || 0), 0);
    pph = calcPPHFromMinutes(pmInput, qtyInput);
  } else if (aid.includes('sb-empaquetado-deshuesado') || aid.includes('env-envasado') || aid.includes('env-empaquetado')) {
    const acts = data.filter(a => a.tipoTarea === TaskType.PRODUCCION);
    const pmInput = acts.reduce((sum, a) => sum + (a.duracionMin || 0) * (Array.isArray(a.operarios) ? a.operarios.length : 1), 0);
    const qtyInput = acts.reduce((sum, a) => sum + (a.cantidad || 0), 0);
    pph = calcPPHFromMinutes(pmInput, qtyInput);
  } else if (aid.includes('sb-empaquetado-loncheado')) {
    const bActs = data.filter(a => a.tipoTarea === TaskType.PRODUCCION && (a.formato?.toUpperCase().includes('BLISTER') || a.formato?.toUpperCase().includes('BLÍSTER')));
    const cuchilloActs = data.filter(a => a.tipoTarea === TaskType.PRODUCCION && a.formato?.toUpperCase().includes('CUCHILLO'));
    const sinMarcarActs = data.filter(a => a.tipoTarea === TaskType.PRODUCCION && a.formato?.toUpperCase().includes('SIN MARCAR'));
    const jabuActs = data.filter(a => a.tipoTarea === TaskType.PRODUCCION && a.formato?.toUpperCase().includes('JABU'));

    pph_blister_emp = calcPPHFromMinutes(bActs.reduce((s, a) => s + (a.duracionMin || 0) * (Array.isArray(a.operarios) ? a.operarios.length : 1), 0), bActs.reduce((s, a) => s + (a.cantidad || 0), 0));
    pph_sin_blister_cuchillo = calcPPHFromMinutes(cuchilloActs.reduce((s, a) => s + (a.duracionMin || 0) * (Array.isArray(a.operarios) ? a.operarios.length : 1), 0), cuchilloActs.reduce((s, a) => s + (a.cantidad || 0), 0));
    pph_sin_marcar = calcPPHFromMinutes(sinMarcarActs.reduce((s, a) => s + (a.duracionMin || 0) * (Array.isArray(a.operarios) ? a.operarios.length : 1), 0), sinMarcarActs.reduce((s, a) => s + (a.cantidad || 0), 0));
    pph_empaquetado_jabu = calcPPHFromMinutes(jabuActs.reduce((s, a) => s + (a.duracionMin || 0) * (Array.isArray(a.operarios) ? a.operarios.length : 1), 0), jabuActs.reduce((s, a) => s + (a.cantidad || 0), 0));

    // Support old variables as fallback aliases
    pph_blister = pph_blister_emp;
    pph_sin_blister = pph_sin_blister_cuchillo;
  } else if (aid.includes('movimiento-jamones')) {
    const actsJamones = data.filter(a =>
      a.formato === 'COLGAR JAMONES'
      && a.tipoTarea === TaskType.PRODUCCION
    );
    const cantJamones = actsJamones.reduce((sum, a) => sum + Number(a.cantidad || 0), 0);
    const persJamones = new Set(actsJamones.flatMap(a => a.operarios || [])).size || 1;
    const horasJamones = calculateUniqueMinutes(getIntervals(actsJamones)) / 60;
    pph_jamones = horasJamones > 0 ? Math.round(cantJamones / persJamones / horasJamones) : 0;

    const actsPaletas = data.filter(a =>
      a.formato === 'COLGAR PALETAS'
      && a.tipoTarea === TaskType.PRODUCCION
    );
    const cantPaletas = actsPaletas.reduce((sum, a) => sum + Number(a.cantidad || 0), 0);
    const persPaletas = new Set(actsPaletas.flatMap(a => a.operarios || [])).size || 1;
    const horasPaletas = calculateUniqueMinutes(getIntervals(actsPaletas)) / 60;
    pph_paletas = horasPaletas > 0 ? Math.round(cantPaletas / persPaletas / horasPaletas) : 0;

    const actsManteca = data.filter(a =>
      a.formato === 'COLGAR JAMONES MANTECA'
      && a.tipoTarea === TaskType.PRODUCCION
    );
    const cantManteca = actsManteca.reduce((sum, a) => sum + Number(a.cantidad || 0), 0);
    const persManteca = new Set(actsManteca.flatMap(a => a.operarios || [])).size || 1;
    const horasManteca = calculateUniqueMinutes(getIntervals(actsManteca)) / 60;
    pph_manteca = horasManteca > 0 ? Math.round(cantManteca / persManteca / horasManteca) : 0;

    cantidad_colgada = data
      .filter(a => 
        (a.formato === 'COLGAR JAMONES' || 
         a.formato === 'COLGAR PALETAS' || 
         a.formato === 'COLGAR JAMONES MANTECA') &&
        a.tipoTarea === TaskType.PRODUCCION
      )
      .reduce((sum, a) => sum + Number(a.cantidad || 0), 0);
  }

  const finalAvailability = Math.min(100, availability > 0 ? availability : 0);
  const finalPerformance = Math.min(100, performance > 0 ? performance : 0);
  const finalQuality = Math.min(100, quality > 0 ? quality : 100);
  const oee = (finalAvailability * finalPerformance * finalQuality) / 10000;

  const hasData = data.length > 0;
  const hasMermas = isLoncheadoArea && mermas && mermas.length > 0;

  return {
    disponibilidad: hasData ? finalAvailability.toFixed(1) : '',
    rendimiento: hasData ? finalPerformance.toFixed(1) : '',
    calidad: hasData ? finalQuality.toFixed(1) : '',
    productividad: hasData ? oee.toFixed(1) : '',
    totalParts,
    downtime: (uniqueTotalTime - uniqueTimeP).toFixed(0),
    merma1: (hasData || hasMermas) ? merma1.toFixed(2) : '',
    merma2: (hasData || hasMermas) ? merma2.toFixed(2) : '',
    subproducto: (hasData || hasMermas) ? subproducto.toFixed(2) : '',
    pph: hasData ? pph.toFixed(0) : '',
    pph_blister: hasData ? pph_blister.toFixed(0) : '',
    pph_sin_blister: hasData ? pph_sin_blister.toFixed(0) : '',
    pph_blister_emp: hasData ? pph_blister_emp.toFixed(0) : '',
    pph_sin_blister_cuchillo: hasData ? pph_sin_blister_cuchillo.toFixed(0) : '',
    pph_sin_marcar: hasData ? pph_sin_marcar.toFixed(0) : '',
    pph_empaquetado_jabu: hasData ? pph_empaquetado_jabu.toFixed(0) : '',
    pph_jamones: hasData ? pph_jamones.toFixed(0) : '',
    pph_paletas: hasData ? pph_paletas.toFixed(0) : '',
    pph_manteca: hasData ? pph_manteca.toFixed(0) : '',
    cantidad_colgada: hasData ? cantidad_colgada.toFixed(0) : '',
    tiempo_produccion_real: uniqueTimeP,
    tiempo_esperas: uniqueTimeE,
    tiempo_averias: uniqueTimeA
  };
};

const Dashboard: React.FC<DashboardProps> = ({ 
  activities, 
  history, 
  masterSpeeds, 
  incidenceMaster, 
  oeeObjectives,
  allObjectives = {},
  workshopName,
  selectedArea,
  mermas = [],
  selectedDate: propDate,
  setSelectedDate: propSetDate
}) => {
  const [localDate, setLocalDate] = useState(new Date().toISOString().split('T')[0]);
  const selectedDate = propDate || localDate;
  const setSelectedDate = propSetDate || setLocalDate;
  
  const [aiAnalysis, setAiAnalysis] = useState<string>('Analizando datos con IA...');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Helper to get objective for a workshop and indicator based on date
  const getObjectiveForDate = (indicator_id: string, dateStr: string) => {
    if (!selectedArea) return (oeeObjectives as any)[indicator_id] || 0;
    
    const objs = allObjectives[selectedArea] || [];
    const sorted = [...objs].sort((a, b) => b.valid_from.localeCompare(a.valid_from));
    
    // Helper function for prioritized lookup
    const getVal = (id: string) => {
      const spec = sorted.find(o => o.valid_from <= dateStr && o.indicator_id === id);
      if (spec && spec.objetivo) return spec.objetivo;
      
      const master = sorted.find(o => o.valid_from <= dateStr && (o.indicator_id === 'productividad' || o.indicator_id === 'oee' || !o.indicator_id));
      if (master) {
        if (id === 'disponibilidad' || id === 'availability') return master.disponibilidad || 0;
        if (id === 'rendimiento' || id === 'performance') return master.rendimiento || 0;
        if (id === 'calidad' || id === 'quality') return master.calidad || 0;
      }
      return 0;
    };

    const isOEEPart = ['disponibilidad', 'rendimiento', 'calidad', 'productividad', 'oee', 'availability', 'performance', 'quality'].includes(indicator_id);
    if (isOEEPart) {
      if (indicator_id === 'productividad' || indicator_id === 'oee') {
        const specProd = sorted.find(o => o.valid_from <= dateStr && (o.indicator_id === 'productividad' || o.indicator_id === 'oee'));
        if (specProd && specProd.objetivo) return specProd.objetivo;
        
        // If no explicit OEE goal, calculate from components (which also follow priority)
        const d = getVal('disponibilidad');
        const r = getVal('rendimiento');
        const c = getVal('calidad');
        if (d > 0 || r > 0 || c > 0) {
          return parseFloat(((d * r * c) / 10000).toFixed(1));
        }
        if (selectedArea === 'env-envasado' || selectedArea === 'env-empaquetado') {
          return 45;
        }
        return 62.4;
      }
      const val = getVal(indicator_id);
      if (val > 0) return val;
      if (selectedArea === 'env-envasado' || selectedArea === 'env-empaquetado') {
        if (indicator_id === 'disponibilidad' || indicator_id === 'availability') return 90;
        if (indicator_id === 'rendimiento' || indicator_id === 'performance') return 50;
        if (indicator_id === 'calidad' || indicator_id === 'quality') return 100;
      }
      if (indicator_id === 'disponibilidad' || indicator_id === 'availability') return 90;
      if (indicator_id === 'rendimiento' || indicator_id === 'performance') return 70;
      if (indicator_id === 'calidad' || indicator_id === 'quality') return 99;
      return val;
    }

    // Default fallbacks for non-OEE indicators
    if (indicator_id === 'cantidad_colgada') {
      const spec = sorted.find(o => o.valid_from <= dateStr && o.indicator_id === 'cantidad_colgada');
      return spec?.objetivo || (oeeObjectives as any).cantidad_colgada || 2000;
    }
    if (indicator_id === 'pph') {
      const spec = sorted.find(o => o.valid_from <= dateStr && o.indicator_id === 'pph');
      return spec?.objetivo || spec?.pph || (oeeObjectives as any).pph || 0;
    }
    if (indicator_id === 'merma1') {
      const spec = sorted.find(o => o.valid_from <= dateStr && o.indicator_id === 'merma1');
      return spec?.objetivo || spec?.merma1 || (oeeObjectives as any).merma1 || 3;
    }
    if (indicator_id === 'merma2') {
      const spec = sorted.find(o => o.valid_from <= dateStr && o.indicator_id === 'merma2');
      return spec?.objetivo || spec?.merma2 || (oeeObjectives as any).merma2 || 3;
    }
    if (indicator_id === 'subproducto') {
      const spec = sorted.find(o => o.valid_from <= dateStr && o.indicator_id === 'subproducto');
      return spec?.objetivo || spec?.subproducto || (oeeObjectives as any).subproducto || 5;
    }

    const simpleMatch = sorted.find(o => o.valid_from <= dateStr && o.indicator_id === indicator_id);
    return simpleMatch?.objetivo || (oeeObjectives as any)[indicator_id] || 0;
  };

  // Drill-down state
  const [drillDownRecords, setDrillDownRecords] = useState<{ type: 'disponibilidad' | 'rendimiento' | 'calidad', category: string } | null>(null);

  const allData = useMemo(() => [...history, ...activities], [history, activities]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrillDownRecords(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleParetoBarDoubleClick = (type: 'disponibilidad' | 'rendimiento' | 'calidad', category: string) => {
    setDrillDownRecords({ type, category });
  };

  const isMecanizado = false;

  // Filtered data for selected date
  const dayData = useMemo(() => allData.filter(a => a.fecha === selectedDate), [allData, selectedDate]);
  const stats = useMemo(() => calculateStats(dayData, selectedArea, mermas.filter(m => m.fecha === selectedDate)), [dayData, selectedArea, selectedDate, mermas]);

  // Scorecard Data
  const scorecardData = useMemo(() => {
    const today = new Date(selectedDate);
    
    // Last 7 days
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split('T')[0];
      const data = allData.filter(a => a.fecha === dateStr);
      return { 
        label: dateStr, 
        total: calculateStats(data, selectedArea, mermas.filter(m => m.fecha === dateStr)),
      };
    });

    // Last 7 weeks
    const last7Weeks = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i) * 7);
      const weekNum = getWeekNumber(d);
      const year = d.getFullYear();
      const data = allData.filter(a => {
        if (!a.fecha) return false;
        const ad = new Date(a.fecha);
        return getWeekNumber(ad) === weekNum && ad.getFullYear() === year;
      });
      const weekMermas = mermas.filter(m => {
        if (!m.fecha) return false;
        const md = new Date(m.fecha);
        return getWeekNumber(md) === weekNum && md.getFullYear() === year;
      });
      return { 
        label: `S${weekNum}`, 
        total: calculateStats(data, selectedArea, weekMermas),
      };
    });

    // Annual Cumulative
    const currentYear = today.getFullYear();
    const prevYear = currentYear - 1;
    const currentYearData = allData.filter(a => a.fecha?.startsWith(currentYear.toString()));
    const prevYearData = allData.filter(a => a.fecha?.startsWith(prevYear.toString()));
    const currentYearMermas = mermas.filter(m => m.fecha?.startsWith(currentYear.toString()));
    const prevYearMermas = mermas.filter(m => m.fecha?.startsWith(prevYear.toString()));

    return {
      daily: last7Days,
      weekly: last7Weeks,
      annual: [
        { 
          label: prevYear.toString(), 
          total: calculateStats(prevYearData, selectedArea, prevYearMermas),
        },
        { 
          label: currentYear.toString(), 
          total: calculateStats(currentYearData, selectedArea, currentYearMermas),
        }
      ]
    };
  }, [allData, selectedDate, selectedArea, mermas]);

  const isTimeBased = false;

  // Merma stats por período (só Loncheado)
  const calcMermaStats = (records: any[]) => {
    if (!records || records.length === 0) return { merma1: '', merma2: '', subproducto: '' };
    
    let sumKgMerma = 0;
    let sumKgTacos = 0;
    let sumKgPieles = 0;
    let sumKgHueco = 0;
    let sumKgEnvasados = 0;

    records.forEach(m => {
      sumKgMerma += Number(m.kgMerma !== undefined ? m.kgMerma : (m.kg_merma || 0));
      sumKgTacos += Number(m.kgTacos !== undefined ? m.kgTacos : (m.kg_tacos || 0));
      sumKgPieles += Number(m.kgPieles !== undefined ? m.kgPieles : (m.kg_pieles || 0));
      sumKgHueco += Number(m.kgHueco !== undefined ? m.kgHueco : (m.kg_hueco || 0));
      sumKgEnvasados += Number(m.kgSalida !== undefined ? m.kgSalida : (m.kg_salida || m.kgEnvasados || m.kg_envasados || 0));
    });

    const totalKgSalida = sumKgEnvasados + sumKgTacos + sumKgPieles + sumKgHueco + sumKgMerma;
    
    if (totalKgSalida > 0) {
      const m1 = (sumKgMerma / totalKgSalida) * 100;
      const m2 = ((sumKgMerma + sumKgPieles + sumKgHueco) / totalKgSalida) * 100;
      const sub = (sumKgTacos / totalKgSalida) * 100;
      return { 
        merma1: m1.toFixed(2), 
        merma2: m2.toFixed(2), 
        subproducto: sub.toFixed(2) 
      };
    }
    
    return { merma1: '0.00', merma2: '0.00', subproducto: '0.00' };
  };

  const mermaScorecard = useMemo(() => {
    if (selectedArea !== 'sb-loncheado') return null;
    const today = new Date(selectedDate);
    const lowercaseArea = selectedArea.toLowerCase();

    const daily = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today); d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split('T')[0];
      return { label: dateStr, total: calcMermaStats(mermas.filter(m => m.fecha === dateStr && (m.area || '').toLowerCase() === lowercaseArea)) };
    });

    const weekly = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today); d.setDate(d.getDate() - (6 - i) * 7);
      const w = getWeekNumber(d); const yr = d.getFullYear();
      return { label: `S${w}`, total: calcMermaStats(mermas.filter(m => { 
        if (!m.fecha || (m.area || '').toLowerCase() !== lowercaseArea) return false; 
        const md = new Date(m.fecha); 
        return getWeekNumber(md) === w && md.getFullYear() === yr; 
      })) };
    });

    const currentYear = today.getFullYear(); const prevYear = currentYear - 1;
    const annual = [
      { label: prevYear.toString(), total: calcMermaStats(mermas.filter(m => m.fecha?.startsWith(prevYear.toString()) && (m.area || '').toLowerCase() === lowercaseArea)) },
      { label: currentYear.toString(), total: calcMermaStats(mermas.filter(m => m.fecha?.startsWith(currentYear.toString()) && (m.area || '').toLowerCase() === lowercaseArea)) },
    ];

    return { daily, weekly, annual };
  }, [mermas, selectedDate, selectedArea]);

  // Pareto Data
  const paretos = useMemo(() => {
    const esperas: Record<string, number> = {};
    const performanceLoss: Record<string, number> = {};
    const qualityLoss: Record<string, number> = {};

    dayData.forEach(act => {
      if (act.tipoTarea === TaskType.ESPERAS || act.tipoTarea === TaskType.AVERIA) {
        // Robust check: if flag is missing but task name is known to be quality-related
        const name = act.formato.toUpperCase();
        const isQualityTask = ['REPROCESADO', 'REPROCESO', 'REPASAR', 'REPINTADO', 'RETRABAJO', 'CALIDAD'].some(kw => name.includes(kw));
        if (act.afectaCalidad || isQualityTask) {
          qualityLoss[act.formato] = (qualityLoss[act.formato] || 0) + (act.duracionMin || 0);
        } else {
          esperas[act.formato] = (esperas[act.formato] || 0) + (act.duracionMin || 0);
        }
      }
      if (act.tipoTarea === TaskType.PRODUCCION) {
        const actArea = (act.area || selectedArea || '').toLowerCase();
        const actIsLoncheado = actArea.includes('loncheado');
        const isLaser = actArea.includes('laser');
        const teo = act.tiempoTeoricoManual || 0;
        
        let theoreticalTotal = 0;
        if (isLaser) {
          theoreticalTotal = (teo > 0 ? (60 / teo) : 0);
        } else if (actIsLoncheado) {
          theoreticalTotal = (teo > 0 ? (act.cantidad || 0) / teo : 0);
        } else {
          theoreticalTotal = teo * (act.cantidad || 0);
        }

        const loss = (act.duracionMin || 0) - theoreticalTotal;
        if (loss > 0) {
          performanceLoss[act.formato] = (performanceLoss[act.formato] || 0) + loss;
        }
        
        // Quality loss from NOK pieces
        if ((act.cantidadNok || 0) > 0) {
          let nokLoss = 0;
          if (actIsLoncheado) {
            nokLoss = (teo > 0 ? (act.cantidadNok || 0) / teo : 0);
          } else {
            nokLoss = teo * (act.cantidadNok || 0);
          }
          qualityLoss[act.formato] = (qualityLoss[act.formato] || 0) + nokLoss;
        }
      }
    });

    const formatPareto = (record: Record<string, number>) => 
      Object.entries(record)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

    return {
      esperas: formatPareto(esperas),
      performance: formatPareto(performanceLoss),
      quality: formatPareto(qualityLoss)
    };
  }, [dayData]);

  // AI Analysis
  const runAnalysis = async () => {
    if (dayData.length === 0) {
      setAiAnalysis('No hay datos suficientes para realizar un análisis de IA en esta fecha.');
      return;
    }

    setIsAnalyzing(true);
    setAiAnalysis('Generando análisis del día...');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Analiza los indicadores de producción de Joselito (Productor de Jamones) para el taller ${workshopName} en la fecha ${selectedDate}.
      
      DATOS REALES:
      - Disponibilidad: ${stats.disponibilidad}% (Objetivo: ${oeeObjectives.disponibilidad}%)
      - Rendimiento: ${stats.rendimiento}% (Objetivo: ${oeeObjectives.rendimiento}%)
      - Calidad: ${stats.calidad}% (Objetivo: ${oeeObjectives.calidad}%)
      - OEE Global: ${stats.productividad}% (Objetivo: ${oeeObjectives.productividad}%)
      
      PRINCIPALES CAUSAS DE PÉRDIDA:
      - Esperas: ${JSON.stringify(paretos.esperas)}
      - Rendimiento: ${JSON.stringify(paretos.performance)}
      - Calidad: ${JSON.stringify(paretos.quality)}
      
      Proporciona un análisis breve y directo (máximo 200 palabras) en formato Markdown sobre el desempeño del día y sugerencias de mejora.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      setAiAnalysis(response.text || 'No se pudo generar el análisis.');
    } catch (error: any) {
      console.error('AI Error:', error);
      setAiAnalysis('Error al conectar con la IA. Por favor, inténtalo de nuevo.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Remove auto-analysis
  useEffect(() => {
    setAiAnalysis('Pulsa el botón para analizar los datos del día con IA.');
  }, [selectedDate, workshopName]);

  const renderScorecardTable = (title: string, data: any[]) => {
    let indicators = [
      { id: 'disponibilidad', objKey: 'disponibilidad', label: 'DISPONIBILIDAD (%)' },
      { id: 'rendimiento', objKey: 'rendimiento', label: 'RENDIMIENTO (%)' },
      { id: 'calidad', objKey: 'calidad', label: 'CALIDAD (%)' }
    ];

    if (selectedArea === 'movimiento-jamones') {
      indicators = indicators.filter(ind => ind.id !== 'rendimiento' && ind.id !== 'calidad');
    }

    if (selectedArea === 'sb-loncheado') {
      indicators.push(
        { id: 'merma1', objKey: 'merma1', label: 'MERMA 1 (%)' },
        { id: 'merma2', objKey: 'merma2', label: 'MERMA 2 (%)' },
        { id: 'subproducto', objKey: 'subproducto', label: 'SUBPRODUCTO (%)' }
      );
    }
    if (selectedArea === 'sb-preparacion') {
      indicators.unshift({ id: 'pph', objKey: 'pph', label: 'PPH PESAR' });
    }
    if (selectedArea === 'sb-empaquetado-loncheado') {
      indicators.unshift(
        { id: 'pph_blister_emp', objKey: 'pph_blister_emp', label: 'PPH BLISTER EMPAQUETADO' },
        { id: 'pph_sin_blister_cuchillo', objKey: 'pph_sin_blister_cuchillo', label: 'PPH SIN BLISTER CUCHILLO' },
        { id: 'pph_sin_marcar', objKey: 'pph_sin_marcar', label: 'PPH SIN MARCAR' },
        { id: 'pph_empaquetado_jabu', objKey: 'pph_empaquetado_jabu', label: 'PPH EMPAQUETADO JABU' }
      );
    }
    if (selectedArea === 'sb-empaquetado-deshuesado') {
      indicators.unshift({ id: 'pph', objKey: 'pph', label: 'PPH' });
    }
    if (selectedArea === 'env-envasado') {
      indicators.unshift({ id: 'pph', objKey: 'pph', label: 'PPH ENVASADO' });
    }
    if (selectedArea === 'env-empaquetado') {
      indicators.unshift({ id: 'pph', objKey: 'pph', label: 'PPH EMPAQUETADO' });
    }
    if (selectedArea === 'movimiento-jamones') {
      indicators.unshift(
        { id: 'pph_jamones', objKey: 'pph_jamones', label: 'PPH COLGAR JAMONES' },
        { id: 'pph_paletas', objKey: 'pph_paletas', label: 'PPH COLGAR PALETAS' },
        { id: 'pph_manteca', objKey: 'pph_manteca', label: 'PPH COLGAR JAMONES MANTECA' },
        { id: 'cantidad_colgada', objKey: 'cantidad_colgada', label: 'CANTIDAD COLGADA' }
      );
    }

    return (
      <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-sm overflow-hidden max-h-[500px] overflow-y-auto">
        <table className="w-full text-[13px] border-collapse">
          <thead className="sticky top-0 z-20">
            <tr className="bg-slate-900 text-white font-black text-[11px] uppercase tracking-widest">
              <th className="p-2.5 text-left border border-slate-700 w-48">{title}</th>
              <th className="p-2.5 text-center border border-slate-700 w-20">OBJ.</th>
              {data.map(d => <th key={d.label} className="p-2.5 text-center border border-slate-700 min-w-[65px]">{d.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {indicators.map((indicator) => {
              const staticObj = (oeeObjectives as any)[indicator.objKey || ''] || 0;
              const isLowerBetter = indicator.id.startsWith('merma') || indicator.id === 'subproducto';
              const isPPH = indicator.id.startsWith('pph') || indicator.id === 'cantidad_colgada';

              return (
                <tr key={indicator.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="p-2 font-bold border border-slate-100 bg-slate-50/30 text-slate-700 uppercase text-[11px]">
                    {indicator.label}
                  </td>
                  <td className="p-2 text-center font-black border border-slate-200 text-blue-600 bg-blue-50/20">
                    {staticObj !== 0 ? (isPPH ? staticObj : `${staticObj}%`) : '—'}
                  </td>
                  {data.map(d => {
                    const rawVal = d.total[indicator.id];
                    const val = rawVal === '' ? null : Number(rawVal);
                    const dynamicObj = getObjectiveForDate(indicator.objKey || indicator.id, d.key || d.label);
                    
                    let cellStyle = 'text-slate-300';
                    if (val !== null) {
                      const isGood = isLowerBetter ? val <= dynamicObj : val >= dynamicObj;
                      cellStyle = isGood ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold';
                    }

                    return (
                      <td 
                        key={d.label} 
                        className={`p-2 text-center text-[12px] border border-slate-100 ${cellStyle}`}
                        title={`Objetivo para esta fecha: ${dynamicObj}`}
                      >
                        {val !== null ? (isPPH ? val : `${val}%`) : '—'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const extraKPIs = useMemo(() => {
    const kpis: any[] = [];
    const aid = (selectedArea || '').toLowerCase();
    
    if (aid.includes('sb-preparacion')) {
      kpis.push({ label: 'PPH PESAR', val: stats.pph, obj: getObjectiveForDate('pph', selectedDate), color: 'indigo', key: 'pph' });
    }
    if (aid.includes('sb-empaquetado-loncheado')) {
      kpis.push({ label: 'PPH Blister Emp', val: stats.pph_blister_emp, obj: getObjectiveForDate('pph_blister_emp', selectedDate), color: 'indigo', key: 'pph_blister_emp' });
      kpis.push({ label: 'PPH Sin Blister Cuchillo', val: stats.pph_sin_blister_cuchillo, obj: getObjectiveForDate('pph_sin_blister_cuchillo', selectedDate), color: 'indigo', key: 'pph_sin_blister_cuchillo' });
      kpis.push({ label: 'PPH Sin Marcar', val: stats.pph_sin_marcar, obj: getObjectiveForDate('pph_sin_marcar', selectedDate), color: 'indigo', key: 'pph_sin_marcar' });
      kpis.push({ label: 'PPH Emp Jabu', val: stats.pph_empaquetado_jabu, obj: getObjectiveForDate('pph_empaquetado_jabu', selectedDate), color: 'indigo', key: 'pph_empaquetado_jabu' });
    }
    if (aid.includes('sb-empaquetado-deshuesado') || aid.includes('env-envasado') || aid.includes('env-empaquetado')) {
      kpis.push({ label: 'PPH', val: stats.pph, obj: getObjectiveForDate('pph', selectedDate), color: 'indigo', key: 'pph' });
    }
    if (aid.includes('movimiento-jamones')) {
      kpis.push({ label: 'PPH COLGAR JAMONES', val: stats.pph_jamones, obj: getObjectiveForDate('pph_jamones', selectedDate), color: 'indigo', key: 'pph_jamones' });
      kpis.push({ label: 'PPH COLGAR PALETAS', val: stats.pph_paletas, obj: getObjectiveForDate('pph_paletas', selectedDate), color: 'indigo', key: 'pph_paletas' });
      kpis.push({ label: 'PPH COLGAR JAMONES MANTECA', val: stats.pph_manteca, obj: getObjectiveForDate('pph_manteca', selectedDate), color: 'indigo', key: 'pph_manteca' });
      kpis.push({ label: 'CANTIDAD COLGADA', val: stats.cantidad_colgada, obj: getObjectiveForDate('cantidad_colgada', selectedDate) || 2000, color: 'indigo', key: 'cantidad_colgada' });
    }
    return kpis;
  }, [selectedArea, stats, selectedDate]);

  const formatDetailedStats = useMemo(() => {
    const formats = Array.from(new Set(dayData.filter(a => a.formato).map(a => a.formato))).sort();
    
    return formats.map(f => {
      const fData = dayData.filter(a => a.formato === f);
      
      const fProdActs = fData.filter(act => {
        const tipo = act.tipoTarea || (act as any).tipo_tarea;
        return tipo === TaskType.PRODUCCION || tipo === 'P';
      });
      const fAveriaActs = fData.filter(a => a.tipoTarea === TaskType.AVERIA);
      const fEsperaActs = fData.filter(a => a.tipoTarea === TaskType.ESPERAS);

      const pInts = mergeIntervals(getIntervalsInMinutes(getIntervals(fProdActs)));
      const aIntsRaw = mergeIntervals(getIntervalsInMinutes(getIntervals(fAveriaActs)));
      const eIntsRaw = mergeIntervals(getIntervalsInMinutes(getIntervals(fEsperaActs)));

      const aInts = subtractIntervals(aIntsRaw, pInts);
      const eInts = subtractIntervals(subtractIntervals(eIntsRaw, pInts), aInts);

      return {
        formato: f,
        ok: fProdActs.reduce((sum, a) => sum + Number(a.cantidad || 0), 0),
        nok: fProdActs.reduce((sum, a) => sum + Number(a.cantidadNok || 0), 0),
        prod: pInts.reduce((sum, i) => sum + (i.end - i.start), 0),
        averia: aInts.reduce((sum, i) => sum + (i.end - i.start), 0),
        espera: eInts.reduce((sum, i) => sum + (i.end - i.start), 0),
        personas: Array.from(new Set(fData.flatMap(a => a.operarios || []))).length,
      };
    }).sort((a, b) => b.prod - a.prod);
  }, [dayData]);

  return (
    <div className="flex flex-col gap-1 animate-in fade-in duration-500 h-full">
      {/* Date Selector */}
      <div className="flex flex-row items-center justify-between gap-1 bg-white p-2 rounded-xl border border-slate-100 shadow-sm shrink-0">
        <div>
          <h2 className="text-[12px] sm:text-sm font-black text-slate-900 tracking-tight uppercase leading-tight">CMI {workshopName && `- ${workshopName}`}</h2>
        </div>
        <div className="flex items-center gap-1">
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)}
            className="p-1 bg-slate-50 border border-slate-100 rounded-md font-black text-[12px] sm:text-sm text-blue-600 outline-none"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-1 sm:gap-2 shrink-0">
        <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center sm:gap-2 px-1 sm:px-3 text-center sm:text-left">
          <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-tighter">Dispon.</span>
          <span className="text-[12px] sm:text-base font-black text-slate-900 tracking-tighter leading-none">{stats.disponibilidad}{stats.disponibilidad !== '' ? '%' : ''}</span>
        </div>
        <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center sm:gap-2 px-1 sm:px-3 text-center sm:text-left">
          <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-tighter">Rendim.</span>
          <span className="text-[12px] sm:text-base font-black text-slate-900 tracking-tighter leading-none">{stats.rendimiento}{stats.rendimiento !== '' ? '%' : ''}</span>
        </div>
        <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center sm:gap-2 px-1 sm:px-3 text-center sm:text-left">
          <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-tighter">Calidad</span>
          <span className="text-[12px] sm:text-base font-black text-slate-900 tracking-tighter leading-none">{stats.calidad}{stats.calidad !== '' ? '%' : ''}</span>
        </div>
        <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 shadow-md flex flex-col sm:flex-row items-center sm:gap-2 px-1 sm:px-3 text-center sm:text-left">
          <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-tighter">OEE</span>
          <span className="text-[12px] sm:text-base font-black text-white tracking-tighter leading-none">{stats.productividad}{stats.productividad !== '' ? '%' : ''}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-2 no-scrollbar pb-24">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            { label: 'Disponibilidad', val: stats.disponibilidad, obj: getObjectiveForDate('disponibilidad', selectedDate), color: 'blue', key: 'disponibilidad' },
            { label: 'Rendimiento', val: stats.rendimiento, obj: getObjectiveForDate('rendimiento', selectedDate), color: 'emerald', key: 'rendimiento' },
            { label: 'Calidad', val: stats.calidad, obj: getObjectiveForDate('calidad', selectedDate), color: 'amber', key: 'calidad' },
            { label: 'OEE Global', val: stats.productividad, obj: getObjectiveForDate('productividad', selectedDate), color: 'slate', isGlobal: true, key: 'productividad' }
          ].map(kpi => (
            <div key={kpi.label} className={`${kpi.isGlobal ? 'bg-slate-900 text-white' : 'bg-white'} p-2 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 shadow-md relative overflow-hidden group hover:shadow-lg transition-all flex flex-col justify-between`}>
              <div>
                <h3 className={`${kpi.isGlobal ? 'text-slate-400' : 'text-slate-400'} text-[10px] sm:text-[13px] font-black uppercase tracking-widest mb-0.5`}>{kpi.label}</h3>
                <div className="text-lg sm:text-2xl font-black tracking-tighter">
                  {kpi.val}{kpi.val !== '' ? '%' : ''}
                </div>
              </div>
              
              <div className="mt-1 sm:mt-2 grid grid-cols-1 gap-2 border-t border-slate-100 pt-1 sm:pt-2">
                <div className="flex flex-col">
                  <span className={`text-[10px] sm:text-[15px] font-bold ${Number(kpi.val) >= kpi.obj ? 'text-emerald-500' : 'text-red-500'}`}>
                    {kpi.val}{kpi.val !== '' ? '%' : ''}
                  </span>
                </div>
              </div>

              <div className="mt-1">
                <div className={`text-[10px] sm:text-[15px] font-bold ${kpi.isGlobal ? 'text-slate-400' : `text-${kpi.color}-600`}`}>Obj: {kpi.obj}%</div>
                <div className="w-full bg-slate-100 h-1 rounded-full mt-1 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-1000 ${Number(kpi.val) >= kpi.obj ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, Number(kpi.val))}%` }}></div>
                </div>
              </div>
            </div>
          ))}
          {extraKPIs.map(kpi => (
            <div key={kpi.label} className="bg-white p-2 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 shadow-md relative overflow-hidden group hover:shadow-lg transition-all flex flex-col justify-between">
              <div>
                <h3 className="text-slate-400 text-[10px] sm:text-[13px] font-black uppercase tracking-widest mb-0.5">{kpi.label}</h3>
                <div className="text-lg sm:text-2xl font-black tracking-tighter">
                  {kpi.val}
                </div>
              </div>
              
              <div className="mt-1 sm:mt-2 grid grid-cols-1 gap-2 border-t border-slate-100 pt-1 sm:pt-2">
                <div className="flex flex-col">
                  <span className={`text-[10px] sm:text-[15px] font-bold ${Number(kpi.val) >= kpi.obj ? 'text-emerald-500' : 'text-red-500'}`}>
                    {kpi.val}
                  </span>
                </div>
              </div>

              <div className="mt-1">
                <div className={`text-[10px] sm:text-[15px] font-bold text-${kpi.color}-600`}>Obj: {kpi.obj}</div>
                <div className="w-full bg-slate-100 h-1 rounded-full mt-1 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-1000 ${Number(kpi.val) >= kpi.obj ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, (Number(kpi.val) / kpi.obj) * 100)}%` }}></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scorecard Section */}
      <div className="bg-white p-4 sm:p-8 rounded-2xl sm:rounded-[3rem] border border-slate-100 shadow-xl space-y-4 sm:space-y-8">
        <div className="flex items-center gap-3 sm:gap-4 mb-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-lg sm:rounded-2xl flex items-center justify-center text-white font-black text-sm sm:text-base">M</div>
          <h3 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tighter">CUADRO DE MANDO</h3>
        </div>
        
        <div className="space-y-6 sm:space-y-8">
          <section>
            <h4 className="text-[11px] sm:text-[14px] font-black text-slate-400 uppercase tracking-[0.2em] sm:tracking-[0.3em] mb-2 sm:mb-4">Últimos 7 Días (Diario)</h4>
            {renderScorecardTable('Fecha', scorecardData.daily)}
          </section>
          
          <section>
            <h4 className="text-[11px] sm:text-[14px] font-black text-slate-400 uppercase tracking-[0.2em] sm:tracking-[0.3em] mb-2 sm:mb-4">Últimas 7 Semanas</h4>
            {renderScorecardTable('Semana', scorecardData.weekly)}
          </section>

          <section>
            <h4 className="text-[11px] sm:text-[14px] font-black text-slate-400 uppercase tracking-[0.2em] sm:tracking-[0.3em] mb-2 sm:mb-4">Acumulado Anual</h4>
            {renderScorecardTable('Año', scorecardData.annual)}
          </section>
        </div>
      </div>

      {/* Pareto Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {[
          { title: 'Pareto de Esperas', data: paretos.esperas, type: 'disponibilidad' as const, unit: 'min' },
          { title: 'Pérdida Rendimiento', data: paretos.performance, type: 'rendimiento' as const, unit: 'min' },
          { title: 'Pérdida Calidad', data: paretos.quality, type: 'calidad' as const, unit: isTimeBased ? 'min' : 'uds' }
        ].map(pareto => (
          <div key={pareto.title} className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] border border-slate-100 shadow-lg">
            <h3 className="text-slate-900 text-[13px] sm:text-[15px] font-black uppercase tracking-widest mb-4 sm:mb-6 px-2">{pareto.title}</h3>
            <div className="h-64 w-full relative">
              {pareto.data.length > 0 ? (
                <div className="absolute inset-0">
                  <ResponsiveContainer width="100%" height="100%" minHeight={256} debounce={100}>
                  <BarChart data={pareto.data} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tick={{fontSize: 8, fontWeight: 700}} width={80} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', fontSize: '10px'}}
                    />
                    <Bar 
                      dataKey="value" 
                      fill="#3b82f6" 
                      radius={[0, 4, 4, 0]}
                      onDoubleClick={(data) => handleParetoBarDoubleClick(pareto.type, data.name)}
                      className="cursor-pointer"
                    >
                      {pareto.data.map((_, index) => (
                        <RechartsCell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              ) : (
                <div className="h-full flex items-center justify-center text-[14px] font-bold text-slate-300 uppercase tracking-widest">Sin datos</div>
              )}
            </div>
            <p className="text-[15px] text-center text-slate-400 mt-2 font-bold uppercase tracking-widest">Doble clic en barra para ver registros</p>
          </div>
        ))}
      </div>

      {/* Breakdown by Format Table */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-black text-sm">D</div>
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Detalle por Formato ({selectedDate.split('-').reverse().join('/')})</h3>
        </div>
        
        <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-black text-[11px] uppercase tracking-widest">
                <th className="p-3 text-left border border-slate-700">Formato</th>
                <th className="p-3 text-center border border-slate-700">Pers.</th>
                <th className="p-3 text-center border border-slate-700">OK</th>
                <th className="p-3 text-center border border-slate-700">NOK</th>
                <th className="p-3 text-center border border-slate-700">T. Prod (min)</th>
                <th className="p-3 text-center border border-slate-700">T. Avería (min)</th>
                <th className="p-3 text-center border border-slate-700">T. Espera (min)</th>
              </tr>
            </thead>
            <tbody>
              {formatDetailedStats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest">No hay datos para esta fecha</td>
                </tr>
              ) : (
                formatDetailedStats.map((f, idx) => (
                  <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-bold text-slate-700 border border-slate-100">{f.formato}</td>
                    <td className="p-3 text-center border border-slate-100 font-black text-slate-500">{f.personas}</td>
                    <td className="p-3 text-center border border-slate-100 font-black text-emerald-600">{Number(f.ok || 0).toFixed(1)}</td>
                    <td className="p-3 text-center border border-slate-100 font-black text-red-500">{Number(f.nok || 0).toFixed(1)}</td>
                    <td className="p-3 text-center border border-slate-100 font-black text-blue-600">{f.prod}</td>
                    <td className="p-3 text-center border border-slate-100 text-slate-500">{f.averia}</td>
                    <td className="p-3 text-center border border-slate-100 text-slate-500">{f.espera}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Analysis Section */}
      <div className="bg-blue-900 p-10 rounded-[4rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-10">
          <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                <svg className={`w-6 h-6 ${isAnalyzing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              </div>
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tighter">Análisis de IA Joselito</h3>
                <p className="text-blue-300 text-[14px] font-bold uppercase tracking-widest">Diagnóstico de causas raíz para {workshopName}</p>
              </div>
            </div>
            <button 
              onClick={() => runAnalysis()}
              disabled={isAnalyzing}
              className={`px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${isAnalyzing ? 'bg-blue-800 text-blue-400 cursor-not-allowed' : 'bg-white text-blue-900 hover:bg-blue-50 shadow-xl active:scale-95'}`}
            >
              {isAnalyzing ? 'ANALIZANDO...' : 'SOLICITAR ANÁLISIS'}
            </button>
          </div>
          <div className="prose prose-invert max-w-none text-blue-100 text-sm leading-relaxed bg-blue-950/30 p-6 rounded-3xl border border-white/10">
            <Markdown>{aiAnalysis}</Markdown>
          </div>
        </div>
      </div>

      {/* Records Modal */}
      {drillDownRecords && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-blue-600 text-white">
              <div>
                <h3 className="text-lg font-black uppercase tracking-tighter">Registros Detallados</h3>
                <p className="text-[14px] font-bold uppercase tracking-widest opacity-80">{drillDownRecords.category} - {selectedDate.split('-').reverse().join('/')}</p>
              </div>
              <button onClick={() => setDrillDownRecords(null)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X className="w-6 h-6 text-white" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto">
              <table className="w-full text-[14px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600">
                    <th className="p-2 text-left border border-slate-200">Operarios</th>
                    <th className="p-2 text-center border border-slate-200">Inicio</th>
                    <th className="p-2 text-center border border-slate-200">Fin</th>
                    <th className="p-2 text-center border border-slate-200">Duración</th>
                    <th className="p-2 text-center border border-slate-200">Cant.</th>
                    {drillDownRecords.type === 'rendimiento' && (
                      <>
                        <th className="p-2 text-center border border-slate-200">T. Teo (min)</th>
                        <th className="p-2 text-center border border-slate-200">T. Real (min)</th>
                        <th className="p-2 text-center border border-slate-200">Pérdida (min)</th>
                      </>
                    )}
                    {drillDownRecords.type === 'calidad' && <th className="p-2 text-center border border-slate-200">Reprocesado</th>}
                    <th className="p-2 text-left border border-slate-200">Comentario</th>
                  </tr>
                </thead>
                <tbody>
                  {dayData.filter(a => {
                    if (drillDownRecords.type === 'disponibilidad') {
                      return (a.tipoTarea === TaskType.ESPERAS || a.tipoTarea === TaskType.AVERIA) && a.formato === drillDownRecords.category;
                    }
                    if (drillDownRecords.type === 'rendimiento') {
                      return a.tipoTarea === TaskType.PRODUCCION && a.formato === drillDownRecords.category;
                    }
                    return false;
                  }).length === 0 && (
                    <tr>
                      <td colSpan={drillDownRecords.type === 'rendimiento' ? 9 : 6} className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest">No se encontraron registros detallados</td>
                    </tr>
                  )}
                  {dayData.filter(a => {
                    if (drillDownRecords.type === 'disponibilidad') {
                      return (a.tipoTarea === TaskType.ESPERAS || a.tipoTarea === TaskType.AVERIA) && a.formato === drillDownRecords.category;
                    }
                    if (drillDownRecords.type === 'rendimiento') {
                      return a.tipoTarea === TaskType.PRODUCCION && a.formato === drillDownRecords.category;
                    }
                    return false;
                  }).map((rec, idx) => {
                    const teo = rec.tiempoTeoricoManual || 0;
                    const theoreticalTotal = (teo > 0 ? (60 / teo) : 0) * (rec.cantidad || 0);
                    const realTime = rec.duracionMin || 0;
                    const loss = realTime - theoreticalTotal;

                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 border border-slate-200 font-bold">{rec.operarios?.join(', ')}</td>
                        <td className="p-2 border border-slate-200 text-center">{rec.horaInicio}</td>
                        <td className="p-2 border border-slate-200 text-center">{rec.horaFin}</td>
                        <td className="p-2 border border-slate-200 text-center font-black">{rec.duracionMin} min</td>
                        <td className="p-2 border border-slate-200 text-center">{rec.cantidad || 0}</td>
                        {drillDownRecords.type === 'rendimiento' && (
                          <>
                            <td className="p-2 border border-slate-200 text-center text-blue-600 font-bold">{theoreticalTotal.toFixed(1)}</td>
                            <td className="p-2 border border-slate-200 text-center text-slate-600 font-bold">{realTime}</td>
                            <td className={`p-2 border border-slate-200 text-center font-black ${loss > 0 ? 'text-red-600' : (loss < 0 ? 'text-emerald-600' : 'text-slate-400')}`}>
                              {loss > 0 ? '+' : ''}{loss.toFixed(1)}
                            </td>
                          </>
                        )}
                        <td className="p-2 border border-slate-200 text-slate-500 italic">{rec.comentarios || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button onClick={() => setDrillDownRecords(null)} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">Cerrar (ESC)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
