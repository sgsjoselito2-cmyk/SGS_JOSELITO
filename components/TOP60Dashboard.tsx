import React, { useMemo, useState, useEffect } from 'react';
import { 
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, AreaChart, Area
} from 'recharts';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import { Activity as ActivityIcon, ShieldAlert, Clock } from 'lucide-react';
import { Activity, OEEObjectives, TaskType, User, ActionPlanItem } from '../types';
import { calculateStats, getWeekNumber } from './Dashboard';
import { AREA_NAMES, JOSELITO_LOGO } from '../constants';
import HelpModal from './HelpModal';

interface TOP60DashboardProps {
  activities: Activity[];
  history: Activity[];
  allObjectives: Record<string, OEEObjectives[]>;
  operarios: User[];
}

const TALLERES_POR_AREA = [
  {
    area: 'Producción',
    talleres: [
      { id: 'sala-blanca', name: 'SALA BLANCA' },
      { id: 'movimiento-jamones', name: 'MOVIMIENTO JAMONES' },
      { id: 'sb-preparacion', name: 'PREPARACIÓN SB' },
      { id: 'sb-loncheado', name: 'LONCHEADO SB' },
      { id: 'sb-empaquetado-loncheado', name: 'EMP. LONCHEADO SB' },
      { id: 'sb-empaquetado-deshuesado', name: 'EMP. DESHUESADO SB' },
      { id: 'env-envasado', name: 'ENVASADO' },
      { id: 'env-empaquetado', name: 'EMPAQUETADO ENV' },
      { id: 'expedicion', name: 'EXPEDICIONES' },
      { id: 'preparacion-exp', name: 'PREPARACIÓN EXP' }
    ]
  },
  {
    area: 'Logística',
    talleres: [
      { id: 'preparacion', name: 'PREPARACIÓN' },
      { id: 'expedicion-log', name: 'EXPEDICIÓN' },
      { id: 'movimiento-jamones-log', name: 'MOVIMIENTOS' }
    ]
  }
];

const TABS = [
  { id: 'seguridad', name: 'Seguridad' },
  { id: 'rrhh', name: 'RRHH' },
  { id: 'calidad', name: 'Calidad' },
  { id: 'cmi', name: 'Cuadros de Mando' },
  { id: 'adherencia', name: 'Adherencia' },
  { id: 'idm', name: 'IdM' }
];

