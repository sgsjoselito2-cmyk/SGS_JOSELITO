import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell as RechartsCell, ComposedChart, Line, Legend
} from 'recharts';
import Markdown from 'react-markdown';
import { GoogleGenAI } from "@google/genai";
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import { Activity, MasterSpeed, IncidenceMaster, OEEObjectives, TaskType, User, ActionPlanItem } from '../types';
import { AREA_NAMES, JOSELITO_LOGO } from '../constants';
import { calculateStats, getWeekNumber } from './Dashboard';
import { generateContentWithRetry } from '../src/utils/aiUtils';
import HelpModal from './HelpModal';
import { X } from 'lucide-react';

interface TOP15IndicatorsProps {
  activities: Activity[];
  history: Activity[];
  masterSpeeds: MasterSpeed[];
  incidenceMaster: IncidenceMaster[];
  allObjectives: Record<string, OEEObjectives[]>;
  mermas?: any[];
}

const TALLERES = [
  { id: 'sala-blanca', name: 'SALA BLANCA', taller: 'Producción' },
  { id: 'movimiento-jamones', name: 'MOVIMIENTO JAMONES', taller: 'Producción' },
  { id: 'sb-preparacion', name: 'PREPARACIÓN SB', taller: 'Sala Blanca' },
  { id: 'sb-loncheado', name: 'LONCHEADO SB', taller: 'Sala Blanca' },
  { id: 'sb-empaquetado-loncheado', name: 'EMP. LONCHEADO SB', taller: 'Sala Blanca' },
  { id: 'sb-empaquetado-deshuesado', name: 'EMP. DESHUESADO SB', taller: 'Sala Blanca' },
  { id: 'env-envasado', name: 'ENVASADO', taller: 'Envasado' },
  { id: 'env-empaquetado', name: 'EMPAQUETADO ENV', taller: 'Envasado' },
  { id: 'expedicion', name: 'EXPEDICIONES', taller: 'Expediciones' },
  { id: 'preparacion-exp', name: 'PREPARACIÓN EXP', taller: 'Expediciones' },
  { id: 'movimiento-jamones-log', name: 'MOVIMIENTOS', taller: 'Movimientos' },
  { id: 'preparacion', name: 'PREPARACIÓN', taller: 'Logística' },
  { id: 'expedicion-log', name: 'EXPEDICIÓN', taller: 'Logística' }
];

