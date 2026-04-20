import React, { useState, useEffect, useRef } from 'react';
import { Database, Activity as ActivityIcon, Upload } from 'lucide-react';
import Papa from 'papaparse';
import { isConfigured, supabase } from '../lib/supabase';
import { MasterSpeed, IncidenceMaster, TaskType, OEEObjectives, User } from '../types';
import { AREA_NAMES, AREA_COLUMNS, getInitialMasterSpeeds, getInitialIncidenceMaster, getInitialOperarios } from '../constants';

interface ConfigPanelProps {
  masterSpeeds: MasterSpeed[];
  setMasterSpeeds: (speeds: MasterSpeed[]) => void;
  onDeleteTask: (id: string) => void;
  incidenceMaster: IncidenceMaster[];
  setIncidenceMaster: (inc: IncidenceMaster[]) => void;
  onDeleteIncidence: (id: string) => void;
  oeeObjectives: OEEObjectives;
  setOeeObjectives: (obj: OEEObjectives) => void;
  allObjectives?: Record<string, OEEObjectives[]>;
  onUpdateAllObjectives?: (map: Record<string, OEEObjectives>, validFrom: string) => void;
  selectedArea?: string;
  onlyPeople?: boolean;
  responsibles?: string[];
  setResponsibles?: (r: string[]) => void;
  passwords?: {
    jefeEquipo: string;
    jefeTaller: string;
    directorOperaciones: string;
    asistenciaTecnica: string;
  };
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ 
  masterSpeeds = [],
  setMasterSpeeds,
  onDeleteTask,
  incidenceMaster = [],
  setIncidenceMaster,
  onDeleteIncidence,
  oeeObjectives,
  setOeeObjectives,
  allObjectives = {},
  onUpdateAllObjectives,
  selectedArea,
  onlyPeople = false,
  responsibles = [],
  setResponsibles,
  passwords
}) => {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  // Estados para nuevos registros
  const [newStopName, setNewStopName] = useState('');
  const [newStopAfectaCalidad, setNewStopAfectaCalidad] = useState(false);
  const [newBreakdownName, setNewBreakdownName] = useState('');
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('');
  const [newTaskPeso, setNewTaskPeso] = useState('');
  const [newTaskUnidad, setNewTaskUnidad] = useState<'kg' | 'unidades'>('unidades');
  const [newTaskMachine, setNewTaskMachine] = useState('');

  // Estados para edición
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editPeso, setEditPeso] = useState('');
  const [editUnidad, setEditUnidad] = useState<'kg' | 'unidades'>('unidades');
  const [editAfectaCalidad, setEditAfectaCalidad] = useState(false);
  const [newResponsibleName, setNewResponsibleName] = useState('');

  // Estado local para la tabla maestra de TOP 60
  const [localMasterObjectives, setLocalMasterObjectives] = useState<Record<string, OEEObjectives>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [objectiveValidFrom, setObjectiveValidFrom] = useState(new Date().toISOString().split('T')[0]);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'info' | 'error' } | null>(null);

  useEffect(() => {
    if (selectedArea === 'TOP 60' && allObjectives && Object.keys(allObjectives).length > 0 && !isInitialized) {
      const latest: Record<string, OEEObjectives> = {};
      Object.entries(allObjectives).forEach(([area, objs]) => {
        if (Array.isArray(objs) && objs.length > 0) {
          objs.forEach(obj => {
            const key = obj.indicatorId ? `${area}_${obj.indicatorId}` : area;
            latest[key] = obj;
          });
        }
      });
      setLocalMasterObjectives(latest);
      setIsInitialized(true);
    }
  }, [selectedArea, allObjectives, isInitialized]);

  // Reset initialization when area changes
  useEffect(() => {
    setIsInitialized(false);
  }, [selectedArea]);

  useEffect(() => {
    if (pin.length === 4 && passwords) {
      let isCorrect = false;
      
      // Determinar nivel requerido
      let requiredLevel = 1; // Default TOP 5
      if (selectedArea === 'TOP 60') requiredLevel = 3;
      else if (selectedArea === 'TOP 15') requiredLevel = 2;
      
      // Validar según jerarquía
      if (pin === passwords.asistenciaTecnica) isCorrect = true;
      if (requiredLevel <= 3 && pin === passwords.directorOperaciones) isCorrect = true;
      if (requiredLevel <= 2 && pin === passwords.jefeTaller) isCorrect = true;
      if (requiredLevel <= 1 && pin === passwords.jefeEquipo) isCorrect = true;

      if (isCorrect) {
        setIsAdminMode(true);
        setShowPassModal(false);
        setPin('');
        setPinError(false);
      } else {
        setPinError(true);
        setTimeout(() => {
          setPin('');
          setPinError(false);
        }, 1000);
      }
    }
  }, [pin, passwords, selectedArea]);

  // --- GESTIÓN DE PARADAS (ESPERAS) ---
  const onAddStop = () => {
    const name = newStopName.trim().toUpperCase();
    if (name.length > 0) {
      const newStop: IncidenceMaster = {
        id: crypto.randomUUID(),
        nombre: name,
        tipo: TaskType.ESPERAS,
        afectaCalidad: newStopAfectaCalidad,
        area: selectedArea
      };
      setIncidenceMaster([...incidenceMaster, newStop]);
      setNewStopName('');
      setNewStopAfectaCalidad(false);
    }
  };

  const startEditIncidence = (inc: IncidenceMaster) => {
    setEditingId(inc.id);
    setEditValue(inc.nombre);
    setEditAfectaCalidad(inc.afectaCalidad);
  };

  const saveEditIncidence = () => {
    if (editingId && editValue.trim()) {
      setIncidenceMaster(incidenceMaster.map(inc => inc.id === editingId ? { 
        ...inc, 
        nombre: editValue.trim().toUpperCase(),
        afectaCalidad: editAfectaCalidad
      } : inc));
      setEditingId(null);
      setEditValue('');
      setEditAfectaCalidad(false);
    }
  };

  const toggleStopQuality = (id: string) => {
    setIncidenceMaster(incidenceMaster.map(inc => 
      inc.id === id ? { ...inc, afectaCalidad: !inc.afectaCalidad } : inc
    ));
  };

  // --- GESTIÓN DE AVERÍAS ---
  const onAddBreakdown = () => {
    const name = newBreakdownName.trim().toUpperCase();
    if (name.length > 0) {
      const newBreakdown: IncidenceMaster = {
        id: crypto.randomUUID(),
        nombre: name,
        tipo: TaskType.AVERIA,
        afectaCalidad: false,
        area: selectedArea
      };
      setIncidenceMaster([...incidenceMaster, newBreakdown]);
      setNewBreakdownName('');
    }
  };

  // --- GESTIÓN DE TAREAS ---
  const handleResetMasterData = () => {
    if (!selectedArea) return;
    if (confirm(`¿Estás seguro de que quieres restablecer las tareas maestras de ${AREA_NAMES[selectedArea]} a los valores por defecto? Se perderán los cambios personalizados.`)) {
      const initial = getInitialMasterSpeeds(selectedArea);
      setMasterSpeeds(initial);
    }
  };

  const handleForceSync = () => {
    if (masterSpeeds.length === 0) {
      alert("No hay tareas para sincronizar. Prueba a 'Restablecer' primero.");
      return;
    }
    setMasterSpeeds([...masterSpeeds]);
    if (!isConfigured) {
      alert("AVISO: La aplicación no está conectada a la nube (Supabase). Los cambios se guardarán solo en este navegador.");
    } else {
      alert("Sincronización de tareas maestras solicitada. Revisa el icono de la nube en la cabecera.");
    }
  };

  const onAddTask = () => {
    const name = newTaskName.trim().toUpperCase();
    const t1 = parseFloat(newTaskTime) || 0;
    const p1 = parseFloat(newTaskPeso) || 0;
    
    if (name.length > 0) {
      const newTask: MasterSpeed = {
        id: crypto.randomUUID(),
        formato: name,
        tiempoTeorico: t1,
        peso: p1,
        unidad: newTaskUnidad,
        area: selectedArea
      };
      setMasterSpeeds([...masterSpeeds, newTask]);
      setNewTaskName('');
      setNewTaskTime('');
      setNewTaskPeso('');
      setNewTaskUnidad('unidades');
    }
  };

  const startEditTask = (task: MasterSpeed) => {
    setEditingId(task.id);
    setEditValue(task.formato);
    setEditTime((task.tiempoTeorico || 0).toString());
    setEditPeso((task.peso || 0).toString());
    setEditUnidad(task.unidad || 'unidades');
  };

  const saveEditTask = () => {
    if (editingId && editValue.trim()) {
      const t1 = parseFloat(editTime) || 0;
      const p1 = parseFloat(editPeso) || 0;
      
      setMasterSpeeds(masterSpeeds.map(t => t.id === editingId ? { 
        ...t, 
        formato: editValue.trim().toUpperCase(), 
        tiempoTeorico: t1,
        peso: p1,
        unidad: editUnidad
      } : t));
      setEditingId(null);
      setEditValue('');
      setEditTime('');
      setEditPeso('');
      setEditUnidad('unidades');
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: async (results) => {
        const data = results.data as any[];
        if (data.length === 0) {
          alert('El archivo CSV está vacío.');
          return;
        }

        const headers = Object.keys(data[0]);
        
        try {
          if (headers.includes('modBaja') || headers.includes('totalMod')) {
            // RRHH
            const formatted = data.map(r => ({
              id: r.id || Math.random().toString(36).substr(2, 9),
              fecha: r.fecha,
              totalMod: Number(r.totalMod) || 0,
              totalMoi: Number(r.totalMoi) || 0,
              modBaja: Number(r.modBaja) || 0,
              moiBaja: Number(r.moiBaja) || 0,
              ettBaja: Number(r.ettBaja) || 0
            }));
            localStorage.setItem('zitron_top60_rrhh', JSON.stringify(formatted));
            if (isConfigured) {
              await supabase.from('top60_rrhh').delete().neq('id', '0');
              await supabase.from('top60_rrhh').insert(formatted);
            }
            alert('Datos de RRHH cargados correctamente.');
          } else if (headers.includes('jornadasPerdidasMod') || headers.includes('jornadasPerdidasMoi')) {
            // Ausentismo
            const formatted = data.map(r => ({
              id: r.id || Math.random().toString(36).substr(2, 9),
              fecha: r.fecha,
              mod: Number(r.mod) || 0,
              moi: Number(r.moi) || 0,
              jornadasPerdidasMod: Number(r.jornadasPerdidasMod) || 0,
              jornadasPerdidasMoi: Number(r.jornadasPerdidasMoi) || 0
            }));
            localStorage.setItem('zitron_top60_ausentismo', JSON.stringify(formatted));
            if (isConfigured) {
              await supabase.from('top60_ausentismo').delete().neq('id', '0');
              await supabase.from('top60_ausentismo').insert(formatted);
            }
            alert('Datos de Ausentismo cargados correctamente.');
          } else if (headers.includes('problema') || headers.includes('gap')) {
            // Seguridad
            const formatted = data.map(r => ({
              id: r.id || Math.random().toString(36).substr(2, 9),
              fecha: r.fecha,
              tipo: r.tipo || 'Incidente',
              gap: r.gap || '',
              problema: r.problema || '',
              accion: r.accion || '',
              responsable: r.responsable || '',
              fechaPrevista: r.fechaPrevista || r.fecha,
              fechaReal: r.fechaReal || null
            }));
            localStorage.setItem('zitron_top60_seguridad', JSON.stringify(formatted));
            if (isConfigured) {
              await supabase.from('top60_seguridad').delete().neq('id', '0');
              await supabase.from('top60_seguridad').insert(formatted);
            }
            alert('Datos de Seguridad cargados correctamente.');
          } else {
            alert('Formato de CSV no reconocido. Verifique las cabeceras.');
          }
        } catch (error) {
          console.error('Error al cargar CSV:', error);
          alert('Error al procesar el archivo CSV. Verifique el formato.');
        }
        
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  };

  const areaLabel = selectedArea ? (AREA_NAMES[selectedArea] || selectedArea.replace('-', ' ').toUpperCase()) : 'PLANTA';

  const workshopsList = [
    'sb-preparacion', 'sb-loncheado', 'sb-empaquetado-loncheado', 'sb-empaquetado-deshuesado',
    'env-envasado', 'env-empaquetado', 'expedicion', 'preparacion-exp'
  ];

  const workshopIndicators: Record<string, {id: string, name: string}[]> = {
    'sb-loncheado': [
      { id: 'oee', name: 'OEE / KPIs' },
      { id: 'merma1', name: 'Merma 1' },
      { id: 'merma2', name: 'Merma 2' },
      { id: 'subproducto', name: 'Subproducto' }
    ],
    'sb-preparacion': [
      { id: 'oee', name: 'OEE / KPIs' },
      { id: 'pph', name: 'PPH' }
    ],
    'default': [{ id: 'oee', name: 'OEE / KPIs' }]
  };

  const handleUpdateMasterCell = (areaId: string, indicatorId: string, field: keyof OEEObjectives, value: number) => {
    const key = `${areaId}_${indicatorId}`;
    const current = localMasterObjectives[key] || { 
      disponibilidad: 0, rendimiento: 0, calidad: 0, productividad: 0, objetivo: 0, area: areaId, indicatorId: indicatorId, validFrom: objectiveValidFrom 
    };
    const updated = { ...current, [field]: value };
    
    // Auto-calculate productivity if relevant
    if (indicatorId === 'oee' && (field === 'disponibilidad' || field === 'rendimiento' || field === 'calidad')) {
      updated.productividad = parseFloat(((updated.disponibilidad * updated.rendimiento * updated.calidad) / 10000).toFixed(1));
    }
    
    setLocalMasterObjectives(prev => ({
      ...prev,
      [key]: updated
    }));
  };

  const saveMasterObjectives = () => {
    if (onUpdateAllObjectives) {
      onUpdateAllObjectives(localMasterObjectives, objectiveValidFrom);
    }
  };

  // Filtrar listas por tipo
  const stopsList = incidenceMaster.filter(i => i.tipo === TaskType.ESPERAS);
  const breakdownsList = incidenceMaster.filter(i => i.tipo === TaskType.AVERIA);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      {/* MODAL PIN */}
      {showPassModal && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl overflow-hidden border-8 border-slate-800">
            <div className="bg-slate-900 p-8 text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>
              </div>
              <h3 className="text-white font-black text-sm uppercase tracking-widest">Acceso Maestro</h3>
              <div className="flex justify-center gap-4 mt-8">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${pin.length > i ? 'bg-blue-500 border-blue-500 scale-125' : 'bg-transparent border-slate-700'}`}></div>
                ))}
              </div>
            </div>
            <div className="p-8 bg-slate-50">
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'ESC', 0, 'DEL'].map((num) => (
                  <button key={num} type="button" onClick={() => num === 'ESC' ? setShowPassModal(false) : num === 'DEL' ? setPin(pin.slice(0, -1)) : pin.length < 4 && setPin(pin + num)} className="h-16 rounded-2xl bg-white border-b-4 border-slate-200 text-xl font-black text-slate-700 active:scale-90 transition-all">{num}</button>
                ))}
              </div>
              {pinError && <p className="text-center text-red-500 font-black text-[15px] uppercase mt-4 animate-bounce">❌ PIN INCORRECTO</p>}
            </div>
          </div>
        </div>
      )}

      {/* CABECERA */}
      <div className={`p-10 rounded-[3.5rem] border-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 transition-all ${isAdminMode ? 'bg-blue-900 border-blue-600 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tighter text-blue-600">
            Maestro de {areaLabel}
          </h2>
          <p className="text-[14px] font-black uppercase tracking-[0.3em] opacity-60">
            {isAdminMode ? '🔓 MODO EDICIÓN ACTIVO' : '🔒 MODO CONSULTA'}
          </p>
        </div>
        <button 
          type="button"
          onClick={() => isAdminMode ? setIsAdminMode(false) : setShowPassModal(true)} 
          className={`px-10 py-5 rounded-2xl text-[17px] font-black uppercase tracking-widest border-2 transition-all active:scale-95 ${isAdminMode ? 'bg-red-500 border-red-400 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-white shadow-2xl'}`}
        >
          {isAdminMode ? 'BLOQUEAR CAMBIOS' : 'EDITAR MAESTRO'}
        </button>
      </div>

      {/* SECCIÓN: TABLA MAESTRA DE OBJETIVOS (SOLO TOP 60) */}
      {selectedArea === 'TOP 60' && (
        <section className={`p-10 rounded-[4rem] border shadow-2xl flex flex-col transition-colors ${isAdminMode ? 'bg-indigo-950/40 border-indigo-800 text-white' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-black uppercase tracking-tighter text-indigo-600">Tabla Maestra de Objetivos</h2>
              <p className="text-[14px] font-black uppercase tracking-widest opacity-50">Consolidado de indicadores de planta</p>
            </div>
            {isAdminMode && (
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <label className="text-[15px] font-black uppercase tracking-widest text-indigo-400 mb-1">Aplicable desde:</label>
                  <input 
                    type="date" 
                    value={objectiveValidFrom}
                    onChange={(e) => setObjectiveValidFrom(e.target.value)}
                    className="bg-white/10 border border-indigo-500/30 rounded-lg px-3 py-2 text-[14px] font-black text-white outline-none"
                  />
                </div>
                <button 
                  onClick={saveMasterObjectives}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-[14px] uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
                >
                  Guardar Cambios
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleCSVUpload} 
                  accept=".csv" 
                  className="hidden" 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-amber-500 text-white px-6 py-3 rounded-xl font-black text-[14px] uppercase tracking-widest shadow-lg shadow-amber-200 hover:bg-amber-600 transition-all active:scale-95 flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Cargar CSV
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto rounded-3xl border border-slate-200 shadow-inner bg-white/5 max-h-[600px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-20">
                <tr className="bg-slate-900 text-white">
                  <th className="p-4 text-[14px] font-black uppercase tracking-widest border-b border-slate-800">Taller / Indicador</th>
                  <th className="p-4 text-[14px] font-black uppercase tracking-widest border-b border-slate-800 text-center">Disponibilidad (%)</th>
                  <th className="p-4 text-[14px] font-black uppercase tracking-widest border-b border-slate-800 text-center">Rendimiento (%)</th>
                  <th className="p-4 text-[14px] font-black uppercase tracking-widest border-b border-slate-800 text-center">Calidad (%)</th>
                  <th className="p-4 text-[14px] font-black uppercase tracking-widest border-b border-slate-800 text-center">Prod. (%)</th>
                  <th className="p-4 text-[14px] font-black uppercase tracking-widest border-b border-slate-800 text-center">Objetivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {workshopsList.map(wsId => {
                  const indicators = workshopIndicators[wsId] || workshopIndicators.default;
                  return (
                    <React.Fragment key={wsId}>
                      <tr className="bg-slate-50">
                        <td colSpan={6} className="p-2 text-[14px] font-black text-slate-800 uppercase tracking-widest pl-4 border-b border-slate-200">
                          {AREA_NAMES[wsId]}
                        </td>
                      </tr>
                      {indicators.map(ind => {
                        const key = `${wsId}_${ind.id}`;
                        const obj = localMasterObjectives[key] || { disponibilidad: 0, rendimiento: 0, calidad: 0, productividad: 0, objetivo: 0 };
                        const isOEE = ind.id === 'oee';
                        return (
                          <tr key={key} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 pl-8 text-[13px] font-bold text-slate-500 uppercase tracking-tight border-r border-slate-100 italic">
                              {ind.name}
                            </td>
                            <td className="p-2 border-r border-slate-100">
                              {isOEE && (
                                <input 
                                  type="number" 
                                  disabled={!isAdminMode}
                                  value={obj.disponibilidad}
                                  onChange={(e) => handleUpdateMasterCell(wsId, ind.id, 'disponibilidad', parseFloat(e.target.value) || 0)}
                                  className={`w-full bg-transparent border-none text-center text-[13px] font-black focus:ring-0 ${isAdminMode ? 'text-indigo-600 cursor-pointer' : 'text-slate-500'}`}
                                />
                              )}
                            </td>
                            <td className="p-2 border-r border-slate-100">
                              {isOEE && (
                                <input 
                                  type="number" 
                                  disabled={!isAdminMode}
                                  value={obj.rendimiento}
                                  onChange={(e) => handleUpdateMasterCell(wsId, ind.id, 'rendimiento', parseFloat(e.target.value) || 0)}
                                  className={`w-full bg-transparent border-none text-center text-[13px] font-black focus:ring-0 ${isAdminMode ? 'text-indigo-600 cursor-pointer' : 'text-slate-500'}`}
                                />
                              )}
                            </td>
                            <td className="p-2 border-r border-slate-100">
                              {isOEE && (
                                <input 
                                  type="number" 
                                  disabled={!isAdminMode}
                                  value={obj.calidad}
                                  onChange={(e) => handleUpdateMasterCell(wsId, ind.id, 'calidad', parseFloat(e.target.value) || 0)}
                                  className={`w-full bg-transparent border-none text-center text-[13px] font-black focus:ring-0 ${isAdminMode ? 'text-indigo-600 cursor-pointer' : 'text-slate-500'}`}
                                />
                              )}
                            </td>
                            <td className="p-4 text-center text-[13px] font-black text-slate-400 border-r border-slate-100">
                              {isOEE ? `${obj.productividad}%` : '-'}
                            </td>
                            <td className="p-2">
                              <input 
                                type="number" 
                                disabled={!isAdminMode}
                                value={obj.objetivo}
                                onChange={(e) => handleUpdateMasterCell(wsId, ind.id, 'objetivo', parseFloat(e.target.value) || 0)}
                                className={`w-full bg-transparent border-none text-center text-[14px] font-black focus:ring-0 ${isAdminMode ? 'text-indigo-600 cursor-pointer' : 'text-slate-500'}`}
                                placeholder="Definir..."
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* SECCIÓN: GESTIÓN DE PARADAS (Moved up as People is removed) */}
      {selectedArea !== 'TOP 15' && selectedArea !== 'TOP 60' && !onlyPeople && (
        <>
          <section className={`p-10 rounded-[4rem] border shadow-2xl flex flex-col min-h-[400px] transition-colors ${isAdminMode ? 'bg-amber-950/40 border-amber-800 text-white' : 'bg-white border-slate-100'}`}>
         <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <div>
               <h2 className="text-2xl font-black uppercase tracking-tighter text-amber-600">Tipos de Parada</h2>
               <p className="text-[14px] font-black uppercase tracking-widest opacity-50">Configuración de motivos de espera</p>
            </div>
         </div>

         {isAdminMode && (
           <div className="flex flex-col gap-4 mb-10">
             <div className="flex gap-4">
               <input 
                 type="text" 
                 placeholder="NOMBRE DE LA PARADA..." 
                 value={newStopName} 
                 onChange={(e) => setNewStopName(e.target.value)} 
                 className="flex-1 bg-white/10 border-4 border-slate-100 rounded-2xl px-6 py-4 text-sm font-black uppercase tracking-widest outline-none focus:border-amber-500 transition-all text-slate-900 bg-slate-50"
               />
               <button 
                 type="button" 
                 onClick={onAddStop} 
                 className="bg-amber-600 text-white px-12 rounded-2xl font-black text-xs uppercase shadow-xl shadow-amber-200 active:scale-95 transition-all hover:bg-amber-700"
               >
                 Añadir
               </button>
             </div>

           </div>
         )}

         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stopsList.map(stop => (
               <div key={stop.id} className={`flex items-center justify-between p-6 rounded-[2rem] border transition-all ${isAdminMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-slate-50 border-slate-100 hover:border-amber-200 hover:bg-white'}`}>
                  {editingId === stop.id ? (
                    <div className="flex flex-col flex-1 gap-3">
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={editValue} 
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-xs font-black uppercase text-white outline-none"
                          autoFocus
                        />
                        <button onClick={saveEditIncidence} className="p-2 bg-emerald-500 rounded-lg text-white hover:bg-emerald-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-2 bg-slate-500 rounded-lg text-white hover:bg-slate-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </div>

                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-black uppercase tracking-tight">{stop.nombre}</span>
                        </div>
                      </div>
                      {isAdminMode && (
                        <div className="flex gap-2">
                          <button type="button" onClick={() => startEditIncidence(stop)} className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center hover:bg-amber-500 hover:text-white transition-all">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                          </button>
                          <button type="button" onClick={() => onDeleteIncidence(stop.id)} className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      )}
                    </>
                  )}
               </div>
            ))}
         </div>
      </section>

      {/* SECCIÓN: GESTIÓN DE AVERÍAS */}
      <section className={`p-10 rounded-[4rem] border shadow-2xl flex flex-col min-h-[400px] transition-colors ${isAdminMode ? 'bg-red-950/40 border-red-800 text-white' : 'bg-white border-slate-100'}`}>
         <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center shadow-inner">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </div>
            <div>
               <h2 className="text-2xl font-black uppercase tracking-tighter text-red-600">Tipos de Avería</h2>
               <p className="text-[14px] font-black uppercase tracking-widest opacity-50">Catálogo de fallos comunes</p>
            </div>
         </div>

         {isAdminMode && (
           <div className="flex flex-col gap-4 mb-10">
             <div className="flex gap-4">
               <input 
                 type="text" 
                 placeholder="DESCRIPCIÓN DE AVERÍA..." 
                 value={newBreakdownName} 
                 onChange={(e) => setNewBreakdownName(e.target.value)} 
                 className="flex-1 bg-white/10 border-4 border-slate-100 rounded-2xl px-6 py-4 text-sm font-black uppercase tracking-widest outline-none focus:border-red-500 transition-all text-slate-900 bg-slate-50"
               />
               <button 
                 type="button" 
                 onClick={onAddBreakdown} 
                 className="bg-red-600 text-white px-12 rounded-2xl font-black text-xs uppercase shadow-xl shadow-red-200 active:scale-95 transition-all hover:bg-red-700"
               >
                 Añadir
               </button>
             </div>

           </div>
         )}

         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {breakdownsList.map(brk => (
               <div key={brk.id} className={`flex items-center justify-between p-6 rounded-[2rem] border transition-all ${isAdminMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-slate-50 border-slate-100 hover:border-red-200 hover:bg-white'}`}>
                  {editingId === brk.id ? (
                    <div className="flex flex-col flex-1 gap-3">
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={editValue} 
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-xs font-black uppercase text-white outline-none"
                          autoFocus
                        />
                        <button onClick={saveEditIncidence} className="p-2 bg-emerald-500 rounded-lg text-white hover:bg-emerald-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-2 bg-slate-500 rounded-lg text-white hover:bg-slate-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </div>

                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-black uppercase tracking-tight">{brk.nombre}</span>
                        </div>
                      </div>
                      {isAdminMode && (
                        <div className="flex gap-2">
                          <button type="button" onClick={() => startEditIncidence(brk)} className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                          </button>
                          <button type="button" onClick={() => onDeleteIncidence(brk.id)} className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      )}
                    </>
                  )}
               </div>
            ))}
         </div>
      </section>
        </>
      )}

      {/* SECCIÓN: OBJETIVOS KPI */}
      <section className={`p-10 rounded-[4rem] border shadow-2xl flex flex-col transition-colors ${isAdminMode ? 'bg-purple-950/40 border-purple-800 text-white' : 'bg-white border-slate-100'}`}>
         <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center shadow-inner">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
            </div>
            <div>
               <h2 className="text-2xl font-black uppercase tracking-tighter text-purple-600">Objetivos KPI</h2>
               <p className="text-[14px] font-black uppercase tracking-widest opacity-50">
                 {selectedArea === 'TOP 60' ? 'Metas de rendimiento del taller' : 'Gestionados por la Tabla Maestra TOP 60'}
               </p>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className={`p-6 rounded-[2rem] border ${isAdminMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
               <label className="text-[13px] font-black uppercase tracking-widest opacity-60 mb-2 block">Disponibilidad (%)</label>
               {isAdminMode && selectedArea === 'TOP 60' ? (
                 <input 
                   type="number" 
                   value={oeeObjectives.disponibilidad} 
                   onChange={(e) => {
                     const val = parseFloat(e.target.value) || 0;
                     const newObj = { ...oeeObjectives, disponibilidad: val };
                     newObj.productividad = parseFloat(((newObj.disponibilidad * newObj.rendimiento * newObj.calidad) / 10000).toFixed(1));
                     setOeeObjectives(newObj);
                   }}
                   className="w-full bg-white/10 border-2 border-white/20 rounded-xl px-4 py-3 text-lg font-black text-center outline-none focus:border-purple-500 transition-all"
                 />
               ) : (
                 <div className="text-2xl font-black text-center">{oeeObjectives.disponibilidad}%</div>
               )}
            </div>
            <div className={`p-6 rounded-[2rem] border ${isAdminMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
               <label className="text-[13px] font-black uppercase tracking-widest opacity-60 mb-2 block">Rendimiento (%)</label>
               {isAdminMode && selectedArea === 'TOP 60' ? (
                 <input 
                   type="number" 
                   value={oeeObjectives.rendimiento} 
                   onChange={(e) => {
                     const val = parseFloat(e.target.value) || 0;
                     const newObj = { ...oeeObjectives, rendimiento: val };
                     newObj.productividad = parseFloat(((newObj.disponibilidad * newObj.rendimiento * newObj.calidad) / 10000).toFixed(1));
                     setOeeObjectives(newObj);
                   }}
                   className="w-full bg-white/10 border-2 border-white/20 rounded-xl px-4 py-3 text-lg font-black text-center outline-none focus:border-purple-500 transition-all"
                 />
               ) : (
                 <div className="text-2xl font-black text-center">{oeeObjectives.rendimiento}%</div>
               )}
            </div>
            <div className={`p-6 rounded-[2rem] border ${isAdminMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
               <label className="text-[13px] font-black uppercase tracking-widest opacity-60 mb-2 block">Calidad (%)</label>
               {isAdminMode && selectedArea === 'TOP 60' ? (
                 <input 
                   type="number" 
                   value={oeeObjectives.calidad} 
                   onChange={(e) => {
                     const val = parseFloat(e.target.value) || 0;
                     const newObj = { ...oeeObjectives, calidad: val };
                     newObj.productividad = parseFloat(((newObj.disponibilidad * newObj.rendimiento * newObj.calidad) / 10000).toFixed(1));
                     setOeeObjectives(newObj);
                   }}
                   className="w-full bg-white/10 border-2 border-white/20 rounded-xl px-4 py-3 text-lg font-black text-center outline-none focus:border-purple-500 transition-all"
                 />
               ) : (
                 <div className="text-2xl font-black text-center">{oeeObjectives.calidad}%</div>
               )}
            </div>
            <div className={`p-6 rounded-[2rem] border bg-indigo-50/30 border-indigo-100/20`}>
               <label className="text-[13px] font-black uppercase tracking-widest text-indigo-400 mb-2 block">Productividad (%)</label>
               <div className="text-2xl font-black text-center text-indigo-600">
                 {((oeeObjectives.disponibilidad * oeeObjectives.rendimiento * oeeObjectives.calidad) / 10000).toFixed(1)}%
               </div>
               <p className="text-[10px] font-bold text-indigo-300 uppercase text-center mt-1">Autocalculado (D x R x C)</p>
            </div>
         </div>
      </section>

      {/* SECCIÓN: MAESTRO DE TAREAS */}
      <section className={`p-10 rounded-[4rem] border shadow-2xl flex flex-col min-h-[600px] transition-colors ${isAdminMode ? 'bg-slate-900 border-indigo-800 text-white' : 'bg-white border-slate-100'}`}>
         <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
            </div>
            <div>
               <h2 className="text-2xl font-black uppercase tracking-tighter text-indigo-600">Maestro de Formatos</h2>
               <div className="flex items-center gap-4 mt-1">
                 <p className="text-[14px] font-black uppercase tracking-widest opacity-50">Definición de tiempos estándar por GAP</p>
                 {!isConfigured && (
                   <span className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded text-[10px] font-black uppercase tracking-widest animate-pulse">
                     Modo Local (Sin Cloud)
                   </span>
                 )}
                 {isAdminMode && (
                   <div className="flex gap-2 ml-auto">
                     <button 
                       onClick={handleForceSync}
                       className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-lg text-[15px] font-black uppercase tracking-widest hover:bg-indigo-500/20 transition-all flex items-center gap-1 border border-indigo-500/20"
                     >
                       <Database className="w-2 h-2" />
                       Sincronizar
                     </button>
                     <button 
                       onClick={handleResetMasterData}
                       className="px-3 py-1 bg-red-500/10 text-red-400 rounded-lg text-[15px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all border border-red-500/20"
                     >
                       Restablecer
                     </button>
                   </div>
                 )}
               </div>
            </div>
         </div>

         {isAdminMode && (
           <div className="flex flex-col gap-4 mb-10">
             <div className="flex flex-col md:flex-row gap-4">
               <input 
                 type="text" 
                 placeholder="NOMBRE DEL FORMATO..." 
                 value={newTaskName} 
                 onChange={(e) => setNewTaskName(e.target.value)} 
                 className="flex-[2] bg-white/10 border-4 border-slate-100 rounded-2xl px-6 py-4 text-sm font-black uppercase tracking-widest outline-none focus:border-indigo-500 transition-all text-slate-900 bg-slate-50"
               />
             </div>
             
             <div className="flex flex-col md:flex-row gap-4">
               <div className="flex flex-1 gap-4">
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-[15px] font-black uppercase tracking-widest text-slate-400 ml-2">
                      Unidades Hora
                    </label>
                    <input 
                      type="number" 
                      placeholder="U/H" 
                      value={newTaskTime} 
                      onChange={(e) => setNewTaskTime(e.target.value)} 
                      className="w-full bg-white/10 border-4 border-slate-100 rounded-2xl px-6 py-4 text-sm font-black uppercase tracking-widest outline-none focus:border-indigo-500 transition-all text-slate-900 bg-slate-50 text-center"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-[15px] font-black uppercase tracking-widest text-slate-400 ml-2">
                       Peso (Kg)
                    </label>
                    <input 
                      type="number" 
                      step="0.001"
                      placeholder="KG" 
                      value={newTaskPeso} 
                      onChange={(e) => setNewTaskPeso(e.target.value)} 
                      className="w-full bg-white/10 border-4 border-slate-100 rounded-2xl px-6 py-4 text-sm font-black uppercase tracking-widest outline-none focus:border-indigo-500 transition-all text-slate-900 bg-slate-50 text-center"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-[15px] font-black uppercase tracking-widest text-slate-400 ml-2">
                      Unidad
                    </label>
                    <select 
                      value={newTaskUnidad} 
                      onChange={(e) => setNewTaskUnidad(e.target.value as 'kg' | 'unidades')} 
                      className="w-full bg-white/10 border-4 border-slate-100 rounded-2xl px-6 py-4 text-sm font-black uppercase tracking-widest outline-none focus:border-indigo-500 transition-all text-slate-900 bg-slate-50"
                    >
                      <option value="unidades">Unidades</option>
                      <option value="kg">Kg</option>
                    </select>
                  </div>
               </div>
               
               <div className="flex gap-3 mt-auto">
                 <button 
                   type="button" 
                   onClick={onAddTask} 
                   className="flex-1 bg-indigo-600 text-white px-8 rounded-2xl font-black text-xs uppercase shadow-xl shadow-indigo-200 active:scale-95 transition-all hover:bg-indigo-700 h-[60px]"
                 >
                   Añadir Formato
                 </button>
                 <button 
                   type="button" 
                   onClick={() => {
                     if (selectedArea && confirm('¿Cargar formatos por defecto para este GAP? Se borrarán las actuales.')) {
                       setMasterSpeeds(getInitialMasterSpeeds(selectedArea));
                     }
                   }} 
                   className="bg-slate-100 text-slate-400 px-6 rounded-2xl font-black text-[13px] uppercase tracking-widest hover:bg-slate-200 transition-all h-[60px]"
                 >
                   Reset
                 </button>
               </div>
             </div>
           </div>
         )}
              <div className="grid grid-cols-1 gap-3 max-h-[500px] overflow-y-auto pr-2">
            <div className="flex items-center justify-between px-5 py-2 text-[13px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 mb-2">
              <div className="flex-[2]">Formato</div>
              <div className="flex-1 text-center">Unidades Hora</div>
              <div className="flex-1 text-center">Peso</div>
              <div className="flex-1 text-center">Unidad</div>
              {isAdminMode && <div className="w-24"></div>}
            </div>
            {masterSpeeds
              .filter(ms => ms.area === selectedArea)
              .map(task => (
               <div key={task.id} className={`flex items-center justify-between p-5 rounded-[2rem] border transition-all ${isAdminMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-slate-50 border-slate-100 hover:border-indigo-200 hover:bg-white'}`}>
                  {editingId === task.id ? (
                    <div className="flex flex-1 gap-4 items-center">
                      <input 
                        type="text" 
                        value={editValue} 
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-[2] bg-slate-800 border border-white/20 rounded-lg px-3 py-2 text-xs font-black uppercase text-white outline-none"
                        autoFocus
                      />
                      <input 
                        type="number" 
                        value={editTime} 
                        onChange={(e) => setEditTime(e.target.value)}
                        className="flex-1 bg-slate-800 border border-white/20 rounded-lg px-2 py-2 text-[14px] font-black uppercase text-white outline-none text-center"
                      />
                      <input 
                        type="number" 
                        step="0.001"
                        value={editPeso} 
                        onChange={(e) => setEditPeso(e.target.value)}
                        className="flex-1 bg-slate-800 border border-white/20 rounded-lg px-2 py-2 text-[14px] font-black uppercase text-white outline-none text-center"
                      />
                      <select 
                        value={editUnidad} 
                        onChange={(e) => setEditUnidad(e.target.value as 'kg' | 'unidades')} 
                        className="flex-1 bg-slate-800 border border-white/20 rounded-lg px-2 py-2 text-[14px] font-black uppercase text-white outline-none text-center"
                      >
                        <option value="unidades">Unidades</option>
                        <option value="kg">Kg</option>
                      </select>
                      <div className="flex gap-2">
                        <button onClick={saveEditTask} className="p-2 bg-emerald-500 rounded-lg text-white hover:bg-emerald-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-2 bg-slate-500 rounded-lg text-white hover:bg-slate-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-1 items-center">
                        <div className="flex-[2] text-xs font-black uppercase tracking-tight">{task.formato}</div>
                        <div className="flex-1 text-xs font-black uppercase tracking-tight text-center">{task.tiempoTeorico}</div>
                        <div className="flex-1 text-xs font-black uppercase tracking-tight text-center">{task.peso || 0}</div>
                        <div className="flex-1 text-xs font-black uppercase tracking-tight text-center">{task.unidad || 'unidades'}</div>
                      </div>
                      {isAdminMode && (
                        <div className="flex gap-2 ml-4">
                          <button type="button" onClick={() => startEditTask(task)} className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                          </button>
                          <button type="button" onClick={() => onDeleteTask(task.id)} className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      )}
                    </>
                  )}
               </div>
            ))}
         </div>
      </section>

      {/* SECCIÓN: RESPONSABLES */}
      {(selectedArea === 'TOP 15' || selectedArea === 'TOP 60') && setResponsibles && (
        <section className={`p-10 rounded-[4rem] border shadow-2xl flex flex-col min-h-[400px] transition-colors ${isAdminMode ? 'bg-violet-950/40 border-violet-800 text-white' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-violet-100 text-violet-600 rounded-2xl flex items-center justify-center shadow-inner">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tighter text-violet-600">Responsables</h2>
              <p className="text-[14px] font-black uppercase tracking-widest opacity-50">Personas que aparecen en el plan de acción</p>
            </div>
          </div>

          {isAdminMode && (
            <div className="flex gap-4 mb-10">
              <input
                type="text"
                placeholder="NOMBRE DEL RESPONSABLE..."
                value={newResponsibleName}
                onChange={(e) => setNewResponsibleName(e.target.value)}
                className="flex-1 bg-white/10 border-4 border-slate-100 rounded-2xl px-6 py-4 text-sm font-black uppercase tracking-widest outline-none focus:border-violet-500 transition-all text-slate-900 bg-slate-50"
              />
              <button
                type="button"
                onClick={() => {
                  const name = newResponsibleName.trim().toUpperCase();
                  if (name && !responsibles.includes(name)) {
                    setResponsibles([...responsibles, name]);
                    setNewResponsibleName('');
                  }
                }}
                className="bg-violet-600 text-white px-12 rounded-2xl font-black text-xs uppercase shadow-xl shadow-violet-200 active:scale-95 transition-all hover:bg-violet-700"
              >
                Añadir
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {responsibles.map((name, idx) => (
              <div key={idx} className={`flex items-center justify-between p-6 rounded-[2rem] border transition-all ${isAdminMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-slate-50 border-slate-100 hover:border-violet-200 hover:bg-white'}`}>
                <span className="text-xs font-black uppercase tracking-tight">{name}</span>
                {isAdminMode && (
                  <button
                    type="button"
                    onClick={() => setResponsibles(responsibles.filter((_, i) => i !== idx))}
                    className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default ConfigPanel;