const TOP60Dashboard: React.FC<TOP60DashboardProps> = ({ activities, history, allObjectives, operarios }) => {
  const [activeTab, setActiveTab] = useState('seguridad');
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportProgress, setReportProgress] = useState({ current: 0, total: 0 });
  
  const now = new Date();
  const currentWeek = getWeekNumber(now);
  const currentYear = now.getFullYear();
  
  const [selectedWeek, setSelectedWeek] = useState(() => {
    if (currentWeek === 1) return 52;
    return currentWeek - 1;
  });
  const [selectedYear, setSelectedYear] = useState(() => {
    if (currentWeek === 1) return currentYear - 1;
    return currentYear;
  });

  const [seguridadData, setSeguridadData] = useState<any[]>([]);
  const [rrhhData, setRrhhData] = useState<any[]>([]);
  const [ausentismoData, setAusentismoData] = useState<any[]>([]);
  const [calidadData, setCalidadData] = useState<any[]>([]);
  const [idmData, setIdmData] = useState<any[]>([]);
  const [actionPlanData, setActionPlanData] = useState<ActionPlanItem[]>([]);
  const [fullscreenChart, setFullscreenChart] = useState<any>(null);

  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [showPowerBI, setShowPowerBI] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullscreenChart(null);
        setFullscreenImage(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    if (history.length > 0) {
      const dates = history.map(h => h.fecha).filter(Boolean).sort();
      // Reduced logging to avoid console noise
      console.log(`TOP60Dashboard: History records: ${history.length}. Range: ${dates[0]} to ${dates[dates.length - 1]}`);
    }
  }, [history]);

  useEffect(() => {
    // Load data from LocalStorage
    setSeguridadData(JSON.parse(localStorage.getItem('zitron_top60_seguridad') || '[]'));
    setRrhhData(JSON.parse(localStorage.getItem('zitron_top60_rrhh') || '[]'));
    setAusentismoData(JSON.parse(localStorage.getItem('zitron_top60_ausentismo') || '[]'));
    setCalidadData(JSON.parse(localStorage.getItem('zitron_top60_calidad') || '[]'));
    setIdmData(JSON.parse(localStorage.getItem('zitron_top60_idm') || '[]'));
    setActionPlanData(JSON.parse(localStorage.getItem('zitron_top60_actionplan') || '[]'));
  }, []);

  const allData = useMemo(() => [...history, ...activities], [history, activities]);

  // Generate last 15 weeks up to selected week/year
  const last15Weeks = useMemo(() => {
    const weeks = [];
    const baseDate = new Date(selectedYear, 0, 1);
    baseDate.setDate(baseDate.getDate() + (selectedWeek - 1) * 7);
    
    for (let i = 0; i < 15; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - (14 - i) * 7);
      weeks.push({ week: getWeekNumber(d), year: d.getFullYear(), label: `${getWeekNumber(d)}\n${d.getFullYear()}` });
    }
    return weeks;
  }, [selectedWeek, selectedYear]);

  // Generate last 15 months up to selected week/year
  const last15Months = useMemo(() => {
    const months = [];
    const baseDate = new Date(selectedYear, 0, 1);
    baseDate.setDate(baseDate.getDate() + (selectedWeek - 1) * 7);
    
    for (let i = 0; i < 15; i++) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - (14 - i), 1);
      months.push({ month: d.getMonth(), year: d.getFullYear(), label: `${d.getMonth() + 1}\n${d.getFullYear()}` });
    }
    return months;
  }, [selectedWeek, selectedYear]);

  const globalProductivity = useMemo(() => {
    const weekData = history.filter(h => {
      const d = new Date(h.fecha);
      return getWeekNumber(d) === selectedWeek && d.getFullYear() === selectedYear;
    });
    if (weekData.length === 0) return 0;
    const stats = calculateStats(weekData);
    return Math.round(parseFloat(stats.oee) || 0);
  }, [history, selectedWeek, selectedYear]);

  const getWorkshopData = (wsId: string) => {
    const wsData = allData.filter(a => {
      if (!a.area) return false;
      const areaLower = a.area.toLowerCase();
      const wsIdLower = wsId.toLowerCase();
      const areaNameLower = AREA_NAMES[wsId]?.toLowerCase();
      
      return areaLower === wsIdLower || (areaNameLower && areaLower === areaNameLower);
    });

    const getObjectivesForArea = (areaId: string) => {
      if (allObjectives[areaId]) return allObjectives[areaId];
      const key = Object.keys(allObjectives).find(k => k.toLowerCase() === areaId.toLowerCase());
      return key ? allObjectives[key] : [];
    };

    // Pre-process data into buckets to avoid O(N^2) complexity
    const weeklyBuckets: Record<string, Activity[]> = {};
    const monthlyBuckets: Record<string, Activity[]> = {};

    wsData.forEach(a => {
      if (!a.fecha) return;
      const ad = new Date(a.fecha);
      const week = getWeekNumber(ad);
      const year = ad.getFullYear();
      const month = ad.getMonth();
      
      const weekKey = `${week}-${year}`;
      const monthKey = `${month}-${year}`;
      
      if (!weeklyBuckets[weekKey]) weeklyBuckets[weekKey] = [];
      if (!monthlyBuckets[monthKey]) monthlyBuckets[monthKey] = [];
      
      weeklyBuckets[weekKey].push(a);
      monthlyBuckets[monthKey].push(a);
    });

    const weeklyData = last15Weeks.map(w => {
      const weekKey = `${w.week}-${w.year}`;
      const data = weeklyBuckets[weekKey] || [];
      
      const date = new Date(w.year, 0, 1);
      date.setDate(date.getDate() + (w.week - 1) * 7);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      const objs = [...getObjectivesForArea(wsId)].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
      const found = (Array.isArray(objs) ? objs.find(o => o.validFrom <= dateStr) : null) || { disponibilidad: 90, rendimiento: 75, calidad: 99, productividad: 62.4, objetivo: 62.4 };
      
      const objective = Math.round(found.productividad || found.objetivo);

      const hasProduction = data.some(a => a.tipoTarea === TaskType.PRODUCCION);
      
      if (!hasProduction) {
        return { name: w.label, Disp: 0, Rto: 0, Cal: 0, Prod: 0, Obj: objective, ObjDisp: found.disponibilidad, ObjRto: found.rendimiento, ObjCal: found.calidad };
      }
      
      const stats = calculateStats(data, wsId);
      return {
        name: w.label,
        Disp: parseFloat(stats.availability) || 0,
        Rto: parseFloat(stats.performance) || 0,
        Cal: parseFloat(stats.quality) || 0,
        Prod: parseFloat(stats.oee) || 0,
        Obj: objective,
        ObjDisp: found.disponibilidad,
        ObjRto: found.rendimiento,
        ObjCal: found.calidad
      };
    });

    const monthlyData = last15Months.map(m => {
      const monthKey = `${m.month}-${m.year}`;
      const data = monthlyBuckets[monthKey] || [];

      const date = new Date(m.year, m.month, 1);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const objs = [...getObjectivesForArea(wsId)].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
      const found = (Array.isArray(objs) ? objs.find(o => o.validFrom <= dateStr) : null) || { disponibilidad: 90, rendimiento: 75, calidad: 99, productividad: 62.4, objetivo: 62.4 };
      
      const objective = Math.round(found.productividad || found.objetivo);

      const hasProduction = data.some(a => a.tipoTarea === TaskType.PRODUCCION);
      
      if (!hasProduction) {
        return { name: m.label, Disp: 0, Rto: 0, Cal: 0, Prod: 0, Obj: objective, ObjDisp: found.disponibilidad, ObjRto: found.rendimiento, ObjCal: found.calidad };
      }
      
      const stats = calculateStats(data, wsId);
      return {
        name: m.label,
        Disp: parseFloat(stats.availability) || 0,
        Rto: parseFloat(stats.performance) || 0,
        Cal: parseFloat(stats.quality) || 0,
        Prod: parseFloat(stats.oee) || 0,
        Obj: objective,
        ObjDisp: found.disponibilidad,
        ObjRto: found.rendimiento,
        ObjCal: found.calidad
      };
    });

    return { weeklyData, monthlyData };
  };

  const CustomXAxisTick = ({ x, y, payload }: any) => {
    const parts = payload.value.split('\n');
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={12} textAnchor="middle" fill="#64748b" fontSize={8} fontWeight={700}>
          {parts[0]}
        </text>
        {parts[1] && (
          <text x={0} y={0} dy={22} textAnchor="middle" fill="#94a3b8" fontSize={7} fontWeight={600}>
            {parts[1]}
          </text>
        )}
      </g>
    );
  };

  const renderChart = (data: any[], title: string, areaId?: string, isReport = false) => {
    const chartData = data.map(d => {
      let objValue = 0;
      if (areaId) {
        // Try to find date in d. If not, use d.week/d.year to estimate
        let date = new Date();
        if (d.date) date = new Date(d.date);
        else if (d.year && d.week) {
          date = new Date(d.year, 0, 1);
          date.setDate(date.getDate() + (d.week - 1) * 7);
        }
        objValue = getObjectiveForDate(areaId, date);
      }
      return { ...d, Objective: objValue };
    });

    const chart = (
      <ResponsiveContainer width="100%" height="100%" minHeight={isReport ? 220 : 250} debounce={100}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 35, left: -25 }} barCategoryGap="20%" barGap={5}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false}
            tick={<CustomXAxisTick />}
            interval={0}
          />
          <YAxis 
            tick={{fontSize: 7, fontWeight: 700, fill: '#64748b'}} 
            axisLine={false} 
            tickLine={false}
            domain={[0, 100]}
            tickFormatter={(val) => `${val}%`}
          />
          <Tooltip 
            contentStyle={{borderRadius: '6px', border: 'none', boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)', fontSize: '8px', fontWeight: 'bold'}}
            formatter={(value: number) => `${value.toFixed(1)}%`}
          />
          <Legend 
            wrapperStyle={{fontSize: '7px', fontWeight: 'bold', paddingTop: '25px'}} 
          />
          {/* Productividad como área en el fondo */}
          <Area type="monotone" dataKey="Prod" fill="#eab308" fillOpacity={0.1} stroke="none" legendType="none" isAnimationActive={false} />
          
          <Bar dataKey="Disp" name="Disp." fill="#3b82f6" radius={[1, 1, 0, 0]} maxBarSize={15} isAnimationActive={false} />
          <Bar dataKey="Rto" name="Rto." fill="#f97316" radius={[1, 1, 0, 0]} maxBarSize={15} isAnimationActive={false} />
          <Bar dataKey="Cal" name="Cal." fill="#94a3b8" radius={[1, 1, 0, 0]} maxBarSize={15} isAnimationActive={false} />
          
          {/* Productividad como línea delante para mantener orden de leyenda y definición */}
          <Line type="monotone" dataKey="Prod" name="Product." stroke="#eab308" strokeWidth={2} dot={{r: 1.5, strokeWidth: 1}} activeDot={{r: 3}} isAnimationActive={false}>
            <LabelList dataKey="Prod" position="top" formatter={(val: number) => val > 0 ? `${val.toFixed(1)}%` : ''} style={{ fontSize: '6px', fontWeight: 'bold', fill: '#334155' }} />
          </Line>
          
          {areaId && (
            <Line type="stepAfter" dataKey="Objective" name="OBJETIVO" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} isAnimationActive={false} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );

    return (
      <div 
        className={`bg-white p-2 rounded-xl border border-slate-100 shadow-sm flex flex-col ${isReport ? 'h-[380px]' : 'h-[300px]'} cursor-zoom-in`}
        onDoubleClick={() => setFullscreenChart({ title, chart })}
      >
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 text-center">{title}</h3>
        <div className="flex-1 w-full min-h-0">
          {chart}
        </div>
      </div>
    );
  };

  const getObjectiveForDate = (area: string, date: Date) => {
    const getObjectivesForArea = (areaId: string) => {
      if (allObjectives[areaId]) return allObjectives[areaId];
      const key = Object.keys(allObjectives).find(k => k.toLowerCase() === areaId.toLowerCase());
      return key ? allObjectives[key] : [];
    };
    
    const objs = [...getObjectivesForArea(area)].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    // objs is sorted by validFrom desc
    const found = objs.find(o => o.validFrom <= dateStr);
    const objective = found ? (found.productividad || found.objetivo || 0) : 0;
    return objective;
  };

  const handleSendReport = async () => {
    if (isGeneratingReport) return;
    
    const reportContainer = document.getElementById('top60-full-report');
    if (!reportContainer) return;

    setIsGeneratingReport(true);
    setReportProgress({ current: 0, total: 0 });
    window.scrollTo(0, 0);

    // Temporarily show the hidden report for capturing
    const originalStyle = {
      position: reportContainer.style.position,
      left: reportContainer.style.left,
      top: reportContainer.style.top,
      opacity: reportContainer.style.opacity,
      visibility: reportContainer.style.visibility,
      zIndex: reportContainer.style.zIndex,
      pointerEvents: reportContainer.style.pointerEvents,
      width: reportContainer.style.width,
      display: reportContainer.style.display
    };

    reportContainer.style.position = 'absolute';
    reportContainer.style.top = '0';
    reportContainer.style.left = '0';
    reportContainer.style.width = '1122px';
    reportContainer.style.opacity = '1';
    reportContainer.style.visibility = 'visible';
    reportContainer.style.pointerEvents = 'none';
    reportContainer.style.zIndex = '-1';
    reportContainer.style.display = 'block';

    try {
      const sections = reportContainer.querySelectorAll('[data-report-page]');
      const firstPageLandscape = sections.length > 0 && sections[0].hasAttribute('data-report-landscape');
      
      const pdf = new jsPDF(firstPageLandscape ? 'l' : 'p', 'mm', 'a4');
      const margin = 10;

      setReportProgress({ current: 0, total: sections.length });
      
      console.log(`Starting TOP60 report generation: ${sections.length} pages`);

      for (let i = 0; i < sections.length; i++) {
        setReportProgress(prev => ({ ...prev, current: i + 1 }));
        console.log(`Processing page ${i + 1}/${sections.length}...`);
        
        // Give time for charts to render completely
        await new Promise(resolve => setTimeout(resolve, 2500));
        
        const section = sections[i] as HTMLElement;
        const isLandscape = section.hasAttribute('data-report-landscape');
        
        // Use toPng with robust options
        const capturePromise = toPng(section, {
          backgroundColor: '#ffffff',
          width: isLandscape ? 1122 : 1000,
          cacheBust: true,
          skipFonts: true, // Crucial for stability
          style: {
            visibility: 'visible',
            display: 'block'
          }
        });

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('La captura de página ha tardado demasiado (timeout)')), 45000)
        );

        const imgData = await Promise.race([capturePromise, timeoutPromise]) as string;
        
        console.log(`Page ${i + 1} captured successfully`);

        if (i > 0) {
          pdf.addPage('a4', isLandscape ? 'l' : 'p');
        }
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        const pdfWidth = pageWidth - (margin * 2);
        const pdfHeight = (section.offsetHeight * pdfWidth) / section.offsetWidth;
        
        let yPos = margin;
        if (pdfHeight < (pageHeight - margin * 2)) {
          yPos = (pageHeight - pdfHeight) / 2;
        }
        
        pdf.addImage(imgData, 'PNG', margin, yPos, pdfWidth, pdfHeight);
      }
      
      pdf.save(`Reporte_TOP60_S${selectedWeek}_${selectedYear}.pdf`);
      console.log('TOP60 report saved successfully');
      alert("Reporte generado correctamente.");
    } catch (error: any) {
      console.error("Error generating report:", error);
      alert(`Error al generar el reporte: ${error.message || 'Error desconocido'}. Si el problema persiste, intente recargar la página.`);
    } finally {
      // Restore original style
      Object.assign(reportContainer.style, originalStyle);
      setIsGeneratingReport(false);
      setReportProgress({ current: 0, total: 0 });
    }
  };

  const renderEvolutionChart = (data: any[], dataKey: string, name: string, color: string, title: string, objectiveArea?: string, isPercentage?: boolean, isReport = false) => {
    const chartData = data.map(d => {
      let objValue = 0;
      if (objectiveArea) {
        // Try to find date in d. If not, use d.week/d.year to estimate
        let date = new Date();
        if (d.date) date = new Date(d.date);
        else if (d.year && d.week) {
          date = new Date(d.year, 0, 1);
          date.setDate(date.getDate() + (d.week - 1) * 7);
        }
        objValue = getObjectiveForDate(objectiveArea, date);
      }
      return { ...d, Objective: objValue };
    });

    const chart = (
      <ResponsiveContainer width="100%" height="100%" minHeight={isReport ? 220 : 250} debounce={100}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 30, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={<CustomXAxisTick />} interval={0} />
          <YAxis 
            tick={{fontSize: 8, fontWeight: 700, fill: '#64748b'}} 
            axisLine={false} 
            tickLine={false}
            tickFormatter={(val) => isPercentage ? `${val}%` : val}
          />
          <Tooltip 
            contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '9px', fontWeight: 'bold'}}
            formatter={(val: any, name: string) => isPercentage ? [`${Number(val).toFixed(1)}%`, name] : [val, name]}
          />
          <Legend wrapperStyle={{fontSize: '8px', fontWeight: 'bold', paddingTop: '15px'}} />
          <Area type="monotone" dataKey={dataKey} name={name} stroke={color} fill={color} fillOpacity={0.1} strokeWidth={3} isAnimationActive={false} />
          {objectiveArea && (
            <Line type="stepAfter" dataKey="Objective" name="OBJETIVO" stroke="#ef4444" strokeWidth={3} strokeDasharray="5 5" dot={false} activeDot={false} isAnimationActive={false} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );

    return (
      <div className={`bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col ${isReport ? 'h-[280px]' : 'h-[300px]'} cursor-zoom-in`}
        onDoubleClick={() => setFullscreenChart({ title, chart })}
      >
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 text-center">{title}</h3>
        <div className="flex-1 w-full">
          {chart}
        </div>
      </div>
    );
  };

  const chunkArray = (arr: any[], size: number) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  const renderSeguridadTab = (isReport = false, onlyCharts = false, onlyTable = false) => {
    const weeklyAccidents = last15Weeks.map(w => {
      const count = seguridadData.filter(i => {
        const d = new Date(i.fecha);
        return i.tipo === 'Accidente' && getWeekNumber(d) === w.week && d.getFullYear() === w.year;
      }).length;
      return { name: w.label, count, week: w.week, year: w.year };
    });

    const monthlyAccidents = last15Months.map(m => {
      const count = seguridadData.filter(i => {
        const d = new Date(i.fecha);
        return i.tipo === 'Accidente' && d.getMonth() === m.month && d.getFullYear() === m.year;
      }).length;
      return { name: m.label, count, date: new Date(m.year, m.month, 1) };
    });

    const weeklyIncidentes = last15Weeks.map(w => {
      const count = seguridadData.filter(i => {
        const d = new Date(i.fecha);
        return i.tipo === 'Incidente' && getWeekNumber(d) === w.week && d.getFullYear() === w.year;
      }).length;
      return { name: w.label, count, week: w.week, year: w.year };
    });

    const monthlyIncidentes = last15Months.map(m => {
      const count = seguridadData.filter(i => {
        const d = new Date(i.fecha);
        return i.tipo === 'Incidente' && d.getMonth() === m.month && d.getFullYear() === m.year;
      }).length;
      return { name: m.label, count, date: new Date(m.year, m.month, 1) };
    });

    // Filter items from the Preparation Tab's Security Plan (seguridadData)
    // Show all actions as per user request
    const securityActions = seguridadData;

    return (
      <div className="flex flex-col gap-8">
        {!onlyTable && (
          <div className={`grid ${isReport ? 'grid-cols-2' : 'grid-cols-1 lg:grid-cols-2'} gap-6`}>
            {renderEvolutionChart(weeklyAccidents, 'count', 'ACCIDENTES', '#ef4444', 'Evolución Accidentes (Semanas)', 'accidentes', false, isReport)}
            {renderEvolutionChart(monthlyAccidents, 'count', 'ACCIDENTES', '#ef4444', 'Evolución Accidentes (Meses)', 'accidentes', false, isReport)}
            {renderEvolutionChart(weeklyIncidentes, 'count', 'INCIDENTES', '#f97316', 'Evolución Incidentes (Semanas)', 'incidentes', false, isReport)}
            {renderEvolutionChart(monthlyIncidentes, 'count', 'INCIDENTES', '#f97316', 'Evolución Incidentes (Meses)', 'incidentes', false, isReport)}
          </div>
        )}

        {!onlyCharts && securityActions.length > 0 && (
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-50 pb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                <ActivityIcon size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Plan de Acción de Seguridad (Preparación)</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Historial completo de acciones</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Problema / Acción</th>
                    <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsable</th>
                    <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha Prevista</th>
                    <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Taller (GAP)</th>
                    <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {securityActions.map((action) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const planned = new Date(action.fecha_implantacion_prevista);
                    planned.setHours(0, 0, 0, 0);
                    const isClosed = !!(action.fecha_implantacion_real && action.fecha_implantacion_real.trim() !== '');
                    const isOverdue = !isClosed && planned < today;

                    return (
                      <tr key={action.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-4">
                          <div className="text-xs font-bold text-slate-800 mb-1">{action.problema}</div>
                          <div className="text-[10px] text-slate-500 leading-relaxed">{action.accion}</div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-[10px] font-black text-slate-600 bg-slate-100 px-2 py-1 rounded-md uppercase">
                            {action.responsable}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className={`text-[10px] font-bold ${isOverdue ? 'text-red-500' : 'text-slate-600'}`}>
                            {new Date(action.fecha_implantacion_prevista).toLocaleDateString('es-ES')}
                          </div>
                          {isClosed && (
                            <div className="text-[8px] text-emerald-600 font-black uppercase mt-1">
                              Cerrada: {new Date(action.fecha_implantacion_real!).toLocaleDateString('es-ES')}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">
                            {action.gap}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                            isClosed ? 'bg-emerald-100 text-emerald-600' :
                            isOverdue ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                          }`}>
                            {isClosed ? 'Cerrada' : isOverdue ? 'Retrasada' : 'En marcha'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderRRHHTab = (isReport = false) => {
    const weeklyAbsentismo = last15Weeks.map(w => {
      const records = rrhhData.filter(r => {
        const d = new Date(r.fecha);
        return getWeekNumber(d) === w.week && d.getFullYear() === w.year;
      });
      if (records.length === 0) return { name: w.label, MOD: 0, MOI: 0, week: w.week, year: w.year };
      const totalMod = records.reduce((acc, r) => acc + r.totalMod, 0);
      const totalMoi = records.reduce((acc, r) => acc + r.totalMoi, 0);
      const modBaja = records.reduce((acc, r) => acc + r.modBaja, 0);
      const moiBaja = records.reduce((acc, r) => acc + r.moiBaja, 0);
      return { 
        name: w.label, 
        MOD: totalMod > 0 ? (modBaja / totalMod) * 100 : 0, 
        MOI: totalMoi > 0 ? (moiBaja / totalMoi) * 100 : 0,
        week: w.week,
        year: w.year
      };
    });

    const monthlyAbsentismo = last15Months.map(m => {
      const records = rrhhData.filter(r => {
        const d = new Date(r.fecha);
        return d.getMonth() === m.month && d.getFullYear() === m.year;
      });
      if (records.length === 0) return { name: m.label, MOD: 0, MOI: 0, date: new Date(m.year, m.month, 1) };
      const totalMod = records.reduce((acc, r) => acc + r.totalMod, 0);
      const totalMoi = records.reduce((acc, r) => acc + r.totalMoi, 0);
      const modBaja = records.reduce((acc, r) => acc + r.modBaja, 0);
      const moiBaja = records.reduce((acc, r) => acc + r.moiBaja, 0);
      return { 
        name: m.label, 
        MOD: totalMod > 0 ? (modBaja / totalMod) * 100 : 0, 
        MOI: totalMoi > 0 ? (moiBaja / totalMoi) * 100 : 0,
        date: new Date(m.year, m.month, 1)
      };
    });

    const weeklyAusentismo = last15Weeks.map(w => {
      const records = ausentismoData.filter(r => {
        const d = new Date(r.fecha);
        return getWeekNumber(d) === w.week && d.getFullYear() === w.year;
      });
      if (records.length === 0) return { name: w.label, MOD: 0, MOI: 0, week: w.week, year: w.year };
      const totalMod = records.reduce((acc, r) => acc + r.mod, 0);
      const totalMoi = records.reduce((acc, r) => acc + r.moi, 0);
      const jornadasMod = records.reduce((acc, r) => acc + r.jornadasPerdidasMod, 0);
      const jornadasMoi = records.reduce((acc, r) => acc + r.jornadasPerdidasMoi, 0);
      return { 
        name: w.label, 
        MOD: jornadasMod, 
        MOI: jornadasMoi,
        week: w.week,
        year: w.year
      };
    });

    const monthlyAusentismo = last15Months.map(m => {
      const records = ausentismoData.filter(r => {
        const d = new Date(r.fecha);
        return d.getMonth() === m.month && d.getFullYear() === m.year;
      });
      if (records.length === 0) return { name: m.label, MOD: 0, MOI: 0, date: new Date(m.year, m.month, 1) };
      const totalMod = records.reduce((acc, r) => acc + r.mod, 0);
      const totalMoi = records.reduce((acc, r) => acc + r.moi, 0);
      const jornadasMod = records.reduce((acc, r) => acc + r.jornadasPerdidasMod, 0);
      const jornadasMoi = records.reduce((acc, r) => acc + r.jornadasPerdidasMoi, 0);
      return { 
        name: m.label, 
        MOD: jornadasMod, 
        MOI: jornadasMoi,
        date: new Date(m.year, m.month, 1)
      };
    });

    return (
      <div className={`grid ${isReport ? 'grid-cols-2' : 'grid-cols-1 lg:grid-cols-2'} gap-6`}>
        <div className="col-span-full border-b border-slate-200 pb-2 mb-2">
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Absentismo (Bajas)</h4>
        </div>
        {renderEvolutionChart(weeklyAbsentismo, 'MOD', 'MOD %', '#3b82f6', 'Absentismo MOD % (Semanas)', 'absentismo-mod', true, isReport)}
        {renderEvolutionChart(monthlyAbsentismo, 'MOD', 'MOD %', '#3b82f6', 'Absentismo MOD % (Meses)', 'absentismo-mod', true, isReport)}
        {renderEvolutionChart(weeklyAbsentismo, 'MOI', 'MOI %', '#8b5cf6', 'Absentismo MOI % (Semanas)', 'absentismo-moi', true, isReport)}
        {renderEvolutionChart(monthlyAbsentismo, 'MOI', 'MOI %', '#8b5cf6', 'Absentismo MOI % (Meses)', 'absentismo-moi', true, isReport)}
        
        <div className="col-span-full border-b border-slate-200 pb-2 mb-2 mt-6">
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Ausentismo (Jornadas Perdidas)</h4>
        </div>
        {renderEvolutionChart(weeklyAusentismo, 'MOD', 'MOD', '#3b82f6', 'Ausentismo MOD (Semanas)', 'ausentismo-mod', false, isReport)}
        {renderEvolutionChart(monthlyAusentismo, 'MOD', 'MOD', '#3b82f6', 'Ausentismo MOD (Meses)', 'ausentismo-mod', false, isReport)}
        {renderEvolutionChart(weeklyAusentismo, 'MOI', 'MOI', '#8b5cf6', 'Ausentismo MOI (Semanas)', 'ausentismo-moi', false, isReport)}
        {renderEvolutionChart(monthlyAusentismo, 'MOI', 'MOI', '#8b5cf6', 'Ausentismo MOI (Meses)', 'ausentismo-moi', false, isReport)}
      </div>
    );
  };

  const renderCalidadTab = () => {
    const currentRecord = calidadData.find(r => r.semana === selectedWeek && r.anio === selectedYear);
    
    return (
      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm min-h-[400px] relative flex flex-col items-center">
        <div className="mb-10">
          <button 
            onClick={() => setShowPowerBI(true)}
            className="flex flex-col items-center gap-3 group transition-all hover:scale-110"
            title="Abrir Cuadro de Mando de Calidad en Power BI"
          >
            <div className="w-20 h-20 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-amber-200 group-hover:bg-amber-600 transition-colors animate-pulse">
              <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 16H7v-6h4v6zm4 0h-4V9h4v9zm4 0h-4V6h4v9z"/>
              </svg>
            </div>
            <span className="text-xs font-black text-amber-600 uppercase tracking-[0.3em] animate-bounce">Power BI Calidad</span>
          </button>
        </div>

        <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest mb-8 text-center w-full">Calidad - Semana {selectedWeek} ({selectedYear})</h3>
        {currentRecord && currentRecord.imagenes && currentRecord.imagenes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentRecord.imagenes.map((img: string, idx: number) => (
              <div key={idx} className="rounded-2xl overflow-hidden border-4 border-slate-50 shadow-lg hover:scale-105 transition-all cursor-pointer" onClick={() => setFullscreenImage(img)}>
                {img ? (
                  <img src={img} alt={`Calidad ${idx}`} className="w-full h-auto object-cover aspect-video" referrerPolicy="no-referrer" />
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300">
            <svg className="w-20 h-20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            <p className="font-black uppercase tracking-widest text-xs">No hay imágenes para esta semana</p>
          </div>
        )}
      </div>
    );
  };

  const renderIdMTab = (isReport = false) => {
    const weeklyIdM = last15Weeks.map(w => {
      const records = idmData.filter(i => {
        const d = new Date(i.fechaCreacion);
        return getWeekNumber(d) === w.week && d.getFullYear() === w.year;
      });
      const presentadas = records.length;
      const cerradas = records.filter(i => i.fechaCierre).length;
      const rechazadas = records.filter(i => i.aprobada === 'NO').length;
      
      const date = new Date(w.year, 0, 1);
      date.setDate(date.getDate() + (w.week - 1) * 7);
      
      const objPres = getObjectiveForDate('idm-presentadas', date);
      const objCerr = getObjectiveForDate('idm-cerradas', date);
      
      return { name: w.label, presentadas, cerradas, rechazadas, ObjPres: objPres, ObjCerr: objCerr };
    });

    const monthlyIdM = last15Months.map(m => {
      const records = idmData.filter(i => {
        const d = new Date(i.fechaCreacion);
        return d.getMonth() === m.month && d.getFullYear() === m.year;
      });
      const presentadas = records.length;
      const cerradas = records.filter(i => i.fechaCierre).length;
      const rechazadas = records.filter(i => i.aprobada === 'NO').length;
      
      const date = new Date(m.year, m.month, 1);
      const objPres = getObjectiveForDate('idm-presentadas', date);
      const objCerr = getObjectiveForDate('idm-cerradas', date);
      
      return { name: m.label, presentadas, cerradas, rechazadas, ObjPres: objPres, ObjCerr: objCerr };
    });

    return (
      <div className={`grid ${isReport ? 'grid-cols-2' : 'grid-cols-1 lg:grid-cols-2'} gap-6`}>
        <div className={`bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col ${isReport ? 'h-[320px]' : 'h-[300px]'}`}>
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 text-center">Evolución IdM (Semanas)</h3>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%" minHeight={isReport ? 240 : 250} debounce={100}>
              <ComposedChart data={weeklyIdM} margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={<CustomXAxisTick />} />
                <YAxis tick={{fontSize: 8, fontWeight: 700, fill: '#64748b'}} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '9px', fontWeight: 'bold'}} />
                <Legend wrapperStyle={{fontSize: '8px', fontWeight: 'bold', paddingTop: '5px'}} />
                <Bar dataKey="presentadas" name="PRESENTADAS" fill="#3b82f6" radius={[1, 1, 0, 0]} maxBarSize={20} />
                <Bar dataKey="cerradas" name="CERRADAS" fill="#10b981" radius={[1, 1, 0, 0]} maxBarSize={20} />
                <Bar dataKey="rechazadas" name="RECHAZADAS" fill="#ef4444" radius={[1, 1, 0, 0]} maxBarSize={20} />
                <Line type="step" dataKey="ObjPres" name="OBJ. PRES" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} />
                <Line type="step" dataKey="ObjCerr" name="OBJ. CERR" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className={`bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col ${isReport ? 'h-[320px]' : 'h-[300px]'}`}>
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 text-center">Evolución IdM (Meses)</h3>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%" minHeight={isReport ? 240 : 250} debounce={100}>
              <ComposedChart data={monthlyIdM} margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={<CustomXAxisTick />} />
                <YAxis tick={{fontSize: 8, fontWeight: 700, fill: '#64748b'}} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '9px', fontWeight: 'bold'}} />
                <Legend wrapperStyle={{fontSize: '8px', fontWeight: 'bold', paddingTop: '5px'}} />
                <Bar dataKey="presentadas" name="PRESENTADAS" fill="#3b82f6" radius={[1, 1, 0, 0]} maxBarSize={20} />
                <Bar dataKey="cerradas" name="CERRADAS" fill="#10b981" radius={[1, 1, 0, 0]} maxBarSize={20} />
                <Bar dataKey="rechazadas" name="RECHAZADAS" fill="#ef4444" radius={[1, 1, 0, 0]} maxBarSize={20} />
                <Line type="step" dataKey="ObjPres" name="OBJ. PRES" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} />
                <Line type="step" dataKey="ObjCerr" name="OBJ. CERR" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2 animate-in fade-in duration-500 h-full relative">
      {isGeneratingReport && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center text-white p-10 text-center">
          <div className="relative w-32 h-32 mb-8">
            <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
            <div 
              className="absolute inset-0 border-4 border-indigo-500 rounded-full animate-spin border-t-transparent"
              style={{ animationDuration: '1.5s' }}
            ></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-black">{Math.round((reportProgress.current / (reportProgress.total || 1)) * 100)}%</span>
            </div>
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tighter mb-4">Generando Reporte Ejecutivo</h2>
          <div className="max-w-md space-y-4">
            <p className="text-slate-300 font-bold uppercase tracking-widest text-sm">
              Capturando página {reportProgress.current} de {reportProgress.total}...
            </p>
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-500 h-full transition-all duration-500"
                style={{ width: `${(reportProgress.current / (reportProgress.total || 1)) * 100}%` }}
              ></div>
            </div>
            <p className="text-amber-400 font-black uppercase tracking-widest text-xs animate-pulse">
              IMPORTANTE: Mantenga esta pestaña activa y visible para evitar errores.
            </p>
          </div>
        </div>
      )}

      <button 
        onClick={() => setIsHelpModalOpen(true)}
        className="absolute -top-1 -right-1 z-20 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-all active:scale-90 border-2 border-white"
        title="Ayuda"
      >
        <span className="text-xs font-black">?</span>
      </button>

      {/* HIDDEN FULL REPORT CONTAINER */}
      <div id="top60-full-report" style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '1122px', backgroundColor: 'white', pointerEvents: 'none' }}>
        <div className="flex flex-col">
          {/* PAGE 1: PORTADA & RESUMEN (LANDSCAPE) */}
          <div data-report-page data-report-landscape className="flex flex-col min-h-[794px] w-[1122px] bg-white p-12 space-y-8 overflow-hidden">
            <div className="flex items-center justify-between border-b-8 border-slate-900 pb-8">
              <div className="flex items-center gap-6">
                {JOSELITO_LOGO ? (
                  <div className="relative">
                    <img 
                      src={JOSELITO_LOGO} 
                      alt="JOSELITO" 
                      className="h-16 w-auto" 
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback');
                        if (fallback) (fallback as HTMLElement).style.display = 'block';
                      }}
                    />
                    <h1 className="logo-fallback text-3xl font-serif font-black text-slate-900 tracking-tight uppercase hidden">JOSELITO</h1>
                  </div>
                ) : (
                  <h1 className="text-3xl font-serif font-black text-slate-900 tracking-tight uppercase">JOSELITO</h1>
                )}
                <div className="w-px h-16 bg-slate-200 mx-2"></div>
                <div>
                  <h1 className="text-5xl font-black uppercase tracking-tighter text-slate-900">TOP 60 - Reporte Semanal</h1>
                  <p className="text-lg font-black text-slate-400 uppercase tracking-[0.3em]">Gestión Estratégica de Operaciones</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-7xl font-black text-slate-900">S{selectedWeek}</p>
                <p className="text-xl font-black text-slate-400 uppercase tracking-widest">{selectedYear}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-8 flex-1">
              <div className="col-span-2 grid grid-cols-2 gap-6">
                <div className="bg-slate-50 p-8 rounded-[3rem] border-2 border-slate-100 flex flex-col items-center text-center justify-center shadow-sm">
                  <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest mb-4">Productividad Global</h3>
                  <div className="text-8xl font-black text-indigo-600">
                    {globalProductivity}%
                  </div>
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest mt-4">Media Semanal</p>
                </div>
                <div className="bg-slate-50 p-8 rounded-[3rem] border-2 border-red-100 flex flex-col items-center text-center justify-center shadow-sm">
                  <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest mb-4">Seguridad</h3>
                  <div className="text-8xl font-black text-red-600">
                    {seguridadData.filter(i => {
                      const d = new Date(i.fecha);
                      return i.tipo === 'Accidente' && getWeekNumber(d) === selectedWeek && d.getFullYear() === selectedYear;
                    }).length}
                  </div>
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest mt-4">Accidentes S{selectedWeek}</p>
                </div>
                <div className="bg-slate-50 p-8 rounded-[3rem] border-2 border-emerald-100 flex flex-col items-center text-center justify-center shadow-sm">
                  <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest mb-4">Calidad</h3>
                  <div className="text-8xl font-black text-emerald-600">
                    {(() => {
                      const record = calidadData.find(r => r.semana === selectedWeek && r.anio === selectedYear);
                      return record ? record.ncInternas : 0;
                    })()}
                  </div>
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest mt-4">NC Internas S{selectedWeek}</p>
                </div>
                <div className="bg-slate-50 p-8 rounded-[3rem] border-2 border-amber-100 flex flex-col items-center text-center justify-center shadow-sm">
                  <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest mb-4">IdM</h3>
                  <div className="text-8xl font-black text-amber-600">
                    {idmData.filter(i => {
                      const d = new Date(i.fechaCreacion);
                      return getWeekNumber(d) === selectedWeek && d.getFullYear() === selectedYear;
                    }).length}
                  </div>
                  <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Sugerencias S{selectedWeek}</p>
                </div>
              </div>
              
              <div className="bg-slate-900 rounded-[3rem] p-10 text-white flex flex-col justify-between shadow-2xl">
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-widest mb-8 border-b border-white/10 pb-6">Resumen Ejecutivo</h3>
                  <p className="text-lg text-slate-400 leading-relaxed italic">
                    "Reporte consolidado de los indicadores clave de desempeño (KPIs) para la semana {selectedWeek}. 
                    Enfoque en Seguridad, Calidad, Plazos y Costes (SQDC) para la mejora continua de los procesos productivos."
                  </p>
                  <div className="mt-10 space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                      <p className="text-sm font-bold uppercase tracking-wider text-slate-300">Análisis de Productividad</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <p className="text-sm font-bold uppercase tracking-wider text-slate-300">Control de Siniestralidad</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      <p className="text-sm font-bold uppercase tracking-wider text-slate-300">Aseguramiento de Calidad</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Fecha Generación</span>
                    <span className="text-sm font-bold">{new Date().toLocaleDateString('es-ES')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Versión</span>
                    <span className="text-sm font-bold">v3.1 Landscape Optimized</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PAGE 2: SEGURIDAD (LANDSCAPE) */}
          <div data-report-page data-report-landscape className="flex flex-col min-h-[794px] w-[1122px] bg-white p-12 space-y-6 overflow-hidden">
            <div className="flex items-center justify-between border-b-4 border-red-600 pb-4">
              <h2 className="text-3xl font-black uppercase tracking-tighter text-red-600">Seguridad y Salud - Evolución</h2>
              <div className="flex items-center gap-4">
                {JOSELITO_LOGO ? (
                  <div className="relative">
                    <img 
                      src={JOSELITO_LOGO} 
                      alt="JOSELITO" 
                      className="h-6 w-auto" 
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback');
                        if (fallback) (fallback as HTMLElement).style.display = 'block';
                      }}
                    />
                    <h1 className="logo-fallback text-xl font-serif font-black text-slate-900 tracking-tight uppercase hidden">JOSELITO</h1>
                  </div>
                ) : (
                  <h1 className="text-xl font-serif font-black text-slate-900 tracking-tight uppercase">JOSELITO</h1>
                )}
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Página 2</p>
              </div>
            </div>
            <div className="flex-1">
              {renderSeguridadTab(true, true, false)}
            </div>
          </div>

          {/* PAGE 2b: SEGURIDAD ACTION PLAN (LANDSCAPE) */}
          {(() => {
            const securityActions = seguridadData.filter(a => a.problema || a.accion);
            const actionChunks = chunkArray(securityActions, 8); // 8 actions per landscape page
            
            return actionChunks.map((chunk, idx) => (
              <div key={`sec-actions-${idx}`} data-report-page data-report-landscape className="flex flex-col min-h-[794px] w-[1122px] bg-white p-12 space-y-6 overflow-hidden">
                <div className="flex items-center justify-between border-b-4 border-amber-500 pb-4">
                  <h2 className="text-3xl font-black uppercase tracking-tighter text-amber-500">Plan de Acción de Seguridad {actionChunks.length > 1 ? `(${idx + 1}/${actionChunks.length})` : ''}</h2>
                  <div className="flex items-center gap-4">
                    {JOSELITO_LOGO ? (
                      <div className="relative">
                        <img 
                          src={JOSELITO_LOGO} 
                          alt="JOSELITO" 
                          className="h-6 w-auto" 
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback');
                            if (fallback) (fallback as HTMLElement).style.display = 'block';
                          }}
                        />
                        <h1 className="logo-fallback text-xl font-serif font-black text-slate-900 tracking-tight uppercase hidden">JOSELITO</h1>
                      </div>
                    ) : (
                      <h1 className="text-xl font-serif font-black text-slate-900 tracking-tight uppercase">JOSELITO</h1>
                    )}
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Página 3.{idx + 1}</p>
                  </div>
                </div>
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[40%]">Problema / Acción</th>
                        <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[15%]">Responsable</th>
                        <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[15%]">Fecha Prevista</th>
                        <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[15%]">Taller (GAP)</th>
                        <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[15%]">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {chunk.map((action: any) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const planned = new Date(action.fecha_implantacion_prevista);
                        planned.setHours(0, 0, 0, 0);
                        const isClosed = !!(action.fecha_implantacion_real && action.fecha_implantacion_real.trim() !== '');
                        const isOverdue = !isClosed && planned < today;

                        return (
                          <tr key={action.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-5 px-6">
                              <div className="text-xs font-black text-slate-800 mb-1 uppercase tracking-tight">{action.problema}</div>
                              <div className="text-[10px] text-slate-500 leading-relaxed italic">{action.accion}</div>
                            </td>
                            <td className="py-5 px-6">
                              <span className="text-[10px] font-black text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg uppercase">
                                {action.responsable}
                              </span>
                            </td>
                            <td className="py-5 px-6">
                              <div className={`text-[10px] font-black ${isOverdue ? 'text-red-500' : 'text-slate-700'}`}>
                                {new Date(action.fecha_implantacion_prevista).toLocaleDateString('es-ES')}
                              </div>
                              {isClosed && (
                                <div className="text-[8px] text-emerald-600 font-black uppercase mt-1">
                                  Cerrada: {new Date(action.fecha_implantacion_real!).toLocaleDateString('es-ES')}
                                </div>
                              )}
                            </td>
                            <td className="py-5 px-6">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                {action.gap}
                              </span>
                            </td>
                            <td className="py-5 px-6">
                              <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${
                                isClosed ? 'bg-emerald-100 text-emerald-600' :
                                isOverdue ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                              }`}>
                                {isClosed ? 'Cerrada' : isOverdue ? 'Retrasada' : 'En marcha'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ));
          })()}

          {/* PAGE 3: RRHH ABSENTISMO (LANDSCAPE) */}
          <div data-report-page data-report-landscape className="flex flex-col min-h-[794px] w-[1122px] bg-white p-12 space-y-6 overflow-hidden">
            <div className="flex items-center justify-between border-b-4 border-blue-600 pb-4">
              <h2 className="text-3xl font-black uppercase tracking-tighter text-blue-600">RRHH - Absentismo (Bajas)</h2>
              <div className="flex items-center gap-4">
                {JOSELITO_LOGO ? (
                  <div className="relative">
                    <img 
                      src={JOSELITO_LOGO} 
                      alt="JOSELITO" 
                      className="h-6 w-auto" 
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback');
                        if (fallback) (fallback as HTMLElement).style.display = 'block';
                      }}
                    />
                    <h1 className="logo-fallback text-xl font-serif font-black text-slate-900 tracking-tight uppercase hidden">JOSELITO</h1>
                  </div>
                ) : (
                  <h1 className="text-xl font-serif font-black text-slate-900 tracking-tight uppercase">JOSELITO</h1>
                )}
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Página 4</p>
              </div>
            </div>
            <div className="flex-1">
              {(() => {
                const weeklyAbsentismo = last15Weeks.map(w => {
                  const records = rrhhData.filter(r => {
                    const d = new Date(r.fecha);
                    return getWeekNumber(d) === w.week && d.getFullYear() === w.year;
                  });
                  if (records.length === 0) return { name: w.label, MOD: 0, MOI: 0, week: w.week, year: w.year };
                  const totalMod = records.reduce((acc, r) => acc + r.totalMod, 0);
                  const totalMoi = records.reduce((acc, r) => acc + r.totalMoi, 0);
                  const modBaja = records.reduce((acc, r) => acc + r.modBaja, 0);
                  const moiBaja = records.reduce((acc, r) => acc + r.moiBaja, 0);
                  return { name: w.label, MOD: totalMod > 0 ? (modBaja / totalMod) * 100 : 0, MOI: totalMoi > 0 ? (moiBaja / totalMoi) * 100 : 0, week: w.week, year: w.year };
                });
                const monthlyAbsentismo = last15Months.map(m => {
                  const records = rrhhData.filter(r => {
                    const d = new Date(r.fecha);
                    return d.getMonth() === m.month && d.getFullYear() === m.year;
                  });
                  if (records.length === 0) return { name: m.label, MOD: 0, MOI: 0, date: new Date(m.year, m.month, 1) };
                  const totalMod = records.reduce((acc, r) => acc + r.totalMod, 0);
                  const totalMoi = records.reduce((acc, r) => acc + r.totalMoi, 0);
                  const modBaja = records.reduce((acc, r) => acc + r.modBaja, 0);
                  const moiBaja = records.reduce((acc, r) => acc + r.moiBaja, 0);
                  return { name: m.label, MOD: totalMod > 0 ? (modBaja / totalMod) * 100 : 0, MOI: totalMoi > 0 ? (moiBaja / totalMoi) * 100 : 0, date: new Date(m.year, m.month, 1) };
                });
                return (
                  <div className="grid grid-cols-2 gap-8">
                    {renderEvolutionChart(weeklyAbsentismo, 'MOD', 'MOD %', '#3b82f6', 'Absentismo MOD % (Semanas)', 'absentismo-mod', true, true)}
                    {renderEvolutionChart(monthlyAbsentismo, 'MOD', 'MOD %', '#3b82f6', 'Absentismo MOD % (Meses)', 'absentismo-mod', true, true)}
                    {renderEvolutionChart(weeklyAbsentismo, 'MOI', 'MOI %', '#8b5cf6', 'Absentismo MOI % (Semanas)', 'absentismo-moi', true, true)}
                    {renderEvolutionChart(monthlyAbsentismo, 'MOI', 'MOI %', '#8b5cf6', 'Absentismo MOI % (Meses)', 'absentismo-moi', true, true)}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* PAGE 4: RRHH AUSENTISMO (LANDSCAPE) */}
          <div data-report-page data-report-landscape className="flex flex-col min-h-[794px] w-[1122px] bg-white p-12 space-y-6 overflow-hidden">
            <div className="flex items-center justify-between border-b-4 border-blue-600 pb-4">
              <h2 className="text-3xl font-black uppercase tracking-tighter text-blue-600">RRHH - Ausentismo (Jornadas)</h2>
              <div className="flex items-center gap-4">
                {JOSELITO_LOGO ? (
                  <div className="relative">
                    <img 
                      src={JOSELITO_LOGO} 
                      alt="JOSELITO" 
                      className="h-6 w-auto" 
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback');
                        if (fallback) (fallback as HTMLElement).style.display = 'block';
                      }}
                    />
                    <h1 className="logo-fallback text-xl font-serif font-black text-slate-900 tracking-tight uppercase hidden">JOSELITO</h1>
                  </div>
                ) : (
                  <h1 className="text-xl font-serif font-black text-slate-900 tracking-tight uppercase">JOSELITO</h1>
                )}
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Página 5</p>
              </div>
            </div>
            <div className="flex-1">
              {(() => {
                const weeklyAusentismo = last15Weeks.map(w => {
                  const records = ausentismoData.filter(r => {
                    const d = new Date(r.fecha);
                    return getWeekNumber(d) === w.week && d.getFullYear() === w.year;
                  });
                  if (records.length === 0) return { name: w.label, MOD: 0, MOI: 0, week: w.week, year: w.year };
                  const jornadasMod = records.reduce((acc, r) => acc + r.jornadasPerdidasMod, 0);
                  const jornadasMoi = records.reduce((acc, r) => acc + r.jornadasPerdidasMoi, 0);
                  return { name: w.label, MOD: jornadasMod, MOI: jornadasMoi, week: w.week, year: w.year };
                });
                const monthlyAusentismo = last15Months.map(m => {
                  const records = ausentismoData.filter(r => {
                    const d = new Date(r.fecha);
                    return d.getMonth() === m.month && d.getFullYear() === m.year;
                  });
                  if (records.length === 0) return { name: m.label, MOD: 0, MOI: 0, date: new Date(m.year, m.month, 1) };
                  const jornadasMod = records.reduce((acc, r) => acc + r.jornadasPerdidasMod, 0);
                  const jornadasMoi = records.reduce((acc, r) => acc + r.jornadasPerdidasMoi, 0);
                  return { name: m.label, MOD: jornadasMod, MOI: jornadasMoi, date: new Date(m.year, m.month, 1) };
                });
                return (
                  <div className="grid grid-cols-2 gap-8">
                    {renderEvolutionChart(weeklyAusentismo, 'MOD', 'MOD', '#3b82f6', 'Ausentismo MOD (Semanas)', 'absentismo-mod', false, true)}
                    {renderEvolutionChart(monthlyAusentismo, 'MOD', 'MOD', '#3b82f6', 'Ausentismo MOD (Meses)', 'absentismo-mod', false, true)}
                    {renderEvolutionChart(weeklyAusentismo, 'MOI', 'MOI', '#8b5cf6', 'Ausentismo MOI (Semanas)', 'absentismo-moi', false, true)}
                    {renderEvolutionChart(monthlyAusentismo, 'MOI', 'MOI', '#8b5cf6', 'Ausentismo MOI (Meses)', 'absentismo-moi', false, true)}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* PAGE 5: CALIDAD (LANDSCAPE) */}
          <div data-report-page data-report-landscape className="flex flex-col min-h-[794px] w-[1122px] bg-white p-12 space-y-6 overflow-hidden">
            <div className="flex items-center justify-between border-b-4 border-emerald-600 pb-4">
              <h2 className="text-3xl font-black uppercase tracking-tighter text-emerald-600">Calidad</h2>
              <div className="flex items-center gap-4">
                {JOSELITO_LOGO ? (
                  <div className="relative">
                    <img 
                      src={JOSELITO_LOGO} 
                      alt="JOSELITO" 
                      className="h-6 w-auto" 
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback');
                        if (fallback) (fallback as HTMLElement).style.display = 'block';
                      }}
                    />
                    <h1 className="logo-fallback text-xl font-serif font-black text-slate-900 tracking-tight uppercase hidden">JOSELITO</h1>
                  </div>
                ) : (
                  <h1 className="text-xl font-serif font-black text-slate-900 tracking-tight uppercase">JOSELITO</h1>
                )}
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Página 6</p>
              </div>
            </div>
            <div className="flex-1 space-y-8">
              {(() => {
                const weeklyCalidad = last15Weeks.map(w => {
                  const record = calidadData.find(r => r.semana === w.week && r.anio === w.year);
                  return { name: w.label, count: record ? record.ncInternas : 0, week: w.week, year: w.year };
                });
                const monthlyCalidad = last15Months.map(m => {
                  const records = calidadData.filter(r => r.anio === m.year && r.mes === m.month);
                  const count = records.reduce((acc, r) => acc + r.ncInternas, 0);
                  return { name: m.label, count, date: new Date(m.year, m.month, 1) };
                });
                return (
                  <div className="grid grid-cols-2 gap-8">
                    {renderEvolutionChart(weeklyCalidad, 'count', 'NC INTERNAS', '#10b981', 'Evolución NC Internas (Semanas)', 'calidad', false, true)}
                    {renderEvolutionChart(monthlyCalidad, 'count', 'NC INTERNAS', '#10b981', 'Evolución NC Internas (Meses)', 'calidad', false, true)}
                  </div>
                );
              })()}
              
              <div className="bg-slate-50 p-8 rounded-[3rem] border border-slate-100">
                <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-6 text-center">Evidencias Fotográficas S{selectedWeek}</h3>
                {(() => {
                  const currentRecord = calidadData.find(r => r.semana === selectedWeek && r.anio === selectedYear);
                  if (currentRecord && currentRecord.imagenes && currentRecord.imagenes.length > 0) {
                    return (
                      <div className="grid grid-cols-3 gap-6">
                        {currentRecord.imagenes.slice(0, 6).map((img: string, idx: number) => (
                          <div key={idx} className="rounded-2xl overflow-hidden border-4 border-white shadow-md aspect-video">
                            {img ? (
                              <img src={img} alt={`Calidad ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : null}
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return <p className="text-center text-slate-400 font-bold uppercase text-xs py-10">No hay imágenes para esta semana</p>;
                })()}
              </div>
            </div>
          </div>

          {/* PAGES 6+: CMI WORKSHOPS (LANDSCAPE) */}
          {TALLERES_POR_AREA.map((areaGroup, areaIdx) => {
            const workshopChunks = chunkArray(areaGroup.talleres, 4); // 4 workshops per landscape page
            return workshopChunks.map((chunk, chunkIdx) => (
              <div key={`${areaGroup.area}-${chunkIdx}`} data-report-page data-report-landscape className="flex flex-col min-h-[794px] w-[1122px] bg-white p-12 space-y-6 overflow-hidden">
                <div className="flex items-center justify-between border-b-4 border-indigo-600 pb-4">
                  <h2 className="text-3xl font-black uppercase tracking-tighter text-indigo-600">CMI - {areaGroup.area.toUpperCase()} {workshopChunks.length > 1 ? `(${chunkIdx + 1}/${workshopChunks.length})` : ''}</h2>
                  <div className="flex items-center gap-4">
                    {JOSELITO_LOGO ? (
                      <div className="relative">
                        <img 
                          src={JOSELITO_LOGO} 
                          alt="JOSELITO" 
                          className="h-6 w-auto" 
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback');
                            if (fallback) (fallback as HTMLElement).style.display = 'block';
                          }}
                        />
                        <h1 className="logo-fallback text-xl font-serif font-black text-slate-900 tracking-tight uppercase hidden">JOSELITO</h1>
                      </div>
                    ) : (
                      <h1 className="text-xl font-serif font-black text-slate-900 tracking-tight uppercase">JOSELITO</h1>
                    )}
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Página {7 + areaIdx + chunkIdx}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6 flex-1">
                  {chunk.map((ws, wsIdx) => {
                    const { weeklyData, monthlyData } = getWorkshopData(ws.id);
                    return (
                      <div key={`${ws.id}-${wsIdx}`} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col h-[280px]">
                        <h4 className="text-xs font-black text-slate-800 uppercase mb-4 border-b border-slate-200 pb-2">{ws.name}</h4>
                        <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
                          {renderChart(weeklyData, `SEMANAL`, ws.id, true)}
                          {renderChart(monthlyData, `MENSUAL`, ws.id, true)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })}

          {/* PAGE IdM (LANDSCAPE) */}
          <div data-report-page data-report-landscape className="flex flex-col min-h-[794px] w-[1122px] bg-white p-12 space-y-6 overflow-hidden">
            <div className="flex items-center justify-between border-b-4 border-amber-600 pb-4">
              <h2 className="text-3xl font-black uppercase tracking-tighter text-amber-600">IdM - Ideas de Mejora</h2>
              <div className="flex items-center gap-4">
                {JOSELITO_LOGO ? (
                  <div className="relative">
                    <img 
                      src={JOSELITO_LOGO} 
                      alt="JOSELITO" 
                      className="h-6 w-auto" 
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback');
                        if (fallback) (fallback as HTMLElement).style.display = 'block';
                      }}
                    />
                    <h1 className="logo-fallback text-xl font-serif font-black text-slate-900 tracking-tight uppercase hidden">JOSELITO</h1>
                  </div>
                ) : (
                  <h1 className="text-xl font-serif font-black text-slate-900 tracking-tight uppercase">JOSELITO</h1>
                )}
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Página {7 + TALLERES_POR_AREA.length}</p>
              </div>
            </div>
            <div className="flex-1">
              {renderIdMTab(true)}
            </div>
          </div>

          {/* LAST PAGE: ACTION PLAN (LANDSCAPE, MULTI-PAGE) */}
          {(() => {
            const saved = localStorage.getItem('zitron_top60_actionplan');
            let items: ActionPlanItem[] = [];
            if (saved) {
              try {
                items = JSON.parse(saved);
              } catch (e) {}
            }
            
            const itemChunks = chunkArray(items, 18); // 18 items per landscape page
            if (itemChunks.length === 0) {
              return (
                <div data-report-page data-report-landscape className="flex flex-col min-h-[794px] w-[1122px] bg-white p-12 space-y-6 overflow-hidden">
                  <div className="flex items-center justify-between border-b-4 border-slate-900 pb-4">
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Plan de Acción Estratégico</h2>
                    {JOSELITO_LOGO ? (
                      <div className="relative">
                        <img 
                          src={JOSELITO_LOGO} 
                          alt="JOSELITO" 
                          className="h-8 w-auto" 
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback');
                            if (fallback) (fallback as HTMLElement).style.display = 'block';
                          }}
                        />
                        <h1 className="logo-fallback text-2xl font-serif font-black text-slate-900 tracking-tight uppercase hidden">JOSELITO</h1>
                      </div>
                    ) : (
                      <h1 className="text-2xl font-serif font-black text-slate-900 tracking-tight uppercase">JOSELITO</h1>
                    )}
                  </div>
                  <div className="bg-white rounded-[2rem] border-2 border-slate-900 overflow-hidden shadow-xl p-32 text-center flex-1 flex items-center justify-center">
                    <p className="text-slate-400 font-black uppercase tracking-widest text-xl">No hay acciones registradas</p>
                  </div>
                </div>
              );
            }

            return itemChunks.map((chunk, chunkIdx) => (
              <div key={`action-plan-page-${chunkIdx}`} data-report-page data-report-landscape className="flex flex-col min-h-[794px] w-[1122px] bg-white p-12 space-y-6 overflow-hidden">
                <div className="flex items-center justify-between border-b-4 border-slate-900 pb-4">
                  <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Plan de Acción Estratégico {itemChunks.length > 1 ? `(${chunkIdx + 1}/${itemChunks.length})` : ''}</h2>
                  <div className="flex items-center gap-4">
                    {JOSELITO_LOGO ? (
                      <div className="relative">
                        <img 
                          src={JOSELITO_LOGO} 
                          alt="JOSELITO" 
                          className="h-8 w-auto" 
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback');
                            if (fallback) (fallback as HTMLElement).style.display = 'block';
                          }}
                        />
                        <h1 className="logo-fallback text-2xl font-serif font-black text-slate-900 tracking-tight uppercase hidden">JOSELITO</h1>
                      </div>
                    ) : (
                      <h1 className="text-2xl font-serif font-black text-slate-900 tracking-tight uppercase">JOSELITO</h1>
                    )}
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Página {8 + TALLERES_POR_AREA.length + chunkIdx}</p>
                  </div>
                </div>
                
                <div className="bg-white rounded-[2rem] border-2 border-slate-900 overflow-hidden shadow-xl flex-1">
                  <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                        <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                          <th className="px-3 py-3 w-[40px]">Nº</th>
                          <th className="px-3 py-3 w-[15%]">Asunto</th>
                          <th className="px-3 py-3 w-[30%]">Acción</th>
                          <th className="px-3 py-3 w-[12%]">Responsable</th>
                          <th className="px-3 py-3 w-[80px] text-center">Estado</th>
                          <th className="px-3 py-3 w-[85px]">Fecha Obj.</th>
                          <th className="px-3 py-3 w-[100px]">Avance</th>
                          <th className="px-3 py-3 w-auto">Observaciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {chunk.map(item => {
                        const isClosed = !!(item.fechaCierre && item.fechaCierre.trim() !== '');
                        const today = new Date().toISOString().split('T')[0];
                        const isDelayed = !isClosed && today > item.fechaObjetivo;
                        const status = isClosed ? 'CERRADO' : (isDelayed ? 'RETRASADA' : 'EN MARCHA');
                        
                        return (
                          <tr key={item.id} className="text-[9px] font-bold text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-50 align-top">
                            <td className="px-3 py-2 font-black text-slate-400">#{item.id}</td>
                            <td className="px-3 py-2 uppercase truncate">{item.asunto}</td>
                            <td className="px-3 py-2 leading-tight">{item.accion}</td>
                            <td className="px-3 py-2 uppercase truncate">{item.responsable}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`px-2 py-1 rounded-full text-[8px] font-black ${
                                status === 'CERRADO' ? 'bg-emerald-100 text-emerald-700' :
                                status === 'RETRASADA' ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {status}
                              </span>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">{item.fechaObjetivo}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-indigo-600" style={{ width: `${item.avance}%` }}></div>
                                </div>
                                <span className="min-w-[30px] text-right text-[9px]">{item.avance}%</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 leading-tight text-slate-500 italic">{item.observaciones}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-auto pt-8 flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reporte Generado por</p>
                    <p className="text-sm font-black text-slate-900 uppercase tracking-widest">Sistema de Gestión JOSELITO TOP 60</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado del Plan</p>
                    <p className="text-sm font-black text-indigo-600 uppercase tracking-widest">Actualizado a S{selectedWeek}</p>
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>
      </div>

      <HelpModal 
        isOpen={isHelpModalOpen} 
        onClose={() => setIsHelpModalOpen(false)} 
        areaId="TOP 60" 
      />
      
      <div className="flex flex-col md:flex-row items-center justify-between gap-2 shrink-0">
        {/* TABS NAVIGATION */}
        <div className="flex flex-wrap gap-0.5 bg-slate-100/50 p-0.5 rounded-lg border border-slate-100 flex-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[80px] py-1.5 rounded-md text-[15px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100 scale-[1.02]' 
                  : 'text-slate-500 hover:bg-white hover:text-slate-900'
              }`}
            >
              {tab.name}
            </button>
          ))}
          <button
            onClick={handleSendReport}
            className="flex-1 min-w-[80px] py-1.5 rounded-md text-[15px] font-black uppercase tracking-widest transition-all bg-emerald-600 text-white shadow-md shadow-emerald-100 hover:bg-emerald-700 active:scale-95"
          >
            Enviar Report
          </button>
        </div>

        <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-100 shadow-sm">
          <div className="flex items-center gap-0.5 px-1">
            <span className="text-[10px] font-black text-slate-400 uppercase">Semana</span>
            <select 
              value={selectedWeek} 
              onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
              className="bg-transparent border-none text-[14px] font-black text-slate-700 focus:ring-0 p-0"
            >
              {Array.from({ length: 53 }, (_, i) => i + 1).map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div className="w-px h-3 bg-slate-200"></div>
          <div className="flex items-center gap-0.5 px-1">
            <span className="text-[10px] font-black text-slate-400 uppercase">Año</span>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-transparent border-none text-[14px] font-black text-slate-700 focus:ring-0 p-0"
            >
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div id="top60-dashboard-content" className="flex-1 overflow-y-auto pr-1 space-y-6 no-scrollbar pb-10">
        {activeTab === 'seguridad' && renderSeguridadTab()}
        {activeTab === 'rrhh' && renderRRHHTab()}
        {activeTab === 'calidad' && renderCalidadTab()}
        {activeTab === 'idm' && renderIdMTab()}
        {activeTab === 'adherencia' && (
          <div className="flex flex-col items-center justify-center py-40 text-slate-300 bg-white rounded-[3rem] border border-slate-100 shadow-sm">
            <svg className="w-20 h-20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
            <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">En Construcción</h3>
            <p className="text-[14px] font-bold uppercase tracking-[0.3em] mt-2">Módulo de Adherencia a la Planificación</p>
          </div>
        )}
        {activeTab === 'cmi' && (
          <div className="space-y-8">
            {TALLERES_POR_AREA.map(areaGroup => {
              return (
                <div key={areaGroup.area} className="space-y-4">
                  <div className="flex items-center gap-2 px-2">
                    <div className="h-0.5 flex-1 bg-slate-800 rounded-full"></div>
                    <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">{areaGroup.area}</h2>
                    <div className="h-0.5 flex-1 bg-slate-800 rounded-full"></div>
                  </div>

                  <div className="space-y-8 pl-2 border-l-2 border-slate-200 ml-2">
                    {areaGroup.talleres.map(ws => {
                      const { weeklyData, monthlyData } = getWorkshopData(ws.id);

                      return (
                        <div key={ws.id} className="space-y-3">
                          <div className="flex items-center gap-2 px-2">
                            <div className="h-px flex-1 bg-slate-200"></div>
                            <h3 className="text-[14px] font-black text-slate-600 uppercase tracking-widest">{ws.name}</h3>
                            <div className="h-px flex-1 bg-slate-200"></div>
                          </div>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {renderChart(weeklyData, `SEMANAL`, ws.id)}
                            {renderChart(monthlyData, `MENSUAL`, ws.id)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Power BI */}
      {showPowerBI && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-6xl h-[90vh] rounded-[3rem] overflow-hidden shadow-2xl flex flex-col relative animate-in zoom-in duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-200">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 16H7v-6h4v6zm4 0h-4V9h4v9zm4 0h-4V6h4v9z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Cuadro de Mando de Calidad</h2>
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Power BI Report</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPowerBI(false)}
                className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-slate-400 hover:text-slate-600 hover:scale-110 transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="flex-1 bg-slate-100">
              <iframe 
                src="https://app.powerbi.com/groups/me/reports/0c7e001e-6dc8-41fb-8465-8bc36c407ea5/e222123e7030dd18ab52?experience=power-bi"
                className="w-full h-full border-none"
                title="Power BI Calidad"
                allowFullScreen
              />
            </div>
            <div className="p-4 bg-white border-t border-slate-100 flex justify-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">JOSELITO ECOSYSTEM - CALIDAD POWER BI INTEGRATION</p>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN IMAGE MODAL */}
      {fullscreenImage && (
        <div 
          className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={() => setFullscreenImage(null)}
        >
          <button 
            className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors"
            onClick={() => setFullscreenImage(null)}
          >
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
          <img 
            src={fullscreenImage || undefined} 
            alt="Fullscreen" 
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-in zoom-in duration-300" 
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="absolute bottom-10 text-center text-white/40 font-black uppercase tracking-widest text-[14px]">Presiona ESC para salir</p>
        </div>
      )}

      {fullscreenChart && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-xl flex flex-col p-10 animate-in fade-in zoom-in duration-300">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">{fullscreenChart.title}</h2>
            <button 
              onClick={() => setFullscreenChart(null)}
              className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="flex-1 w-full bg-white rounded-[3rem] p-10 shadow-2xl">
            {fullscreenChart.chart}
          </div>
          <p className="text-center text-white/40 font-black uppercase tracking-widest text-[14px] mt-8">Presiona ESC para salir</p>
        </div>
      )}
    </div>
  );
};

export default TOP60Dashboard;