const TALLER_BG_COLORS: Record<string, string> = {
  'Producción': 'bg-blue-50/30',
  'Logística': 'bg-emerald-50/30'
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const isTimeBased = (wsId: string) => {
  return true; // All Joselito workshops are time-based for now
};

const TALLER_INDICATORS: Record<string, {id: string, name: string}[]> = {
  'sb-loncheado': [
    { id: 'availability', name: 'Disponibilidad' },
    { id: 'performance', name: 'Rendimiento' },
    { id: 'quality', name: 'Calidad' },
    { id: 'oee', name: 'OEE' },
    { id: 'merma1', name: 'Merma (desaparecido)' },
    { id: 'merma2', name: 'Merma 2' },
    { id: 'subproducto', name: 'Subproducto' }
  ],
  'sb-preparacion': [
    { id: 'pph', name: 'PPH' },
    { id: 'availability', name: 'Disponibilidad' },
    { id: 'performance', name: 'Rendimiento' },
    { id: 'quality', name: 'Calidad' },
    { id: 'oee', name: 'OEE' }
  ],
  'default': [
    { id: 'availability', name: 'Disponibilidad' },
    { id: 'performance', name: 'Rendimiento' },
    { id: 'quality', name: 'Calidad' },
    { id: 'oee', name: 'OEE' }
  ]
};

const TOP15Indicators: React.FC<TOP15IndicatorsProps> = ({ 
  activities, 
  history, 
  allObjectives,
  mermas = []
}) => {
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return yesterday.toISOString().split('T')[0];
  });
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const lastAnalyzedDataRef = useRef<string>('');
  const [selectedWorkshopPareto, setSelectedWorkshopPareto] = useState(TALLERES[0].id);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Drill-down state
  const [drillDownPareto, setDrillDownPareto] = useState<{ workshopId: string, date: string } | null>(null);
  const [drillDownRecords, setDrillDownRecords] = useState<{ workshopId: string, date: string, type: 'availability' | 'performance' | 'quality', category: string } | null>(null);

  const allData = useMemo(() => [...history, ...activities], [history, activities]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (drillDownRecords) {
          setDrillDownRecords(null);
        } else if (drillDownPareto) {
          setDrillDownPareto(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drillDownPareto, drillDownRecords]);

  const handleIndicatorDoubleClick = (workshopId: string, date: string) => {
    setDrillDownPareto({ workshopId, date });
  };

  const handleParetoBarDoubleClick = (workshopId: string, date: string, type: 'availability' | 'performance' | 'quality', category: string) => {
    setDrillDownRecords({ workshopId, date, type, category });
  };

  // Helper to get objective for a workshop and indicator
  const getWorkshopObjective = (wsId: string, indicatorId: string, dateStr?: string) => {
    const objs = allObjectives[wsId] || [];
    const targetDate = dateStr || selectedDate;
    const found = objs.find(o => o.validFrom <= targetDate && (o.indicatorId === indicatorId || (!o.indicatorId && indicatorId === 'oee')));
    if (found) {
      if (indicatorId === 'availability') return found.disponibilidad;
      if (indicatorId === 'performance') return found.rendimiento;
      if (indicatorId === 'quality') return found.calidad;
      if (indicatorId === 'oee') return parseFloat(((found.disponibilidad * found.rendimiento * found.calidad) / 10000).toFixed(1));
      return found.objetivo;
    }
    // Fallbacks
    if (indicatorId === 'availability' || indicatorId === 'performance' || indicatorId === 'quality') return 85;
    if (indicatorId === 'oee') return 62;
    if (indicatorId === 'merma1' || indicatorId === 'merma2') return 3;
    if (indicatorId === 'subproducto') return 5;
    return 0;
  };

  const handlePrintA3 = async () => {
    if (isPrinting) return;
    
    const element = document.getElementById('top15-full-report');
    if (!element) {
      console.error('Report container not found');
      alert('Error: No se encontró el contenedor del reporte');
      return;
    }

    setIsPrinting(true);
    console.log('Starting TOP 15 PDF generation...');
    
    // Temporarily show the hidden report for capturing
    const originalStyle = {
      position: element.style.position,
      left: element.style.left,
      top: element.style.top,
      opacity: element.style.opacity,
      visibility: element.style.visibility,
      zIndex: element.style.zIndex,
      pointerEvents: element.style.pointerEvents,
      width: element.style.width,
      display: element.style.display
    };

    element.style.position = 'absolute';
    element.style.top = '0';
    element.style.left = '0';
    element.style.width = '1600px';
    element.style.opacity = '1';
    element.style.visibility = 'visible';
    element.style.pointerEvents = 'none';
    element.style.zIndex = '-1';
    element.style.display = 'block';

    // Give time for the hidden report to render charts and apply styles
    setTimeout(async () => {
      try {
        console.log('Capturing element with html-to-image...');
        
        // Ensure images are loaded
        const images = element.getElementsByTagName('img');
        console.log(`Found ${images.length} images to load`);
        await Promise.all(Array.from(images).map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(resolve => { 
            img.onload = resolve; 
            img.onerror = resolve; 
            setTimeout(resolve, 3000);
          });
        }));

        // Use toPng with robust options
        const capturePromise = toPng(element, {
          backgroundColor: '#ffffff',
          width: 1600,
          cacheBust: true,
          skipFonts: true,
          style: {
            visibility: 'visible',
            display: 'block',
            margin: '0'
          }
        });

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('La captura de imagen ha tardado demasiado (timeout)')), 30000)
        );

        const imgData = await Promise.race([capturePromise, timeoutPromise]) as string;

        console.log('Capture successful, creating PDF...');

        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a3'
        });
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        const imgWidth = pdfWidth - 20; 
        const imgHeight = (element.offsetHeight * imgWidth) / element.offsetWidth;
        
        let yPos = 10;
        if (imgHeight < (pdfHeight - 20)) {
          yPos = (pdfHeight - imgHeight) / 2;
        }

        pdf.addImage(imgData, 'PNG', 10, yPos, imgWidth, imgHeight);
        pdf.save(`TOP15_Joselito_${selectedDate}.pdf`);
        console.log('PDF saved successfully');

      } catch (error: any) {
        console.error('Detailed PDF Error:', error);
        alert(`Error al generar el PDF: ${error.message || 'Error desconocido'}. Si el problema persiste, intente recargar la página.`);
      } finally {
        // Restore original styles
        element.style.position = originalStyle.position;
        element.style.left = originalStyle.left;
        element.style.top = originalStyle.top;
        element.style.opacity = originalStyle.opacity;
        element.style.visibility = originalStyle.visibility;
        element.style.zIndex = originalStyle.zIndex;
        element.style.pointerEvents = originalStyle.pointerEvents;
        element.style.width = originalStyle.width;
        element.style.display = originalStyle.display;
        
        setIsPrinting(false);
      }
    }, 3000);
  };

  // Generate last 7 days
  const last7Days = useMemo(() => {
    const today = new Date(selectedDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });
  }, [selectedDate]);

  // Generate last 7 weeks
  const last7Weeks = useMemo(() => {
    const today = new Date(selectedDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i) * 7);
      return { week: getWeekNumber(d), year: d.getFullYear() };
    });
  }, [selectedDate]);

  // Calculate stats for each workshop and each day
  const dailyStats = useMemo(() => {
    const rows: any[] = [];
    TALLERES.forEach(ws => {
      const indicators = TALLER_INDICATORS[ws.id] || TALLER_INDICATORS.default;
      const dayDataMap = last7Days.map(date => {
        const data = allData.filter(a => a.area === ws.id && a.fecha && a.fecha === date);
        const dayMermas = mermas.filter(m => m.fecha === date && m.area === ws.id);
        return data.length === 0 ? null : calculateStats(data, ws.id, dayMermas);
      });

      indicators.forEach(ind => {
        const values = dayDataMap.map(stats => {
          if (!stats) return null;
          return stats[ind.id as keyof typeof stats];
        });
        rows.push({
          id: ws.id,
          taller: ws.taller,
          workshopName: ws.name,
          indicatorName: ind.name,
          indicatorId: ind.id,
          values
        });
      });
    });
    return rows;
  }, [allData, last7Days, mermas]);

  // Calculate stats for each workshop and each week
  const weeklyStats = useMemo(() => {
    const rows: any[] = [];
    TALLERES.forEach(ws => {
      const indicators = TALLER_INDICATORS[ws.id] || TALLER_INDICATORS.default;
      
      const weekDataMap = last7Weeks.map(w => {
        const data = allData.filter(a => {
          if (a.area !== ws.id || !a.fecha) return false;
          const ad = new Date(a.fecha);
          return getWeekNumber(ad) === w.week && ad.getFullYear() === w.year;
        });
        const weekMermas = mermas.filter(m => {
          if (!m.fecha || m.area !== ws.id) return false;
          const md = new Date(m.fecha);
          return getWeekNumber(md) === w.week && md.getFullYear() === w.year;
        });

        const date = new Date(w.year, 0, 1);
        date.setDate(date.getDate() + (w.week - 1) * 7);
        const objs = allObjectives[ws.id] || [];
        const found = objs.find(o => o.validFrom <= date.toISOString().split('T')[0]) || { productividad: 62 };
        const objective = Math.round(found.productividad);

        if (data.length === 0) return { stats: null, objective };
        return { stats: calculateStats(data, ws.id, weekMermas), objective };
      });

      indicators.forEach(ind => {
        const values = weekDataMap.map(wData => {
          if (!wData.stats) return null;
          return wData.stats[ind.id as keyof typeof wData.stats];
        });
        rows.push({
          id: ws.id,
          taller: ws.taller,
          workshopName: ws.name,
          indicatorName: ind.name,
          indicatorId: ind.id,
          objective: weekDataMap[weekDataMap.length - 1].objective,
          values
        });
      });
    });
    return rows;
  }, [allData, last7Weeks, allObjectives, mermas]);

  // Calculate workshop-level data for charts (one row per workshop, containing all metrics)
  const workshopWeeklyData = useMemo(() => {
    return TALLERES.map(ws => {
      const data = last7Weeks.map(w => {
        const weekActivities = allData.filter(a => {
          if (a.area !== ws.id || !a.fecha) return false;
          const ad = new Date(a.fecha);
          return getWeekNumber(ad) === w.week && ad.getFullYear() === w.year;
        });
        const weekMermas = mermas.filter(m => {
          if (!m.fecha || m.area !== ws.id) return false;
          const md = new Date(m.fecha);
          return getWeekNumber(md) === w.week && md.getFullYear() === w.year;
        });

        const date = new Date(w.year, 0, 1);
        date.setDate(date.getDate() + (w.week - 1) * 7);
        const objs = allObjectives[ws.id] || [];
        const found = objs.find(o => o.validFrom <= date.toISOString().split('T')[0]) || { productividad: 62 };
        const objective = Math.round(found.productividad);

        if (weekActivities.length === 0) return { name: `S${w.week}`, Disp: 0, Rto: 0, Prod: 0, Obj: objective };
        
        const stats = calculateStats(weekActivities, ws.id, weekMermas);
        return { 
          name: `S${w.week}`, 
          Disp: stats.availability || 0, 
          Rto: stats.performance || 0, 
          Prod: stats.oee || 0, 
          Obj: objective 
        };
      });
      return { id: ws.id, name: ws.name, values: data };
    });
  }, [allData, last7Weeks, allObjectives, mermas]);

  // Pareto data for selected workshop
  const paretos = useMemo(() => {
    const wsData = allData.filter(a => a.area === selectedWorkshopPareto && a.fecha === selectedDate);
    const esperas: Record<string, number> = {};
    const performanceLoss: Record<string, number> = {};
    const qualityLoss: Record<string, number> = {};
    const timeBased = selectedWorkshopPareto ? isTimeBased(selectedWorkshopPareto) : false;

    wsData.forEach(act => {
      if (act.tipoTarea === TaskType.ESPERAS || act.tipoTarea === TaskType.AVERIA) {
        esperas[act.formato] = (esperas[act.formato] || 0) + (act.duracionMin || 0);
      }
      if (act.tipoTarea === TaskType.PRODUCCION) {
        const theoreticalTotal = (act.tiempoTeoricoManual || 0) * (act.cantidad || 0);
        const loss = (act.duracionMin || 0) - theoreticalTotal;
        if (loss > 0) {
          performanceLoss[act.formato] = (performanceLoss[act.formato] || 0) + loss;
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
      performance: formatPareto(performanceLoss)
    };
  }, [allData, selectedWorkshopPareto, selectedDate]);

  // AI Analysis
  const runAnalysis = useCallback(async (force = false) => {
    const hasAnyData = dailyStats.some(s => s.values.some(v => v !== null)) || 
                       weeklyStats.some(s => s.values.some(v => v !== null));
    
    if (!hasAnyData) {
      setAiAnalysis('No hay datos suficientes para realizar un análisis de IA en este periodo.');
      return;
    }

    const dataFingerprint = JSON.stringify({ selectedDate, dailyStats, weeklyStats });
    if (!force && dataFingerprint === lastAnalyzedDataRef.current) return;

    setIsAnalyzing(true);
    setAiAnalysis('Analizando indicadores con IA...');
    
    try {
      const prompt = `
        Actúa como un experto en Lean Manufacturing. Analiza los indicadores de productividad de la planta para la fecha ${selectedDate}.
        
        DATOS DIARIOS (Últimos 7 días):
        ${JSON.stringify(dailyStats.map(s => ({ taller: s.name, indicadores: s.rows.map((row: any) => ({ nombre: row.indicatorName, objetivo: getWorkshopObjective(row.id, row.indicatorId) })) })), null, 2)}
        
        DATOS SEMANALES (Últimas 7 semanas):
        ${JSON.stringify(weeklyStats.map(s => ({ taller: s.name, indicadores: s.rows.map((row: any) => ({ nombre: row.indicatorName, objetivo: getWorkshopObjective(row.id, row.indicatorId) })) })), null, 2)}
        
        Proporciona un análisis ejecutivo breve (máximo 3 párrafos) en formato Markdown. 
        Identifica tendencias preocupantes y sugiere acciones prioritarias para los mandos intermedios.
      `;

      const response = await generateContentWithRetry({
        model: "gemini-2.0-flash",
        contents: prompt,
      });
      
      const text = response.text || 'No se pudo generar el análisis.';
      setAiAnalysis(text);
      lastAnalyzedDataRef.current = dataFingerprint;
    } catch (error) {
      console.error('AI Error:', error);
      setAiAnalysis('Error al conectar con el servicio de IA. Por favor, intente de nuevo más tarde.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedDate, dailyStats, weeklyStats, allObjectives]);

  // A análise NÃO é automática — só corre quando o utilizador carrega no botão
  useEffect(() => {
    setAiAnalysis('Pulsa el botón para analizar los indicadores con IA.');
  }, [selectedDate]);

  const renderTable = (title: string, columns: string[], stats: any[]) => (
    <div className={`bg-white ${isPrinting ? 'p-1' : 'p-2'} rounded-xl border border-slate-100 shadow-sm overflow-hidden shrink-0`}>
      <h3 className={`${isPrinting ? 'text-[11px]' : 'text-[13px]'} font-black text-slate-900 uppercase tracking-tighter mb-1 px-1`}>{title}</h3>
      <div className="overflow-x-auto no-scrollbar max-h-[500px] overflow-y-auto">
        <table className={`w-full ${isPrinting ? 'text-[8px]' : 'text-[10px]'} border-collapse`}>
          <thead className="sticky top-0 z-30">
            <tr className="bg-slate-900 text-white font-black text-[10px] uppercase tracking-wider">
              <th className={`p-1 text-left border border-slate-700 ${isPrinting ? 'w-24' : 'w-28'}`}>Taller</th>
              <th className={`p-1 text-left border border-slate-700 ${isPrinting ? 'w-24' : 'w-48'}`}>Indicador</th>
              <th className="p-1 text-center border border-slate-700 w-10">Obj</th>
              {columns.map(col => <th key={col} className="p-1 text-center border border-slate-700 min-w-[35px] text-[12px]">{col}</th>)}
            </tr>
          </thead>
          <tbody>
            {stats.map((row, idx) => {
              const objective = getWorkshopObjective(row.id, row.indicatorId);
              const bgColor = TALLER_BG_COLORS[row.taller] || 'bg-white';
              
              // Calculate rowspan for Taller
              const tallerRows = stats.filter(r => r.id === row.id);
              const isFirstOfWorkshop = idx === 0 || stats[idx - 1].id !== row.id;
              
              return (
                <tr key={`${row.id}-${row.indicatorId}`} className={`${bgColor} hover:bg-white transition-colors`}>
                  {isFirstOfWorkshop && (
                    <td 
                      rowSpan={tallerRows.length}
                      className="p-1 font-black border border-slate-200 bg-slate-50/50"
                      style={{ verticalAlign: 'top' }}
                    >
                      <div className="flex flex-col leading-tight">
                        <span className={`uppercase text-slate-400 font-bold ${isPrinting ? 'text-[7px]' : 'text-[9px]'}`}>{row.taller}</span>
                        <span className="text-slate-800 text-[12px]">{row.workshopName}</span>
                      </div>
                    </td>
                  )}
                  <td className="p-1 font-bold border border-slate-200 uppercase text-slate-600 bg-white italic">
                    {row.indicatorName}
                  </td>
                  <td className="p-1 text-center font-black border border-slate-200 text-blue-600 bg-blue-50/30">
                    {objective !== 0 ? (row.indicatorId === 'pph' ? objective : `${objective}%`) : '—'}
                  </td>
                  {row.values.map((val: any, i: number) => {
                    const isKPI = (row.indicatorId === 'oee' || row.indicatorId === 'availability' || row.indicatorId === 'performance' || row.indicatorId === 'quality');
                    const numVal = parseFloat(val);
                    
                    const colObj = getWorkshopObjective(row.id, row.indicatorId, title.includes('Diario') ? last7Days[i] : undefined);
                    
                    let isGood = false;
                    if (row.indicatorId.startsWith('merma') || row.indicatorId === 'subproducto') {
                      isGood = !isNaN(numVal) && numVal <= colObj;
                    } else {
                      isGood = !isNaN(numVal) && numVal >= colObj;
                    }

                    const isEmpty = val === null || val === undefined || val === '';
                    const date = title.includes('Diario') ? last7Days[i] : null;
                    
                    return (
                      <td 
                        key={i} 
                        onDoubleClick={() => date && isKPI && handleIndicatorDoubleClick(row.id, date)}
                        className={`p-1 text-center font-bold border border-slate-200 select-none ${isEmpty ? 'text-slate-300' : (isGood ? 'text-emerald-600 bg-emerald-50/30' : 'text-red-500 bg-red-50/30')}`}
                        title={date && isKPI ? "Doble clic para ver Pareto" : ""}
                      >
                        {isEmpty ? '-' : (row.indicatorId === 'pph' ? val : `${val}%`)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div id="top15-indicators-content" className="flex flex-col gap-2 animate-in fade-in duration-500 h-full">
      <HelpModal 
        isOpen={isHelpModalOpen} 
        onClose={() => setIsHelpModalOpen(false)} 
        areaId="TOP 15" 
      />
      
      {/* Header & Controls */}
      <div className="flex flex-row items-center justify-between gap-2 bg-white p-2 rounded-xl border border-slate-100 shadow-sm relative shrink-0">
        <button 
          onClick={() => setIsHelpModalOpen(true)}
          className="absolute -top-1 -right-1 z-20 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-all active:scale-90 border-2 border-white"
          title="Ayuda"
        >
          <span className="text-[14px] font-black">?</span>
        </button>
        <div className="flex items-center gap-1.5">
          {JOSELITO_LOGO ? (
            <img 
              src={JOSELITO_LOGO} 
              alt="JOSELITO" 
              className="h-8 w-auto object-contain mr-1"
              referrerPolicy="no-referrer"
            />
          ) : null}
          <div className="w-6 h-6 bg-emerald-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-emerald-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          </div>
          <div className="flex flex-col">
            <h2 className="text-[14px] font-black text-slate-900 tracking-tighter uppercase leading-tight">Indicadores TOP 15</h2>
            <button 
              onClick={handlePrintA3}
              disabled={isPrinting}
              className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1 hover:text-emerald-700 transition-all active:scale-95 disabled:opacity-50"
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 00-2-2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
              {isPrinting ? 'Generando...' : 'Imprimir A3'}
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5">
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)}
            className="p-1 bg-slate-50 border border-slate-100 rounded-lg font-black text-[13px] text-emerald-600 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-2 no-scrollbar">
        {/* Tables */}
        {renderTable('Rendimiento Diario (%)', last7Days.map(d => d.split('-').slice(1).reverse().join('/')), dailyStats)}
        {renderTable('Rendimiento Semanal (%)', last7Weeks.map(w => `S${w.week}`), weeklyStats)}

        {/* Weekly Workshop Charts */}
        <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
          <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-tighter mb-2">Evolución Semanal por Taller (Últimas 7 Semanas)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {workshopWeeklyData.map(ww => (
              <div key={ww.id} className="bg-slate-50/50 p-2 rounded-xl border border-slate-100 flex flex-col h-[240px]">
                <h4 className="text-[15px] font-black text-slate-700 uppercase mb-1 text-center">{ww.name}</h4>
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%" minHeight={180} debounce={100}>
                    <ComposedChart data={ww.values} margin={{ top: 5, right: 5, bottom: 5, left: -25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 6, fontWeight: 700}} />
                      <YAxis tick={{fontSize: 6, fontWeight: 700}} axisLine={false} tickLine={false} domain={[0, 100]} />
                      <Tooltip contentStyle={{fontSize: '7px', fontWeight: 'bold', borderRadius: '8px'}} />
                      <Legend wrapperStyle={{fontSize: '6px', fontWeight: 'bold'}} />
                      <Bar dataKey="Disp" name="DIS" fill="#3b82f6" radius={[1, 1, 0, 0]} />
                      <Bar dataKey="Rto" name="RTO" fill="#f97316" radius={[1, 1, 0, 0]} />
                      <Line type="monotone" dataKey="Prod" name="PROD" stroke="#eab308" strokeWidth={2} dot={{r: 2}} />
                      <Line type="step" dataKey="Obj" name="OBJ" stroke="#ef4444" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pareto Section */}
        <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex flex-row items-center justify-between gap-2 mb-2">
            <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-tighter">PARETO PÉRDIDAS</h3>
            {!isPrinting && (
              <select 
                value={selectedWorkshopPareto} 
                onChange={(e) => setSelectedWorkshopPareto(e.target.value)}
                className="p-1 bg-slate-50 border border-slate-100 rounded-lg font-black text-[10px] text-blue-600 outline-none uppercase"
              >
                {TALLERES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              { [
                { title: 'Esperas y Averías', data: paretos.esperas, type: 'availability' as const, unit: 'min' },
                { title: 'Pérdida Rendimiento', data: paretos.performance, type: 'performance' as const, unit: 'min' }
              ].map(pareto => (
                <div key={pareto.title} className="space-y-1">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{pareto.title}</h4>
                  <div className="h-32 w-full relative">
                    {pareto.data.length > 0 ? (
                      <div className="absolute inset-0">
                        <ResponsiveContainer width="100%" height="100%" minHeight={128} debounce={100}>
                          <BarChart data={pareto.data} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" tick={{fontSize: 5, fontWeight: 700}} width={50} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{fontSize: '7px'}} />
                            <Bar 
                              dataKey="value" 
                              fill="#3b82f6" 
                              radius={[0, 2, 2, 0]}
                              onDoubleClick={(data) => handleParetoBarDoubleClick(selectedWorkshopPareto!, selectedDate, pareto.type, data.name)}
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
                      <div className="h-full flex items-center justify-center text-[10px] font-bold text-slate-300 uppercase tracking-widest border border-dashed border-slate-100 rounded-xl">Sin datos</div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* AI Analysis */}
        {!isPrinting && (
          <div className="bg-emerald-900 p-3 rounded-xl text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-white/20 backdrop-blur-xl rounded-lg flex items-center justify-center">
                    <svg className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-tighter">Análisis Táctico IA</h3>
                  </div>
                </div>
                <button 
                  onClick={() => runAnalysis(true)}
                  disabled={isAnalyzing}
                  className="text-[10px] font-bold bg-white/10 hover:bg-white/20 px-2 py-1 rounded-md transition-colors disabled:opacity-50"
                >
                  {isAnalyzing ? 'ANALIZANDO...' : 'REGENERAR'}
                </button>
              </div>
              <div className="prose prose-invert max-w-none text-emerald-50/90 text-[14px] leading-relaxed font-medium">
                {aiAnalysis ? <Markdown>{aiAnalysis}</Markdown> : <div className="animate-pulse h-12 bg-white/5 rounded-lg" />}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pareto Modals */}
      {drillDownPareto && (
        <ParetoModal 
          workshopId={drillDownPareto.workshopId}
          date={drillDownPareto.date}
          allData={allData}
          onClose={() => setDrillDownPareto(null)}
          onBarDoubleClick={(type, category) => handleParetoBarDoubleClick(drillDownPareto.workshopId, drillDownPareto.date, type, category)}
        />
      )}

      {drillDownRecords && (
        <RecordsModal 
          workshopId={drillDownRecords.workshopId}
          date={drillDownRecords.date}
          type={drillDownRecords.type}
          category={drillDownRecords.category}
          allData={allData}
          onClose={() => setDrillDownRecords(null)}
        />
      )}

      {/* HIDDEN FULL REPORT CONTAINER FOR A3 LANDSCAPE */}
      <div id="top15-full-report" style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '1600px', padding: '40px', backgroundColor: 'white', pointerEvents: 'none' }}>
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between border-b-4 border-slate-900 pb-6">
            <div className="flex items-center gap-6">
              {JOSELITO_LOGO ? (
                <div className="relative">
                  <img 
                    src={JOSELITO_LOGO} 
                    alt="JOSELITO" 
                    className="h-20 w-auto" 
                    referrerPolicy="no-referrer" 
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback');
                      if (fallback) (fallback as HTMLElement).style.display = 'block';
                    }}
                  />
                  <h1 className="logo-fallback text-4xl font-serif font-black text-slate-900 tracking-tight uppercase hidden">JOSELITO</h1>
                </div>
              ) : (
                <h1 className="text-4xl font-serif font-black text-slate-900 tracking-tight uppercase">JOSELITO</h1>
              )}
              <div>
                <h1 className="text-5xl font-black uppercase tracking-tighter text-slate-900">Indicadores TOP 15</h1>
                <p className="text-2xl font-bold text-slate-500 uppercase tracking-widest">Semana {getWeekNumber(new Date(selectedDate))} - {new Date(selectedDate).getFullYear()}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-slate-900 uppercase">Fecha de Reporte</p>
              <p className="text-3xl font-bold text-emerald-600">{selectedDate.split('-').reverse().join('/')}</p>
            </div>
          </div>

          {/* Tables Section - Full Width */}
          <div className="space-y-6">
            {renderTable('Rendimiento Diario (%)', last7Days.map(d => d.split('-').slice(1).reverse().join('/')), dailyStats)}
            {renderTable('Rendimiento Semanal (%)', last7Weeks.map(w => `S${w.week}`), weeklyStats)}
          </div>

          {/* Charts Section - 4 Columns */}
          <div className="space-y-4">
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter border-l-8 border-blue-600 pl-4">Evolución Semanal por Taller</h3>
            <div className="grid grid-cols-4 gap-6">
              {weeklyStats.map(ws => (
                <div key={ws.id} className="bg-slate-50 p-4 rounded-3xl border border-slate-200 flex flex-col h-[350px]">
                  <h4 className="text-xl font-black text-slate-800 uppercase mb-3 text-center">{ws.name}</h4>
                  <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={ws.values} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#475569'}} />
                        <YAxis tick={{fontSize: 10, fontWeight: 800, fill: '#475569'}} axisLine={false} tickLine={false} domain={[0, 100]} />
                        <Legend wrapperStyle={{fontSize: '10px', fontWeight: 'bold', paddingTop: '10px'}} />
                        <Bar dataKey="Disp" name="DIS" fill="#3b82f6" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                        <Bar dataKey="Rto" name="RTO" fill="#f97316" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                        <Line type="monotone" dataKey="Prod" name="PROD" stroke="#eab308" strokeWidth={3} dot={{r: 4, fill: '#eab308'}} isAnimationActive={false} />
                        <Line type="step" dataKey="Obj" name="OBJ" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pareto Section - 3 Columns */}
          <div className="space-y-4">
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter border-l-8 border-amber-600 pl-4">Pareto Pérdidas - {TALLERES.find(t => t.id === selectedWorkshopPareto)?.name}</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               { [
                  { title: 'Esperas y Averías', data: paretos.esperas, type: 'availability' as const, unit: 'min' },
                  { title: 'Pérdida Rendimiento', data: paretos.performance, type: 'performance' as const, unit: 'min' }
                ].map(pareto => (
                  <div key={pareto.title} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h4 className="text-lg font-black text-slate-400 uppercase tracking-widest mb-4">{pareto.title}</h4>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={pareto.data} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                          <XAxis type="number" hide />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            width={100} 
                            tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip 
                            cursor={{fill: 'transparent'}}
                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px'}}
                          />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={false}>
                            {pareto.data.map((entry, index) => (
                              <RechartsCell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ParetoModalProps {
  workshopId: string;
  date: string;
  allData: Activity[];
  onClose: () => void;
  onBarDoubleClick: (type: 'availability' | 'performance' | 'quality', category: string) => void;
}

const ParetoModal: React.FC<ParetoModalProps> = ({ workshopId, date, allData, onClose, onBarDoubleClick }) => {
  const workshopName = TALLERES.find(t => t.id === workshopId)?.name || workshopId;
  
  const paretos = useMemo(() => {
    const wsData = allData.filter(a => a.area === workshopId && a.fecha === date);
    const availability: Record<string, number> = {};
    const performance: Record<string, number> = {};
    const quality: Record<string, number> = {};
    const timeBased = isTimeBased(workshopId);

    wsData.forEach(act => {
      if (act.tipoTarea === TaskType.ESPERAS || act.tipoTarea === TaskType.AVERIA) {
        availability[act.formato] = (availability[act.formato] || 0) + (act.duracionMin || 0);
      }
      if (act.tipoTarea === TaskType.PRODUCCION) {
        const isLaser = workshopId === 'corte-laser' || act.area === 'corte-laser';
        const teo = act.tiempoTeoricoManual || 0;
        const theoreticalTotal = isLaser 
          ? (teo > 0 ? (60 / teo) : 0)
          : (teo > 0 ? (60 / teo) : 0) * (act.cantidad || 0);
        const loss = (act.duracionMin || 0) - theoreticalTotal;
        if (loss > 0) {
          performance[act.formato] = (performance[act.formato] || 0) + loss;
        }
      }
    });

    const formatPareto = (record: Record<string, number>) => 
      Object.entries(record)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

    return {
      availability: formatPareto(availability),
      performance: formatPareto(performance)
    };
  }, [allData, workshopId, date]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Paretos de Pérdida - {workshopName}</h3>
            <p className="text-[14px] font-bold text-slate-400 uppercase tracking-widest">{date.split('-').reverse().join('/')}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-500" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { title: 'Disponibilidad (Esperas/Averías)', data: paretos.availability, type: 'availability' as const, unit: 'min' },
            { title: 'Rendimiento (Pérdida Tiempo)', data: paretos.performance, type: 'performance' as const, unit: 'min' }
          ].map(pareto => (
            <div key={pareto.title} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <h4 className="text-[14px] font-black text-slate-400 uppercase tracking-widest mb-4">{pareto.title}</h4>
              <div className="h-64 w-full">
                {pareto.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minHeight={256} debounce={100}>
                    <BarChart data={pareto.data} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" tick={{fontSize: 8, fontWeight: 700}} width={80} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{fontSize: '10px', borderRadius: '8px'}} />
                      <Bar 
                        dataKey="value" 
                        fill="#3b82f6" 
                        radius={[0, 4, 4, 0]}
                        onDoubleClick={(data) => onBarDoubleClick(pareto.type, data.name)}
                        className="cursor-pointer"
                      >
                        {pareto.data.map((_, index) => (
                          <RechartsCell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-[14px] font-bold text-slate-300 uppercase tracking-widest border border-dashed border-slate-200 rounded-xl">Sin datos</div>
                )}
              </div>
              <p className="text-[15px] text-center text-slate-400 mt-2 font-bold uppercase tracking-widest">Doble clic en barra para ver registros</p>
            </div>
          ))}
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all">Cerrar (ESC)</button>
        </div>
      </div>
    </div>
  );
};

interface RecordsModalProps {
  workshopId: string;
  date: string;
  type: 'availability' | 'performance' | 'quality';
  category: string;
  allData: Activity[];
  onClose: () => void;
}

const RecordsModal: React.FC<RecordsModalProps> = ({ workshopId, date, type, category, allData, onClose }) => {
  const filteredRecords = useMemo(() => {
    return allData.filter(a => {
      if (a.area !== workshopId || a.fecha !== date) return false;
      
      if (type === 'availability') {
        return (a.tipoTarea === TaskType.ESPERAS || a.tipoTarea === TaskType.AVERIA) && a.formato === category && !a.afectaCalidad;
      }
      if (type === 'performance') {
        return a.tipoTarea === TaskType.PRODUCCION && a.formato === category;
      }
      if (type === 'quality') {
        const name = a.formato.toUpperCase();
        const isQualityTask = ['REPROCESADO', 'REPROCESO', 'REPASAR', 'REPINTADO', 'RETRABAJO', 'CALIDAD'].some(kw => name.includes(kw));
        const isProdQuality = false; // Cantidad NOK no longer tracked
        const isWaitQuality = (a.tipoTarea === TaskType.ESPERAS || a.tipoTarea === TaskType.AVERIA) && a.formato === category && (a.afectaCalidad || isQualityTask);
        return isProdQuality || isWaitQuality;
      }
      return false;
    });
  }, [allData, workshopId, date, type, category]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-blue-600 text-white">
          <div>
            <h3 className="text-lg font-black uppercase tracking-tighter">Registros Detallados</h3>
            <p className="text-[14px] font-bold uppercase tracking-widest opacity-80">{category} - {date.split('-').reverse().join('/')}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto">
          <table className="w-full text-[14px] border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="bg-slate-100 text-slate-600 shadow-sm">
                <th className="p-2 text-left border border-slate-200">Operario</th>
                <th className="p-2 text-center border border-slate-200">Inicio</th>
                <th className="p-2 text-center border border-slate-200">Fin</th>
                <th className="p-2 text-center border border-slate-200">Duración</th>
                <th className="p-2 text-center border border-slate-200">Cant.</th>
                {type === 'performance' && (
                  <>
                    <th className="p-2 text-center border border-slate-200">T. Teo (min)</th>
                    <th className="p-2 text-center border border-slate-200">T. Real (min)</th>
                    <th className="p-2 text-center border border-slate-200">Pérdida (min)</th>
                  </>
                )}
                <th className="p-2 text-left border border-slate-200">Comentario</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((rec, idx) => {
                const isLaser = workshopId === 'corte-laser' || rec.area === 'corte-laser';
                const teo = rec.tiempoTeoricoManual || 0;
                const theoreticalTotal = isLaser 
                  ? (teo > 0 ? (60 / teo) : 0) 
                  : (teo > 0 ? (60 / teo) : 0) * (rec.cantidad || 0);
                const realTime = rec.duracionMin || 0;
                const loss = realTime - theoreticalTotal;

                return (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-2 border border-slate-200 font-bold">{rec.operarios?.join(', ')}</td>
                    <td className="p-2 border border-slate-200 text-center">{rec.horaInicio}</td>
                    <td className="p-2 border border-slate-200 text-center">{rec.horaFin}</td>
                    <td className="p-2 border border-slate-200 text-center font-black">{rec.duracionMin} min</td>
                    <td className="p-2 border border-slate-200 text-center">{rec.cantidad || 0}</td>
                    {type === 'performance' && (
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
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={(type === 'performance' ? 9 : type === 'quality' ? 7 : 6) + ((workshopId === 'mecanizado' || workshopId === 'curvadora' || workshopId === 'corte-laser' || workshopId === 'soldadura-carcasas' || workshopId === 'soldadura-rodetes') ? 1 : 0)} className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest">No se encontraron registros detallados</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">Cerrar (ESC)</button>
        </div>
      </div>
    </div>
  );
};

export default TOP15Indicators;