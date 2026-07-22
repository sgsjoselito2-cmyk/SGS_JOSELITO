import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Users, ClipboardCheck, ArrowRight, X, Check, Info, Lock, Unlock, Plus, Trash2, Pencil, AlertTriangle, Clock, ShieldAlert, Lightbulb } from 'lucide-react';
import { User, PlanAccionSeguridad, GapSeguridad, RegistroPersonalTop60, PlanAccionCalidad, TipoReclamacion, IdeaDeMejora } from '../types';
import { supabase } from '../lib/supabase';

interface TOP60PreparacionProps {
  operarios?: User[];
  passwords?: Record<string, string>;
  ideasDeMejora?: IdeaDeMejora[];
  onSaveIdeaMejora?: (idea: IdeaDeMejora) => Promise<void>;
  onDeleteIdeaMejora?: (id: string) => Promise<void>;
}

interface SectionRecord {
  completed: boolean;
  updatedAt?: string;
  data: any;
}

interface DateRecords {
  seguridad?: SectionRecord;
  personal?: SectionRecord;
  produccion?: SectionRecord;
}

const getMondayDateString = (dateStr: string): string => {
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

const getFridayOfWeek = (dateStr: string): string => {
  try {
    const mondayStr = getMondayDateString(dateStr);
    const parts = mondayStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    const mondayDate = new Date(year, month, day);
    const fridayDate = new Date(mondayDate.setDate(mondayDate.getDate() + 4));
    
    const yyyy = fridayDate.getFullYear();
    const mm = String(fridayDate.getMonth() + 1).padStart(2, '0');
    const dd = String(fridayDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch (e) {
    return dateStr;
  }
};

const getWeekNumber = (d: Date): number => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
};

const TOP60Preparacion: React.FC<TOP60PreparacionProps> = ({ 
  operarios = [], 
  passwords, 
  ideasDeMejora = [], 
  onSaveIdeaMejora, 
  onDeleteIdeaMejora 
}) => {
  // Helper to get local date string YYYY-MM-DD safely
  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString);

  // Load all records from localStorage
  const [records, setRecords] = useState<Record<string, DateRecords>>(() => {
    try {
      const saved = localStorage.getItem('zitron_top60_preparacion_records');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // State for Supabase rrhh records
  const [supabaseRrhhRecords, setSupabaseRrhhRecords] = useState<any[]>([]);
  const [loadingSupabase, setLoadingSupabase] = useState(false);

  // New States for Plan de Acción de Seguridad
  const [planAccionRecords, setPlanAccionRecords] = useState<PlanAccionSeguridad[]>([]);
  const [gapsList, setGapsList] = useState<GapSeguridad[]>([]);
  const [isEditingUnlocked, setIsEditingUnlocked] = useState(false);
  
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  
  const [showAddActionModal, setShowAddActionModal] = useState(false);
  const [currentActionForm, setCurrentActionForm] = useState<PlanAccionSeguridad>({
    id: '',
    fecha: '',
    tipo: 'Accidente',
    gap: '',
    queHaOcurrido: '',
    accion: '',
    responsable: '',
    fechaImplantacionPrevista: '',
    fechaImplantacionReal: '',
    estado: 'Abierto'
  });
  
  // --- NEW IDEAS DE MEJORA (IDM) STATES ---
  const getAllOperariosSorted = () => {
    if (!operarios || operarios.length === 0) return [];
    return [...operarios].sort((a, b) => a.nombre.localeCompare(b.nombre));
  };

  const formatToDdMmYyyy = (dateStr?: string) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const [idmForm, setIdmForm] = useState<{
    id: string;
    sugerencia: string;
    recurso: string;
    responsable: string;
    fechaEjecucionPrevista: string;
    fechaCierre: string;
    aprobada: 'Sí' | 'No' | 'Pendiente';
    fechaEmision: string;
  }>({
    id: '',
    sugerencia: '',
    recurso: '',
    responsable: '',
    fechaEjecucionPrevista: '',
    fechaCierre: '',
    aprobada: 'Pendiente',
    fechaEmision: new Date().toISOString().split('T')[0]
  });

  const [filterIdmEstado, setFilterIdmEstado] = useState<string>('Todos');
  const [filterIdmAprobada, setFilterIdmAprobada] = useState<string>('Todos');
  const [filterIdmResponsable, setFilterIdmResponsable] = useState<string>('Todos');
  const [showIdmOnlyThisWeek, setShowIdmOnlyThisWeek] = useState<boolean>(false);

  const resetIdmForm = () => {
    const reps = getResponsablesDisponibles();
    const allOps = getAllOperariosSorted();
    setIdmForm({
      id: '',
      sugerencia: '',
      recurso: allOps.length > 0 ? allOps[0].nombre : '',
      responsable: reps.length > 0 ? reps[0].nombre : '',
      fechaEjecucionPrevista: '',
      fechaCierre: '',
      aprobada: 'Pendiente',
      fechaEmision: new Date().toISOString().split('T')[0]
    });
  };

  useEffect(() => {
    if (!idmForm.responsable || !idmForm.recurso) {
      const reps = getResponsablesDisponibles();
      const allOps = getAllOperariosSorted();
      if (reps.length > 0 || allOps.length > 0) {
        setIdmForm(prev => ({
          ...prev,
          responsable: prev.responsable || (reps.length > 0 ? reps[0].nombre : ''),
          recurso: prev.recurso || (allOps.length > 0 ? allOps[0].nombre : '')
        }));
      }
    }
  }, [operarios]);

  const [showAddGapModal, setShowAddGapModal] = useState(false);
  const [newGapName, setNewGapName] = useState('');
  
  const [filterTipo, setFilterTipo] = useState('Todos');
  const [filterEstado, setFilterEstado] = useState('Todos');
  const [showOnlyThisWeek, setShowOnlyThisWeek] = useState(true);

  // --- NEW PERSONAL & CALIDAD STATES ---
  const [personalForm, setPersonalForm] = useState({
    fecha: '',
    jornadasTeoricas: 0,
    jornadasPerdidasBaja: 0,
    jornadasPerdidasAusentismo: 0
  });

  // Quality Plan of Action records and lookups
  const [planCalidadRecords, setPlanCalidadRecords] = useState<PlanAccionCalidad[]>([]);
  const [tiposReclamacion, setTiposReclamacion] = useState<TipoReclamacion[]>([]);
  const [areasCausantesCalidad, setAreasCausantesCalidad] = useState<{ id: string; nombre: string }[]>([]);

  // Quality Modals & Forms
  const [showAddCalidadModal, setShowAddCalidadModal] = useState(false);
  const [currentCalidadForm, setCurrentCalidadForm] = useState<PlanAccionCalidad>({
    id: '',
    fecha: '',
    tipoReclamacion: '',
    areaCausante: '',
    descripcionProblema: '',
    accionContenedora: '',
    responsableContenedora: '',
    fechaPrevistaContenedora: '',
    fechaCierreContenedora: '',
    accionCorrectora: '',
    responsableCorrectora: '',
    fechaPrevistaCorrectora: '',
    fechaCierreCorrectora: '',
    origen: undefined
  });

  const [showAddTipoReclamacionModal, setShowAddTipoReclamacionModal] = useState(false);
  const [newTipoReclamacionName, setNewTipoReclamacionName] = useState('');

  const [showAddAreaCausanteModal, setShowAddAreaCausanteModal] = useState(false);
  const [newAreaCausanteName, setNewAreaCausanteName] = useState('');

  // Quality filters
  const [filterCalidadTipo, setFilterCalidadTipo] = useState('Todos');
  const [filterCalidadEstado, setFilterCalidadEstado] = useState('Todos');
  const [showCalidadOnlyThisWeek, setShowCalidadOnlyThisWeek] = useState(true);

  // Helper constants & functions for Safety Action Plan
  const TALLERES_SEGURIDAD = [
    'SALA BLANCA',
    'EMBUTIDO',
    'MOVIMIENTOS',
    'EXPEDICIONES'
  ];

  const calcularEstado = (fechaPrevista: string, fechaReal?: string): string => {
    if (fechaReal) return 'Cerrado';
    if (!fechaPrevista) return 'Abierto';
    const hoy = new Date().toISOString().split('T')[0];
    if (fechaPrevista < hoy) return 'Retrasado';
    return 'En Marcha';
  };

  const getResponsablesDisponibles = () => {
    if (!operarios || operarios.length === 0) return [];
    return operarios.filter(op => 
      op.areas?.includes('TOP 15') || 
      op.areas?.includes('TOP 60') || 
      (op as any).showInTop15 === true || 
      (op as any).showInTop60 === true ||
      (op as any).show_in_top15 === true ||
      (op as any).show_in_top60 === true
    );
  };

  // Mapper helpers
  const mapDbToUi = (dbItem: any): PlanAccionSeguridad => {
    const prev = dbItem.fecha_implantacion_prevista || dbItem.fechaImplantacionPrevista || '';
    const real = dbItem.fecha_implantacion_real || dbItem.fechaImplantacionReal || '';
    return {
      id: dbItem.id,
      fecha: dbItem.fecha,
      tipo: dbItem.tipo,
      gap: dbItem.gap,
      queHaOcurrido: dbItem.que_ha_ocurrido || dbItem.queHaOcurrido || '',
      accion: dbItem.accion || '',
      responsable: dbItem.responsable || '',
      fechaImplantacionPrevista: prev,
      fechaImplantacionReal: real,
      estado: calcularEstado(prev, real) as any
    };
  };

  const mapUiToDb = (uiItem: PlanAccionSeguridad) => {
    const prev = uiItem.fechaImplantacionPrevista || '';
    const real = uiItem.fechaImplantacionReal || '';
    return {
      id: uiItem.id,
      fecha: uiItem.fecha,
      tipo: uiItem.tipo,
      gap: uiItem.gap,
      que_ha_ocurrido: uiItem.queHaOcurrido,
      accion: uiItem.accion,
      responsable: uiItem.responsable,
      fecha_implantacion_prevista: prev,
      fecha_implantacion_real: real || null,
      estado: calcularEstado(prev, real)
    };
  };

  const getActionStatus = (item: any) => {
    const prev = item.fechaImplantacionPrevista || item.fecha_implantacion_prevista || '';
    const real = item.fechaImplantacionReal || item.fecha_implantacion_real || '';
    return calcularEstado(prev, real);
  };

  // --- PERSONAL & CALIDAD MAPPERS & HELPERS ---
  const mapDbToPersonal = (row: any): RegistroPersonalTop60 => {
    if (row.comentarios && row.comentarios.startsWith('{')) {
      try {
        const parsed = JSON.parse(row.comentarios);
        return {
          id: row.id,
          fecha: row.fecha,
          jornadasTeoricas: parsed.jornadasTeoricas || 0,
          jornadasPerdidasBaja: parsed.jornadasPerdidasBaja || 0,
          jornadasPerdidasAusentismo: parsed.jornadasPerdidasAusentismo || 0,
        };
      } catch (e) {
        // Fallback
      }
    }
    return {
      id: row.id,
      fecha: row.fecha,
      jornadasTeoricas: Number(row.jornadas_teoricas || row.jornadasTeoricas || 100),
      jornadasPerdidasBaja: Number(row.jornadas_perdidas_baja || row.jornadasPerdidasBaja || 0),
      jornadasPerdidasAusentismo: Number(row.jornadas_perdidas_ausentismo || row.jornadasPerdidasAusentismo || 0),
    };
  };

  const mapDbToCalidad = (dbItem: any): PlanAccionCalidad => {
    return {
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
    };
  };

  const mapCalidadToDb = (uiItem: PlanAccionCalidad) => {
    return {
      id: uiItem.id || undefined,
      fecha: uiItem.fecha,
      tipo_reclamacion: uiItem.tipoReclamacion,
      area_causante: uiItem.areaCausante,
      descripcion_problema: uiItem.descripcionProblema,
      accion_contenedora: uiItem.accionContenedora,
      responsable_contenedora: uiItem.responsableContenedora,
      fecha_prevista_contenedora: uiItem.fechaPrevistaContenedora,
      fecha_cierre_contenedora: uiItem.fechaCierreContenedora || null,
      accion_correctora: uiItem.accionCorrectora,
      responsable_correctora: uiItem.responsableCorrectora,
      fecha_prevista_correctora: uiItem.fechaPrevistaCorrectora,
      fecha_cierre_correctora: uiItem.fechaCierreCorrectora || null,
      origen: uiItem.origen || null,
    };
  };

  const getCalidadActionStatus = (fechaPrevista: string, fechaCierre?: string): string => {
    if (fechaCierre) return 'Cerrado';
    if (!fechaPrevista) return 'Abierto';
    const hoy = new Date().toISOString().split('T')[0];
    if (fechaPrevista < hoy) return 'Retrasado';
    return 'En Marcha';
  };

  const getCalidadGlobalStatus = (item: PlanAccionCalidad): 'Abierto' | 'En Marcha' | 'Cerrado' | 'Retrasado' => {
    const estCont = getCalidadActionStatus(item.fechaPrevistaContenedora, item.fechaCierreContenedora);
    const estCorr = getCalidadActionStatus(item.fechaPrevistaCorrectora, item.fechaCierreCorrectora);
    
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

  const fetchSecurityPlan = async () => {
    try {
      const { data, error } = await supabase.from('plan_accion_seguridad').select('*');
      if (error) {
        console.error("Error fetching plan_accion_seguridad:", error);
      } else if (data) {
        setPlanAccionRecords(data.map(mapDbToUi));
      }
    } catch (e) {
      console.warn("Exception fetching plan_accion_seguridad:", e);
    }
  };

  const fetchGaps = async () => {
    try {
      const { data, error } = await supabase.from('gaps_seguridad').select('*').order('nombre');
      if (error) {
        console.error("Error fetching gaps_seguridad:", error);
      } else if (data) {
        setGapsList(data);
      }
    } catch (e) {
      console.warn("Exception fetching gaps_seguridad:", e);
    }
  };

  const filteredActions = useMemo(() => {
    return planAccionRecords.filter(action => {
      // Filter by type
      if (filterTipo !== 'Todos' && action.tipo !== filterTipo) {
        return false;
      }
      
      // Filter by state/status
      const status = getActionStatus(action);
      if (filterEstado !== 'Todos') {
        if (filterEstado === 'Retrasado') {
          if (status !== 'Retrasado') return false;
        } else {
          if (action.estado !== filterEstado) return false;
        }
      }

      // Filter by week if enabled
      if (showOnlyThisWeek) {
        const actionMonday = getMondayDateString(action.fecha);
        const selectedMonday = getMondayDateString(selectedDate);
        if (actionMonday !== selectedMonday) {
          return false;
        }
      }

      return true;
    });
  }, [planAccionRecords, filterTipo, filterEstado, showOnlyThisWeek, selectedDate]);

  const fetchPlanCalidad = async () => {
    try {
      const { data, error } = await supabase.from('plan_accion_calidad').select('*');
      if (error) {
        console.error("Error fetching plan_accion_calidad:", error);
      } else if (data) {
        setPlanCalidadRecords(data.map(mapDbToCalidad));
      }
    } catch (e) {
      console.warn("Exception fetching plan_accion_calidad:", e);
    }
  };

  const fetchTiposReclamacion = async () => {
    try {
      const { data, error } = await supabase.from('tipos_reclamacion').select('*').order('nombre');
      if (error) {
        console.error("Error fetching tipos_reclamacion:", error);
      } else if (data) {
        setTiposReclamacion(data);
      }
    } catch (e) {
      console.warn("Exception fetching tipos_reclamacion:", e);
    }
  };

  const fetchAreasCausantesCalidad = async () => {
    try {
      const { data, error } = await supabase.from('areas_causantes_calidad').select('*').order('nombre');
      if (error) {
        console.error("Error fetching areas_causantes_calidad:", error);
      } else if (data) {
        setAreasCausantesCalidad(data);
      }
    } catch (e) {
      console.warn("Exception fetching areas_causantes_calidad:", e);
    }
  };

  const registrosPersonal = useMemo(() => {
    const list: RegistroPersonalTop60[] = [];
    const addedFechas = new Set<string>();

    supabaseRrhhRecords.forEach(r => {
      if (r.area === 'PERSONAL_TOP60') {
        const mapped = mapDbToPersonal(r);
        list.push(mapped);
        addedFechas.add(r.fecha);
      }
    });

    const groupedOld: Record<string, { absentismo?: number; ausentismo?: number; comentarios?: string }> = {};
    supabaseRrhhRecords.forEach(r => {
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
  }, [supabaseRrhhRecords]);

  const filteredCalidadActions = useMemo(() => {
    return planCalidadRecords.filter(action => {
      if (filterCalidadTipo !== 'Todos' && action.tipoReclamacion !== filterCalidadTipo) {
        return false;
      }
      
      const globalStatus = getCalidadGlobalStatus(action);
      if (filterCalidadEstado !== 'Todos' && globalStatus !== filterCalidadEstado) {
        return false;
      }

      if (showCalidadOnlyThisWeek) {
        const actionMonday = getMondayDateString(action.fecha);
        const selectedMonday = getMondayDateString(selectedDate);
        if (actionMonday !== selectedMonday) {
          return false;
        }
      }
      
      return true;
    });
  }, [planCalidadRecords, filterCalidadTipo, filterCalidadEstado, showCalidadOnlyThisWeek, selectedDate]);

  const filteredIdeas = useMemo(() => {
    return (ideasDeMejora || []).filter(idea => {
      // Estado filter
      if (filterIdmEstado !== 'Todos' && idea.estado !== filterIdmEstado) return false;
      
      // Aprobada filter
      if (filterIdmAprobada !== 'Todos' && idea.aprobada !== filterIdmAprobada) return false;
      
      // Responsable filter
      if (filterIdmResponsable !== 'Todos' && idea.responsable !== filterIdmResponsable) return false;
      
      // Show only this week filter
      if (showIdmOnlyThisWeek) {
        const mondaySelected = getMondayDateString(selectedDate);
        const mondayIdea = getMondayDateString(idea.fechaCreacion);
        if (mondaySelected !== mondayIdea) return false;
      }
      
      return true;
    });
  }, [ideasDeMejora, filterIdmEstado, filterIdmAprobada, filterIdmResponsable, showIdmOnlyThisWeek, selectedDate]);

  const handleEditIdea = (idea: IdeaDeMejora) => {
    if (!isEditingUnlocked) {
      setPinInput('');
      setPinError('');
      setShowPinModal(true);
      return;
    }
    setIdmForm({
      id: idea.id,
      sugerencia: idea.sugerencia,
      recurso: idea.recurso as any,
      responsable: idea.responsable,
      fechaEjecucionPrevista: idea.fechaEjecucionPrevista || '',
      fechaCierre: idea.fechaCierre || '',
      aprobada: idea.aprobada,
      fechaEmision: idea.fechaEmision || new Date().toISOString().split('T')[0]
    });
  };

  const handleDeleteIdea = (id: string) => {
    if (!isEditingUnlocked) {
      setPinInput('');
      setPinError('');
      setShowPinModal(true);
      return;
    }
    if (confirm("¿Estás seguro de que quieres eliminar esta idea de mejora?")) {
      onDeleteIdeaMejora?.(id);
    }
  };

  const handleSaveIdea = () => {
    if (!idmForm.sugerencia.trim()) {
      alert("Por favor, introduce la sugerencia.");
      return;
    }
    if (!idmForm.recurso) {
      alert("Por favor, selecciona un emisor.");
      return;
    }
    if (!idmForm.fechaEmision) {
      alert("Por favor, selecciona una fecha de emisión.");
      return;
    }
    
    const ideaToSave: IdeaDeMejora = {
      id: idmForm.id || '',
      numeroSugerencia: 0, // Will be calculated by handleSaveIdeaMejora if new
      sugerencia: idmForm.sugerencia,
      recurso: idmForm.recurso,
      fechaCreacion: idmForm.id ? ((ideasDeMejora || []).find(i => i.id === idmForm.id)?.fechaCreacion || selectedDate) : selectedDate,
      aprobada: idmForm.aprobada,
      responsable: idmForm.responsable || (getResponsablesDisponibles().length > 0 ? getResponsablesDisponibles()[0].nombre : ''),
      fechaEjecucionPrevista: idmForm.fechaEjecucionPrevista || undefined,
      fechaCierre: idmForm.fechaCierre || undefined,
      estado: 'Abierto', // Will be recalculated by handleSaveIdeaMejora
      fechaEmision: idmForm.fechaEmision
    };

    onSaveIdeaMejora?.(ideaToSave).then(() => {
      resetIdmForm();
    });
  };

  const fetchSupabaseRrhh = async () => {
    try {
      const { data, error } = await supabase.from('top60_rrhh').select('*');
      if (error) {
        console.error("Error fetching top60_rrhh:", error);
      } else if (data) {
        setSupabaseRrhhRecords(data);
      }
    } catch (e) {
      console.error("Error in fetchSupabaseRrhh:", e);
    }
  };

  useEffect(() => {
    fetchSupabaseRrhh();
    fetchSecurityPlan();
    fetchGaps();
    fetchPlanCalidad();
    fetchTiposReclamacion();
    fetchAreasCausantesCalidad();
  }, []);

  // Save records to localStorage
  const saveRecords = (newRecords: Record<string, DateRecords>) => {
    setRecords(newRecords);
    try {
      localStorage.setItem('zitron_top60_preparacion_records', JSON.stringify(newRecords));
    } catch (e) {
      console.error("Error saving records:", e);
    }
  };

  // Active modal state
  const [activeModal, setActiveModal] = useState<'seguridad' | 'personal' | 'calidad' | 'produccion' | 'idm' | null>(null);

  const [produccionForm, setProduccionForm] = useState({
    cantidad: '',
    tiempoProduccion: '',
    tiempoEsperas: '',
    tiempoAverias: '',
    observaciones: ''
  });

  // Populate forms when date or activeModal changes
  useEffect(() => {
    const dayRecords = records[selectedDate];
    
    if (activeModal === 'personal') {
      const fridayDate = getFridayOfWeek(selectedDate);
      const mondayDate = getMondayDateString(selectedDate);
      const existing = registrosPersonal.find(r => getMondayDateString(r.fecha) === mondayDate);
      
      setPersonalForm({
        fecha: existing?.fecha ?? fridayDate,
        jornadasTeoricas: existing?.jornadasTeoricas ?? 0,
        jornadasPerdidasBaja: existing?.jornadasPerdidasBaja ?? 0,
        jornadasPerdidasAusentismo: existing?.jornadasPerdidasAusentismo ?? 0
      });
    } else if (activeModal === 'produccion') {
      const existing = dayRecords?.produccion?.data;
      setProduccionForm({
        cantidad: existing?.cantidad ?? '',
        tiempoProduccion: existing?.tiempoProduccion ?? '',
        tiempoEsperas: existing?.tiempoEsperas ?? '',
        tiempoAverias: existing?.tiempoAverias ?? '',
        observaciones: existing?.observaciones ?? ''
      });
    }
  }, [activeModal, selectedDate, records, operarios, supabaseRrhhRecords, registrosPersonal]);

  // Helper to format date relative to today
  const formatLastUpdate = (timestampStr: string) => {
    if (!timestampStr) return "Sin registrar";
    const dateObj = new Date(timestampStr);
    const now = new Date();
    
    const isToday = dateObj.getFullYear() === now.getFullYear() &&
                    dateObj.getMonth() === now.getMonth() &&
                    dateObj.getDate() === now.getDate();
                    
    const timeStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return `Hoy, ${timeStr}`;
    } else {
      const dateStr = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
      return `${dateStr}, ${timeStr}`;
    }
  };

  // Helper to format date in Spanish for title
  const getSpanishDateText = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const formatted = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch (e) {
      return dateStr;
    }
  };

  // Helpers for sections state
  const getSectionStatusAndDate = (sectionKey: 'seguridad' | 'personal' | 'calidad' | 'produccion' | 'idm') => {
    if (sectionKey === 'idm') {
      const pendingCount = (ideasDeMejora || []).filter(a => {
        return a.estado === 'Abierto' || a.estado === 'Retrasado';
      }).length;
      
      if (pendingCount === 0) {
        return {
          status: 'Completado' as const,
          color: 'text-green-600',
          bgClass: 'bg-green-100 text-green-700 border-green-200',
          updatedText: 'Sin ideas pendientes de mejora'
        };
      } else {
        return {
          status: 'Pendiente' as const,
          color: 'text-amber-600',
          bgClass: 'bg-amber-100 text-amber-700 border-amber-200',
          updatedText: `${pendingCount} ideas abiertas o retrasadas`
        };
      }
    }

    if (sectionKey === 'seguridad') {
      const pendingGlobalCount = planAccionRecords.filter(a => {
        const s = getActionStatus(a);
        return s === 'Abierto' || s === 'Retrasado';
      }).length;
      
      if (pendingGlobalCount === 0) {
        return {
          status: 'Completado' as const,
          color: 'text-green-600',
          bgClass: 'bg-green-100 text-green-700 border-green-200',
          updatedText: 'Sin acciones pendientes de seguridad'
        };
      } else {
        return {
          status: 'Pendiente' as const,
          color: 'text-amber-600',
          bgClass: 'bg-amber-100 text-amber-700 border-amber-200',
          updatedText: `${pendingGlobalCount} acciones pendientes de cierre`
        };
      }
    }

    if (sectionKey === 'personal') {
      const mondayDate = getMondayDateString(selectedDate);
      const record = registrosPersonal.find(r => getMondayDateString(r.fecha) === mondayDate);
      
      if (record) {
        return {
          status: 'Completado' as const,
          color: 'text-green-600',
          bgClass: 'bg-green-100 text-green-700 border-green-200',
          updatedText: 'Semana registrada'
        };
      } else {
        return {
          status: 'Pendiente' as const,
          color: 'text-amber-600',
          bgClass: 'bg-amber-100 text-amber-700 border-amber-200',
          updatedText: 'Sin registrar para esta semana'
        };
      }
    }

    if (sectionKey === 'calidad') {
      const mondayDate = getMondayDateString(selectedDate);
      const weekActions = planCalidadRecords.filter(a => getMondayDateString(a.fecha) === mondayDate);
      
      // Check if there are any actions with status 'Abierto' or 'Retrasado'
      const pendingCount = weekActions.filter(a => {
        const s = getCalidadGlobalStatus(a);
        return s === 'Abierto' || s === 'Retrasado';
      }).length;
      
      if (pendingCount === 0) {
        return {
          status: 'Completado' as const,
          color: 'text-green-600',
          bgClass: 'bg-green-100 text-green-700 border-green-200',
          updatedText: 'Sin reclamaciones pendientes de calidad'
        };
      } else {
        return {
          status: 'Pendiente' as const,
          color: 'text-amber-600',
          bgClass: 'bg-amber-100 text-amber-700 border-amber-200',
          updatedText: `${pendingCount} reclamaciones abiertas o retrasadas`
        };
      }
    }

    const dayRecords = records[selectedDate];
    const sectionRecord = dayRecords?.[sectionKey];
    
    if (sectionRecord?.completed) {
      return {
        status: 'Completado' as const,
        color: 'text-green-600',
        bgClass: 'bg-green-100 text-green-700 border-green-200',
        updatedText: sectionRecord.updatedAt ? formatLastUpdate(sectionRecord.updatedAt) : 'Última actualización: Desconocida'
      };
    } else {
      return {
        status: 'Pendiente' as const,
        color: 'text-amber-600',
        bgClass: 'bg-amber-100 text-amber-700 border-amber-200',
        updatedText: 'Sin registrar para este día'
      };
    }
  };

  const getSectionSummary = (sectionKey: 'seguridad' | 'personal' | 'calidad' | 'produccion' | 'idm') => {
    const record = records[selectedDate]?.[sectionKey as any];
    
    if (sectionKey === 'idm') {
      if ((ideasDeMejora || []).length > 0) {
        const approved = ideasDeMejora.filter(a => a.aprobada === 'Sí').length;
        const pendingApprove = ideasDeMejora.filter(a => a.aprobada === 'Pendiente').length;
        const closed = ideasDeMejora.filter(a => a.estado === 'Cerrado').length;
        return `Total: ${ideasDeMejora.length} | Aprobadas: ${approved} | Pendientes Aprob.: ${pendingApprove} | Cerradas: ${closed}`;
      }
      return "0 ideas registradas";
    }

    if (sectionKey === 'seguridad') {
      const mondayDate = getMondayDateString(selectedDate);
      const weekActions = planAccionRecords.filter(a => getMondayDateString(a.fecha) === mondayDate);
      
      if (weekActions.length > 0) {
        const acc = weekActions.filter(a => a.tipo === 'Accidente').length;
        const inc = weekActions.filter(a => a.tipo === 'Incidente').length;
        const nm = weekActions.filter(a => a.tipo === 'Near Miss').length;
        const pending = weekActions.filter(a => {
          const s = getActionStatus(a);
          return s === 'Abierto' || s === 'Retrasado';
        }).length;
        return `Accidentes: ${acc} | Incidentes: ${inc} | Near Miss: ${nm}${pending > 0 ? ` | Pendientes: ${pending}` : ' | Todo cerrado'}`;
      }
      return "0 acciones registradas esta semana";
    } else if (sectionKey === 'personal') {
      const mondayDate = getMondayDateString(selectedDate);
      const record = registrosPersonal.find(r => getMondayDateString(r.fecha) === mondayDate);
      
      if (record) {
        const abs = record.jornadasTeoricas > 0 ? (record.jornadasPerdidasBaja / record.jornadasTeoricas) * 100 : 0;
        const aus = record.jornadasTeoricas > 0 ? (record.jornadasPerdidasAusentismo / record.jornadasTeoricas) * 100 : 0;
        return `Teóricas: ${record.jornadasTeoricas} | Absentismo: ${abs.toFixed(1)}% | Ausentismo: ${aus.toFixed(1)}%`;
      }
      return "0 registros para esta semana";
    } else if (sectionKey === 'calidad') {
      const mondayDate = getMondayDateString(selectedDate);
      const weekActions = planCalidadRecords.filter(a => getMondayDateString(a.fecha) === mondayDate);
      
      if (weekActions.length > 0) {
        const closed = weekActions.filter(a => getCalidadGlobalStatus(a) === 'Cerrado').length;
        const pending = weekActions.length - closed;
        return `Reclamaciones: ${weekActions.length} | Cerradas: ${closed}${pending > 0 ? ` | Pendientes: ${pending}` : ' | Todo cerrado'}`;
      }
      return "0 reclamaciones registradas esta semana";
    } else if (sectionKey === 'produccion') {
      const d = record?.data;
      if (!record?.completed || !d) return null;
      const items = [];
      if (d.cantidad) items.push(`${d.cantidad} kg`);
      if (d.tiempoProduccion) items.push(`${d.tiempoProduccion} min prod`);
      const paradas = Number(d.tiempoEsperas || 0) + Number(d.tiempoAverias || 0);
      if (paradas > 0) items.push(`${paradas} min paradas`);
      return items.join(" | ") || "Datos registrados";
    }
    return null;
  };

  // Save event handlers for Plan de Acción de Seguridad
  const checkPasswordLevel3 = (pin: string) => {
    if (!passwords) return pin === '1234';
    return pin === passwords.directorOperaciones || pin === passwords.asistenciaTecnica || pin === passwords.jefeTaller;
  };

  const handleSaveAction = async (action: PlanAccionSeguridad) => {
    const dbItem = mapUiToDb(action);
    try {
      const { error } = await supabase.from('plan_accion_seguridad').upsert(dbItem);
      if (error) {
        alert("Error al guardar la acción: " + error.message);
      } else {
        await fetchSecurityPlan();
        setShowAddActionModal(false);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleDeleteAction = async (id: string) => {
    try {
      const { error } = await supabase.from('plan_accion_seguridad').delete().eq('id', id);
      if (error) {
        alert("Error al eliminar la acción: " + error.message);
      } else {
        await fetchSecurityPlan();
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleCreateGap = async (name: string) => {
    if (!name.trim()) return;
    const newGap = {
      id: name.trim().toLowerCase().replace(/\s+/g, '-'),
      nombre: name.trim()
    };
    try {
      const { error } = await supabase.from('gaps_seguridad').insert(newGap);
      if (error) {
        alert("Error al guardar gap: " + error.message);
      } else {
        await fetchGaps();
        setShowAddGapModal(false);
        setNewGapName('');
        // Auto-select standard or customized gap name
        setCurrentActionForm(prev => ({ ...prev, gap: newGap.nombre }));
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleSavePersonal = async () => {
    if (personalForm.jornadasTeoricas <= 0) {
      alert("Las jornadas teóricas de la semana deben ser mayores que 0.");
      return;
    }
    if (personalForm.jornadasPerdidasBaja > personalForm.jornadasTeoricas) {
      alert("Las jornadas perdidas por baja no pueden superar a las jornadas teóricas.");
      return;
    }
    if (personalForm.jornadasPerdidasAusentismo > personalForm.jornadasTeoricas) {
      alert("Las jornadas perdidas por ausentismo no pueden superar a las jornadas teóricas.");
      return;
    }

    const regDate = personalForm.fecha || getFridayOfWeek(selectedDate);
    const mondayDate = getMondayDateString(regDate);
    const pctAbsentismo = (personalForm.jornadasPerdidasBaja / personalForm.jornadasTeoricas) * 100;
    const pctAusentismo = (personalForm.jornadasPerdidasAusentismo / personalForm.jornadasTeoricas) * 100;

    const serialized = JSON.stringify({
      jornadasTeoricas: personalForm.jornadasTeoricas,
      jornadasPerdidasBaja: personalForm.jornadasPerdidasBaja,
      jornadasPerdidasAusentismo: personalForm.jornadasPerdidasAusentismo
    });

    console.log('Guardando registro de personal en Supabase:', serialized);
    try {
      // A. Main structured row
      const primaryObj = {
        id: `${mondayDate}_personal`,
        fecha: regDate,
        area: 'PERSONAL_TOP60',
        jornadas_teoricas: personalForm.jornadasTeoricas,
        jornadas_perdidas_baja: personalForm.jornadasPerdidasBaja,
        jornadas_perdidas_ausentismo: personalForm.jornadasPerdidasAusentismo,
        comentarios: serialized,
        valor: personalForm.jornadasTeoricas
      };

      const { error: primaryErr } = await supabase.from('top60_rrhh').upsert(primaryObj);
      
      if (primaryErr && primaryErr.message.includes('column')) {
        // Fallback for missing custom columns: save using standard columns only
        const fallbackObj = {
          id: `${mondayDate}_personal`,
          fecha: regDate,
          area: 'PERSONAL_TOP60',
          comentarios: serialized,
          valor: personalForm.jornadasTeoricas
        };
        await supabase.from('top60_rrhh').upsert(fallbackObj);
      }

      // B. Legacy rows for backwards compatibility with the existing dashboard
      await supabase.from('top60_rrhh').upsert({
        id: `${mondayDate}_absentismo`,
        fecha: mondayDate,
        area: 'absentismo',
        valor: pctAbsentismo,
        comentarios: `Auto-generated. Baja: ${personalForm.jornadasPerdidasBaja}, Teoricas: ${personalForm.jornadasTeoricas}`
      });

      await supabase.from('top60_rrhh').upsert({
        id: `${mondayDate}_ausentismo`,
        fecha: mondayDate,
        area: 'ausentismo',
        valor: pctAusentismo,
        comentarios: `Auto-generated. Ausentismo: ${personalForm.jornadasPerdidasAusentismo}, Teoricas: ${personalForm.jornadasTeoricas}`
      });

      await fetchSupabaseRrhh();
    } catch (e: any) {
      console.error("Exception upserting to top60_rrhh:", e);
      alert("Error al guardar en Supabase: " + e.message);
    }

    const updatedRecords = {
      ...records,
      [selectedDate]: {
        ...records[selectedDate],
        personal: {
          completed: true,
          updatedAt: new Date().toISOString(),
          data: {
            jornadasTeoricas: personalForm.jornadasTeoricas,
            jornadasPerdidasBaja: personalForm.jornadasPerdidasBaja,
            jornadasPerdidasAusentismo: personalForm.jornadasPerdidasAusentismo
          }
        }
      }
    };
    saveRecords(updatedRecords);
    setActiveModal(null);
  };

  const handleCreateTipoReclamacion = async () => {
    if (!newTipoReclamacionName.trim()) return;
    const name = newTipoReclamacionName.trim();
    const id = name.toLowerCase().replace(/\s+/g, '-');
    try {
      const { error } = await supabase.from('tipos_reclamacion').insert({ id, nombre: name });
      if (error) {
        alert("Error al guardar el tipo de reclamación: " + error.message);
      } else {
        setNewTipoReclamacionName('');
        setShowAddTipoReclamacionModal(false);
        await fetchTiposReclamacion();
        setCurrentCalidadForm(prev => ({ ...prev, tipoReclamacion: name }));
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleCreateAreaCausante = async () => {
    if (!newAreaCausanteName.trim()) return;
    const name = newAreaCausanteName.trim();
    const id = name.toLowerCase().replace(/\s+/g, '-');
    try {
      const { error } = await supabase.from('areas_causantes_calidad').insert({ id, nombre: name });
      if (error) {
        alert("Error al guardar el área causante: " + error.message);
      } else {
        setNewAreaCausanteName('');
        setShowAddAreaCausanteModal(false);
        await fetchAreasCausantesCalidad();
        setCurrentCalidadForm(prev => ({ ...prev, areaCausante: name }));
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleSaveCalidad = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentCalidadForm.fecha) {
      alert("Debe seleccionar una fecha para la reclamación.");
      return;
    }
    if (!currentCalidadForm.tipoReclamacion) {
      alert("Debe seleccionar el tipo de reclamación.");
      return;
    }
    if (!currentCalidadForm.areaCausante) {
      alert("Debe seleccionar el área causante.");
      return;
    }
    if (!currentCalidadForm.origen) {
      alert("Debe seleccionar el origen (Interna o Externa) de la reclamación.");
      return;
    }
    if (!currentCalidadForm.descripcionProblema) {
      alert("Debe describir qué ha ocurrido.");
      return;
    }
    if (!currentCalidadForm.accionContenedora) {
      alert("Debe describir la acción contenedora.");
      return;
    }
    if (!currentCalidadForm.responsableContenedora) {
      alert("Debe asignar un responsable para la acción contenedora.");
      return;
    }
    if (!currentCalidadForm.fechaPrevistaContenedora) {
      alert("Debe asignar una fecha prevista para la acción contenedora.");
      return;
    }
    if (!currentCalidadForm.accionCorrectora) {
      alert("Debe describir la acción correctora.");
      return;
    }
    if (!currentCalidadForm.responsableCorrectora) {
      alert("Debe asignar un responsable para la acción correctora.");
      return;
    }
    if (!currentCalidadForm.fechaPrevistaCorrectora) {
      alert("Debe asignar una fecha prevista para la acción correctora.");
      return;
    }

    const dbItem = mapCalidadToDb(currentCalidadForm);
    if (!dbItem.id) {
      dbItem.id = `calidad_${Date.now()}`;
    }
    try {
      const { error } = await supabase.from('plan_accion_calidad').upsert(dbItem);
      if (error) {
        alert("Error al guardar la reclamación: " + error.message);
      } else {
        await fetchPlanCalidad();
        setShowAddCalidadModal(false);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleDeleteCalidad = async (id: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta reclamación?")) return;
    try {
      const { error } = await supabase.from('plan_accion_calidad').delete().eq('id', id);
      if (error) {
        alert("Error al eliminar la reclamación: " + error.message);
      } else {
        await fetchPlanCalidad();
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleSaveProduccion = () => {
    const updatedRecords = {
      ...records,
      [selectedDate]: {
        ...records[selectedDate],
        produccion: {
          completed: true,
          updatedAt: new Date().toISOString(),
          data: produccionForm
        }
      }
    };
    saveRecords(updatedRecords);
    setActiveModal(null);
  };

  const sections = [
    { key: 'seguridad' as const, title: 'Seguridad', icon: ClipboardCheck },
    { key: 'personal' as const, title: 'Personal', icon: Users },
    { key: 'calidad' as const, title: 'Calidad', icon: ClipboardCheck },
    { key: 'idm' as const, title: 'Ideas de Mejora (IDM)', icon: Lightbulb },
    { key: 'produccion' as const, title: 'Producción', icon: Calendar },
  ];

  return (
    <div className="p-6 bg-slate-50/50 min-h-full">
      <div className="max-w-4xl mx-auto">
        {/* Header with Title and Date Selector */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div>
            <h1 className="text-3xl font-serif font-black text-slate-900 uppercase tracking-tight">Preparación TOP 60</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">{getSpanishDateText(selectedDate)}</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cambiar fecha:</label>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2.5 border border-slate-200 rounded-2xl font-bold text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer"
            />
          </div>
        </div>
        
        {/* Main Sections Cards */}
        <div className="grid gap-6">
          {sections.map((s) => {
            const info = getSectionStatusAndDate(s.key);
            const summary = getSectionSummary(s.key);
            
            return (
              <div key={s.key} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all gap-4">
                <div className="flex items-center gap-6">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm flex-shrink-0">
                    <s.icon className={`w-8 h-8 ${info.color}`} />
                  </div>
                  <div>
                    <h3 className="text-xl font-serif font-black text-slate-900 uppercase tracking-tight">{s.title}</h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">{info.updatedText}</p>
                    {summary && (
                      <p className="text-sm text-indigo-600 font-semibold mt-1.5 flex items-center gap-1.5 bg-indigo-50/50 px-3 py-1 rounded-xl w-fit border border-indigo-100/50">
                        <Check className="w-4 h-4" />
                        {summary}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 border-t border-slate-50 sm:border-t-0 pt-4 sm:pt-0">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${info.bgClass}`}>
                    {info.status}
                  </span>
                  <button 
                    id={`btn-open-${s.key}`}
                    onClick={() => setActiveModal(s.key)}
                    className="p-3 bg-slate-900 text-white hover:bg-indigo-600 rounded-2xl shadow-sm transition-all flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95"
                    title={`Registrar ${s.title}`}
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* SEGURIDAD MODAL (Plan de Acción de Seguridad completo) */}
      {activeModal === 'seguridad' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-6xl shadow-2xl border border-slate-100 flex flex-col h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="bg-red-50 p-3 rounded-2xl text-red-600 border border-red-100">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-serif font-black text-slate-900 uppercase tracking-tight">PLAN DE ACCIÓN DE SEGURIDAD</h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Semana {getWeekNumber(new Date(selectedDate))} (Lunes {formatDateDMY(getMondayDateString(selectedDate))})
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Bloquear/Desbloquear Button */}
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
                  className={`px-4 py-2 rounded-2xl font-bold text-xs flex items-center gap-2 border transition-all cursor-pointer ${
                    isEditingUnlocked 
                      ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                      : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  {isEditingUnlocked ? (
                    <>
                      <Unlock className="w-4 h-4 text-green-600" />
                      Desbloqueado 🔓
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-rose-600" />
                      Bloqueado 🔒
                    </>
                  )}
                </button>

                {/* Añadir Acción Button */}
                <button
                  onClick={() => {
                    if (!isEditingUnlocked) {
                      setPinInput('');
                      setPinError('');
                      setShowPinModal(true);
                      return;
                    }
                    setCurrentActionForm({
                      id: 'action_' + Date.now(),
                      fecha: selectedDate,
                      tipo: 'Accidente',
                      gap: 'SALA BLANCA',
                      queHaOcurrido: '',
                      accion: '',
                      responsable: getResponsablesDisponibles().length > 0 ? getResponsablesDisponibles()[0].nombre : '',
                      fechaImplantacionPrevista: selectedDate,
                      fechaImplantacionReal: '',
                      estado: 'Abierto'
                    });
                    setShowAddActionModal(true);
                  }}
                  className="px-4 py-2 bg-slate-900 text-white rounded-2xl font-bold text-xs flex items-center gap-2 hover:bg-indigo-600 transition-all cursor-pointer shadow-sm hover:shadow-indigo-100"
                >
                  <Plus className="w-4 h-4" />
                  Añadir Acción
                </button>

                <button 
                  onClick={() => setActiveModal(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filters Row */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                {/* Tipo Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tipo:</span>
                  <select
                    value={filterTipo}
                    onChange={(e) => setFilterTipo(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Todos">Todos los tipos</option>
                    <option value="Accidente">Accidente</option>
                    <option value="Incidente">Incidente</option>
                    <option value="Near Miss">Near Miss</option>
                  </select>
                </div>

                {/* Estado Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Estado:</span>
                  <select
                    value={filterEstado}
                    onChange={(e) => setFilterEstado(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Todos">Todos los estados</option>
                    <option value="Abierto">Abierto</option>
                    <option value="En Marcha">En Marcha</option>
                    <option value="Cerrado">Cerrado</option>
                    <option value="Retrasado">Retrasado (Límite vencido)</option>
                  </select>
                </div>

                {/* Toggle Solo esta semana */}
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showOnlyThisWeek}
                    onChange={(e) => setShowOnlyThisWeek(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span className="text-xs font-bold text-slate-600">Solo esta semana</span>
                </label>
              </div>

              {/* Status Counters summary */}
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-400 font-medium">Acciones mostradas: <strong className="text-slate-700">{filteredActions.length}</strong></span>
                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                <span className="text-slate-400 font-medium">Pendientes globales: <strong className="text-rose-600 font-bold">{planAccionRecords.filter(a => getActionStatus(a) !== 'Cerrado').length}</strong></span>
              </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto p-6">
              {filteredActions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                  <ClipboardCheck className="w-12 h-12 stroke-1 text-slate-300 mb-3" />
                  <p className="text-sm font-medium">No se encontraron acciones de seguridad que cumplan con los filtros.</p>
                  {showOnlyThisWeek && (
                    <button
                      onClick={() => setShowOnlyThisWeek(false)}
                      className="mt-2 text-xs font-bold text-indigo-600 hover:underline"
                    >
                      Ver todas las semanas
                    </button>
                  )}
                </div>
              ) : (
                <div className="min-w-full overflow-hidden border border-slate-100 rounded-2xl bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-slate-100 text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Gap Seguridad</th>
                        <th className="px-4 py-3 max-w-xs">Qué ha ocurrido</th>
                        <th className="px-4 py-3 max-w-xs">Acción correctora</th>
                        <th className="px-4 py-3">Responsable</th>
                        <th className="px-4 py-3">F. Prevista</th>
                        <th className="px-4 py-3">F. Real</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                      {filteredActions.map((action) => {
                        const status = getActionStatus(action);
                        
                        let tipoBadge = 'bg-slate-100 text-slate-700 border-slate-200';
                        if (action.tipo === 'Accidente') tipoBadge = 'bg-red-50 text-red-700 border-red-100';
                        if (action.tipo === 'Incidente') tipoBadge = 'bg-orange-50 text-orange-700 border-orange-100';
                        if (action.tipo === 'Near Miss') tipoBadge = 'bg-amber-50 text-amber-700 border-amber-100';

                        let statusBadge = 'bg-blue-50 text-blue-700 border-blue-100';
                        if (status === 'En Marcha') statusBadge = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                        if (status === 'Cerrado') statusBadge = 'bg-green-50 text-green-700 border-green-100';
                        if (status === 'Retrasado') statusBadge = 'bg-rose-50 text-rose-700 border-rose-100';

                        return (
                          <tr key={action.id} className="hover:bg-slate-50/50 transition-all">
                            <td className="px-4 py-3 font-mono font-semibold whitespace-nowrap">
                              {formatDateDMY(action.fecha)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${tipoBadge}`}>
                                {action.tipo}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-700">
                              {action.gap}
                            </td>
                            <td className="px-4 py-3 max-w-xs truncate" title={action.queHaOcurrido}>
                              {action.queHaOcurrido}
                            </td>
                            <td className="px-4 py-3 max-w-xs truncate" title={action.accion}>
                              {action.accion}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-800">
                              {action.responsable}
                            </td>
                            <td className="px-4 py-3 font-mono whitespace-nowrap">
                              {formatDateDMY(action.fechaImplantacionPrevista)}
                            </td>
                            <td className="px-4 py-3 font-mono whitespace-nowrap">
                              {action.fechaImplantacionReal ? formatDateDMY(action.fechaImplantacionReal) : '-'}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${statusBadge}`}>
                                {status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    if (!isEditingUnlocked) {
                                      setPinInput('');
                                      setPinError('');
                                      setShowPinModal(true);
                                      return;
                                    }
                                    setCurrentActionForm(action);
                                    setShowAddActionModal(true);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                                  title="Editar acción"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (!isEditingUnlocked) {
                                      setPinInput('');
                                      setPinError('');
                                      setShowPinModal(true);
                                      return;
                                    }
                                    if (window.confirm("¿Seguro que deseas eliminar esta acción de seguridad?")) {
                                      handleDeleteAction(action.id);
                                    }
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                                  title="Eliminar acción"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="px-6 py-2.5 bg-slate-900 text-white hover:bg-indigo-600 rounded-2xl font-bold text-sm cursor-pointer transition-all"
              >
                Cerrar Panel
              </button>
            </div>

          </div>

          {/* Sub-Modal 2: Add/Edit Action Form */}
          {showAddActionModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
              <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600">
                      <ClipboardCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-serif font-black text-slate-900 uppercase">
                        {currentActionForm.id.startsWith('action_') ? 'NUEVA ACCIÓN DE SEGURIDAD' : 'EDITAR ACCIÓN DE SEGURIDAD'}
                      </h4>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Introduce los detalles de la acción</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAddActionModal(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-auto p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Fecha */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">FECHA DEL EVENTO:</label>
                      <input
                        type="date"
                        value={currentActionForm.fecha}
                        onChange={(e) => setCurrentActionForm({ ...currentActionForm, fecha: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                        required
                      />
                    </div>

                    {/* Tipo */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">TIPO DE SUCESO:</label>
                      <select
                        value={currentActionForm.tipo}
                        onChange={(e) => setCurrentActionForm({ ...currentActionForm, tipo: e.target.value as any })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                      >
                        <option value="Accidente">Accidente</option>
                        <option value="Incidente">Incidente</option>
                        <option value="Near Miss">Near Miss</option>
                      </select>
                    </div>
                  </div>

                  {/* Gap de Seguridad */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">GAP DE SEGURIDAD:</label>
                    <div className="flex gap-2">
                      <select
                        value={currentActionForm.gap}
                        onChange={(e) => {
                          if (e.target.value === '__add_new_gap__') {
                            setNewGapName('');
                            setShowAddGapModal(true);
                          } else {
                            setCurrentActionForm({ ...currentActionForm, gap: e.target.value });
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                      >
                        <option value="">Selecciona un gap...</option>
                        {TALLERES_SEGURIDAD.map((taller) => (
                          <option key={taller} value={taller}>{taller}</option>
                        ))}
                        {gapsList.map((g) => {
                          if (TALLERES_SEGURIDAD.includes(g.nombre.toUpperCase())) return null;
                          return (
                            <option key={g.id} value={g.nombre}>{g.nombre}</option>
                          );
                        })}
                        <option value="__add_new_gap__" className="text-indigo-600 font-bold">+ Crear nuevo Gap...</option>
                      </select>
                      
                      <button
                        type="button"
                        onClick={() => {
                          setNewGapName('');
                          setShowAddGapModal(true);
                        }}
                        className="px-3 py-2 border border-slate-200 hover:border-indigo-500 rounded-xl font-bold text-xs text-indigo-600 transition-all cursor-pointer"
                        title="Añadir nuevo gap"
                      >
                        + Añadir Gap
                      </button>
                    </div>
                  </div>

                  {/* Qué ha ocurrido */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">QUÉ HA OCURRIDO (DETALLE):</label>
                    <textarea
                      placeholder="Detalla lo sucedido exactamente..."
                      value={currentActionForm.queHaOcurrido}
                      onChange={(e) => setCurrentActionForm({ ...currentActionForm, queHaOcurrido: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs bg-slate-50/30"
                      required
                    />
                  </div>

                  {/* Acción correctiva */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">ACCIÓN CORRECTIVA PROPUESTA:</label>
                    <textarea
                      placeholder="Acción a realizar para corregir el gap..."
                      value={currentActionForm.accion}
                      onChange={(e) => setCurrentActionForm({ ...currentActionForm, accion: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs bg-slate-50/30"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Responsable */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">RESPONSABLE DE ACCIÓN:</label>
                      <select
                        value={currentActionForm.responsable}
                        onChange={(e) => setCurrentActionForm({ ...currentActionForm, responsable: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                      >
                        {getResponsablesDisponibles().length === 0 ? (
                          <option value="">No hay responsables configurados — marca personal como TOP15/TOP60 en Gestión de Personal</option>
                        ) : (
                          <>
                            <option value="">Selecciona responsable...</option>
                            {getResponsablesDisponibles().map(o => (
                              <option key={o.id} value={o.nombre}>{o.nombre}</option>
                            ))}
                          </>
                        )}
                      </select>
                    </div>

                    {/* Estado en formulario - No editable, auto-calculado */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">ESTADO INICIAL/ACTUAL:</label>
                      <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-500 select-none">
                        Estado: <span className="text-indigo-600 font-extrabold uppercase tracking-wide">
                          {calcularEstado(currentActionForm.fechaImplantacionPrevista, currentActionForm.fechaImplantacionReal)}
                        </span>
                        <p className="text-[10px] text-slate-400 font-normal mt-1 leading-tight">
                          (Se calculará automáticamente según las fechas)
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Fecha Implantación Prevista */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">FECHA IMPLANTACIÓN PREVISTA:</label>
                      <input
                        type="date"
                        value={currentActionForm.fechaImplantacionPrevista}
                        onChange={(e) => setCurrentActionForm({ ...currentActionForm, fechaImplantacionPrevista: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                        required
                      />
                    </div>

                    {/* Fecha Implantación Real */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">FECHA IMPLANTACIÓN REAL (OPCIONAL):</label>
                      <input
                        type="date"
                        value={currentActionForm.fechaImplantacionReal}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCurrentActionForm({ 
                            ...currentActionForm, 
                            fechaImplantacionReal: val,
                            estado: val ? 'Cerrado' : currentActionForm.estado 
                          });
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                  <button
                    onClick={() => setShowAddActionModal(false)}
                    className="px-5 py-2.5 border border-slate-200 text-slate-500 font-bold rounded-2xl hover:bg-slate-50 text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      if (!currentActionForm.fecha || !currentActionForm.gap || !currentActionForm.queHaOcurrido || !currentActionForm.accion || !currentActionForm.fechaImplantacionPrevista) {
                        alert("Por favor, rellena todos los campos obligatorios.");
                        return;
                      }
                      handleSaveAction(currentActionForm);
                    }}
                    className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-2xl hover:bg-indigo-600 shadow-lg shadow-slate-100 hover:shadow-indigo-100 text-xs cursor-pointer"
                  >
                    Guardar Acción
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sub-Modal 3: Add Gap Dialog */}
          {showAddGapModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
              <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-150">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600">
                    <Plus className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-md font-serif font-black text-slate-900 uppercase">NUEVO GAP DE SEGURIDAD</h4>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mt-0.5">Crear opción para desplegables</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">NOMBRE DEL GAP:</label>
                    <input
                      type="text"
                      placeholder="Ej: Suelos resbaladizos por grasa"
                      value={newGapName}
                      onChange={(e) => setNewGapName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateGap(newGapName);
                        }
                      }}
                      className="w-full px-3 py-2.5 text-xs font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 text-slate-800"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => setShowAddGapModal(false)}
                      className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl font-bold text-xs hover:bg-slate-50 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleCreateGap(newGapName)}
                      className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 shadow-lg shadow-indigo-100 cursor-pointer"
                    >
                      Crear Gap
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* PERSONAL MODAL */}
      {activeModal === 'personal' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl border border-slate-100 flex flex-col h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600 border border-indigo-100">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-serif font-black text-slate-900 uppercase tracking-tight">REGISTRO DE PERSONAL (TOP 60)</h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Semana {getWeekNumber(new Date(selectedDate))} (Lunes {formatDateDMY(getMondayDateString(selectedDate))})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer border border-transparent hover:border-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Split Content */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* Left Side: Form */}
              <div className="w-full md:w-1/3 border-r border-slate-100 p-6 overflow-y-auto space-y-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">Registrar Semana</h4>
                  
                  {/* Fecha Input */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">FECHA:</label>
                    <input 
                      type="date" 
                      value={personalForm.fecha}
                      onChange={(e) => setPersonalForm({ ...personalForm, fecha: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                      required
                    />
                  </div>

                  {/* Jornadas Teóricas Input */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">JORNADAS TEÓRICAS DE LA SEMANA:</label>
                    <input 
                      type="number" 
                      min="1"
                      value={personalForm.jornadasTeoricas || ''}
                      onChange={(e) => setPersonalForm({ ...personalForm, jornadasTeoricas: Math.max(0, parseInt(e.target.value) || 0) })}
                      placeholder="Ej: 150"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                      required
                    />
                  </div>

                  {/* Jornadas Perdidas por Baja Input */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">JORNADAS PERDIDAS POR BAJA:</label>
                    <input 
                      type="number" 
                      min="0"
                      value={personalForm.jornadasPerdidasBaja}
                      onChange={(e) => setPersonalForm({ ...personalForm, jornadasPerdidasBaja: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                      required
                    />
                  </div>

                  {/* Jornadas Perdidas por Ausentismo Input */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">JORNADAS PERDIDAS POR AUSENTISMO:</label>
                    <input 
                      type="number" 
                      min="0"
                      value={personalForm.jornadasPerdidasAusentismo}
                      onChange={(e) => setPersonalForm({ ...personalForm, jornadasPerdidasAusentismo: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                      required
                    />
                  </div>

                  {/* Action Info/Preview */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 select-none">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Cálculo de Indicadores</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase block">ABSENTISMO</span>
                        <span className="text-sm font-extrabold text-indigo-600">
                          {personalForm.jornadasTeoricas > 0 ? ((personalForm.jornadasPerdidasBaja / personalForm.jornadasTeoricas) * 100).toFixed(1) : '0.0'}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase block">AUSENTISMO</span>
                        <span className="text-sm font-extrabold text-indigo-600">
                          {personalForm.jornadasTeoricas > 0 ? ((personalForm.jornadasPerdidasAusentismo / personalForm.jornadasTeoricas) * 100).toFixed(1) : '0.0'}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <button 
                    onClick={() => setActiveModal(null)}
                    className="flex-1 py-2 border border-slate-200 text-slate-500 font-bold rounded-xl hover:bg-slate-50 transition-all text-xs cursor-pointer text-center"
                  >
                    Cancelar
                  </button>
                  <button 
                    id="btn-save-personal"
                    onClick={handleSavePersonal}
                    className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all text-xs cursor-pointer text-center"
                  >
                    Guardar
                  </button>
                </div>
              </div>

              {/* Right Side: History Table */}
              <div className="flex-1 p-6 overflow-hidden flex flex-col">
                <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2 mb-4 shrink-0">Historial de Registros</h4>
                
                <div className="flex-1 overflow-y-auto border border-slate-100 rounded-2xl">
                  {registrosPersonal.length === 0 ? (
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
                        {registrosPersonal.map((reg) => {
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
            </div>
          </div>
        </div>
      )}

      {/* CALIDAD MODAL (Plan de Acción de Calidad completo) */}
      {activeModal === 'calidad' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-6xl shadow-2xl border border-slate-100 flex flex-col h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 p-3 rounded-2xl text-blue-600 border border-blue-100">
                  <ClipboardCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-serif font-black text-slate-900 uppercase tracking-tight">PLAN DE ACCIÓN DE CALIDAD</h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Semana {getWeekNumber(new Date(selectedDate))} (Lunes {formatDateDMY(getMondayDateString(selectedDate))})
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Bloquear/Desbloquear Button */}
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
                  className={`px-4 py-2 rounded-2xl font-bold text-xs flex items-center gap-2 border transition-all cursor-pointer ${
                    isEditingUnlocked 
                      ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                      : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  {isEditingUnlocked ? (
                    <>
                      <Unlock className="w-4 h-4 text-green-600" />
                      Desbloqueado 🔓
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-rose-600" />
                      Bloqueado 🔒
                    </>
                  )}
                </button>

                {/* Añadir Reclamación Button */}
                <button
                  onClick={() => {
                    if (!isEditingUnlocked) {
                      setPinInput('');
                      setPinError('');
                      setShowPinModal(true);
                      return;
                    }
                    setCurrentCalidadForm({
                      id: 'calidad_' + Date.now(),
                      fecha: selectedDate,
                      tipoReclamacion: 'CLIENTE',
                      areaCausante: 'SALA BLANCA',
                      descripcionProblema: '',
                      accionContenedora: '',
                      responsableContenedora: getResponsablesDisponibles().length > 0 ? getResponsablesDisponibles()[0].nombre : '',
                      fechaPrevistaContenedora: selectedDate,
                      fechaCierreContenedora: '',
                      accionCorrectora: '',
                      responsableCorrectora: getResponsablesDisponibles().length > 0 ? getResponsablesDisponibles()[0].nombre : '',
                      fechaPrevistaCorrectora: selectedDate,
                      fechaCierreCorrectora: '',
                      origen: undefined
                    });
                    setShowAddCalidadModal(true);
                  }}
                  className="px-4 py-2 bg-slate-900 text-white rounded-2xl font-bold text-xs flex items-center gap-2 hover:bg-indigo-600 transition-all cursor-pointer shadow-sm hover:shadow-indigo-100"
                >
                  <Plus className="w-4 h-4" />
                  Nueva Reclamación
                </button>

                <button 
                  onClick={() => setActiveModal(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer border border-transparent hover:border-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filters Row */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                {/* Tipo Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tipo:</span>
                  <select
                    value={filterCalidadTipo}
                    onChange={(e) => setFilterCalidadTipo(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Todos">Todos los tipos</option>
                    <option value="CLIENTE">CLIENTE</option>
                    <option value="INTERNA">INTERNA</option>
                    <option value="PROVEEDOR">PROVEEDOR</option>
                    {tiposReclamacion.map((t) => (
                      <option key={t.id} value={t.nombre}>{t.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Estado Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Estado:</span>
                  <select
                    value={filterCalidadEstado}
                    onChange={(e) => setFilterCalidadEstado(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Todos">Todos los estados</option>
                    <option value="Abierto">Abierto</option>
                    <option value="En Marcha">En Marcha</option>
                    <option value="Cerrado">Cerrado</option>
                    <option value="Retrasado">Retrasado</option>
                  </select>
                </div>

                {/* Show Only This Week Checkbox */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={showCalidadOnlyThisWeek}
                    onChange={(e) => setShowCalidadOnlyThisWeek(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="text-xs font-bold text-slate-600">Mostrar solo esta semana</span>
                </label>
              </div>

              {/* Status Counters summary */}
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-400 font-medium">Mostradas: <strong className="text-slate-700">{filteredCalidadActions.length}</strong></span>
                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                <span className="text-slate-400 font-medium">Abiertas globales: <strong className="text-rose-600 font-bold">{planCalidadRecords.filter(a => getCalidadGlobalStatus(a) !== 'Cerrado').length}</strong></span>
              </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto p-6">
              {filteredCalidadActions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                  <ClipboardCheck className="w-12 h-12 stroke-1 text-slate-300 mb-3" />
                  <p className="text-sm font-medium">No se encontraron reclamaciones de calidad que cumplan con los filtros.</p>
                  {showCalidadOnlyThisWeek && (
                    <button
                      onClick={() => setShowCalidadOnlyThisWeek(false)}
                      className="mt-2 text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                    >
                      Ver todas las semanas
                    </button>
                  )}
                </div>
              ) : (
                <div className="min-w-full overflow-hidden border border-slate-100 rounded-2xl bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-slate-100 text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Tipo Reclamación</th>
                        <th className="px-4 py-3">Área Causante</th>
                        <th className="px-4 py-3 max-w-xs">¿Qué ha ocurrido?</th>
                        <th className="px-4 py-3 max-w-xs">Contención (Acción / Resp. / F. Prev / F. Real)</th>
                        <th className="px-4 py-3 max-w-xs">Corrección (Acción / Resp. / F. Prev / F. Real)</th>
                        <th className="px-4 py-3">Estado Global</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                      {filteredCalidadActions.map((action) => {
                        const globalStatus = getCalidadGlobalStatus(action);
                        const contStatus = getCalidadActionStatus(action.fechaPrevistaContenedora, action.fechaCierreContenedora);
                        const corrStatus = getCalidadActionStatus(action.fechaPrevistaCorrectora, action.fechaCierreCorrectora);
                        
                        let tipoBadge = 'bg-slate-100 text-slate-700 border-slate-200';
                        if (action.tipoReclamacion === 'CLIENTE') tipoBadge = 'bg-red-50 text-red-700 border-red-100';
                        if (action.tipoReclamacion === 'INTERNA') tipoBadge = 'bg-orange-50 text-orange-700 border-orange-100';
                        if (action.tipoReclamacion === 'PROVEEDOR') tipoBadge = 'bg-amber-50 text-amber-700 border-amber-100';

                        let globalBadge = 'bg-blue-50 text-blue-700 border-blue-100';
                        if (globalStatus === 'En Marcha') globalBadge = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                        if (globalStatus === 'Cerrado') globalBadge = 'bg-green-50 text-green-700 border-green-100';
                        if (globalStatus === 'Retrasado') globalBadge = 'bg-rose-50 text-rose-700 border-rose-100';

                        let contBadge = 'text-blue-600 bg-blue-50';
                        if (contStatus === 'Cerrado') contBadge = 'text-green-600 bg-green-50';
                        if (contStatus === 'Retrasado') contBadge = 'text-rose-600 bg-rose-50';

                        let corrBadge = 'text-blue-600 bg-blue-50';
                        if (corrStatus === 'Cerrado') corrBadge = 'text-green-600 bg-green-50';
                        if (corrStatus === 'Retrasado') corrBadge = 'text-rose-600 bg-rose-50';

                        return (
                          <tr key={action.id} className="hover:bg-slate-50/50 transition-all">
                            <td className="px-4 py-3 font-mono font-semibold whitespace-nowrap">
                              {formatDateDMY(action.fecha)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${tipoBadge}`}>
                                {action.tipoReclamacion}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-700">
                              {action.areaCausante}
                            </td>
                            {/* ¿Qué ha ocurrido? */}
                            <td className="px-4 py-3 max-w-xs">
                              <p className="text-slate-800 leading-normal line-clamp-2" title={action.descripcionProblema}>
                                {action.descripcionProblema || '-'}
                              </p>
                            </td>
                            {/* Acción Contenedora info */}
                            <td className="px-4 py-3 max-w-xs">
                              <div className="space-y-1">
                                <div className="font-semibold text-slate-950 truncate" title={action.accionContenedora}>
                                  {action.accionContenedora}
                                </div>
                                <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5 flex-wrap">
                                  <span>👤 {action.responsableContenedora}</span>
                                  <span>•</span>
                                  <span>📅 Prev: {formatDateDMY(action.fechaPrevistaContenedora)}</span>
                                  {action.fechaCierreContenedora && (
                                    <>
                                      <span>•</span>
                                      <span className="text-green-600">✅ {formatDateDMY(action.fechaCierreContenedora)}</span>
                                    </>
                                  )}
                                  <span className={`px-1 rounded text-[9px] uppercase font-black ${contBadge}`}>{contStatus}</span>
                                </div>
                              </div>
                            </td>
                            {/* Acción Correctora info */}
                            <td className="px-4 py-3 max-w-xs">
                              <div className="space-y-1">
                                <div className="font-semibold text-slate-950 truncate" title={action.accionCorrectora}>
                                  {action.accionCorrectora}
                                </div>
                                <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5 flex-wrap">
                                  <span>👤 {action.responsableCorrectora}</span>
                                  <span>•</span>
                                  <span>📅 Prev: {formatDateDMY(action.fechaPrevistaCorrectora)}</span>
                                  {action.fechaCierreCorrectora && (
                                    <>
                                      <span>•</span>
                                      <span className="text-green-600">✅ {formatDateDMY(action.fechaCierreCorrectora)}</span>
                                    </>
                                  )}
                                  <span className={`px-1 rounded text-[9px] uppercase font-black ${corrBadge}`}>{corrStatus}</span>
                                </div>
                              </div>
                            </td>
                            {/* Estado Global */}
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${globalBadge}`}>
                                {globalStatus}
                              </span>
                            </td>
                            {/* Acciones */}
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    if (!isEditingUnlocked) {
                                      setPinInput('');
                                      setPinError('');
                                      setShowPinModal(true);
                                      return;
                                    }
                                    setCurrentCalidadForm(action);
                                    setShowAddCalidadModal(true);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                                  title="Editar reclamación"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (!isEditingUnlocked) {
                                      setPinInput('');
                                      setPinError('');
                                      setShowPinModal(true);
                                      return;
                                    }
                                    handleDeleteCalidad(action.id);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                  title="Eliminar reclamación"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sub-Modal for Add/Edit Quality Claim Form */}
      {showAddCalidadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <form onSubmit={handleSaveCalidad} className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600">
                  <ClipboardCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-lg font-serif font-black text-slate-900 uppercase">
                    {currentCalidadForm.id && !currentCalidadForm.id.startsWith('calidad_') ? 'EDITAR RECLAMACIÓN' : 'NUEVA RECLAMACIÓN'}
                  </h4>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Plan de Acción de Calidad</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCalidadModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* General Block */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Fecha */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha:</label>
                  <input 
                    type="date"
                    value={currentCalidadForm.fecha}
                    onChange={(e) => setCurrentCalidadForm({ ...currentCalidadForm, fecha: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                    required
                  />
                </div>

                {/* Tipo de Reclamacion */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                    <span>Tipo Reclamación:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setNewTipoReclamacionName('');
                        setShowAddTipoReclamacionModal(true);
                      }}
                      className="text-indigo-600 hover:text-indigo-800 text-[10px] font-black"
                    >
                      + Crear
                    </button>
                  </label>
                  <select
                    value={currentCalidadForm.tipoReclamacion}
                    onChange={(e) => setCurrentCalidadForm({ ...currentCalidadForm, tipoReclamacion: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                    required
                  >
                    <option value="">Selecciona...</option>
                    <option value="CLIENTE">CLIENTE</option>
                    <option value="INTERNA">INTERNA</option>
                    <option value="PROVEEDOR">PROVEEDOR</option>
                    {tiposReclamacion.map((t) => (
                      <option key={t.id} value={t.nombre}>{t.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Area Causante */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                    <span>Área Causante:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setNewAreaCausanteName('');
                        setShowAddAreaCausanteModal(true);
                      }}
                      className="text-indigo-600 hover:text-indigo-800 text-[10px] font-black"
                    >
                      + Crear
                    </button>
                  </label>
                  <select
                    value={currentCalidadForm.areaCausante}
                    onChange={(e) => setCurrentCalidadForm({ ...currentCalidadForm, areaCausante: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                    required
                  >
                    <option value="">Selecciona...</option>
                    <option value="SALA BLANCA">SALA BLANCA</option>
                    <option value="EMBUTIDO">EMBUTIDO</option>
                    <option value="MOVIMIENTOS">MOVIMIENTOS</option>
                    <option value="EXPEDICIONES">EXPEDICIONES</option>
                    {areasCausantesCalidad.map((a) => (
                      <option key={a.id} value={a.nombre}>{a.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Origen */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Origen:</label>
                  <select
                    value={currentCalidadForm.origen || ''}
                    onChange={(e) => setCurrentCalidadForm({ ...currentCalidadForm, origen: e.target.value as 'Interna' | 'Externa' })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                    required
                  >
                    <option value="">Selecciona...</option>
                    <option value="Interna">Interna</option>
                    <option value="Externa">Externa</option>
                  </select>
                </div>
              </div>

              {/* ¿QUÉ HA OCURRIDO? Field */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">¿QUÉ HA OCURRIDO?</label>
                <textarea
                  value={currentCalidadForm.descripcionProblema}
                  onChange={(e) => setCurrentCalidadForm({ ...currentCalidadForm, descripcionProblema: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-bold"
                  rows={2}
                  placeholder="Describe el problema o la reclamación recibida..."
                  required
                />
              </div>

              {/* ACCION CONTENEDORA (Contención) Block */}
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 space-y-4">
                <h5 className="text-xs font-black text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                  Acción Contenedora (Contención de la Reclamación)
                </h5>
                
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Qué se ha hecho para contenerla:</label>
                  <textarea
                    value={currentCalidadForm.accionContenedora}
                    onChange={(e) => setCurrentCalidadForm({ ...currentCalidadForm, accionContenedora: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-bold"
                    rows={2}
                    placeholder="Describe la acción correctora inmediata..."
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Responsable */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsable:</label>
                    <select
                      value={currentCalidadForm.responsableContenedora}
                      onChange={(e) => setCurrentCalidadForm({ ...currentCalidadForm, responsableContenedora: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                      required
                    >
                      <option value="">Selecciona...</option>
                      {getResponsablesDisponibles().map(r => (
                        <option key={r.id} value={r.nombre}>{r.nombre}</option>
                      ))}
                    </select>
                  </div>

                  {/* Fecha Prevista */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha Prevista:</label>
                    <input 
                      type="date"
                      value={currentCalidadForm.fechaPrevistaContenedora}
                      onChange={(e) => setCurrentCalidadForm({ ...currentCalidadForm, fechaPrevistaContenedora: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                      required
                    />
                  </div>

                  {/* Fecha Cierre Real */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-green-600">Fecha Cierre Real (Opcional):</label>
                    <input 
                      type="date"
                      value={currentCalidadForm.fechaCierreContenedora}
                      onChange={(e) => setCurrentCalidadForm({ ...currentCalidadForm, fechaCierreContenedora: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* ACCION CORRECTORA (Corrección) Block */}
              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50 space-y-4">
                <h5 className="text-xs font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full"></span>
                  Acción Correctora (Acción de Fondo / 8D)
                </h5>
                
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Acción a largo plazo para evitar recurrencia:</label>
                  <textarea
                    value={currentCalidadForm.accionCorrectora}
                    onChange={(e) => setCurrentCalidadForm({ ...currentCalidadForm, accionCorrectora: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-bold"
                    rows={2}
                    placeholder="Describe la acción correctora a largo plazo..."
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Responsable */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsable:</label>
                    <select
                      value={currentCalidadForm.responsableCorrectora}
                      onChange={(e) => setCurrentCalidadForm({ ...currentCalidadForm, responsableCorrectora: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                      required
                    >
                      <option value="">Selecciona...</option>
                      {getResponsablesDisponibles().map(r => (
                        <option key={r.id} value={r.nombre}>{r.nombre}</option>
                      ))}
                    </select>
                  </div>

                  {/* Fecha Prevista */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha Prevista:</label>
                    <input 
                      type="date"
                      value={currentCalidadForm.fechaPrevistaCorrectora}
                      onChange={(e) => setCurrentCalidadForm({ ...currentCalidadForm, fechaPrevistaCorrectora: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                      required
                    />
                  </div>

                  {/* Fecha Cierre Real */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-green-600">Fecha Cierre Real (Opcional):</label>
                    <input 
                      type="date"
                      value={currentCalidadForm.fechaCierreCorrectora}
                      onChange={(e) => setCurrentCalidadForm({ ...currentCalidadForm, fechaCierreCorrectora: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setShowAddCalidadModal(false)}
                className="px-5 py-2.5 border border-slate-200 text-slate-500 font-bold rounded-xl hover:bg-slate-100 transition-all text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-indigo-600 shadow-md transition-all text-xs cursor-pointer"
              >
                Guardar Reclamación
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sub-Modal for Creating custom TipoReclamacion */}
      {showAddTipoReclamacionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="space-y-1">
              <h5 className="text-base font-black text-slate-900 uppercase">Crear Tipo Reclamación</h5>
              <p className="text-xs text-slate-400 font-semibold">Introduce el nombre de la nueva categoría</p>
            </div>
            <input 
              type="text" 
              value={newTipoReclamacionName}
              onChange={(e) => setNewTipoReclamacionName(e.target.value)}
              placeholder="Ej: PACKAGING"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-bold"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddTipoReclamacionModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-500 font-bold rounded-xl hover:bg-slate-100 text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateTipoReclamacion}
                className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-indigo-600 text-xs cursor-pointer"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Modal for Creating custom AreaCausante */}
      {showAddAreaCausanteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="space-y-1">
              <h5 className="text-base font-black text-slate-900 uppercase">Crear Área Causante</h5>
              <p className="text-xs text-slate-400 font-semibold">Introduce el nombre del área causante</p>
            </div>
            <input 
              type="text" 
              value={newAreaCausanteName}
              onChange={(e) => setNewAreaCausanteName(e.target.value)}
              placeholder="Ej: ALMACÉN"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-bold"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddAreaCausanteModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-500 font-bold rounded-xl hover:bg-slate-100 text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateAreaCausante}
                className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-indigo-600 text-xs cursor-pointer"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCCION MODAL */}
      {activeModal === 'produccion' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 animate-out fade-out zoom-out-95">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-serif font-black text-slate-900 uppercase">Producción</h3>
                  <p className="text-xs text-slate-500 font-medium">Registro de Métricas</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Cantidad */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Cantidad Producida (kg):</label>
                  <input 
                    type="number"
                    min="0"
                    placeholder="ej. 1500"
                    value={produccionForm.cantidad}
                    onChange={(e) => setProduccionForm({ ...produccionForm, cantidad: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm bg-slate-50/50"
                  />
                </div>

                {/* Tiempo Producción */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Tiempo de Producción Real (min):</label>
                  <input 
                    type="number"
                    min="0"
                    placeholder="ej. 480"
                    value={produccionForm.tiempoProduccion}
                    onChange={(e) => setProduccionForm({ ...produccionForm, tiempoProduccion: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm bg-slate-50/50"
                  />
                </div>

                {/* Tiempo Esperas */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Tiempo de Esperas (min):</label>
                  <input 
                    type="number"
                    min="0"
                    placeholder="ej. 30"
                    value={produccionForm.tiempoEsperas}
                    onChange={(e) => setProduccionForm({ ...produccionForm, tiempoEsperas: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm bg-slate-50/50"
                  />
                </div>

                {/* Tiempo Averias */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Tiempo de Averías (min):</label>
                  <input 
                    type="number"
                    min="0"
                    placeholder="ej. 15"
                    value={produccionForm.tiempoAverias}
                    onChange={(e) => setProduccionForm({ ...produccionForm, tiempoAverias: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm bg-slate-50/50"
                  />
                </div>
              </div>

              {/* Observaciones */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Observaciones de Producción / Paros:</label>
                <textarea 
                  value={produccionForm.observaciones}
                  onChange={(e) => setProduccionForm({ ...produccionForm, observaciones: e.target.value })}
                  placeholder="Indicar causas de paradas, incidencias con materiales, etc..."
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm resize-none bg-slate-50/50"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100">
              <button 
                onClick={() => setActiveModal(null)}
                className="px-5 py-3 border border-slate-200 text-slate-500 font-bold rounded-2xl hover:bg-slate-50 transition-all text-sm cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                id="btn-save-produccion"
                onClick={handleSaveProduccion}
                className="px-6 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-indigo-600 shadow-lg shadow-slate-100 hover:shadow-indigo-100 transition-all text-sm cursor-pointer"
              >
                Guardar Registro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IDEAS DE MEJORA (IDM) MODAL */}
      {activeModal === 'idm' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-6xl shadow-2xl border border-slate-100 flex flex-col h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600">
                  <Lightbulb className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xl font-serif font-black text-slate-900 uppercase tracking-tight">IDEAS DE MEJORA (IDM)</h3>
                  {isEditingUnlocked ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black tracking-widest text-emerald-600 uppercase mt-0.5 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 animate-pulse">
                      <Unlock className="w-3 h-3" />
                      Modo Edición Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black tracking-widest text-rose-500 uppercase mt-0.5 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                      <Lock className="w-3 h-3" />
                      Edición Bloqueada
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
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
                  className={`px-4 py-2 rounded-2xl font-black text-xs flex items-center gap-2 border transition-all cursor-pointer shadow-sm ${
                    isEditingUnlocked 
                      ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {isEditingUnlocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  {isEditingUnlocked ? 'BLOQUEAR EDICIÓN' : 'DESBLOQUEAR EDICIÓN'}
                </button>

                <button 
                  onClick={() => setActiveModal(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer border border-transparent hover:border-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filters Row */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
              <div className="flex flex-wrap items-center gap-4">
                {/* Estado Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Estado:</span>
                  <select
                    value={filterIdmEstado}
                    onChange={(e) => setFilterIdmEstado(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Todos">Todos los estados</option>
                    <option value="Abierto">Abierto</option>
                    <option value="En Marcha">En Marcha</option>
                    <option value="Cerrado">Cerrado</option>
                    <option value="Retrasado">Retrasado</option>
                  </select>
                </div>

                {/* Aprobación Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Aprob.:</span>
                  <select
                    value={filterIdmAprobada}
                    onChange={(e) => setFilterIdmAprobada(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Todos">Todos</option>
                    <option value="Sí">Sí</option>
                    <option value="No">No</option>
                    <option value="Pendiente">Pendiente</option>
                  </select>
                </div>

                {/* Responsable Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Resp:</span>
                  <select
                    value={filterIdmResponsable}
                    onChange={(e) => setFilterIdmResponsable(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Todos">Todos los responsables</option>
                    {getResponsablesDisponibles().map(r => (
                      <option key={r.id} value={r.nombre}>{r.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Show Only This Week Checkbox */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={showIdmOnlyThisWeek}
                    onChange={(e) => setShowIdmOnlyThisWeek(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="text-xs font-bold text-slate-600">Mostrar solo esta semana</span>
                </label>
              </div>

              {/* Status Counters summary */}
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-400 font-medium">Mostradas: <strong className="text-slate-700">{filteredIdeas.length}</strong></span>
                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                <span className="text-slate-400 font-medium">Abiertas globales: <strong className="text-rose-600 font-bold">{(ideasDeMejora || []).filter(a => a.estado !== 'Cerrado').length}</strong></span>
              </div>
            </div>

            {/* Split Content Area (Form on Left / Top, Table on Right / Bottom) */}
            <div className="flex-1 overflow-auto flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-100 min-h-0">
              
              {/* Form Section */}
              <div className="w-full lg:w-96 p-6 space-y-4 overflow-y-auto bg-slate-50/10 flex-shrink-0">
                <h4 className="text-sm font-serif font-black text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-2">
                  {idmForm.id ? 'EDITAR IDEA' : 'NUEVA IDEA DE MEJORA'}
                </h4>

                {/* SUGERENCIA */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Sugerencia *:</label>
                  <textarea
                    rows={3}
                    disabled={!isEditingUnlocked}
                    placeholder="Describe la idea de mejora..."
                    value={idmForm.sugerencia}
                    onChange={(e) => setIdmForm({ ...idmForm, sugerencia: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white disabled:bg-slate-50 disabled:text-slate-400 resize-none"
                  />
                </div>

                {/* EMISOR */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Emisor *:</label>
                  {getAllOperariosSorted().length === 0 ? (
                    <div className="text-rose-500 text-xs font-bold bg-rose-50 border border-rose-100 p-2.5 rounded-xl">
                      No hay operarios disponibles. Añádelos en la sección de operarios.
                    </div>
                  ) : (
                    <select
                      disabled={!isEditingUnlocked}
                      value={idmForm.recurso}
                      onChange={(e) => setIdmForm({ ...idmForm, recurso: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-50"
                    >
                      {getAllOperariosSorted().map(o => (
                        <option key={o.id} value={o.nombre}>{o.nombre}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* FECHA EMISIÓN */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">*Fecha Emisión :</label>
                  <input
                    type="date"
                    disabled={!isEditingUnlocked}
                    value={idmForm.fechaEmision}
                    onChange={(e) => setIdmForm({ ...idmForm, fechaEmision: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-50"
                  />
                </div>

                {/* RESPONSABLE */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsable:</label>
                  {getResponsablesDisponibles().length === 0 ? (
                    <div className="text-rose-500 text-xs font-bold bg-rose-50 border border-rose-100 p-2.5 rounded-xl">
                      No hay operarios disponibles. Añádelos en la sección de operarios.
                    </div>
                  ) : (
                    <select
                      disabled={!isEditingUnlocked}
                      value={idmForm.responsable}
                      onChange={(e) => setIdmForm({ ...idmForm, responsable: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-50"
                    >
                      {getResponsablesDisponibles().map(o => (
                        <option key={o.id} value={o.nombre}>{o.nombre}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* FECHAS PREVISTA Y CIERRE */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">F. Prevista:</label>
                    <input
                      type="date"
                      disabled={!isEditingUnlocked}
                      value={idmForm.fechaEjecucionPrevista}
                      onChange={(e) => setIdmForm({ ...idmForm, fechaEjecucionPrevista: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">F. Cierre:</label>
                    <input
                      type="date"
                      disabled={!isEditingUnlocked}
                      value={idmForm.fechaCierre}
                      onChange={(e) => setIdmForm({ ...idmForm, fechaCierre: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-50"
                    />
                  </div>
                </div>

                {/* APROBADA */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Aprobada:</label>
                  <select
                    disabled={!isEditingUnlocked}
                    value={idmForm.aprobada}
                    onChange={(e) => setIdmForm({ ...idmForm, aprobada: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-50"
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="Sí">Sí</option>
                    <option value="No">No</option>
                  </select>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    disabled={!isEditingUnlocked}
                    onClick={resetIdmForm}
                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-500 font-bold rounded-xl hover:bg-slate-100 text-xs cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Limpiar
                  </button>
                  <button
                    type="button"
                    disabled={!isEditingUnlocked}
                    onClick={handleSaveIdea}
                    className="flex-1 px-4 py-2.5 bg-slate-900 hover:bg-indigo-600 text-white font-bold rounded-xl text-xs cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-slate-100 hover:shadow-indigo-100"
                  >
                    {idmForm.id ? 'Guardar' : 'Crear Idea'}
                  </button>
                </div>

                {!isEditingUnlocked && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-2 text-[11px] text-rose-600 font-bold mt-2">
                    <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Desbloquea el "Modo Edición" para poder crear, modificar o borrar registros.</span>
                  </div>
                )}
              </div>

              {/* Table Section */}
              <div className="flex-1 overflow-auto p-6 min-h-0">
                {filteredIdeas.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                    <Lightbulb className="w-12 h-12 stroke-[1.5] mb-3 text-slate-300" />
                    <p className="font-bold text-sm">No hay ideas de mejora registradas</p>
                    <p className="text-xs text-slate-400/85 mt-1">Usa los filtros o añade una nueva en el formulario lateral.</p>
                  </div>
                ) : (
                  <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs font-bold text-slate-700">
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
                          <th className="px-4 py-3 text-center w-24">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 bg-white">
                        {filteredIdeas.map((idea) => {
                          // Badge color helper for Resource
                          const recursoColor = 'bg-slate-50 text-slate-700 border-slate-200';

                          // Badge color helper for Aprobada
                          const aprobadaColor = idea.aprobada === 'Sí' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                            : idea.aprobada === 'No' 
                            ? 'bg-rose-50 text-rose-700 border-rose-100' 
                            : 'bg-amber-50 text-amber-700 border-amber-100';

                          // Badge color helper for Estado
                          const estadoColor = idea.estado === 'Cerrado' 
                            ? 'bg-slate-100 text-slate-600 border-slate-200' 
                            : idea.estado === 'Abierto' 
                            ? 'bg-sky-50 text-sky-700 border-sky-100' 
                            : idea.estado === 'Retrasado' 
                            ? 'bg-red-50 text-red-700 border-red-100' 
                            : 'bg-green-50 text-green-700 border-green-100';

                          return (
                            <tr key={idea.id} className="hover:bg-slate-50/50 transition-colors group">
                              <td className="px-4 py-3.5 text-center text-slate-400 font-mono font-bold">
                                {idea.numeroSugerencia}
                              </td>
                              <td className="px-4 py-3.5 max-w-xs break-words">
                                <p className="text-slate-900 leading-normal">{idea.sugerencia}</p>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] ${recursoColor}`}>
                                  {idea.recurso}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-slate-500">
                                {idea.fechaCreacion}
                              </td>
                              <td className="px-4 py-3.5 text-slate-500 font-mono">
                                {formatToDdMmYyyy(idea.fechaEmision)}
                              </td>
                              <td className="px-4 py-3.5">
                                <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] ${aprobadaColor}`}>
                                  {idea.aprobada}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-slate-900">
                                {idea.responsable}
                              </td>
                              <td className="px-4 py-3.5 text-slate-500 font-mono">
                                {idea.fechaEjecucionPrevista || '-'}
                              </td>
                              <td className="px-4 py-3.5 text-slate-500 font-mono">
                                {idea.fechaCierre || '-'}
                              </td>
                              <td className="px-4 py-3.5">
                                <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] ${estadoColor}`}>
                                  {idea.estado}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <div className="flex items-center justify-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => handleEditIdea(idea)}
                                    title="Editar"
                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteIdea(idea.id)}
                                    title="Eliminar"
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Modal: PIN Unlock (Global) */}
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
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl font-bold text-xs hover:bg-slate-50 cursor-pointer"
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
                  className="px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold text-xs hover:bg-rose-700 shadow-lg shadow-rose-100 cursor-pointer"
                >
                  Desbloquear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TOP60Preparacion;
