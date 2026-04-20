import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ActionPlanItem } from '../types';
import { TOP60_RESPONSABLES, INITIAL_ACTION_PLAN_TOP60 } from '../constants';
import { supabase, isConfigured } from '../lib/supabase';
import { Filter, Lock, Plus, ClipboardList } from 'lucide-react';

interface ActionPlanPanelProps {
  storageKey?: string;
  title?: string;
  initialData?: ActionPlanItem[];
  responsibles?: string[];
  dbTable?: string; // New prop to specify Supabase table
  passwords?: {
    jefeEquipo: string;
    jefeTaller: string;
    directorOperaciones: string;
    asistenciaTecnica: string;
  };
  requiredLevel?: number;
}

const ActionPlanPanel: React.FC<ActionPlanPanelProps> = ({
  storageKey = 'zitron_top60_actionplan',
  title = 'Plan de Acción Estratégico',
  initialData = INITIAL_ACTION_PLAN_TOP60,
  responsibles = TOP60_RESPONSABLES,
  dbTable,
  passwords,
  requiredLevel = 3
}) => {
  const [items, setItems] = useState<ActionPlanItem[]>([]);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');
  const [filterResponsible, setFilterResponsible] = useState<string>('TODOS');
  const [showPassModal, setShowPassModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasPendingSync, setHasPendingSync] = useState(false);

  useEffect(() => {
    if (pin.length === 4 && passwords) {
      let isCorrect = false;
      
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
  }, [pin, passwords, requiredLevel]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingSync) {
        const msg = "Hay cambios en el Plan de Acción pendientes de sincronizar.";
        e.returnValue = msg;
        return msg;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasPendingSync]);

  useEffect(() => {
    if (isOnline && hasPendingSync && items.length > 0) {
      saveData(items);
    }
  }, [isOnline, hasPendingSync]);

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    let localData: ActionPlanItem[] = [];
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) localData = parsed;
      } catch (e) { console.error("Error parsing action plan", e); }
    }

    if (isConfigured && dbTable) {
      try {
        const { data, error } = await supabase.from(dbTable).select('*').order('id', { ascending: true });
        if (error) throw error;
        if (data && data.length > 0) {
          setItems(data);
          localStorage.setItem(storageKey, JSON.stringify(data));
          setIsLoading(false);
          return;
        }
      } catch (e) {
        console.error(`Error loading ${dbTable} from Supabase:`, e);
      }
    }

    setItems(localData.length > 0 ? localData : initialData);
    setIsLoading(false);
  }, [storageKey, initialData, dbTable]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save data
  const saveData = async (newItems: ActionPlanItem[]) => {
    setItems(newItems);
    localStorage.setItem(storageKey, JSON.stringify(newItems));

    if (isConfigured && dbTable) {
      if (!navigator.onLine) {
        setHasPendingSync(true);
        return;
      }
      try {
        // Simple approach: delete all and re-insert
        await supabase.from(dbTable).delete().neq('id', 0); // Delete all
        if (newItems.length > 0) {
          const { error } = await supabase.from(dbTable).insert(newItems);
          if (error) throw error;
        }
        setHasPendingSync(false);
      } catch (e) {
        console.error(`Error saving ${dbTable} to Supabase:`, e);
        setHasPendingSync(true);
      }
    }
  };

  const handleResetData = () => {
    if (window.confirm("¿Estás seguro de que quieres restablecer los datos iniciales? Se perderán los cambios actuales.")) {
      saveData(initialData);
    }
  };
  const [showAddForm, setShowAddForm] = useState(false);
  const [newComment, setNewComment] = useState<{ id: number; text: string } | null>(null);
  
  // Form state para nueva acción
  const [formData, setFormData] = useState<Partial<ActionPlanItem>>({
    asunto: '',
    accion: '',
    responsable: '',
    soporte: '',
    fechaLanzamiento: new Date().toISOString().split('T')[0],
    fechaObjetivo: new Date().toISOString().split('T')[0],
    avance: 0,
    observaciones: ''
  });

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.responsable) {
      alert("Por favor, seleccione un Responsable.");
      return;
    }

    const nextId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    const newItem: ActionPlanItem = {
      asunto: formData.asunto || '',
      accion: formData.accion || '',
      responsable: formData.responsable || '',
      soporte: formData.soporte || '',
      fechaLanzamiento: formData.fechaLanzamiento || new Date().toISOString().split('T')[0],
      fechaObjetivo: formData.fechaObjetivo || new Date().toISOString().split('T')[0],
      avance: formData.avance || 0,
      observaciones: formData.observaciones || '',
      id: nextId
    };
    saveData([...items, newItem]);
    setShowAddForm(false);
    setFormData({
      asunto: '',
      accion: '',
      responsable: '',
      soporte: '',
      fechaLanzamiento: new Date().toISOString().split('T')[0],
      fechaObjetivo: new Date().toISOString().split('T')[0],
      avance: 0,
      observaciones: ''
    });
  };

  const updateItemField = (id: number, field: keyof ActionPlanItem, value: any) => {
    const nextItems = items.map(item => {
      if (item.id === id) {
        let updated = { ...item, [field]: value };
        if (field === 'fechaCierre' && value && value.trim() !== '') {
          updated.avance = 100;
        }
        return updated;
      }
      return item;
    });
    saveData(nextItems);
  };

  const handleAddComment = (id: number) => {
    if (!newComment || !newComment.text.trim()) return;
    const dateStr = new Date().toLocaleDateString('es-ES');
    const commentLog = `[${dateStr}]: ${newComment.text}`;
    
    const nextItems = items.map(item => {
      if (item.id === id) {
        const currentObs = item.observaciones ? item.observaciones + '\n' : '';
        return { ...item, observaciones: currentObs + commentLog };
      }
      return item;
    });
    saveData(nextItems);
    setNewComment(null);
  };

  const getStatus = (item: ActionPlanItem) => {
    if (item.fechaCierre && item.fechaCierre.trim() !== '') return 'CERRADO';
    const today = new Date().toISOString().split('T')[0];
    if (today > item.fechaObjetivo) return 'RETRASADA';
    return 'EN MARCHA';
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'CERRADO': return 'bg-emerald-500 text-white';
      case 'EN MARCHA': return 'bg-amber-400 text-slate-900';
      case 'RETRASADA': return 'bg-red-600 text-white font-bold';
      default: return 'bg-slate-200 text-slate-500';
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const status = getStatus(item);
      const matchesStatus = filterStatus === 'TODOS' || status === filterStatus;
      const matchesResponsible = filterResponsible === 'TODOS' || item.responsable === filterResponsible;
      return matchesStatus && matchesResponsible;
    });
  }, [items, filterStatus, filterResponsible]);

  return (
    <div className="space-y-4 animate-in fade-in duration-500 max-w-[100vw] px-2 sm:px-0">
      {/* MODAL PIN */}
      {showPassModal && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl overflow-hidden border-8 border-slate-800">
            <div className="bg-slate-900 p-8 text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>
              </div>
              <h3 className="text-white font-black text-xs uppercase tracking-widest">Acceso Edición Plan Acción</h3>
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
              {pinError && <p className="text-center text-red-500 font-black text-[13px] uppercase mt-4 animate-bounce">❌ PIN INCORRECTO</p>}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200 shadow-sm gap-4">
        <div className="text-center sm:text-left">
          <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tighter uppercase">{title}</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-400 text-[15px] sm:text-[13px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em]">
              {isAdminMode ? '🔓 MODO EDICIÓN ACTIVO' : '🔒 MODO CONSULTA'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* FILTERS */}
          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100 mr-2">
            <div className="flex items-center gap-1.5 px-2 border-r border-slate-200">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase">Estado</span>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0 p-0 cursor-pointer"
              >
                <option value="TODOS">TODOS</option>
                <option value="EN MARCHA">EN MARCHA</option>
                <option value="RETRASADA">RETRASADA</option>
                <option value="CERRADO">CERRADO</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5 px-2">
              <span className="text-[10px] font-black text-slate-400 uppercase">Resp.</span>
              <select 
                value={filterResponsible}
                onChange={(e) => setFilterResponsible(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0 p-0 cursor-pointer max-w-[100px]"
              >
                <option value="TODOS">TODOS</option>
                {Array.from(new Set(items.map(i => i.responsable))).filter(Boolean).sort().map(resp => (
                  <option key={resp} value={resp}>{resp}</option>
                ))}
              </select>
            </div>
          </div>

          <button 
            type="button"
            onClick={() => isAdminMode ? setIsAdminMode(false) : setShowPassModal(true)} 
            className={`flex-1 sm:flex-none px-6 py-3 rounded-xl text-[13px] font-black uppercase tracking-widest border-2 transition-all active:scale-95 ${isAdminMode ? 'bg-red-500 border-red-400 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-white shadow-xl'}`}
          >
            {isAdminMode ? 'BLOQUEAR' : 'EDITAR'}
          </button>

          {isAdminMode && (
            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex-1 sm:flex-none px-3 sm:px-6 py-2 sm:py-3 bg-indigo-600 text-white rounded-xl text-[15px] sm:text-[13px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
            >
              {showAddForm ? 'Cerrar' : '+ Nueva'}
            </button>
          )}
        </div>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddItem} className="bg-white p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border-2 border-indigo-50 shadow-xl animate-in slide-in-from-top-4 duration-500 space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <input required type="text" value={formData.asunto} onChange={e => setFormData({...formData, asunto: e.target.value})} className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs sm:text-sm outline-none focus:border-indigo-500" placeholder="Problema / Asunto..." />
            <input required type="text" value={formData.accion} onChange={e => setFormData({...formData, accion: e.target.value})} className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs sm:text-sm outline-none focus:border-indigo-500" placeholder="Acción a tomar..." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <select required value={formData.responsable} onChange={e => setFormData({...formData, responsable: e.target.value})} className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs sm:text-sm outline-none focus:border-indigo-500">
              <option value="">-- RESPONSABLE --</option>
              {responsibles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={formData.soporte} onChange={e => setFormData({...formData, soporte: e.target.value})} className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs sm:text-sm outline-none focus:border-indigo-500">
              <option value="">-- SOPORTE (OPCIONAL) --</option>
              {responsibles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input type="date" value={formData.fechaObjetivo} onChange={e => setFormData({...formData, fechaObjetivo: e.target.value})} className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs sm:text-sm outline-none focus:border-indigo-500 text-indigo-600" />
            <button className="py-3 sm:py-4 bg-indigo-600 text-white rounded-xl text-[13px] sm:text-[15px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all">Guardar Acción</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto no-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px] table-fixed">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-900 text-white">
                <th className="px-2 py-4 text-[14px] font-black uppercase tracking-widest w-[35px]">Nº</th>
                <th className="px-2 py-4 text-[14px] font-black uppercase tracking-widest w-[18%]">Asunto</th>
                <th className="px-2 py-4 text-[14px] font-black uppercase tracking-widest w-[18%]">Acción</th>
                <th className="px-2 py-4 text-[14px] font-black uppercase tracking-widest w-[110px]">Resp. / Sop.</th>
                <th className="px-2 py-4 text-[14px] font-black uppercase tracking-widest w-[85px]">Lanz.</th>
                <th className="px-2 py-4 text-[14px] font-black uppercase tracking-widest w-[85px]">Obj.</th>
                <th className="px-2 py-4 text-[14px] font-black uppercase tracking-widest w-[85px]">Cierre</th>
                <th className="px-2 py-4 text-[14px] font-black uppercase tracking-widest w-[100px]">Avance</th>
                <th className="px-2 py-4 text-[14px] font-black uppercase tracking-widest w-[90px] text-center">Estado</th>
                <th className="px-2 py-4 text-[14px] font-black uppercase tracking-widest w-auto">Observaciones / Historial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map(item => {
                const status = getStatus(item);
                const isClosed = !!(item.fechaCierre && item.fechaCierre.trim() !== '');
                
                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group align-top">
                    <td className="px-2 py-3 font-black text-slate-400 text-[15px]">#{item.id}</td>
                    <td className="px-1 py-2">
                      <textarea 
                        value={item.asunto} 
                        readOnly={!isAdminMode}
                        onChange={e => updateItemField(item.id, 'asunto', e.target.value)}
                        className={`w-full bg-transparent border-none text-[17px] font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-200 rounded p-1 resize-none outline-none h-24 ${!isAdminMode ? 'cursor-default' : ''}`}
                      />
                    </td>
                    <td className="px-1 py-2">
                      <textarea 
                        value={item.accion} 
                        readOnly={!isAdminMode}
                        onChange={e => updateItemField(item.id, 'accion', e.target.value)}
                        className={`w-full bg-transparent border-none text-[17px] font-medium text-slate-600 italic focus:bg-white focus:ring-1 focus:ring-indigo-200 rounded p-1 resize-none outline-none h-24 ${!isAdminMode ? 'cursor-default' : ''}`}
                      />
                    </td>
                    <td className="px-1 py-2">
                      <select 
                        value={item.responsable} 
                        disabled={!isAdminMode}
                        onChange={e => updateItemField(item.id, 'responsable', e.target.value)}
                        className={`w-full bg-transparent border-none text-[14px] font-black text-slate-900 uppercase focus:bg-white outline-none p-1 ${!isAdminMode ? 'appearance-none cursor-default' : ''}`}
                      >
                        {responsibles.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <select 
                        value={item.soporte} 
                        disabled={!isAdminMode}
                        onChange={e => updateItemField(item.id, 'soporte', e.target.value)}
                        className={`w-full bg-transparent border-none text-[13px] font-bold text-slate-400 uppercase focus:bg-white outline-none p-1 mt-1 ${!isAdminMode ? 'appearance-none cursor-default' : ''}`}
                      >
                        <option value="">(SIN SOPORTE)</option>
                        {responsibles.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-4 text-[15px] font-bold text-slate-500">{item.fechaLanzamiento}</td>
                    <td className="px-1 py-3">
                      <input 
                        type="date" 
                        value={item.fechaObjetivo} 
                        readOnly={!isAdminMode}
                        onChange={e => updateItemField(item.id, 'fechaObjetivo', e.target.value)}
                        className={`w-full bg-transparent text-[15px] font-black text-indigo-600 outline-none p-1 focus:bg-white rounded ${!isAdminMode ? 'cursor-default' : ''}`}
                      />
                    </td>
                    <td className="px-1 py-3">
                      <input 
                        type="date" 
                        value={item.fechaCierre || ''} 
                        readOnly={!isAdminMode}
                        onChange={e => updateItemField(item.id, 'fechaCierre', e.target.value)}
                        className={`bg-transparent text-[15px] font-bold text-emerald-600 outline-none w-full cursor-pointer hover:bg-slate-100 p-1 rounded ${!isAdminMode ? 'cursor-default' : ''}`}
                      />
                    </td>
                    <td className="px-1 py-3">
                      <div className="flex flex-col gap-1">
                        <input 
                          type="range" min="0" max="100" value={item.avance} disabled={isClosed || !isAdminMode}
                          onChange={e => updateItemField(item.id, 'avance', parseInt(e.target.value))}
                          className={`w-full h-1 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-600 ${isClosed || !isAdminMode ? 'opacity-30' : ''}`}
                        />
                        <div className="flex items-center">
                          <input 
                            type="number" min="0" max="100" value={item.avance} disabled={isClosed || !isAdminMode}
                            onChange={e => updateItemField(item.id, 'avance', Math.min(100, parseInt(e.target.value) || 0))}
                            className="w-12 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-[15px] font-black text-center outline-none focus:border-indigo-400"
                          />
                          <span className="text-[15px] font-black text-slate-400 ml-1">%</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-4 text-center">
                      <span className={`px-1 py-1 rounded-full text-[13px] font-black tracking-widest uppercase inline-block w-full ${getStatusStyles(status)}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-1 py-2">
                      <div className="flex flex-col gap-1">
                        <div className="max-h-24 overflow-y-auto bg-slate-50/50 p-1.5 rounded border border-slate-100">
                          <pre className="whitespace-pre-wrap font-sans text-[14px] text-slate-500 leading-tight">
                            {item.observaciones || 'Sin comentarios.'}
                          </pre>
                        </div>
                        <div className="flex gap-1">
                          {isAdminMode && (
                            <>
                              <input 
                                type="text" 
                                placeholder="Añadir..."
                                value={newComment?.id === item.id ? newComment.text : ''}
                                onChange={e => setNewComment({ id: item.id, text: e.target.value })}
                                onKeyDown={e => e.key === 'Enter' && handleAddComment(item.id)}
                                className="flex-1 text-[14px] p-1.5 border border-slate-200 rounded outline-none focus:border-indigo-400"
                              />
                              <button 
                                onClick={() => handleAddComment(item.id)}
                                className="bg-indigo-50 text-indigo-600 p-1 rounded hover:bg-indigo-600 hover:text-white transition-colors"
                              >
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-20 text-center">
                    <p className="text-slate-300 italic font-medium uppercase tracking-widest text-xs mb-4">No hay acciones registradas</p>
                    <button 
                      onClick={() => setItems(initialData)}
                      className="px-6 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-[14px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all"
                    >
                      Cargar Plan Inicial
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ActionPlanPanel;