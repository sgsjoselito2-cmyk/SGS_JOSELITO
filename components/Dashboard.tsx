import React, { useMemo, useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, Cell as RechartsCell
} from 'recharts';
import Markdown from 'react-markdown';
import { GoogleGenAI } from "@google/genai";
import { Activity, MasterSpeed, IncidenceMaster, OEEObjectives, TaskType } from '../types';
import { generateContentWithRetry } from '../src/utils/aiUtils';
import { X } from 'lucide-react';

interface DashboardProps {
  activities: Activity[];
  history: Activity[];
  masterSpeeds: MasterSpeed[];
  incidenceMaster: IncidenceMaster[];
  oeeObjectives: OEEObjectives;
  workshopName?: string;
  selectedArea?: string;
  mermas?: any[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export const getWeekNumber = (d: Date) => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
};

export const calculateStats = (data: Activity[], areaId?: string, mermas: any[] = []) => {
  let totalTime = 0;
  let timeP = 0;
  let timeS = 0;
  let timeA_Quality = 0;
  let timeA_NoQuality = 0;
  let timeE_Quality = 0;
  let timeE_NoQuality = 0;
  let totalParts = 0;
  let totalPartsNok = 0;
  let theoreticalTimeSum = 0;

  data.forEach(act => {
    const duration = act.duracionMin || 0;
    totalTime += duration;

    if (act.tipoTarea === TaskType.PRODUCCION) {
      timeP += duration;
      totalParts += (act.cantidad || 0);
      totalPartsNok += (act.cantidadNok || 0);
      
      const isLaser = act.area === 'corte-laser' || areaId === 'corte-laser';
      const teoManual = Number(act.tiempoTeoricoManual || 0);
      const cant = Number(act.cantidad || 0);

      if (isLaser) {
        theoreticalTimeSum += (teoManual > 0 ? (60 / teoManual) : 0);
      } else {
        // En Joselito, theoreticalTimeSum se calcula como (unidades_reales / unidades_hora) * 60
        // que es igual a (60 / unidades_hora) * unidades_reales.
        // Aquí cant = Cantidad OK (act.cantidad). 
        // El usuario pide para Loncheado: Tiempo teórico = (Cantidad Ok + cantidad reprocesar) / unidades hora
        const totalUnitsForTheo = areaId === 'sb-loncheado' ? (cant + (act.cantidadNok || 0)) : cant;
        theoreticalTimeSum += (teoManual > 0 ? (60 / teoManual) : 0) * totalUnitsForTheo;
      }
    }

    if (act.tipoTarea === TaskType.SIN_TRABAJO) {
      timeS += duration;
    }

    if (act.tipoTarea === TaskType.AVERIA) {
      if (act.afectaCalidad) {
        timeA_Quality += duration;
      } else {
        timeA_NoQuality += duration;
      }
    }

    if (act.tipoTarea === TaskType.ESPERAS) {
      if (act.afectaCalidad) {
        timeE_Quality += duration;
      } else {
        timeE_NoQuality += duration;
      }
    }
  });

  let availability = 0;
  let quality = 100;
  let performance = 0;

  if (areaId === 'sb-loncheado') {
    // Disponibilidad = Tiempo trabajando (P) / (Tiempo (P) + Esperas + Averías)
    // downtimeSum ya incluye Esperas, Averías y Sin Trabajo.
    const loncheadoDowntime = timeE_Quality + timeE_NoQuality + timeA_Quality + timeA_NoQuality;
    availability = (timeP + loncheadoDowntime) > 0 ? (timeP / (timeP + loncheadoDowntime)) * 100 : 0;
    
    // Rendimiento = Tiempo teórico / tiempo real (timeP)
    performance = timeP > 0 ? (theoreticalTimeSum / timeP) * 100 : 0;
    
    // Calidad = Cantidad OK / (Cantidad ok + Cantidad reprocesada)
    quality = (totalParts + totalPartsNok) > 0 ? (totalParts / (totalParts + totalPartsNok)) * 100 : 100;
  } else if (areaId === 'sb-preparacion') {
    // PPH = nº unidades / Tiempo trabajado en horas
    // Usaremos el performance o calidad como base si es necesario, pero el usuario pide PPH.
    // Lo calcularemos al final.
    
    // OEE Estándar para Preparación si no se indica otra cosa
    let downtimeSum = timeS + timeA_NoQuality + timeA_Quality + timeE_NoQuality + timeE_Quality;
    availability = totalTime > 0 ? ((totalTime - downtimeSum) / totalTime) * 100 : 0;
    const prodTime = totalTime - downtimeSum;
    performance = prodTime > 0 ? (theoreticalTimeSum / prodTime) * 100 : 0;
    quality = (totalParts + totalPartsNok) > 0 ? (totalParts / (totalParts + totalPartsNok)) * 100 : 100;
  } else if (areaId === 'corte-laser') {
    const totalAverias = timeA_Quality + timeA_NoQuality;
    availability = (timeP + timeE_NoQuality + totalAverias) > 0 ? (timeP / (timeP + timeE_NoQuality + totalAverias)) * 100 : 0;
    quality = (totalParts + totalPartsNok) > 0 ? (totalParts / (totalParts + totalPartsNok)) * 100 : 100;
    performance = timeP > 0 ? (theoreticalTimeSum / timeP) * 100 : 0;
  } else {
    let downtimeSum = timeS + timeA_NoQuality + timeA_Quality + timeE_NoQuality + timeE_Quality;
    availability = totalTime > 0 ? ((totalTime - downtimeSum) / totalTime) * 100 : 0;
    const prodTime = totalTime - downtimeSum;
    performance = prodTime > 0 ? (theoreticalTimeSum / prodTime) * 100 : 0;
    quality = (totalParts + totalPartsNok) > 0 ? (totalParts / (totalParts + totalPartsNok)) * 100 : 100;
  }

  // Mermas Loncheado
  let merma1 = 0;
  let merma2 = 0;
  let subproducto = 0;
  if (areaId === 'sb-loncheado' && mermas.length > 0) {
    let totalKgSalida = 0;
    let sumKgMerma = 0;
    let sumKgTacos = 0;
    let sumKgPieles = 0;
    let sumKgHueco = 0;
    let sumKgEnvasados = 0;

    mermas.forEach(m => {
      sumKgMerma += (m.kgMerma || 0);
      sumKgTacos += (m.kgTacos || 0);
      sumKgPieles += (m.kgPieles || 0);
      sumKgHueco += (m.kgHueco || 0);
      sumKgEnvasados += (m.kgSalida || m.kgEnvasados || 0);
    });

    totalKgSalida = sumKgEnvasados + sumKgTacos + sumKgPieles + sumKgHueco + sumKgMerma;
    
    if (totalKgSalida > 0) {
      merma1 = (sumKgMerma / totalKgSalida) * 100;
      merma2 = ((sumKgMerma + sumKgPieles + sumKgHueco) / totalKgSalida) * 100;
      subproducto = (sumKgTacos / totalKgSalida) * 100;
    }
  }

  // PPH Preparación
  let pph = 0;
  if (areaId === 'sb-preparacion') {
    const hoursWorked = timeP / 60;
    pph = hoursWorked > 0 ? totalParts / hoursWorked : 0;
  }

  const finalAvailability = Math.min(100, availability > 0 ? availability : 0);
  const finalPerformance = Math.min(100, performance > 0 ? performance : 0);
  const finalQuality = Math.min(100, quality > 0 ? quality : 0);
  const oee = (finalAvailability * finalPerformance * finalQuality) / 10000;

  const hasData = data.length > 0;

  return {
    availability: hasData ? finalAvailability.toFixed(1) : '',
    performance: hasData ? finalPerformance.toFixed(1) : '',
    quality: hasData ? finalQuality.toFixed(1) : '',
    oee: hasData ? oee.toFixed(1) : '',
    totalParts,
    downtime: (totalTime - timeP).toFixed(0),
    merma1: merma1.toFixed(2),
    merma2: merma2.toFixed(2),
    subproducto: subproducto.toFixed(2),
    pph: pph.toFixed(1)
  };
};

const Dashboard: React.FC<DashboardProps> = ({ 
  activities, 
  history, 
  masterSpeeds, 
  incidenceMaster, 
  oeeObjectives,
  workshopName,
  selectedArea,
  mermas = []
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [aiAnalysis, setAiAnalysis] = useState<string>('Analizando datos con IA...');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Drill-down state
  const [drillDownRecords, setDrillDownRecords] = useState<{ type: 'availability' | 'performance' | 'quality', category: string } | null>(null);

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

  const handleParetoBarDoubleClick = (type: 'availability' | 'performance' | 'quality', category: string) => {
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
      return { 
        label: `S${weekNum}`, 
        total: calculateStats(data, selectedArea),
      };
    });

    // Annual Cumulative
    const currentYear = today.getFullYear();
    const prevYear = currentYear - 1;
    const currentYearData = allData.filter(a => a.fecha?.startsWith(currentYear.toString()));
    const prevYearData = allData.filter(a => a.fecha?.startsWith(prevYear.toString()));

    return {
      daily: last7Days,
      weekly: last7Weeks,
      annual: [
        { 
          label: prevYear.toString(), 
          total: calculateStats(prevYearData, selectedArea),
        },
        { 
          label: currentYear.toString(), 
          total: calculateStats(currentYearData, selectedArea),
        }
      ]
    };
  }, [allData, selectedDate, selectedArea]);

  const isTimeBased = false;

  // Merma stats por período (só Loncheado)
  const calcMermaStats = (records: any[]) => {
    if (!records || records.length === 0) return { pctMerma1: '', pctMerma2: '' };
    const valid1 = records.filter(r => r.kgEntrada > 0);
    const valid2 = records.filter(r => (r.kgMerma + r.kgTacos + r.kgPieles + r.kgHueco + r.kgSalida) > 0);
    if (valid1.length === 0) return { pctMerma1: '', pctMerma2: '' };
    const avg1 = valid1.reduce((s, r) => s + Number(r.pctMerma1 || 0), 0) / valid1.length;
    const avg2 = valid2.length > 0 ? valid2.reduce((s, r) => s + Number(r.pctMerma2 || 0), 0) / valid2.length : 0;
    return { pctMerma1: avg1.toFixed(1), pctMerma2: avg2.toFixed(1) };
  };

  const mermaScorecard = useMemo(() => {
    if (selectedArea !== 'sb-loncheado') return null;
    const today = new Date(selectedDate);

    const daily = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today); d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split('T')[0];
      return { label: dateStr, total: calcMermaStats(mermas.filter(m => m.fecha === dateStr)) };
    });

    const weekly = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today); d.setDate(d.getDate() - (6 - i) * 7);
      const w = getWeekNumber(d); const yr = d.getFullYear();
      return { label: `S${w}`, total: calcMermaStats(mermas.filter(m => { if (!m.fecha) return false; const md = new Date(m.fecha); return getWeekNumber(md) === w && md.getFullYear() === yr; })) };
    });

    const currentYear = today.getFullYear(); const prevYear = currentYear - 1;
    const annual = [
      { label: prevYear.toString(), total: calcMermaStats(mermas.filter(m => m.fecha?.startsWith(prevYear.toString()))) },
      { label: currentYear.toString(), total: calcMermaStats(mermas.filter(m => m.fecha?.startsWith(currentYear.toString()))) },
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
        const isLaser = act.area === 'corte-laser' || selectedArea === 'corte-laser';
        const teo = act.tiempoTeoricoManual || 0;
        const theoreticalTotal = isLaser 
          ? (teo > 0 ? (60 / teo) : 0) 
          : (teo > 0 ? (60 / teo) : 0) * (act.cantidad || 0);
        const loss = (act.duracionMin || 0) - theoreticalTotal;
        if (loss > 0) {
          performanceLoss[act.formato] = (performanceLoss[act.formato] || 0) + loss;
        }
        
        // Quality loss from NOK pieces
        if ((act.cantidadNok || 0) > 0) {
          const nokLoss = (teo > 0 ? (60 / teo) : 0) * (act.cantidadNok || 0);
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
      - Disponibilidad: ${stats.availability}% (Objetivo: ${oeeObjectives.disponibilidad}%)
      - Rendimiento: ${stats.performance}% (Objetivo: ${oeeObjectives.rendimiento}%)
      - Calidad: ${stats.quality}% (Objetivo: ${oeeObjectives.calidad}%)
      - OEE Global: ${stats.oee}% (Objetivo: ${oeeObjectives.productividad}%)
      
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
    const indicators = [
      { id: 'availability', objKey: 'disponibilidad', label: 'DISPONIBILIDAD (%)' },
      { id: 'performance', objKey: 'rendimiento', label: 'RENDIMIENTO (%)' },
      { id: 'quality', objKey: 'calidad', label: 'CALIDAD (%)' }
    ];

    if (selectedArea === 'sb-loncheado') {
      indicators.push(
        { id: 'merma1', objKey: 'merma1', label: 'MERMA 1 (%)' },
        { id: 'merma2', objKey: 'merma2', label: 'MERMA 2 (%)' },
        { id: 'subproducto', objKey: 'subproducto', label: 'SUBPRODUCTO (%)' }
      );
    }
    if (selectedArea === 'sb-preparacion') {
      indicators.unshift({ id: 'pph', objKey: 'pph', label: 'PPH' });
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
              const objValue = (oeeObjectives as any)[indicator.objKey || ''] || 0;
              const isLowerBetter = indicator.id.startsWith('merma') || indicator.id === 'subproducto';
              const isPPH = indicator.id === 'pph';

              return (
                <tr key={indicator.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="p-2 font-bold border border-slate-100 bg-slate-50/30 text-slate-700 uppercase text-[11px]">
                    {indicator.label}
                  </td>
                  <td className="p-2 text-center font-black border border-slate-200 text-blue-600 bg-blue-50/20">
                    {objValue !== 0 ? (isPPH ? objValue : `${objValue}%`) : '—'}
                  </td>
                  {data.map(d => {
                    const rawVal = d.total[indicator.id];
                    const val = rawVal === '' ? null : Number(rawVal);
                    
                    let cellStyle = 'text-slate-300';
                    if (val !== null) {
                      const isGood = isLowerBetter ? val <= objValue : val >= objValue;
                      cellStyle = isGood ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold';
                    }

                    return (
                      <td 
                        key={d.label} 
                        className={`p-2 text-center text-[12px] border border-slate-100 ${cellStyle}`}
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

  return (
    <div className="flex flex-col gap-1 animate-in fade-in duration-500 h-full">
      {/* Date Selector */}
      <div className="flex flex-row items-center justify-between gap-1 bg-white p-1 rounded-lg border border-slate-100 shadow-sm shrink-0">
        <div>
          <h2 className="text-[14px] sm:text-xs font-black text-slate-900 tracking-tighter uppercase leading-tight">CMI {workshopName && `- ${workshopName}`}</h2>
        </div>
        <div className="flex items-center gap-1">
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)}
            className="p-0.5 bg-slate-50 border border-slate-100 rounded-md font-black text-[14px] text-blue-600 outline-none"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-1 shrink-0">
        <div className="bg-white p-1 rounded-lg border border-slate-100 shadow-sm flex items-center gap-1.5 px-2">
          <span className="text-[9px] sm:text-[15px] font-black text-slate-400 uppercase tracking-tighter">Dispo</span>
          <span className="text-[14px] sm:text-xs font-black text-slate-900 tracking-tighter">{stats.availability}{stats.availability !== '' ? '%' : ''}</span>
        </div>
        <div className="bg-white p-1 rounded-lg border border-slate-100 shadow-sm flex items-center gap-1.5 px-2">
          <span className="text-[9px] sm:text-[15px] font-black text-slate-400 uppercase tracking-tighter">Rend</span>
          <span className="text-[14px] sm:text-xs font-black text-slate-900 tracking-tighter">{stats.performance}{stats.performance !== '' ? '%' : ''}</span>
        </div>
        <div className="bg-white p-1 rounded-lg border border-slate-100 shadow-sm flex items-center gap-1.5 px-2">
          <span className="text-[9px] sm:text-[15px] font-black text-slate-400 uppercase tracking-tighter">Calid</span>
          <span className="text-[14px] sm:text-xs font-black text-slate-900 tracking-tighter">{stats.quality}{stats.quality !== '' ? '%' : ''}</span>
        </div>
        <div className="bg-slate-900 p-1 rounded-lg border border-slate-800 shadow-md flex items-center gap-1.5 px-2">
          <span className="text-[9px] sm:text-[15px] font-black text-slate-400 uppercase tracking-tighter">Prod</span>
          <span className="text-[14px] sm:text-xs font-black text-white tracking-tighter">{stats.oee}{stats.oee !== '' ? '%' : ''}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-2 no-scrollbar pb-24">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            { label: 'Disponibilidad', val: stats.availability, obj: oeeObjectives.disponibilidad, color: 'blue', key: 'availability' },
            { label: 'Rendimiento', val: stats.performance, obj: oeeObjectives.rendimiento, color: 'emerald', key: 'performance' },
            { label: 'Calidad', val: stats.quality, obj: oeeObjectives.calidad, color: 'amber', key: 'quality' },
            { label: 'OEE Global', val: stats.oee, obj: oeeObjectives.productividad, color: 'slate', isGlobal: true, key: 'oee' }
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
        </div>
      </div>

      {/* Scorecard Section */}
      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl space-y-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black">M</div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">CUADRO DE MANDO</h3>
        </div>
        
        <div className="space-y-8">
          <section>
            <h4 className="text-[14px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Últimos 7 Días (Diario)</h4>
            {renderScorecardTable('Fecha', scorecardData.daily)}
          </section>
          
          <section>
            <h4 className="text-[14px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Últimas 7 Semanas</h4>
            {renderScorecardTable('Semana', scorecardData.weekly)}
          </section>

          <section>
            <h4 className="text-[14px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Acumulado Anual</h4>
            {renderScorecardTable('Año', scorecardData.annual)}
          </section>
        </div>
      </div>

      {/* Pareto Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[
          { title: 'Pareto de Esperas', data: paretos.esperas, type: 'availability' as const, unit: 'min' },
          { title: 'Pérdida Rendimiento', data: paretos.performance, type: 'performance' as const, unit: 'min' },
          { title: 'Pérdida Calidad', data: paretos.quality, type: 'quality' as const, unit: isTimeBased ? 'min' : 'uds' }
        ].map(pareto => (
          <div key={pareto.title} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-lg">
            <h3 className="text-slate-900 text-[15px] font-black uppercase tracking-widest mb-6 px-2">{pareto.title}</h3>
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
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
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
                    {drillDownRecords.type === 'performance' && (
                      <>
                        <th className="p-2 text-center border border-slate-200">T. Teo (min)</th>
                        <th className="p-2 text-center border border-slate-200">T. Real (min)</th>
                        <th className="p-2 text-center border border-slate-200">Pérdida (min)</th>
                      </>
                    )}
                    {drillDownRecords.type === 'quality' && <th className="p-2 text-center border border-slate-200">Reprocesado</th>}
                    <th className="p-2 text-left border border-slate-200">Comentario</th>
                  </tr>
                </thead>
                <tbody>
                  {dayData.filter(a => {
                    if (drillDownRecords.type === 'availability') {
                      return (a.tipoTarea === TaskType.ESPERAS || a.tipoTarea === TaskType.AVERIA) && a.formato === drillDownRecords.category;
                    }
                    if (drillDownRecords.type === 'performance') {
                      return a.tipoTarea === TaskType.PRODUCCION && a.formato === drillDownRecords.category;
                    }
                    return false;
                  }).length === 0 && (
                    <tr>
                      <td colSpan={drillDownRecords.type === 'performance' ? 9 : 6} className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest">No se encontraron registros detallados</td>
                    </tr>
                  )}
                  {dayData.filter(a => {
                    if (drillDownRecords.type === 'availability') {
                      return (a.tipoTarea === TaskType.ESPERAS || a.tipoTarea === TaskType.AVERIA) && a.formato === drillDownRecords.category;
                    }
                    if (drillDownRecords.type === 'performance') {
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
                        {drillDownRecords.type === 'performance' && (
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
