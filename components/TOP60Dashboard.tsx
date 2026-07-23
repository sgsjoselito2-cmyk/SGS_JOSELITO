import React, { useMemo, useState, useEffect } from 'react';
import { 
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, AreaChart, Area, BarChart, Cell
} from 'recharts';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import { Activity as ActivityIcon, ShieldAlert, Clock, Users, Lock, Unlock, Save, Lightbulb } from 'lucide-react';
import { Activity, OEEObjectives, TaskType, User, ActionPlanItem, PlanAccionCalidad } from '../types';
import { calculateStats, getWeekNumber } from './Dashboard';
import { AREA_NAMES, JOSELITO_LOGO } from '../constants';
import HelpModal from './HelpModal';
import { supabase } from '../lib/supabase';

const parseLocalDate = (dateStr: string) => {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
    return new Date(year, month - 1, day);
  }
  return new Date(dateStr);
};

interface TOP60DashboardProps {
  activities: Activity[];
  history: Activity[];
  allObjectives: Record<string, OEEObjectives[]>;
  operarios: User[];
  ideasMejora: any[];
  passwords?: any;
  mermas?: any[];
  onSaveIDMObjectives?: (presentadas: number, cerradas: number) => Promise<boolean>;
}

const TALLERES_POR_AREA = [
  {
    area: 'Producción',
    talleres: [
      { id: 'sala-blanca', name: 'SALA BLANCA' },
      { id: 'movimiento-jamones', name: 'MOVIMIENTO JAMONES' },
      { id: 'sb-preparacion', name: 'PREP. EXPEDICIONES' },
      { id: 'sb-loncheado', name: 'LONCHEADO SB' },
      { id: 'sb-empaquetado-loncheado', name: 'EMP. LONCHEADO SB' },
      { id: 'sb-empaquetado-deshuesado', name: 'EMP. DESHUESADO SB' },
      { id: 'env-envasado', name: 'ENVASADO' },
      { id: 'env-empaquetado', name: 'EMPAQUETADO ENV' },
      { id: 'expedicion', name: 'EXPEDICIONES' },
      { id: 'preparacion-exp', name: 'PREP. EXPEDICIONES' },
      { id: 'movimientos-dashboard', name: 'DASHBOARD MOVIMIENTOS' }
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
  { id: 'cmi', name: 'Producción' },
  { id: 'idm', name: 'IdM' }
];

const formatDateDMY = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (e) {
    return dateStr;
  }
};

const TOP60Dashboard: React.FC<TOP60DashboardProps> = ({ 
  activities, 
  history, 
  allObjectives, 
  operarios, 
  ideasMejora,
  passwords,
  mermas = [],
  onSaveIDMObjectives
}) => {
  const [activeTab, setActiveTab] = useState('seguridad');
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportProgress, setReportProgress] = useState({ current: 0, total: 0 });

  // State for IDM objectives config & table filter
  const [objPresentadasInput, setObjPresentadasInput] = useState(0);
  const [objCerradasInput, setObjCerradasInput] = useState(0);
  const [idmFilterEstado, setIdmFilterEstado] = useState('Todos');
  const [isSavingObjectives, setIsSavingObjectives] = useState(false);
  const [isEditingUnlocked, setIsEditingUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Security action plan table filters
  const [secFilterEstado, setSecFilterEstado] = useState('Todos');
  const [secFilterGap, setSecFilterGap] = useState('Todos');
  const [secFilterResponsable, setSecFilterResponsable] = useState('Todos');

  // Calidad action plan table filters
  const [calFilterEstado, setCalFilterEstado] = useState('Todos');
  const [calFilterOrigen, setCalFilterOrigen] = useState('Todos');

  // Breakdown toggle state for OEE indicators
  const [openBreakdownId, setOpenBreakdownId] = useState<string | null>(null);
  const [selectedBreakdownWeekObj, setSelectedBreakdownWeekObj] = useState<{ week: number; year: number } | null>(null);

  const getSecurityActionStatus = (r: any) => {
    const real = r.fecha_implantacion_real || r.fechaImplantacionReal || '';
    const prev = r.fecha_implantacion_prevista || r.fechaImplantacionPrevista || '';
    if (real && real.trim() !== '') return 'Cerrado';
    if (!prev) return r.estado || 'Abierto';
    const today = new Date().toISOString().split('T')[0];
    if (prev < today) return 'Retrasado';
    return r.estado || 'En Marcha';
  };

  // Update objectives input values when allObjectives is loaded
  useEffect(() => {
    const getCurrentObjectiveValue = (area: string) => {
      const objs = allObjectives[area] || [];
      if (objs.length === 0) return 0;
      const sorted = [...objs].sort((a, b) => b.valid_from.localeCompare(a.valid_from));
      return sorted[0]?.objetivo || 0;
    };

    setObjPresentadasInput(getCurrentObjectiveValue('idm-presentadas'));
    setObjCerradasInput(getCurrentObjectiveValue('idm-cerradas'));
  }, [allObjectives]);

  const checkPasswordLevel3 = (pin: string) => {
    if (!passwords) return pin === '1234';
    return pin === passwords.directorOperaciones || pin === passwords.asistenciaTecnica || pin === passwords.jefeTaller;
  };

  const handleSaveObjectives = async () => {
    setIsSavingObjectives(true);
    if (onSaveIDMObjectives) {
      const success = await onSaveIDMObjectives(objPresentadasInput, objCerradasInput);
      if (success) {
        setIsEditingUnlocked(false);
      }
    } else {
      const todayStr = new Date().toISOString().split('T')[0];
      try {
        const { error } = await supabase.from('oee_objectives').insert([
          {
            area: 'idm-presentadas',
            indicator_id: 'productividad',
            objetivo: objPresentadasInput,
            valid_from: todayStr,
            disponibilidad: 0,
            rendimiento: 0,
            calidad: 0,
            productividad: 0,
            show_in_top5: true,
            show_in_top15: true,
            show_in_top60: true
          },
          {
            area: 'idm-cerradas',
            indicator_id: 'productividad',
            objetivo: objCerradasInput,
            valid_from: todayStr,
            disponibilidad: 0,
            rendimiento: 0,
            calidad: 0,
            productividad: 0,
            show_in_top5: true,
            show_in_top15: true,
            show_in_top60: true
          }
        ]);
        if (error) throw error;
        alert("Objetivos guardados correctamente.");
        setIsEditingUnlocked(false);
      } catch (e: any) {
        console.error(e);
        alert("Error al guardar objetivos: " + e.message);
      }
    }
    setIsSavingObjectives(false);
  };
  
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
  const [dbPlanAccionRecords, setDbPlanAccionRecords] = useState<any[]>([]);

  const availableGaps = useMemo(() => {
    const gapsSet = new Set<string>();
    dbPlanAccionRecords.forEach((r: any) => {
      const g = r.gap?.trim();
      if (g) gapsSet.add(g);
    });
    return Array.from(gapsSet).sort();
  }, [dbPlanAccionRecords]);

  const availableResponsables = useMemo(() => {
    const respSet = new Set<string>();
    dbPlanAccionRecords.forEach((r: any) => {
      const resp = r.responsable?.trim();
      if (resp) respSet.add(resp);
    });
    return Array.from(respSet).sort();
  }, [dbPlanAccionRecords]);
  const [dbPlanCalidadRecords, setDbPlanCalidadRecords] = useState<PlanAccionCalidad[]>([]);
  const [dbRrhhRecords, setDbRrhhRecords] = useState<any[]>([]);
  const [rrhhData, setRrhhData] = useState<any[]>([]);
  const [ausentismoData, setAusentismoData] = useState<any[]>([]);
  const [calidadData, setCalidadData] = useState<any[]>([]);
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
    // Helper para parsear con seguridad
    const safeParse = (key: string, defaultValue: any) => {
      try {
        const saved = localStorage.getItem(key);
        if (!saved || saved === 'undefined' || saved === 'null') return defaultValue;
        return JSON.parse(saved);
      } catch (e) {
        console.warn(`Error parsing ${key}:`, e);
        return defaultValue;
      }
    };

    // Load data from LocalStorage
    setSeguridadData(safeParse('zitron_top60_seguridad', []));
    setRrhhData(safeParse('zitron_top60_rrhh', []));
    setAusentismoData(safeParse('zitron_top60_ausentismo', []));
    setCalidadData(safeParse('zitron_top60_calidad', []));
    setActionPlanData(safeParse('zitron_top60_actionplan', []));

    // Fetch plan_accion_seguridad from Supabase
    const fetchDbPlanAccion = async () => {
      try {
        const { data, error } = await supabase.from('plan_accion_seguridad').select('*');
        if (error) {
          console.error("Error fetching plan_accion_seguridad:", error);
        } else if (data) {
          setDbPlanAccionRecords(data);
          const mappedActions = data.map((r: any) => ({
            id: r.id,
            fecha: r.fecha,
            tipo: r.tipo,
            gap: r.gap,
            problema: r.que_ha_ocurrido || r.queHaOcurrido || '',
            accion: r.accion || '',
            responsable: r.responsable || '',
            fecha_implantacion_prevista: r.fecha_implantacion_prevista || r.fechaImplantacionPrevista || '',
            fecha_implantacion_real: r.fecha_implantacion_real || r.fechaImplantacionReal || '',
            estado: r.estado
          }));
          setSeguridadData(mappedActions);
        }
      } catch (e) {
        console.error("Error in fetchDbPlanAccion:", e);
      }
    };
    fetchDbPlanAccion();

    // Fetch top60_rrhh from Supabase
    const fetchDbRrhh = async () => {
      try {
        const { data, error } = await supabase.from('top60_rrhh').select('*');
        if (error) {
          console.error("Error fetching top60_rrhh:", error);
        } else if (data) {
          setDbRrhhRecords(data);
        }
      } catch (e) {
        console.error("Error in fetchDbRrhh:", e);
      }
    };
    fetchDbRrhh();

    // Fetch plan_accion_calidad from Supabase
    const fetchDbPlanCalidad = async () => {
      try {
        const { data, error } = await supabase.from('plan_accion_calidad').select('*');
        if (error) {
          console.error("Error fetching plan_accion_calidad:", error);
        } else if (data) {
          const mapped = data.map((dbItem: any) => ({
            id: dbItem.id,
            fecha: dbItem.fecha,
            tipoReclamacion: dbItem.tipo_reclamacion || dbItem.tipoReclamacion || '',
            areaCausante: dbItem.area_causante || dbItem.areaCausante || '',
            descripcionProblema: dbItem.descripcion_problema || dbItem.descripcionProblema || '',
            accionContenedora: dbItem.accion_contenedora || dbItem.accionContenedora || '',
            responsableContenedora: dbItem.responsable_contenedora || dbItem.responsableContenedora || '',
            fechaPrevistaContenedora: dbItem.fecha_prevista_contenedora || dbItem.fechaPrevistaContenedora || '',
            fechaCierreContenedora: dbItem.fecha_cierre_contenedora || dbItem.fechaCierreContenedora || undefined,
            accionCorrectora: dbItem.accion_correctora || dbItem.accionCorrectora || '',
            responsableCorrectora: dbItem.responsable_correctora || dbItem.responsableCorrectora || '',
            fechaPrevistaCorrectora: dbItem.fecha_prevista_correctora || dbItem.fechaPrevistaCorrectora || '',
            fechaCierreCorrectora: dbItem.fecha_cierre_correctora || dbItem.fechaCierreCorrectora || undefined,
            origen: dbItem.origen || undefined,
          }));
          setDbPlanCalidadRecords(mapped);
        }
      } catch (e) {
        console.error("Error in fetchDbPlanCalidad:", e);
      }
    };
    fetchDbPlanCalidad();
  }, []);

  const getObjectiveForDate = (area: string, date: Date, indicatorId: string = 'productividad') => {
    const getObjectivesForArea = (areaId: string) => {
      let objs = allObjectives[areaId];
      if (!objs) {
        const key = Object.keys(allObjectives).find(k => k.toLowerCase() === areaId.toLowerCase());
        objs = key ? allObjectives[key] : undefined;
      }
      
      // Fallback for unified rrhh areas
      if (!objs || objs.length === 0) {
        if (areaId === 'absentismo') {
          objs = allObjectives['absentismo-mod'] || allObjectives['Absentismo-MOD'] || [];
        } else if (areaId === 'ausentismo') {
          objs = allObjectives['ausentismo-mod'] || allObjectives['Ausentismo-MOD'] || [];
        }
      }
      return objs || [];
    };
    
    const objs = [...getObjectivesForArea(area)].sort((a, b) => {
      const vComp = (b.valid_from || '').localeCompare(a.valid_from || '');
      if (vComp !== 0) return vComp;
      const aTop = (a.show_in_top15 || a.showInTop15 || a.show_in_top60 || a.showInTop60) ? 1 : 0;
      const bTop = (b.show_in_top15 || b.showInTop15 || b.show_in_top60 || b.showInTop60) ? 1 : 0;
      return bTop - aTop;
    });
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    // Exact match for indicator
    const getVal = (id: string) => {
      const spec = objs.find(o => (o.valid_from || '') <= dateStr && (
        o.indicator_id === id ||
        (id === 'pph_blister_emp' && (o.indicator_id === 'pph_blister' || o.indicator_id === 'pph_blister_emp' || o.indicator_id === 'pph'))
      ));
      if (spec && spec.objetivo !== undefined && spec.objetivo !== null) return spec.objetivo;
      
      const master = objs.find(o => (o.valid_from || '') <= dateStr && (o.indicator_id === 'productividad' || o.indicator_id === 'oee' || !o.indicator_id));
      if (master) {
        if (id === 'disponibilidad') return master.disponibilidad || 0;
        if (id === 'rendimiento') return master.rendimiento || 0;
        if (id === 'calidad') return master.calidad || 0;
      }
      return 0;
    };

    if (indicatorId === 'productividad' || indicatorId === 'oee') {
      const specProd = objs.find(o => o.valid_from <= dateStr && (o.indicator_id === 'productividad' || o.indicator_id === 'oee'));
      if (specProd && specProd.objetivo) return specProd.objetivo;
      
      const d = getVal('disponibilidad');
      const r = getVal('rendimiento');
      const c = getVal('calidad');
      const calcObj = parseFloat(((d * r * c) / 10000).toFixed(1));
      if (calcObj > 0) return calcObj;
      if (area === 'env-envasado' || area === 'env-empaquetado') return 45.0;
      return 0;
    }

    return getVal(indicatorId);
  };

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

  // SALA BLANCA 5 Indicators configuration
  const SALA_BLANCA_INDICATORS = useMemo(() => [
    {
      id: 'pph_preparacion',
      workshopId: 'sb-preparacion',
      title: 'PPH Deshuesado/Prensado',
      getValue: (stats: any) => parseFloat(stats.pph) || 0,
      indicatorId: 'pph',
      isPercentage: false,
      color: '#6366f1',
      unit: 'PPH'
    },
    {
      id: 'oee_loncheado',
      workshopId: 'sb-loncheado',
      title: 'OEE Loncheado',
      getValue: (stats: any) => parseFloat(stats.productividad) || 0,
      indicatorId: 'productividad',
      isPercentage: true,
      color: '#3b82f6',
      unit: '%'
    },
    {
      id: 'merma_loncheado',
      workshopId: 'sb-loncheado',
      title: 'Merma Loncheado',
      getValue: (stats: any) => parseFloat(stats.merma1) || 0,
      indicatorId: 'merma1',
      isPercentage: true,
      color: '#f59e0b',
      unit: '%'
    },
    {
      id: 'pph_emp_loncheado',
      workshopId: 'sb-empaquetado-loncheado',
      title: 'PPH Empaquetado Loncheado',
      getValue: (stats: any) => parseFloat(stats.pph_blister_emp) || parseFloat(stats.pph_blister) || parseFloat(stats.pph) || 0,
      indicatorId: 'pph_blister_emp',
      isPercentage: false,
      color: '#8b5cf6',
      unit: 'PPH'
    },
    {
      id: 'pph_emp_deshuesado',
      workshopId: 'sb-empaquetado-deshuesado',
      title: 'PPH Emp. Deshuesado',
      getValue: (stats: any) => parseFloat(stats.pph) || 0,
      indicatorId: 'pph',
      isPercentage: false,
      color: '#06b6d4',
      unit: 'PPH'
    }
  ], []);

  const salaBlancaWeeklyData = useMemo(() => {
    return SALA_BLANCA_INDICATORS.map(ind => {
      const dataPoints = last15Weeks.map(w => {
        const weekActivities = allData.filter(a => {
          if (!a.area || !a.fecha) return false;
          if (a.area.toLowerCase() !== ind.workshopId.toLowerCase()) return false;
          const d = parseLocalDate(a.fecha);
          return getWeekNumber(d) === w.week && d.getFullYear() === w.year;
        });

        const weekMermas = (mermas || []).filter(m => {
          if (!m.fecha || !m.area) return false;
          if (m.area.toLowerCase() !== ind.workshopId.toLowerCase()) return false;
          const md = parseLocalDate(m.fecha);
          return getWeekNumber(md) === w.week && md.getFullYear() === w.year;
        });

        const date = new Date(w.year, 0, 1);
        date.setDate(date.getDate() + (w.week - 1) * 7);

        const hasData = weekActivities.length > 0 || weekMermas.length > 0;
        let val = 0;
        if (hasData) {
          const stats = calculateStats(weekActivities, ind.workshopId, weekMermas);
          val = ind.getValue(stats);
        }

        let obj = getObjectiveForDate(ind.workshopId, date, ind.indicatorId);
        if (!obj && ind.id === 'merma_loncheado') {
          obj = getObjectiveForDate(ind.workshopId, date, 'merma');
        }
        if (ind.id === 'oee_loncheado' && (!obj || obj === 40)) {
          obj = 45.0;
        }

        return {
          name: `S${w.week}`,
          value: val,
          Objective: obj || 0,
          week: w.week,
          year: w.year,
          date
        };
      });

      return { ...ind, data: dataPoints };
    });
  }, [allData, mermas, last15Weeks, allObjectives, SALA_BLANCA_INDICATORS]);

  const salaBlancaMonthlyData = useMemo(() => {
    return SALA_BLANCA_INDICATORS.map(ind => {
      const dataPoints = last15Months.map(m => {
        const monthActivities = allData.filter(a => {
          if (!a.area || !a.fecha) return false;
          if (a.area.toLowerCase() !== ind.workshopId.toLowerCase()) return false;
          const d = parseLocalDate(a.fecha);
          return d.getMonth() === m.month && d.getFullYear() === m.year;
        });

        const monthMermas = (mermas || []).filter(m => {
          if (!m.fecha || !m.area) return false;
          if (m.area.toLowerCase() !== ind.workshopId.toLowerCase()) return false;
          const md = parseLocalDate(m.fecha);
          return md.getMonth() === m.month && md.getFullYear() === m.year;
        });

        const date = new Date(m.year, m.month, 1);

        const hasData = monthActivities.length > 0 || monthMermas.length > 0;
        let val = 0;
        if (hasData) {
          const stats = calculateStats(monthActivities, ind.workshopId, monthMermas);
          val = ind.getValue(stats);
        }

        let obj = getObjectiveForDate(ind.workshopId, date, ind.indicatorId);
        if (!obj && ind.id === 'merma_loncheado') {
          obj = getObjectiveForDate(ind.workshopId, date, 'merma');
        }
        if (ind.id === 'oee_loncheado' && (!obj || obj === 40)) {
          obj = 45.0;
        }

        return {
          name: m.label,
          value: val,
          Objective: obj || 0,
          month: m.month,
          year: m.year,
          date
        };
      });

      return { ...ind, data: dataPoints };
    });
  }, [allData, mermas, last15Months, allObjectives, SALA_BLANCA_INDICATORS]);

  // EMBUTIDO Indicators configuration
  const EMBUTIDO_INDICATORS = useMemo(() => [
    {
      id: 'oee_envasado',
      workshopId: 'env-envasado',
      title: 'OEE Envasado',
      getValue: (stats: any) => parseFloat(stats.productividad) || 0,
      indicatorId: 'productividad',
      isPercentage: true,
      color: '#3b82f6',
      unit: '%'
    },
    {
      id: 'oee_empaquetado',
      workshopId: 'env-empaquetado',
      title: 'OEE Empaquetado',
      getValue: (stats: any) => parseFloat(stats.productividad) || 0,
      indicatorId: 'productividad',
      isPercentage: true,
      color: '#10b981',
      unit: '%'
    }
  ], []);

  const embutidoWeeklyData = useMemo(() => {
    return EMBUTIDO_INDICATORS.map(ind => {
      const dataPoints = last15Weeks.map(w => {
        const weekActivities = allData.filter(a => {
          if (!a.area || !a.fecha) return false;
          if (a.area.toLowerCase() !== ind.workshopId.toLowerCase()) return false;
          const d = parseLocalDate(a.fecha);
          return getWeekNumber(d) === w.week && d.getFullYear() === w.year;
        });

        const weekMermas = (mermas || []).filter(m => {
          if (!m.fecha || !m.area) return false;
          if (m.area.toLowerCase() !== ind.workshopId.toLowerCase()) return false;
          const md = parseLocalDate(m.fecha);
          return getWeekNumber(md) === w.week && md.getFullYear() === w.year;
        });

        const date = new Date(w.year, 0, 1);
        date.setDate(date.getDate() + (w.week - 1) * 7);

        const hasData = weekActivities.length > 0 || weekMermas.length > 0;
        let val = 0;
        if (hasData) {
          const stats = calculateStats(weekActivities, ind.workshopId, weekMermas);
          val = ind.getValue(stats);
        }

        const obj = getObjectiveForDate(ind.workshopId, date, ind.indicatorId);

        return {
          name: `S${w.week}`,
          value: val,
          Objective: obj || 0,
          week: w.week,
          year: w.year,
          date
        };
      });

      return { ...ind, data: dataPoints };
    });
  }, [allData, mermas, last15Weeks, allObjectives, EMBUTIDO_INDICATORS]);

  const embutidoMonthlyData = useMemo(() => {
    return EMBUTIDO_INDICATORS.map(ind => {
      const dataPoints = last15Months.map(m => {
        const monthActivities = allData.filter(a => {
          if (!a.area || !a.fecha) return false;
          if (a.area.toLowerCase() !== ind.workshopId.toLowerCase()) return false;
          const d = parseLocalDate(a.fecha);
          return d.getMonth() === m.month && d.getFullYear() === m.year;
        });

        const monthMermas = (mermas || []).filter(m => {
          if (!m.fecha || !m.area) return false;
          if (m.area.toLowerCase() !== ind.workshopId.toLowerCase()) return false;
          const md = parseLocalDate(m.fecha);
          return md.getMonth() === m.month && md.getFullYear() === m.year;
        });

        const date = new Date(m.year, m.month, 1);

        const hasData = monthActivities.length > 0 || monthMermas.length > 0;
        let val = 0;
        if (hasData) {
          const stats = calculateStats(monthActivities, ind.workshopId, monthMermas);
          val = ind.getValue(stats);
        }

        const obj = getObjectiveForDate(ind.workshopId, date, ind.indicatorId);

        return {
          name: m.label,
          value: val,
          Objective: obj || 0,
          month: m.month,
          year: m.year,
          date
        };
      });

      return { ...ind, data: dataPoints };
    });
  }, [allData, mermas, last15Months, allObjectives, EMBUTIDO_INDICATORS]);

  const weeklyAbsentismo = useMemo(() => {
    return last15Weeks.map(w => {
      // 1. Search for PERSONAL_TOP60 record
      const personalRecord = dbRrhhRecords.find(r => {
        if (!r.fecha) return false;
        const parts = r.fecha.split('-');
        const d = parts.length === 3 ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) : new Date(r.fecha);
        return getWeekNumber(d) === w.week && d.getFullYear() === w.year && r.area === 'PERSONAL_TOP60';
      });

      // 2. Search for legacy absentismo record
      const legacyRecord = dbRrhhRecords.find(r => {
        if (!r.fecha) return false;
        const parts = r.fecha.split('-');
        const d = parts.length === 3 ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) : new Date(r.fecha);
        return getWeekNumber(d) === w.week && d.getFullYear() === w.year && r.area === 'absentismo';
      });

      let pct = 0;
      if (personalRecord) {
        try {
          const parsed = JSON.parse(personalRecord.comentarios);
          const teo = parsed.jornadasTeoricas || 0;
          const baja = parsed.jornadasPerdidasBaja || 0;
          pct = teo > 0 ? (baja / teo) * 100 : 0;
        } catch (e) {
          pct = Number(personalRecord.valor || 0);
        }
      } else if (legacyRecord) {
        pct = Number(legacyRecord.valor || 0);
      }

      return {
        name: w.label,
        value: pct,
        week: w.week,
        year: w.year
      };
    });
  }, [dbRrhhRecords, last15Weeks]);

  const monthlyAbsentismo = useMemo(() => {
    return last15Months.map(m => {
      const personalRecords = dbRrhhRecords.filter(r => {
        if (!r.fecha) return false;
        const parts = r.fecha.split('-');
        const d = parts.length === 3 ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) : new Date(r.fecha);
        return d.getMonth() === m.month && d.getFullYear() === m.year && r.area === 'PERSONAL_TOP60';
      });

      const legacyRecords = dbRrhhRecords.filter(r => {
        if (!r.fecha) return false;
        const parts = r.fecha.split('-');
        const d = parts.length === 3 ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) : new Date(r.fecha);
        return d.getMonth() === m.month && d.getFullYear() === m.year && r.area === 'absentismo';
      });

      let pct = 0;
      if (personalRecords.length > 0) {
        let totalTeo = 0;
        let totalBaja = 0;
        personalRecords.forEach(r => {
          try {
            const parsed = JSON.parse(r.comentarios);
            totalTeo += parsed.jornadasTeoricas || 0;
            totalBaja += parsed.jornadasPerdidasBaja || 0;
          } catch (e) {}
        });
        pct = totalTeo > 0 ? (totalBaja / totalTeo) * 100 : 0;
      } else if (legacyRecords.length > 0) {
        const sum = legacyRecords.reduce((acc, r) => acc + Number(r.valor || 0), 0);
        pct = sum / legacyRecords.length;
      }

      return {
        name: m.label,
        value: pct,
        date: new Date(m.year, m.month, 1)
      };
    });
  }, [dbRrhhRecords, last15Months]);

  const weeklyAusentismo = useMemo(() => {
    return last15Weeks.map(w => {
      const personalRecord = dbRrhhRecords.find(r => {
        if (!r.fecha) return false;
        const parts = r.fecha.split('-');
        const d = parts.length === 3 ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) : new Date(r.fecha);
        return getWeekNumber(d) === w.week && d.getFullYear() === w.year && r.area === 'PERSONAL_TOP60';
      });

      const legacyRecord = dbRrhhRecords.find(r => {
        if (!r.fecha) return false;
        const parts = r.fecha.split('-');
        const d = parts.length === 3 ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) : new Date(r.fecha);
        return getWeekNumber(d) === w.week && d.getFullYear() === w.year && r.area === 'ausentismo';
      });

      let pct = 0;
      if (personalRecord) {
        try {
          const parsed = JSON.parse(personalRecord.comentarios);
          const teo = parsed.jornadasTeoricas || 0;
          const ausen = parsed.jornadasPerdidasAusentismo || 0;
          pct = teo > 0 ? (ausen / teo) * 100 : 0;
        } catch (e) {
          pct = Number(personalRecord.valor || 0);
        }
      } else if (legacyRecord) {
        pct = Number(legacyRecord.valor || 0);
      }

      return {
        name: w.label,
        value: pct,
        week: w.week,
        year: w.year
      };
    });
  }, [dbRrhhRecords, last15Weeks]);

  const monthlyAusentismo = useMemo(() => {
    return last15Months.map(m => {
      const personalRecords = dbRrhhRecords.filter(r => {
        if (!r.fecha) return false;
        const parts = r.fecha.split('-');
        const d = parts.length === 3 ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) : new Date(r.fecha);
        return d.getMonth() === m.month && d.getFullYear() === m.year && r.area === 'PERSONAL_TOP60';
      });

      const legacyRecords = dbRrhhRecords.filter(r => {
        if (!r.fecha) return false;
        const parts = r.fecha.split('-');
        const d = parts.length === 3 ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) : new Date(r.fecha);
        return d.getMonth() === m.month && d.getFullYear() === m.year && r.area === 'ausentismo';
      });

      let pct = 0;
      if (personalRecords.length > 0) {
        let totalTeo = 0;
        let totalAusen = 0;
        personalRecords.forEach(r => {
          try {
            const parsed = JSON.parse(r.comentarios);
            totalTeo += parsed.jornadasTeoricas || 0;
            totalAusen += parsed.jornadasPerdidasAusentismo || 0;
          } catch (e) {}
        });
        pct = totalTeo > 0 ? (totalAusen / totalTeo) * 100 : 0;
      } else if (legacyRecords.length > 0) {
        const sum = legacyRecords.reduce((acc, r) => acc + Number(r.valor || 0), 0);
        pct = sum / legacyRecords.length;
      }

      return {
        name: m.label,
        value: pct,
        date: new Date(m.year, m.month, 1)
      };
    });
  }, [dbRrhhRecords, last15Months]);

  const weeklyCalidad = useMemo(() => {
    return last15Weeks.map(w => {
      const records = dbPlanCalidadRecords.filter(r => {
        if (!r.fecha) return false;
        if (!r.origen) return false; // Count only when "origen" is defined (not null/vacío)
        const d = new Date(r.fecha);
        return getWeekNumber(d) === w.week && d.getFullYear() === w.year;
      });

      const total = records.length;
      const internas = records.filter(r => r.origen === 'Interna').length;
      const externas = records.filter(r => r.origen === 'Externa').length;

      const date = new Date(w.year, 0, 1);
      date.setDate(date.getDate() + (w.week - 1) * 7);
      const objective = getObjectiveForDate('calidad-reclamaciones', date) || 0;

      return {
        name: w.label,
        total,
        internas,
        externas,
        Objective: objective,
        week: w.week,
        year: w.year
      };
    });
  }, [dbPlanCalidadRecords, last15Weeks, allObjectives]);

  const monthlyCalidad = useMemo(() => {
    return last15Months.map(m => {
      const records = dbPlanCalidadRecords.filter(r => {
        if (!r.fecha) return false;
        if (!r.origen) return false; // Count only when "origen" is defined (not null/vacío)
        const d = new Date(r.fecha);
        return d.getMonth() === m.month && d.getFullYear() === m.year;
      });

      const total = records.length;
      const internas = records.filter(r => r.origen === 'Interna').length;
      const externas = records.filter(r => r.origen === 'Externa').length;

      const date = new Date(m.year, m.month, 1);
      const objective = getObjectiveForDate('calidad-reclamaciones', date) || 0;

      return {
        name: m.label,
        total,
        internas,
        externas,
        Objective: objective,
        month: m.month,
        year: m.year
      };
    });
  }, [dbPlanCalidadRecords, last15Months, allObjectives]);

  const dashboardRegistrosPersonal = useMemo(() => {
    const list: any[] = [];
    const addedFechas = new Set<string>();

    dbRrhhRecords.forEach(r => {
      if (r.area === 'PERSONAL_TOP60') {
        let mapped;
        if (r.comentarios && r.comentarios.startsWith('{')) {
          try {
            const parsed = JSON.parse(r.comentarios);
            mapped = {
              id: r.id,
              fecha: r.fecha,
              jornadasTeoricas: parsed.jornadasTeoricas || 0,
              jornadasPerdidasBaja: parsed.jornadasPerdidasBaja || 0,
              jornadasPerdidasAusentismo: parsed.jornadasPerdidasAusentismo || 0,
            };
          } catch (e) {
            // Fallback
          }
        }
        if (!mapped) {
          mapped = {
            id: r.id,
            fecha: r.fecha,
            jornadasTeoricas: Number(r.jornadas_teoricas || r.jornadasTeoricas || 100),
            jornadasPerdidasBaja: Number(r.jornadas_perdidas_baja || r.jornadasPerdidasBaja || 0),
            jornadasPerdidasAusentismo: Number(r.jornadas_perdidas_ausentismo || r.jornadasPerdidasAusentismo || 0),
          };
        }
        list.push(mapped);
        addedFechas.add(r.fecha);
      }
    });

    const groupedOld: Record<string, { absentismo?: number; ausentismo?: number; comentarios?: string }> = {};
    dbRrhhRecords.forEach(r => {
      if (r.area === 'absentismo' || r.area === 'ausentismo') {
        if (!groupedOld[r.fecha]) {
          groupedOld[r.fecha] = {};
        }
        if (r.area === 'absentismo') {
          groupedOld[r.fecha].absentismo = r.valor;
        } else {
          groupedOld[r.fecha].ausentismo = r.valor;
        }
        if (r.comentarios) {
          groupedOld[r.fecha].comentarios = r.comentarios;
        }
      }
    });

    Object.entries(groupedOld).forEach(([fecha, data]) => {
      if (!addedFechas.has(fecha)) {
        list.push({
          id: `${fecha}_synthesized`,
          fecha,
          jornadasTeoricas: 100,
          jornadasPerdidasBaja: data.absentismo || 0,
          jornadasPerdidasAusentismo: data.ausentismo || 0
        });
      }
    });

    return list.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [dbRrhhRecords]);

  const globalProductivity = useMemo(() => {
    const weekData = history.filter(h => {
      const d = parseLocalDate(h.fecha);
      return getWeekNumber(d) === selectedWeek && d.getFullYear() === selectedYear;
    });
    if (weekData.length === 0) return 0;
    const stats = calculateStats(weekData);
    return Math.round(parseFloat(stats.productividad) || 0);
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
      const ad = parseLocalDate(a.fecha);
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

    // Helper to get component objectives with priority
    const getObjectivesAtDate = (dateStr: string) => {
      const objs = [...getObjectivesForArea(wsId)].sort((a, b) => b.valid_from.localeCompare(a.valid_from));
      
      const getVal = (id: string) => {
        // 1. Specific record for this indicator
        const spec = objs.find(o => o.valid_from <= dateStr && o.indicator_id === id);
        if (spec && spec.objetivo) return spec.objetivo;
        
        // 2. Master OEE record component
        const master = objs.find(o => o.valid_from <= dateStr && (o.indicator_id === 'productividad' || o.indicator_id === 'oee' || !o.indicator_id));
        if (master) {
          if (id === 'disponibilidad') return master.disponibilidad || 0;
          if (id === 'rendimiento') return master.rendimiento || 0;
          if (id === 'calidad') return master.calidad || 0;
        }
        return 0;
      };

      const disp = getVal('disponibilidad');
      const rend = getVal('rendimiento');
      const cal = getVal('calidad');

      // Now for productivity (master goal)
      const specProd = objs.find(o => o.valid_from <= dateStr && (o.indicator_id === 'productividad' || o.indicator_id === 'oee'));
      let prod = 0;
      if (specProd && specProd.objetivo) {
        prod = specProd.objetivo;
      } else {
        // Fallback: calculate from component objectives (which also follow priority)
        prod = parseFloat(((disp * rend * cal) / 10000).toFixed(1));
      }

      return { disp, rend, cal, prod };
    };

    const weeklyData = last15Weeks.map(w => {
      const weekKey = `${w.week}-${w.year}`;
      const data = weeklyBuckets[weekKey] || [];
      
      // Use Sunday of the week for objective lookup (ensures objective set during the week applies)
      const date = new Date(w.year, 0, 1);
      date.setDate(date.getDate() + (w.week * 7) - 1); 
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      const objsAtDate = getObjectivesAtDate(dateStr);
      const objective = objsAtDate.prod;

      const hasProduction = data.some(a => a.tipoTarea === TaskType.PRODUCCION);
      
      if (!hasProduction) {
        return { 
          name: w.label, 
          Disp: 0, Rto: 0, Cal: 0, Prod: 0, 
          Obj: objective, ObjDisp: objsAtDate.disp, ObjRto: objsAtDate.rend, ObjCal: objsAtDate.cal 
        };
      }
      
      const stats = calculateStats(data, wsId);
      return {
        name: w.label,
        Disp: parseFloat(stats.disponibilidad) || 0,
        Rto: parseFloat(stats.rendimiento) || 0,
        Cal: parseFloat(stats.calidad) || 0,
        Prod: parseFloat(stats.productividad) || 0,
        Obj: objective,
        ObjDisp: objsAtDate.disp,
        ObjRto: objsAtDate.rend,
        ObjCal: objsAtDate.cal
      };
    });

    const monthlyData = last15Months.map(m => {
      const monthKey = `${m.month}-${m.year}`;
      const data = monthlyBuckets[monthKey] || [];

      // Use last day of month for objective lookup
      const date = new Date(m.year, m.month + 1, 0);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      const objsAtDate = getObjectivesAtDate(dateStr);
      const objective = objsAtDate.prod;

      const hasProduction = data.some(a => a.tipoTarea === TaskType.PRODUCCION);
      
      if (!hasProduction) {
        return { 
          name: m.label, 
          Disp: 0, Rto: 0, Cal: 0, Prod: 0, 
          Obj: objective, ObjDisp: objsAtDate.disp, ObjRto: objsAtDate.rend, ObjCal: objsAtDate.cal 
        };
      }
      
      const stats = calculateStats(data, wsId);
      return {
        name: m.label,
        Disp: parseFloat(stats.disponibilidad) || 0,
        Rto: parseFloat(stats.rendimiento) || 0,
        Cal: parseFloat(stats.calidad) || 0,
        Prod: parseFloat(stats.productividad) || 0,
        Obj: objective,
        ObjDisp: objsAtDate.disp,
        ObjRto: objsAtDate.rend,
        ObjCal: objsAtDate.cal
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
    const isMovimientoJamones = areaId === 'movimiento-jamones' || areaId === 'movimiento-jamones-log';
    const isEmpaquetadoLoncheado = areaId === 'sb-empaquetado-loncheado';
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
        objValue = getObjectiveForDate(areaId, date, (isMovimientoJamones || isEmpaquetadoLoncheado) ? 'disponibilidad' : 'productividad');
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
          {!isMovimientoJamones && !isEmpaquetadoLoncheado && (
            <Area type="monotone" dataKey="Prod" fill="#eab308" fillOpacity={0.1} stroke="none" legendType="none" isAnimationActive={false} />
          )}
          
          <Bar dataKey="Disp" name="Disponibilidad" fill="#3b82f6" radius={[1, 1, 0, 0]} maxBarSize={15} isAnimationActive={false} />
          {!isMovimientoJamones && !isEmpaquetadoLoncheado && (
            <Bar dataKey="Rto" name="Rendimiento" fill="#f97316" radius={[1, 1, 0, 0]} maxBarSize={15} isAnimationActive={false} />
          )}
          {!isMovimientoJamones && (
            <Bar dataKey="Cal" name="Calidad" fill="#94a3b8" radius={[1, 1, 0, 0]} maxBarSize={15} isAnimationActive={false} />
          )}
          
          {/* Productividad como línea delante para mantener orden de leyenda y definición */}
          {!isMovimientoJamones && !isEmpaquetadoLoncheado && (
            <Line type="monotone" dataKey="Prod" name="Productividad" stroke="#eab308" strokeWidth={2} dot={{r: 1.5, strokeWidth: 1}} activeDot={{r: 3}} isAnimationActive={false}>
              <LabelList dataKey="Prod" position="top" formatter={(val: number) => val > 0 ? `${val.toFixed(1)}%` : ''} style={{ fontSize: '6px', fontWeight: 'bold', fill: '#334155' }} />
            </Line>
          )}
          
          {areaId && (
            <Line type="stepAfter" dataKey="Objective" name={(isMovimientoJamones || isEmpaquetadoLoncheado) ? "OBJETIVO DISP." : "OBJETIVO"} stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} isAnimationActive={false} />
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

  const renderEvolutionChart = (data: any[], dataKey: string, name: string, color: string, title: string, objectiveArea?: string, isPercentage?: boolean, isReport = false, chartType: 'area' | 'bar' = 'area', indicatorId?: string) => {
    const chartData = data.map(d => {
      let objValue = d.Objective;
      if ((objValue === undefined || objValue === 0) && objectiveArea) {
        let date = new Date();
        if (d.date) date = new Date(d.date);
        else if (d.year && d.week) {
          date = new Date(d.year, 0, 1);
          date.setDate(date.getDate() + (d.week - 1) * 7);
        }
        objValue = getObjectiveForDate(objectiveArea, date, indicatorId);
      }
      return { ...d, Objective: objValue || 0 };
    });

    const hasObjective = chartData.some(d => d.Objective > 0);

    const chart = (
      <ResponsiveContainer width="100%" height="100%" minHeight={isReport ? 220 : 250} debounce={100}>
        <ComposedChart data={chartData} margin={{ top: 15, right: 10, bottom: 30, left: -20 }}>
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
            formatter={(val: any, nameStr: string) => isPercentage ? [`${Number(val).toFixed(1)}%`, nameStr] : [val, nameStr]}
          />
          <Legend wrapperStyle={{fontSize: '8px', fontWeight: 'bold', paddingTop: '15px'}} />
          {chartType === 'bar' ? (
            <Bar dataKey={dataKey} name={name} fill={color} radius={[2, 2, 0, 0]} maxBarSize={20} isAnimationActive={false}>
              <LabelList 
                dataKey={dataKey} 
                position="top" 
                formatter={(val: number) => val > 0 ? (isPercentage ? `${val.toFixed(1)}%` : `${val.toFixed(0)}`) : ''} 
                style={{ fontSize: '7px', fontWeight: 'bold', fill: '#334155' }} 
              />
            </Bar>
          ) : (
            <Area type="monotone" dataKey={dataKey} name={name} stroke={color} fill={color} fillOpacity={0.1} strokeWidth={3} isAnimationActive={false} />
          )}
          {hasObjective && (
            <Line type="stepAfter" dataKey="Objective" name="OBJETIVO" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} isAnimationActive={false} />
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

  const renderOEEBreakdown = (ind: any) => {
    if (openBreakdownId !== ind.id) return null;

    const targetWeek = selectedBreakdownWeekObj || { week: selectedWeek, year: selectedYear };

    const weekActivities = allData.filter(a => {
      if (!a.area || !a.fecha) return false;
      if (a.area.toLowerCase() !== ind.workshopId.toLowerCase()) return false;
      const d = parseLocalDate(a.fecha);
      return getWeekNumber(d) === targetWeek.week && d.getFullYear() === targetWeek.year;
    });

    const weekMermas = (mermas || []).filter(m => {
      if (!m.fecha || !m.area) return false;
      if (m.area.toLowerCase() !== ind.workshopId.toLowerCase()) return false;
      const md = parseLocalDate(m.fecha);
      return getWeekNumber(md) === targetWeek.week && md.getFullYear() === targetWeek.year;
    });

    const stats = calculateStats(weekActivities, ind.workshopId, weekMermas);

    // Pareto for Esperas/Averias
    const esperas: Record<string, number> = {};
    weekActivities.forEach(act => {
      const isEA = act.tipoTarea === 'E' || act.tipoTarea === 'A' || act.tipoTarea === TaskType.ESPERAS || act.tipoTarea === TaskType.AVERIA;
      if (isEA) {
        const key = act.formato || 'Sin formato / Varios';
        esperas[key] = (esperas[key] || 0) + (act.duracionMin || 0);
      }
    });

    const paretoData = Object.entries(esperas)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const PARETO_COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#64748b'];

    return (
      <div className="mt-4 p-4 bg-white rounded-xl border border-blue-200 shadow-md space-y-4">
        {/* Header & Week Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
              Desglose D/R/C & Pareto — {ind.title}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
              Semana {targetWeek.week} ({targetWeek.year})
            </span>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto max-w-full py-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Semana:</span>
            {last15Weeks.slice(-8).map(w => (
              <button
                key={`${w.year}-${w.week}`}
                type="button"
                onClick={() => setSelectedBreakdownWeekObj(w)}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition-colors cursor-pointer ${
                  targetWeek.week === w.week && targetWeek.year === w.year
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                S{w.week}
              </button>
            ))}
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* 1. D/R/C Breakdown */}
          <div className="lg:col-span-1 space-y-2">
            <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-2">
              1. Desglose D / R / C
            </h4>
            <div className="grid grid-cols-1 gap-2">
              <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-blue-700 uppercase">Disponibilidad</div>
                  <div className="text-[10px] text-blue-500 font-medium">Tiempo operativo / disponible</div>
                </div>
                <div className="text-lg font-black text-blue-800">
                  {parseFloat(stats.disponibilidad || '0').toFixed(1)}%
                </div>
              </div>

              <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-100 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-emerald-700 uppercase">Rendimiento</div>
                  <div className="text-[10px] text-emerald-500 font-medium">Velocidad real / estándar</div>
                </div>
                <div className="text-lg font-black text-emerald-800">
                  {parseFloat(stats.rendimiento || '0').toFixed(1)}%
                </div>
              </div>

              <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-100 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-amber-700 uppercase">Calidad</div>
                  <div className="text-[10px] text-amber-500 font-medium">Conforme / total</div>
                </div>
                <div className="text-lg font-black text-amber-800">
                  {parseFloat(stats.calidad || '0').toFixed(1)}%
                </div>
              </div>

              <div className="p-3 bg-slate-900 text-white rounded-lg flex items-center justify-between shadow-xs">
                <div>
                  <div className="text-[10px] font-bold text-slate-300 uppercase">Productividad (OEE)</div>
                  <div className="text-[10px] text-slate-400">D × R × C</div>
                </div>
                <div className="text-xl font-black text-white">
                  {parseFloat(stats.productividad || '0').toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* 2. Pareto Chart */}
          <div className="lg:col-span-2 space-y-2">
            <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-2">
              2. Pareto Causas de Baja Disponibilidad (Top 8 Minutos Esperas/Averías)
            </h4>
            {paretoData.length > 0 ? (
              <div className="h-56 w-full bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paretoData} layout="vertical" margin={{ top: 5, right: 35, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 9, fontWeight: 700 }} tickFormatter={(val) => `${val}m`} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 8, fontWeight: 700 }} width={120} axisLine={false} tickLine={false} />
                    <Tooltip 
                      formatter={(val: number) => [`${val} minutos`, 'Duración']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '10px', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={20}>
                      {paretoData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PARETO_COLORS[index % PARETO_COLORS.length]} />
                      ))}
                      <LabelList dataKey="value" position="right" formatter={(val: number) => `${val}m`} style={{ fontSize: '8px', fontWeight: 'bold', fill: '#475569' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-56 w-full bg-slate-50 rounded-lg border border-slate-200 border-dashed flex flex-col items-center justify-center text-slate-400 text-xs font-semibold p-4">
                <span>No hay registros de esperas o averías en la Semana {targetWeek.week}.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderQualityMultiBarChart = (data: any[], title: string, isReport = false) => {
    const chart = (
      <ResponsiveContainer width="100%" height="100%" minHeight={isReport ? 220 : 250} debounce={100}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 30, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={<CustomXAxisTick />} interval={0} />
          <YAxis 
            tick={{fontSize: 8, fontWeight: 700, fill: '#64748b'}} 
            axisLine={false} 
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip 
            contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '9px', fontWeight: 'bold'}}
          />
          <Legend wrapperStyle={{fontSize: '8px', fontWeight: 'bold', paddingTop: '15px'}} />
          <Bar dataKey="total" name="Total" fill="#64748b" radius={[2, 2, 0, 0]} maxBarSize={12} isAnimationActive={false} />
          <Bar dataKey="internas" name="Internas" fill="#ef4444" radius={[2, 2, 0, 0]} maxBarSize={12} isAnimationActive={false} />
          <Bar dataKey="externas" name="Externas" fill="#3b82f6" radius={[2, 2, 0, 0]} maxBarSize={12} isAnimationActive={false} />
          <Line type="stepAfter" dataKey="Objective" name="OBJETIVO" stroke="#10b981" strokeWidth={3} strokeDasharray="5 5" dot={false} activeDot={false} isAnimationActive={false} />
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

  const renderQualityEvolutionChart = (data: any[], dataKey: string, name: string, color: string, title: string, isReport = false) => {
    const chart = (
      <ResponsiveContainer width="100%" height="100%" minHeight={isReport ? 220 : 250} debounce={100}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 30, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={<CustomXAxisTick />} interval={0} />
          <YAxis 
            tick={{fontSize: 8, fontWeight: 700, fill: '#64748b'}} 
            axisLine={false} 
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip 
            contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '9px', fontWeight: 'bold'}}
          />
          <Legend wrapperStyle={{fontSize: '8px', fontWeight: 'bold', paddingTop: '15px'}} />
          <Bar dataKey={dataKey} name={name} fill={color} radius={[2, 2, 0, 0]} maxBarSize={12} isAnimationActive={false} />
          <Line type="stepAfter" dataKey="Objective" name="OBJETIVO" stroke="#10b981" strokeWidth={3} strokeDasharray="5 5" dot={false} activeDot={false} isAnimationActive={false} />
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

  const renderIdMEvolutionChart = (
    data: any[],
    series: { key: string; name: string; color: string }[],
    objKey?: string,
    objName?: string,
    objColor?: string,
    title?: string,
    isReport = false
  ) => {
    const chart = (
      <ResponsiveContainer width="100%" height="100%" minHeight={isReport ? 220 : 250} debounce={100}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 30, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={<CustomXAxisTick />} interval={0} />
          <YAxis 
            tick={{fontSize: 8, fontWeight: 700, fill: '#64748b'}} 
            axisLine={false} 
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip 
            contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '9px', fontWeight: 'bold'}}
          />
          <Legend wrapperStyle={{fontSize: '8px', fontWeight: 'bold', paddingTop: '15px'}} />
          {series.map(s => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[2, 2, 0, 0]} maxBarSize={12} isAnimationActive={false} />
          ))}
          {objKey && (
            <Line type="stepAfter" dataKey={objKey} name={objName || "OBJETIVO"} stroke={objColor || "#10b981"} strokeWidth={3} strokeDasharray="5 5" dot={false} activeDot={false} isAnimationActive={false} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );

    return (
      <div className={`bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col ${isReport ? 'h-[280px]' : 'h-[300px]'} cursor-zoom-in`}
        onDoubleClick={() => setFullscreenChart({ title: title || '', chart })}
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
    const parseDate = (dStr: string) => {
      if (!dStr) return new Date(NaN);
      const parts = dStr.split('-');
      if (parts.length === 3) {
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      }
      return new Date(dStr);
    };

    const weeklyAccidents = last15Weeks.map(w => {
      const count = dbPlanAccionRecords.filter(r => {
        if (!r.fecha) return false;
        const d = parseDate(r.fecha);
        return getWeekNumber(d) === w.week && d.getFullYear() === w.year && r.tipo?.trim().toLowerCase() === 'accidente';
      }).length;
      return { name: w.label, count, week: w.week, year: w.year };
    });

    const monthlyAccidents = last15Months.map(m => {
      const count = dbPlanAccionRecords.filter(r => {
        if (!r.fecha) return false;
        const d = parseDate(r.fecha);
        return d.getMonth() === m.month && d.getFullYear() === m.year && r.tipo?.trim().toLowerCase() === 'accidente';
      }).length;
      return { name: m.label, count, date: new Date(m.year, m.month, 1) };
    });

    const weeklyIncidentes = last15Weeks.map(w => {
      const count = dbPlanAccionRecords.filter(r => {
        if (!r.fecha) return false;
        const d = parseDate(r.fecha);
        return getWeekNumber(d) === w.week && d.getFullYear() === w.year && r.tipo?.trim().toLowerCase() === 'incidente';
      }).length;
      return { name: w.label, count, week: w.week, year: w.year };
    });

    const monthlyIncidentes = last15Months.map(m => {
      const count = dbPlanAccionRecords.filter(r => {
        if (!r.fecha) return false;
        const d = parseDate(r.fecha);
        return d.getMonth() === m.month && d.getFullYear() === m.year && r.tipo?.trim().toLowerCase() === 'incidente';
      }).length;
      return { name: m.label, count, date: new Date(m.year, m.month, 1) };
    });

    // Filter items from the Preparation Tab's Security Plan (dbPlanAccionRecords)
    const filteredSecurityActions = dbPlanAccionRecords.filter((action: any) => {
      const prob = action.que_ha_ocurrido || action.queHaOcurrido || action.problema || '';
      const acc = action.accion || '';
      if (!prob && !acc && !action.tipo) return false;

      // Filter by Estado
      if (secFilterEstado !== 'Todos') {
        const st = getSecurityActionStatus(action);
        if (secFilterEstado === 'Retrasado') {
          if (st !== 'Retrasado') return false;
        } else if (secFilterEstado === 'Cerrado') {
          if (st !== 'Cerrado') return false;
        } else if (secFilterEstado === 'En Marcha') {
          if (st !== 'En Marcha') return false;
        } else if (secFilterEstado === 'Abierto') {
          if (st !== 'Abierto') return false;
        } else {
          if (st !== secFilterEstado && action.estado !== secFilterEstado) return false;
        }
      }

      // Filter by Gap
      if (secFilterGap !== 'Todos') {
        const gapVal = (action.gap || '').trim();
        if (gapVal !== secFilterGap) return false;
      }

      // Filter by Responsables
      if (secFilterResponsable !== 'Todos') {
        const respVal = (action.responsable || '').trim();
        if (respVal !== secFilterResponsable) return false;
      }

      return true;
    });

    // Group dbPlanAccionRecords by Monday date
    const getMondayOfDateString = (dateStr: string) => {
      try {
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        const year = Number(parts[0]);
        const month = Number(parts[1]) - 1;
        const day = Number(parts[2]);
        const d = new Date(year, month, day);
        const dayOfWeek = d.getDay();
        const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(year, month, diff);
        const yyyy = monday.getFullYear();
        const mm = String(monday.getMonth() + 1).padStart(2, '0');
        const dd = String(monday.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      } catch (e) {
        return dateStr;
      }
    };

    const groupedWeeks: Record<string, {
      fecha: string;
      accidentes: number;
      incidentes: number;
      comentarios: string[];
    }> = {};

    dbPlanAccionRecords.forEach(r => {
      if (!r.fecha) return;
      const monday = getMondayOfDateString(r.fecha);
      const isAcc = r.tipo?.trim().toLowerCase() === 'accidente';
      const isInc = r.tipo?.trim().toLowerCase() === 'incidente';
      if (!isAcc && !isInc) return;

      if (!groupedWeeks[monday]) {
        groupedWeeks[monday] = {
          fecha: monday,
          accidentes: 0,
          incidentes: 0,
          comentarios: []
        };
      }

      if (isAcc) groupedWeeks[monday].accidentes += 1;
      if (isInc) groupedWeeks[monday].incidentes += 1;
      const desc = r.que_ha_ocurrido || r.queHaOcurrido || r.accion || '';
      if (desc) {
        groupedWeeks[monday].comentarios.push(`[${r.tipo}] ${desc}`);
      }
    });

    const securityIndicatorRows = Object.values(groupedWeeks).sort((a, b) => b.fecha.localeCompare(a.fecha));

    return (
      <div className="flex flex-col gap-8">
        {!onlyTable && (
          <div className={`grid ${isReport ? 'grid-cols-2' : 'grid-cols-1 lg:grid-cols-2'} gap-6`}>
            <div className="col-span-full border-b border-slate-200 pb-2 mb-2">
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">ACCIDENTES</h4>
            </div>
            {renderEvolutionChart(weeklyAccidents, 'count', 'ACCIDENTES', '#ef4444', 'Evolución Accidentes (Semanas)', 'accidentes', false, isReport, 'bar')}
            {renderEvolutionChart(monthlyAccidents, 'count', 'ACCIDENTES', '#ef4444', 'Evolución Accidentes (Meses)', 'accidentes', false, isReport, 'bar')}
            
            <div className="col-span-full border-b border-slate-200 pb-2 mb-2 mt-6">
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">INCIDENTES</h4>
            </div>
            {renderEvolutionChart(weeklyIncidentes, 'count', 'INCIDENTES', '#f97316', 'Evolución Incidentes (Semanas)', 'incidentes', false, isReport, 'bar')}
            {renderEvolutionChart(monthlyIncidentes, 'count', 'INCIDENTES', '#f97316', 'Evolución Incidentes (Meses)', 'incidentes', false, isReport, 'bar')}
          </div>
        )}

        {/* Histórico de Indicadores de Seguridad */}
        {!onlyCharts && (
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-50 pb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Indicadores de Seguridad Registrados</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Accidentes e incidentes de trabajo por semana</p>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
              {securityIndicatorRows.length === 0 ? (
                <div className="text-center py-8 text-slate-400 font-bold uppercase tracking-wider text-xs">
                  No hay indicadores registrados todavía.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="py-3 px-4">Semana (Lunes)</th>
                      <th className="py-3 px-4 text-center">Accidentes de Trabajo</th>
                      <th className="py-3 px-4 text-center">Incidentes de Trabajo</th>
                      <th className="py-3 px-4">Comentarios</th>
                    </tr>
                  </thead>
                  <tbody>
                    {securityIndicatorRows.map((r) => {
                      const d = parseDate(r.fecha);
                      const weekNum = getWeekNumber(d);
                      const formattedDate = d.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
                      const comentariosText = r.comentarios.length > 0 ? r.comentarios.join(' | ') : 'Sin comentarios';
                      return (
                        <tr key={r.fecha} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 text-xs font-bold text-slate-800">
                            Semana {weekNum} ({formattedDate})
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                              Number(r.accidentes) > 0 ? 'bg-red-100 text-red-700 font-extrabold scale-110 inline-block' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {r.accidentes}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                              Number(r.incidentes) > 0 ? 'bg-amber-100 text-amber-700 font-extrabold scale-110 inline-block' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {r.incidentes}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-500 italic max-w-xs truncate" title={comentariosText}>
                            {comentariosText}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {!onlyCharts && (
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                  <ActivityIcon size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                    Plan de Acción de Seguridad (Preparación)
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Historial completo de acciones ({filteredSecurityActions.length} de {dbPlanAccionRecords.length})
                  </p>
                </div>
              </div>

              {/* Filters Row */}
              <div className="flex flex-wrap items-center gap-3">
                {/* ESTADOS Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Estado:</span>
                  <select
                    value={secFilterEstado}
                    onChange={(e) => setSecFilterEstado(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="Todos">Todos los estados</option>
                    <option value="Abierto">Abierto</option>
                    <option value="En Marcha">En Marcha</option>
                    <option value="Cerrado">Cerrado</option>
                    <option value="Retrasado">Retrasado</option>
                  </select>
                </div>

                {/* GAPS Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">GAP:</span>
                  <select
                    value={secFilterGap}
                    onChange={(e) => setSecFilterGap(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="Todos">Todos los GAPs</option>
                    {availableGaps.map(gap => (
                      <option key={gap} value={gap}>{gap}</option>
                    ))}
                  </select>
                </div>

                {/* RESPONSABLES Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Responsable:</span>
                  <select
                    value={secFilterResponsable}
                    onChange={(e) => setSecFilterResponsable(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="Todos">Todos los responsables</option>
                    {availableResponsables.map(resp => (
                      <option key={resp} value={resp}>{resp}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {filteredSecurityActions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center">
                <ShieldAlert className="w-10 h-10 stroke-[1.5] mb-2 text-slate-300" />
                <p className="font-bold text-xs">No hay acciones de seguridad que coincidan con los filtros seleccionados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
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
                    {filteredSecurityActions.map((action: any) => {
                      const problema = action.que_ha_ocurrido || action.queHaOcurrido || action.problema || '-';
                      const accionText = action.accion || '-';
                      const responsable = action.responsable || '-';
                      const gap = action.gap || '-';
                      const prevDate = action.fecha_implantacion_prevista || action.fechaImplantacionPrevista || '';
                      const realDate = action.fecha_implantacion_real || action.fechaImplantacionReal || '';
                      
                      const status = getSecurityActionStatus(action);
                      const isClosed = status === 'Cerrado';
                      const isOverdue = status === 'Retrasado';

                      const statusColor = isClosed
                        ? 'bg-slate-100 text-slate-600 border border-slate-200'
                        : isOverdue
                        ? 'bg-red-100 text-red-600 border border-red-200'
                        : status === 'En Marcha'
                        ? 'bg-green-50 text-green-700 border border-green-100'
                        : 'bg-sky-50 text-sky-700 border border-sky-100';

                      return (
                        <tr key={action.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-4">
                            <div className="text-xs font-bold text-slate-800 mb-1">{problema}</div>
                            <div className="text-[10px] text-slate-500 leading-relaxed">{accionText}</div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-[10px] font-black text-slate-600 bg-slate-100 px-2 py-1 rounded-md uppercase">
                              {responsable}
                            </span>
                          </td>
                          <td className="py-4 px-4 font-mono">
                            <div className={`text-[10px] font-bold ${isOverdue ? 'text-red-500' : 'text-slate-600'}`}>
                              {prevDate ? formatDateDMY(prevDate) : '-'}
                            </div>
                            {isClosed && realDate && (
                              <div className="text-[8px] text-emerald-600 font-black uppercase mt-1">
                                Cerrada: {formatDateDMY(realDate)}
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">
                              {gap}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${statusColor}`}>
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderRRHHTab = (isReport = false) => {
    // Group dbRrhhRecords by fecha (from Supabase)
    const groupedRrhh: Record<string, { fecha: string; absentismo: number; ausentismo: number; comentarios: string }> = {};

    // First load from local storage if available for fallback
    let localPrepRecords: Record<string, any> = {};
    try {
      const saved = localStorage.getItem('zitron_top60_preparacion_records');
      if (saved) localPrepRecords = JSON.parse(saved);
    } catch (e) {}

    // Helper to get monday string
    const getMondayOfDate = (dateStr: string) => {
      try {
        const d = new Date(dateStr);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      } catch (e) {
        return dateStr;
      }
    };

    Object.entries(localPrepRecords).forEach(([dateStr, rec]) => {
      if (rec?.personal?.completed && rec?.personal?.data) {
        const monday = getMondayOfDate(dateStr);
        groupedRrhh[monday] = {
          fecha: monday,
          absentismo: Number(rec.personal.data.absentismo || 0),
          ausentismo: Number(rec.personal.data.ausentismo || 0),
          comentarios: rec.personal.data.comentarios || ''
        };
      }
    });

    // Then overwrite/merge with Supabase records (source of truth)
    dbRrhhRecords.forEach(r => {
      if (!r.fecha) return;
      if (!groupedRrhh[r.fecha]) {
        groupedRrhh[r.fecha] = {
          fecha: r.fecha,
          absentismo: 0,
          ausentismo: 0,
          comentarios: ''
        };
      }
      if (r.area === 'absentismo') {
        groupedRrhh[r.fecha].absentismo = Number(r.valor || 0);
      } else if (r.area === 'ausentismo') {
        groupedRrhh[r.fecha].ausentismo = Number(r.valor || 0);
      }
      if (r.comentarios && !groupedRrhh[r.fecha].comentarios) {
        groupedRrhh[r.fecha].comentarios = r.comentarios;
      }
    });

    const historicalRows = Object.values(groupedRrhh).sort((a, b) => b.fecha.localeCompare(a.fecha));

    return (
      <div className="flex flex-col gap-8">
        <div className={`grid ${isReport ? 'grid-cols-2' : 'grid-cols-1 lg:grid-cols-2'} gap-6`}>
          <div className="col-span-full border-b border-slate-200 pb-2 mb-2">
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Absentismo (Bajas)</h4>
          </div>
          {renderEvolutionChart(weeklyAbsentismo, 'value', 'ABSENTISMO %', '#3b82f6', 'Absentismo % (Semanas)', 'absentismo', true, isReport, 'bar')}
          {renderEvolutionChart(monthlyAbsentismo, 'value', 'ABSENTISMO %', '#3b82f6', 'Absentismo % (Meses)', 'absentismo', true, isReport, 'bar')}
          
          <div className="col-span-full border-b border-slate-200 pb-2 mb-2 mt-6">
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Ausentismo (Jornadas Perdidas)</h4>
          </div>
          {renderEvolutionChart(weeklyAusentismo, 'value', 'AUSENTISMO %', '#f59e0b', 'Ausentismo % (Semanas)', 'ausentismo', true, isReport, 'bar')}
          {renderEvolutionChart(monthlyAusentismo, 'value', 'AUSENTISMO %', '#f59e0b', 'Ausentismo % (Meses)', 'ausentismo', true, isReport, 'bar')}
        </div>

        {/* Historial de Registros */}
        {!isReport && (
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-50 pb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                <Users size={20} />
              </div>
              <div>
                <h3 className="font-serif font-black text-slate-900 uppercase">Historial de Registros</h3>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Registros históricos de personal y ausentismo sincronizados desde Supabase</p>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[350px] overflow-y-auto border border-slate-100 rounded-2xl">
              {dashboardRegistrosPersonal.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-slate-50/50 h-full">
                  <Users className="w-12 h-12 mb-3 text-slate-300" />
                  <p className="text-xs font-bold uppercase tracking-widest">Sin registros históricos</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider sticky top-0 z-10">
                      <th className="p-4">Fecha</th>
                      <th className="p-4 text-center">Jornadas Teóricas</th>
                      <th className="p-4 text-center">Jornadas Perdidas Baja</th>
                      <th className="p-4 text-center">% Absentismo</th>
                      <th className="p-4 text-center">Jornadas Perdidas Ausen.</th>
                      <th className="p-4 text-center">% Ausentismo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs font-bold text-slate-600">
                    {dashboardRegistrosPersonal.map((reg) => {
                      const pctAb = reg.jornadasTeoricas > 0 ? (reg.jornadasPerdidasBaja / reg.jornadasTeoricas) * 100 : 0;
                      const pctAu = reg.jornadasTeoricas > 0 ? (reg.jornadasPerdidasAusentismo / reg.jornadasTeoricas) * 100 : 0;
                      return (
                        <tr key={reg.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="p-4 text-slate-950">{formatDateDMY(reg.fecha)}</td>
                          <td className="p-4 text-center text-slate-500">{reg.jornadasTeoricas}</td>
                          <td className="p-4 text-center text-red-500">{reg.jornadasPerdidasBaja}</td>
                          <td className="p-4 text-center text-indigo-600 font-extrabold">{pctAb.toFixed(1)}%</td>
                          <td className="p-4 text-center text-amber-500">{reg.jornadasPerdidasAusentismo}</td>
                          <td className="p-4 text-center text-indigo-600 font-extrabold">{pctAu.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCalidadTab = () => {
    const getCalidadActionStatusLocal = (fechaPrevista: string, fechaCierre?: string): string => {
      if (fechaCierre) return 'Cerrado';
      if (!fechaPrevista) return 'Abierto';
      const hoy = new Date().toISOString().split('T')[0];
      if (fechaPrevista < hoy) return 'Retrasado';
      return 'En Marcha';
    };

    const getCalidadGlobalStatusLocal = (item: PlanAccionCalidad): 'Abierto' | 'En Marcha' | 'Cerrado' | 'Retrasado' => {
      const estCont = getCalidadActionStatusLocal(item.fechaPrevistaContenedora, item.fechaCierreContenedora);
      const estCorr = getCalidadActionStatusLocal(item.fechaPrevistaCorrectora, item.fechaCierreCorrectora);
      
      if (estCont === 'Cerrado' && estCorr === 'Cerrado') return 'Cerrado';
      if (estCont === 'Retrasado' || estCorr === 'Retrasado') return 'Retrasado';
      if (estCont === 'En Marcha' || estCorr === 'En Marcha') return 'En Marcha';
      return 'Abierto';
    };

    const formatDateDMY = (dateStr: string) => {
      if (!dateStr) return '';
      try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return dateStr;
      } catch (e) {
        return dateStr;
      }
    };

    const sortedCalidad = [...dbPlanCalidadRecords].sort((a, b) => b.fecha.localeCompare(a.fecha));

    const filteredCalidad = sortedCalidad.filter((item) => {
      // 1. Filter by Estado
      if (calFilterEstado !== 'Todos') {
        const st = getCalidadGlobalStatusLocal(item);
        if (st !== calFilterEstado) return false;
      }

      // 2. Filter by Origen
      if (calFilterOrigen !== 'Todos') {
        if (calFilterOrigen === 'Interna') {
          if (item.origen !== 'Interna') return false;
        } else if (calFilterOrigen === 'Externa') {
          if (item.origen !== 'Externa') return false;
        } else if (calFilterOrigen === 'Sin especificar') {
          if (item.origen === 'Interna' || item.origen === 'Externa') return false;
        }
      }

      return true;
    });

    return (
      <div className="flex flex-col gap-8">
        {/* GRÁFICOS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* TOTAL */}
          <div className="col-span-full border-b border-slate-200 pb-2 mb-2">
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">TOTAL</h4>
          </div>
          {renderQualityEvolutionChart(weeklyCalidad, 'total', 'Total', '#64748b', 'No Conformidades Total (Semanas)')}
          {renderQualityEvolutionChart(monthlyCalidad, 'total', 'Total', '#64748b', 'No Conformidades Total (Meses)')}

          {/* INTERNAS */}
          <div className="col-span-full border-b border-slate-200 pb-2 mb-2 mt-6">
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">INTERNAS</h4>
          </div>
          {renderQualityEvolutionChart(weeklyCalidad, 'internas', 'Internas', '#ef4444', 'No Conformidades Internas (Semanas)')}
          {renderQualityEvolutionChart(monthlyCalidad, 'internas', 'Internas', '#ef4444', 'No Conformidades Internas (Meses)')}

          {/* EXTERNAS */}
          <div className="col-span-full border-b border-slate-200 pb-2 mb-2 mt-6">
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">EXTERNAS</h4>
          </div>
          {renderQualityEvolutionChart(weeklyCalidad, 'externas', 'Externas', '#3b82f6', 'No Conformidades Externas (Semanas)')}
          {renderQualityEvolutionChart(monthlyCalidad, 'externas', 'Externas', '#3b82f6', 'No Conformidades Externas (Meses)')}
        </div>

        {/* TABLA HISTORIAL */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center text-rose-600">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Historial de No Conformidades</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  Plan de Acción de Calidad Completo ({filteredCalidad.length} de {dbPlanCalidadRecords.length})
                </p>
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* ESTADO Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Estado:</span>
                <select
                  value={calFilterEstado}
                  onChange={(e) => setCalFilterEstado(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="Todos">Todos los estados</option>
                  <option value="Abierto">Abierto</option>
                  <option value="En Marcha">En Marcha</option>
                  <option value="Cerrado">Cerrado</option>
                  <option value="Retrasado">Retrasado</option>
                </select>
              </div>

              {/* ORIGEN Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Origen:</span>
                <select
                  value={calFilterOrigen}
                  onChange={(e) => setCalFilterOrigen(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="Todos">Todos los orígenes</option>
                  <option value="Interna">Interna</option>
                  <option value="Externa">Externa</option>
                  <option value="Sin especificar">Sin especificar</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {filteredCalidad.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-bold uppercase tracking-wider text-xs flex flex-col items-center justify-center">
                <ShieldAlert className="w-10 h-10 stroke-[1.5] mb-2 text-slate-300" />
                <p>No hay registros de no conformidades que coincidan con los filtros seleccionados</p>
              </div>
            ) : (
              <table className="min-w-[1500px] w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                    <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo Reclamación</th>
                    <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Origen</th>
                    <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Área Causante</th>
                    <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción del Problema</th>
                    <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Acción Contenedora</th>
                    <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsable Contenedora</th>
                    <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">F. Prevista Contenedora</th>
                    <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">F. Cierre Contenedora</th>
                    <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Acción Correctora</th>
                    <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsable Correctora</th>
                    <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">F. Prevista Correctora</th>
                    <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">F. Cierre Correctora</th>
                    <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCalidad.map((r) => {
                    const status = getCalidadGlobalStatusLocal(r);
                    let statusBg = 'bg-slate-100 text-slate-600';
                    if (status === 'Cerrado') statusBg = 'bg-emerald-100 text-emerald-700';
                    else if (status === 'Retrasado') statusBg = 'bg-rose-100 text-rose-700 font-extrabold scale-105';
                    else if (status === 'En Marcha') statusBg = 'bg-blue-100 text-blue-700';

                    let origenBadge = 'text-slate-500 italic';
                    let origenText = 'Sin especificar';
                    if (r.origen === 'Interna') {
                      origenBadge = 'bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full text-[10px] font-bold';
                      origenText = 'Interna';
                    } else if (r.origen === 'Externa') {
                      origenBadge = 'bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full text-[10px] font-bold';
                      origenText = 'Externa';
                    }

                    const contStatus = getCalidadActionStatusLocal(r.fechaPrevistaContenedora, r.fechaCierreContenedora);
                    const contOverdue = contStatus === 'Retrasado';

                    const corrStatus = getCalidadActionStatusLocal(r.fechaPrevistaCorrectora, r.fechaCierreCorrectora);
                    const corrOverdue = corrStatus === 'Retrasado';

                    return (
                      <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-4 text-xs font-bold text-slate-800 whitespace-nowrap">
                          {formatDateDMY(r.fecha)}
                        </td>
                        <td className="py-4 px-4 text-xs font-bold text-slate-700">
                          {r.tipoReclamacion}
                        </td>
                        <td className="py-4 px-4 text-xs">
                          <span className={origenBadge}>{origenText}</span>
                        </td>
                        <td className="py-4 px-4 text-xs text-slate-600 font-semibold">
                          {r.areaCausante}
                        </td>
                        <td className="py-4 px-4 text-xs text-slate-500 max-w-xs truncate" title={r.descripcionProblema}>
                          {r.descripcionProblema || '-'}
                        </td>
                        {/* Acción Contenedora */}
                        <td className="py-4 px-4 text-xs text-slate-700 max-w-xs truncate" title={r.accionContenedora}>
                          {r.accionContenedora || '-'}
                        </td>
                        {/* Responsable Contenedora */}
                        <td className="py-4 px-4 text-xs">
                          {r.responsableContenedora ? (
                            <span className="text-[10px] font-black text-slate-600 bg-slate-100 px-2 py-1 rounded-md uppercase whitespace-nowrap">
                              {r.responsableContenedora}
                            </span>
                          ) : '-'}
                        </td>
                        {/* F. Prevista Contenedora */}
                        <td className="py-4 px-4 text-xs font-semibold whitespace-nowrap">
                          {r.fechaPrevistaContenedora ? (
                            <span className={contOverdue ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                              {formatDateDMY(r.fechaPrevistaContenedora)}
                            </span>
                          ) : '-'}
                        </td>
                        {/* F. Cierre Contenedora */}
                        <td className="py-4 px-4 text-xs whitespace-nowrap">
                          {r.fechaCierreContenedora ? (
                            <span className="text-emerald-600 font-bold">✅ {formatDateDMY(r.fechaCierreContenedora)}</span>
                          ) : '-'}
                        </td>
                        {/* Acción Correctora */}
                        <td className="py-4 px-4 text-xs text-slate-700 max-w-xs truncate" title={r.accionCorrectora}>
                          {r.accionCorrectora || '-'}
                        </td>
                        {/* Responsable Correctora */}
                        <td className="py-4 px-4 text-xs">
                          {r.responsableCorrectora ? (
                            <span className="text-[10px] font-black text-slate-600 bg-slate-100 px-2 py-1 rounded-md uppercase whitespace-nowrap">
                              {r.responsableCorrectora}
                            </span>
                          ) : '-'}
                        </td>
                        {/* F. Prevista Correctora */}
                        <td className="py-4 px-4 text-xs font-semibold whitespace-nowrap">
                          {r.fechaPrevistaCorrectora ? (
                            <span className={corrOverdue ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                              {formatDateDMY(r.fechaPrevistaCorrectora)}
                            </span>
                          ) : '-'}
                        </td>
                        {/* F. Cierre Correctora */}
                        <td className="py-4 px-4 text-xs whitespace-nowrap">
                          {r.fechaCierreCorrectora ? (
                            <span className="text-emerald-600 font-bold">✅ {formatDateDMY(r.fechaCierreCorrectora)}</span>
                          ) : '-'}
                        </td>
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase ${statusBg}`}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderIdMTab = (isReport = false) => {
    const getIdeaStatus = (i: any): string => {
      const fechaCierre = i.fecha_cierre || i.fechaCierre;
      if (fechaCierre) return 'Cerrado';
      const fechaPrevista = i.fecha_ejecucion_prevista || i.fechaEjecucionPrevista || i.fecha_prevista || i.fechaPrevista;
      if (!fechaPrevista) return 'Abierto';
      const hoy = new Date().toISOString().split('T')[0];
      if (fechaPrevista < hoy) return 'Retrasado';
      return 'En Marcha';
    };

    const getIdeaEmisionDate = (i: any): Date | null => {
      const dateStr = i.fecha_emision || i.fechaEmision;
      if (!dateStr) return null;
      return new Date(dateStr);
    };

    const weeklyIdM = last15Weeks.map(w => {
      const ideasThisWeek = ideasMejora.filter(i => {
        const d = getIdeaEmisionDate(i);
        if (!d) return false;
        return getWeekNumber(d) === w.week && d.getFullYear() === w.year;
      });

      const presentadas = ideasThisWeek.length;

      const enCurso = ideasThisWeek.filter(i => {
        const isAprobada = i.aprobada === 'Sí' || i.aprobada === 'SI' || i.aprobada === 'si';
        if (!isAprobada) return false;
        const status = getIdeaStatus(i);
        return status === 'En Marcha' || status === 'Abierto';
      }).length;

      const atrasadas = ideasThisWeek.filter(i => {
        const isAprobada = i.aprobada === 'Sí' || i.aprobada === 'SI' || i.aprobada === 'si';
        if (!isAprobada) return false;
        const status = getIdeaStatus(i);
        return status === 'Retrasado';
      }).length;

      const cerradas = ideasMejora.filter(i => {
        const isCerrado = i.fecha_cierre || i.estado === 'Cerrado' || getIdeaStatus(i) === 'Cerrado';
        if (!isCerrado) return false;
        const dateStr = i.fecha_ejecucion_prevista || i.fecha_prevista || i.fecha_cierre || i.fechaCierre || i.created_at || i.updated_at;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return getWeekNumber(d) === w.week && d.getFullYear() === w.year;
      }).length;

      const rechazadas = ideasMejora.filter(i => {
        const isRechazada = i.aprobada === 'No' || i.aprobada === 'NO' || i.aprobada === 'no';
        if (!isRechazada) return false;
        const d = getIdeaEmisionDate(i);
        if (!d) return false;
        return getWeekNumber(d) === w.week && d.getFullYear() === w.year;
      }).length;

      const date = new Date(w.year, 0, 1);
      date.setDate(date.getDate() + (w.week - 1) * 7);
      
      const objPres = getObjectiveForDate('idm-presentadas', date);
      const objCerr = getObjectiveForDate('idm-cerradas', date);
      const objAcep = getObjectiveForDate('idm-aceptadas', date);

      return {
        name: w.label,
        presentadas,
        enCurso,
        atrasadas,
        cerradas,
        rechazadas,
        ObjPres: objPres,
        ObjCerr: objCerr,
        ObjAcep: objAcep
      };
    });

    const monthlyIdM = last15Months.map(m => {
      const ideasThisMonth = ideasMejora.filter(i => {
        const d = getIdeaEmisionDate(i);
        if (!d) return false;
        return d.getMonth() === m.month && d.getFullYear() === m.year;
      });

      const presentadas = ideasThisMonth.length;

      const enCurso = ideasThisMonth.filter(i => {
        const isAprobada = i.aprobada === 'Sí' || i.aprobada === 'SI' || i.aprobada === 'si';
        if (!isAprobada) return false;
        const status = getIdeaStatus(i);
        return status === 'En Marcha' || status === 'Abierto';
      }).length;

      const atrasadas = ideasThisMonth.filter(i => {
        const isAprobada = i.aprobada === 'Sí' || i.aprobada === 'SI' || i.aprobada === 'si';
        if (!isAprobada) return false;
        const status = getIdeaStatus(i);
        return status === 'Retrasado';
      }).length;

      const cerradas = ideasMejora.filter(i => {
        const isCerrado = i.fecha_cierre || i.estado === 'Cerrado' || getIdeaStatus(i) === 'Cerrado';
        if (!isCerrado) return false;
        const dateStr = i.fecha_ejecucion_prevista || i.fecha_prevista || i.fecha_cierre || i.fechaCierre || i.created_at || i.updated_at;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d.getMonth() === m.month && d.getFullYear() === m.year;
      }).length;

      const rechazadas = ideasMejora.filter(i => {
        const isRechazada = i.aprobada === 'No' || i.aprobada === 'NO' || i.aprobada === 'no';
        if (!isRechazada) return false;
        const d = getIdeaEmisionDate(i);
        if (!d) return false;
        return d.getMonth() === m.month && d.getFullYear() === m.year;
      }).length;

      const date = new Date(m.year, m.month, 1);
      const objPres = getObjectiveForDate('idm-presentadas', date);
      const objCerr = getObjectiveForDate('idm-cerradas', date);
      const objAcep = getObjectiveForDate('idm-aceptadas', date);

      return {
        name: m.label,
        presentadas,
        enCurso,
        atrasadas,
        cerradas,
        rechazadas,
        ObjPres: objPres,
        ObjCerr: objCerr,
        ObjAcep: objAcep
      };
    });

    return (
      <div className="space-y-6">
        {/* IDM Tab Header with Lock/Unlock button */}
        {!isReport && (
          <div className="flex justify-end items-center gap-2">
            <button
              onClick={() => {
                if (isEditingUnlocked) {
                  setIsEditingUnlocked(false);
                } else {
                  setPinInput('');
                  setPinError('');
                  setShowPinModal(true);
                }
              }}
              className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 border transition-all cursor-pointer shadow-sm ${
                isEditingUnlocked 
                  ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {isEditingUnlocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              {isEditingUnlocked ? 'BLOQUEAR EDICIÓN' : 'DESBLOQUEAR EDICIÓN'}
            </button>
          </div>
        )}

        {/* Objectives Config Panel (visible only when isEditingUnlocked is true) */}
        {isEditingUnlocked && !isReport && (
          <div className="bg-white p-4 rounded-3xl border-2 border-indigo-50 shadow-sm flex flex-col md:flex-row items-center gap-4 justify-between animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-50 p-2.5 rounded-2xl text-indigo-600">
                <Lock className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Configuración de Objetivos IDM</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Define los objetivos semanales</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
              <div className="flex-1 md:flex-initial min-w-[150px]">
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Obj. Presentadas / Sem</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={objPresentadasInput}
                  onChange={(e) => setObjPresentadasInput(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-1.5 text-xs font-black text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                />
              </div>
              <div className="flex-1 md:flex-initial min-w-[150px]">
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Obj. Cerradas / Sem</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={objCerradasInput}
                  onChange={(e) => setObjCerradasInput(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-1.5 text-xs font-black text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                />
              </div>
              <button
                onClick={handleSaveObjectives}
                disabled={isSavingObjectives}
                className="w-full md:w-auto mt-3 md:mt-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-indigo-100"
              >
                <Save className="w-3.5 h-3.5" />
                {isSavingObjectives ? 'GUARDANDO...' : 'GUARDAR'}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* PRESENTADAS */}
          <div className="col-span-full border-b border-slate-200 pb-2 mb-2">
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">PRESENTADAS</h4>
          </div>
          {renderIdMEvolutionChart(weeklyIdM, [{ key: 'presentadas', name: 'PRESENTADAS', color: '#3b82f6' }], 'ObjPres', 'OBJETIVO', '#10b981', 'Ideas Presentadas (Semanas)', isReport)}
          {renderIdMEvolutionChart(monthlyIdM, [{ key: 'presentadas', name: 'PRESENTADAS', color: '#3b82f6' }], 'ObjPres', 'OBJETIVO', '#10b981', 'Ideas Presentadas (Meses)', isReport)}

          {/* ACEPTADAS */}
          <div className="col-span-full border-b border-slate-200 pb-2 mb-2 mt-6">
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">ACEPTADAS</h4>
          </div>
          {renderIdMEvolutionChart(
            weeklyIdM, 
            [
              { key: 'enCurso', name: 'EN CURSO', color: '#4f46e5' },
              { key: 'atrasadas', name: 'ATRASADAS', color: '#ef4444' }
            ], 
            weeklyIdM.some(d => typeof d.ObjAcep === 'number' && d.ObjAcep > 0) ? 'ObjAcep' : undefined, 
            'OBJETIVO', 
            '#10b981', 
            'Ideas Aceptadas (Semanas)', 
            isReport
          )}
          {renderIdMEvolutionChart(
            monthlyIdM, 
            [
              { key: 'enCurso', name: 'EN CURSO', color: '#4f46e5' },
              { key: 'atrasadas', name: 'ATRASADAS', color: '#ef4444' }
            ], 
            monthlyIdM.some(d => typeof d.ObjAcep === 'number' && d.ObjAcep > 0) ? 'ObjAcep' : undefined, 
            'OBJETIVO', 
            '#10b981', 
            'Ideas Aceptadas (Meses)', 
            isReport
          )}

          {/* CERRADAS */}
          <div className="col-span-full border-b border-slate-200 pb-2 mb-2 mt-6">
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">CERRADAS</h4>
          </div>
          {renderIdMEvolutionChart(weeklyIdM, [{ key: 'cerradas', name: 'CERRADAS', color: '#10b981' }], 'ObjCerr', 'OBJETIVO', '#10b981', 'Ideas Cerradas (Semanas)', isReport)}
          {renderIdMEvolutionChart(monthlyIdM, [{ key: 'cerradas', name: 'CERRADAS', color: '#10b981' }], 'ObjCerr', 'OBJETIVO', '#10b981', 'Ideas Cerradas (Meses)', isReport)}

          {/* RECHAZADAS */}
          <div className="col-span-full border-b border-slate-200 pb-2 mb-2 mt-6">
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">RECHAZADAS</h4>
          </div>
          {renderIdMEvolutionChart(weeklyIdM, [{ key: 'rechazadas', name: 'RECHAZADAS', color: '#ef4444' }], undefined, undefined, undefined, 'Ideas Rechazadas (Semanas)', isReport)}
          {renderIdMEvolutionChart(monthlyIdM, [{ key: 'rechazadas', name: 'RECHAZADAS', color: '#ef4444' }], undefined, undefined, undefined, 'Ideas Rechazadas (Meses)', isReport)}
        </div>

        {/* Historial de Ideas de Mejora Table */}
        {(() => {
          const filteredTableIdeas = ideasMejora.filter(idea => {
            if (idmFilterEstado === 'Todos') return true;
            const estado = idea.estado || getIdeaStatus(idea);
            if (idmFilterEstado === 'Retrasado') {
              return estado === 'Retrasado';
            }
            return estado === idmFilterEstado;
          });

          return (
            <div className="mt-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                    Historial de Ideas de Mejora
                  </h3>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">
                    Listado completo de todas las ideas de mejora registradas ({filteredTableIdeas.length} de {ideasMejora.length})
                  </p>
                </div>

                {/* Filter by Estado */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Estado:</span>
                  <select
                    value={idmFilterEstado}
                    onChange={(e) => setIdmFilterEstado(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Todos">Todos los estados</option>
                    <option value="Abierto">Abierto</option>
                    <option value="En Marcha">En Marcha</option>
                    <option value="Cerrado">Cerrado</option>
                    <option value="Retrasado">Retrasado</option>
                  </select>
                </div>
              </div>

              {filteredTableIdeas.length === 0 ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center">
                  <Lightbulb className="w-10 h-10 stroke-[1.5] mb-2 text-slate-300" />
                  <p className="font-bold text-xs">No hay ideas de mejora que coincidan con el filtro</p>
                </div>
              ) : (
                <div className="border border-slate-100 rounded-2xl overflow-x-auto shadow-sm">
                  <table className="w-full text-left text-xs font-bold text-slate-700 min-w-[900px]">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3 text-center w-12">Nº</th>
                        <th className="px-4 py-3">Sugerencia</th>
                        <th className="px-4 py-3">Emisor</th>
                        <th className="px-4 py-3">F. Creación</th>
                        <th className="px-4 py-3">F. Emisión</th>
                        <th className="px-4 py-3">Aprobada</th>
                        <th className="px-4 py-3">Responsable</th>
                        <th className="px-4 py-3">F. Prevista</th>
                        <th className="px-4 py-3">F. Cierre</th>
                        <th className="px-4 py-3">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 bg-white">
                      {filteredTableIdeas.map((idea, idx) => {
                        const numeroSugerencia = idea.numeroSugerencia || idea.numero_sugerencia || idea.id || (idx + 1);
                        const sugerencia = idea.sugerencia || idea.descripcion || idea.idea || '-';
                        const emisor = idea.recurso || idea.emisor || idea.autor || '-';
                        
                        const fechaCreacionRaw = idea.fechaCreacion || idea.fecha_creacion || idea.created_at;
                        const fechaCreacion = fechaCreacionRaw ? formatDateDMY(fechaCreacionRaw) : '-';

                        const fechaEmisionRaw = idea.fechaEmision || idea.fecha_emision;
                        const fechaEmision = fechaEmisionRaw ? formatDateDMY(fechaEmisionRaw) : '-';

                        const isSi = idea.aprobada === 'Sí' || idea.aprobada === 'SI' || idea.aprobada === 'si';
                        const isNo = idea.aprobada === 'No' || idea.aprobada === 'NO' || idea.aprobada === 'no';
                        const aprobadaLabel = isSi ? 'Sí' : isNo ? 'No' : (idea.aprobada || 'Pendiente');
                        const aprobadaColor = isSi 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                          : isNo 
                          ? 'bg-rose-50 text-rose-700 border-rose-100' 
                          : 'bg-amber-50 text-amber-700 border-amber-100';

                        const responsable = idea.responsable || '-';

                        const fechaPrevistaRaw = idea.fechaEjecucionPrevista || idea.fecha_ejecucion_prevista || idea.fecha_prevista || idea.fechaPrevista;
                        const fechaPrevista = fechaPrevistaRaw ? formatDateDMY(fechaPrevistaRaw) : '-';

                        const fechaCierreRaw = idea.fechaCierre || idea.fecha_cierre;
                        const fechaCierre = fechaCierreRaw ? (formatDateDMY(fechaCierreRaw) || '-') : '-';

                        const estado = idea.estado || getIdeaStatus(idea);
                        const estadoColor = estado === 'Cerrado' 
                          ? 'bg-slate-100 text-slate-600 border-slate-200' 
                          : estado === 'Abierto' 
                          ? 'bg-sky-50 text-sky-700 border-sky-100' 
                          : estado === 'Retrasado' 
                          ? 'bg-red-50 text-red-700 border-red-100' 
                          : 'bg-green-50 text-green-700 border-green-100';

                        const recursoColor = 'bg-slate-50 text-slate-700 border-slate-200';

                        return (
                          <tr key={idea.id || idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3.5 text-center text-slate-400 font-mono font-bold">
                              {numeroSugerencia}
                            </td>
                            <td className="px-4 py-3.5 max-w-xs break-words">
                              <p className="text-slate-900 leading-normal">{sugerencia}</p>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] ${recursoColor}`}>
                                {emisor}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-500 font-mono">
                              {fechaCreacion}
                            </td>
                            <td className="px-4 py-3.5 text-slate-500 font-mono">
                              {fechaEmision}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] ${aprobadaColor}`}>
                                {aprobadaLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-900">
                              {responsable}
                            </td>
                            <td className="px-4 py-3.5 text-slate-500 font-mono">
                              {fechaPrevista}
                            </td>
                            <td className="px-4 py-3.5 text-slate-500 font-mono">
                              {fechaCierre}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] ${estadoColor}`}>
                                {estado}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}

        {/* PIN modal */}
        {showPinModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-rose-50 p-2.5 rounded-xl text-rose-600">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-lg font-serif font-black text-slate-900 uppercase">PIN DE SEGURIDAD</h4>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest mt-0.5">Nivel de Fábrica Requerido</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">INTRODUCE TU PIN DE TOP 60:</label>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="••••"
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                      setPinError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (checkPasswordLevel3(pinInput)) {
                          setIsEditingUnlocked(true);
                          setShowPinModal(false);
                        } else {
                          setPinError('PIN incorrecto. Inténtalo de nuevo.');
                        }
                      }
                    }}
                    className="w-full text-center px-4 py-3 tracking-widest text-2xl font-black border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50/50 text-slate-800"
                  />
                  {pinError && <p className="text-xs font-bold text-rose-600 mt-2">{pinError}</p>}

                  {/* On-screen Keypad */}
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '⌫'].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          if (num === 'C') {
                            setPinInput('');
                            setPinError('');
                          } else if (num === '⌫') {
                            setPinInput(prev => prev.slice(0, -1));
                            setPinError('');
                          } else {
                            if (pinInput.length < 4) {
                              const nextVal = pinInput + num;
                              setPinInput(nextVal);
                              setPinError('');
                            }
                          }
                        }}
                        className={`h-12 rounded-xl font-black text-lg transition-all active:scale-95 cursor-pointer ${
                          num === '⌫' 
                            ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' 
                            : num === 'C' 
                              ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' 
                              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPinModal(false)}
                    className="px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (checkPasswordLevel3(pinInput)) {
                        setIsEditingUnlocked(true);
                        setShowPinModal(false);
                      } else {
                        setPinError('PIN incorrecto. Inténtalo de nuevo.');
                      }
                    }}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-colors shadow-lg shadow-rose-100"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
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
                    {dbPlanAccionRecords.filter(r => {
                      if (!r.fecha) return false;
                      const parts = r.fecha.split('-');
                      const d = parts.length === 3 ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) : new Date(r.fecha);
                      return getWeekNumber(d) === selectedWeek && d.getFullYear() === selectedYear && r.tipo?.trim().toLowerCase() === 'accidente';
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
                    {ideasMejora.filter(i => {
                      if (!i.fecha_emision) return false;
                      const d = new Date(i.fecha_emision);
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
            const securityActions = dbPlanAccionRecords.filter(a => a.que_ha_ocurrido || a.queHaOcurrido || a.problema || a.accion);
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
                        const problema = action.que_ha_ocurrido || action.queHaOcurrido || action.problema || '-';
                        const accionText = action.accion || '-';
                        const prevDate = action.fecha_implantacion_prevista || action.fechaImplantacionPrevista || '';
                        const realDate = action.fecha_implantacion_real || action.fechaImplantacionReal || '';
                        
                        const status = getSecurityActionStatus(action);
                        const isClosed = status === 'Cerrado';
                        const isOverdue = status === 'Retrasado';

                        return (
                          <tr key={action.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-5 px-6">
                              <div className="text-xs font-black text-slate-800 mb-1 uppercase tracking-tight">{problema}</div>
                              <div className="text-[10px] text-slate-500 leading-relaxed italic">{accionText}</div>
                            </td>
                            <td className="py-5 px-6">
                              <span className="text-[10px] font-black text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg uppercase">
                                {action.responsable || '-'}
                              </span>
                            </td>
                            <td className="py-5 px-6 font-mono">
                              <div className={`text-[10px] font-black ${isOverdue ? 'text-red-500' : 'text-slate-700'}`}>
                                {prevDate ? formatDateDMY(prevDate) : '-'}
                              </div>
                              {isClosed && realDate && (
                                <div className="text-[8px] text-emerald-600 font-black uppercase mt-1">
                                  Cerrada: {formatDateDMY(realDate)}
                                </div>
                              )}
                            </td>
                            <td className="py-5 px-6">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                {action.gap || '-'}
                              </span>
                            </td>
                            <td className="py-5 px-6">
                              <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${
                                isClosed ? 'bg-emerald-100 text-emerald-600' :
                                isOverdue ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                              }`}>
                                {status}
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
              <div className="grid grid-cols-2 gap-8">
                {renderEvolutionChart(weeklyAbsentismo, 'value', 'ABSENTISMO %', '#3b82f6', 'Absentismo % (Semanas)', 'absentismo', true, true, 'bar')}
                {renderEvolutionChart(monthlyAbsentismo, 'value', 'ABSENTISMO %', '#3b82f6', 'Absentismo % (Meses)', 'absentismo', true, true, 'bar')}
              </div>
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
              <div className="grid grid-cols-2 gap-8">
                {renderEvolutionChart(weeklyAusentismo, 'value', 'AUSENTISMO %', '#f59e0b', 'Ausentismo % (Semanas)', 'ausentismo', true, true, 'bar')}
                {renderEvolutionChart(monthlyAusentismo, 'value', 'AUSENTISMO %', '#f59e0b', 'Ausentismo % (Meses)', 'ausentismo', true, true, 'bar')}
              </div>
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
              <div key={`report-area-${areaGroup.area}-${chunkIdx}`} data-report-page data-report-landscape className="flex flex-col min-h-[794px] w-[1122px] bg-white p-12 space-y-6 overflow-hidden">
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
                      <div key={`report-ws-${ws.id}-${wsIdx}`} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col h-[280px]">
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
            if (saved && saved !== 'undefined' && saved !== 'null') {
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
        {activeTab === 'cmi' && (
          <div className="space-y-8">
            <div className="flex items-center gap-2 px-2">
              <div className="h-0.5 flex-1 bg-slate-800 rounded-full"></div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">SALA BLANCA</h2>
              <div className="h-0.5 flex-1 bg-slate-800 rounded-full"></div>
            </div>

            {salaBlancaWeeklyData.map((ind, idx) => {
              const mInd = salaBlancaMonthlyData[idx];
              const isOEE = ind.indicatorId === 'productividad';
              const showBreakdownBtn = isOEE;
              return (
                <div key={ind.id} className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2 px-2">
                    <div className="h-px flex-1 bg-slate-200"></div>
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">{ind.title}</h3>
                    {showBreakdownBtn && (
                      <button
                        type="button"
                        onClick={() => {
                          if (openBreakdownId === ind.id) {
                            setOpenBreakdownId(null);
                          } else {
                            setOpenBreakdownId(ind.id);
                            setSelectedBreakdownWeekObj({ week: selectedWeek, year: selectedYear });
                          }
                        }}
                        className="px-2.5 py-1 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 rounded-lg border border-blue-200 transition-colors flex items-center gap-1 shadow-xs cursor-pointer ml-2"
                      >
                        <ActivityIcon className="w-3 h-3 text-blue-500" />
                        {openBreakdownId === ind.id ? 'Ocultar desglose' : 'Ver desglose'}
                      </button>
                    )}
                    <div className="h-px flex-1 bg-slate-200"></div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {renderEvolutionChart(
                      ind.data,
                      'value',
                      ind.unit,
                      ind.color,
                      `${ind.title} (Semanas)`,
                      ind.workshopId,
                      ind.isPercentage,
                      false,
                      'bar',
                      ind.indicatorId
                    )}
                    {renderEvolutionChart(
                      mInd.data,
                      'value',
                      mInd.unit,
                      mInd.color,
                      `${mInd.title} (Meses)`,
                      mInd.workshopId,
                      mInd.isPercentage,
                      false,
                      'bar',
                      mInd.indicatorId
                    )}
                  </div>
                  {renderOEEBreakdown(ind)}
                </div>
              );
            })}

            {/* EMBUTIDO Section */}
            <div className="flex items-center gap-2 px-2 pt-4">
              <div className="h-0.5 flex-1 bg-slate-800 rounded-full"></div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">EMBUTIDO</h2>
              <div className="h-0.5 flex-1 bg-slate-800 rounded-full"></div>
            </div>

            {embutidoWeeklyData.map((ind, idx) => {
              const mInd = embutidoMonthlyData[idx];
              const isOEE = ind.indicatorId === 'productividad';
              const showBreakdownBtn = isOEE;
              return (
                <div key={ind.id} className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2 px-2">
                    <div className="h-px flex-1 bg-slate-200"></div>
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">{ind.title}</h3>
                    {showBreakdownBtn && (
                      <button
                        type="button"
                        onClick={() => {
                          if (openBreakdownId === ind.id) {
                            setOpenBreakdownId(null);
                          } else {
                            setOpenBreakdownId(ind.id);
                            setSelectedBreakdownWeekObj({ week: selectedWeek, year: selectedYear });
                          }
                        }}
                        className="px-2.5 py-1 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 rounded-lg border border-blue-200 transition-colors flex items-center gap-1 shadow-xs cursor-pointer ml-2"
                      >
                        <ActivityIcon className="w-3 h-3 text-blue-500" />
                        {openBreakdownId === ind.id ? 'Ocultar desglose' : 'Ver desglose'}
                      </button>
                    )}
                    <div className="h-px flex-1 bg-slate-200"></div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {renderEvolutionChart(
                      ind.data,
                      'value',
                      ind.unit,
                      ind.color,
                      `${ind.title} (Semanas)`,
                      ind.workshopId,
                      ind.isPercentage,
                      false,
                      'bar',
                      ind.indicatorId
                    )}
                    {renderEvolutionChart(
                      mInd.data,
                      'value',
                      mInd.unit,
                      mInd.color,
                      `${mInd.title} (Meses)`,
                      mInd.workshopId,
                      mInd.isPercentage,
                      false,
                      'bar',
                      mInd.indicatorId
                    )}
                  </div>
                  {renderOEEBreakdown(ind)}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Power BI */}
      {showPowerBI && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-white w-full max-w-6xl h-[90vh] rounded-[3rem] overflow-y-auto max-h-[90vh] shadow-2xl flex flex-col relative animate-in zoom-in duration-300">
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
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-xl flex flex-col p-10 animate-in fade-in zoom-in duration-300 overflow-y-auto">
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