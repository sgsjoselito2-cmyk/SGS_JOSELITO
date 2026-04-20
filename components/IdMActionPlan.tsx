import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../types';
import { supabase, isConfigured } from '../lib/supabase';
import { Filter } from 'lucide-react';

interface IdMActionPlanProps {
  operarios: User[];
  passwords?: {
    jefeEquipo: string;
    jefeTaller: string;
    directorOperaciones: string;
    asistenciaTecnica: string;
  };
}

interface IdMItem {
  id: string;
  idSugerencia: number;
  sugerencia: string;
  recurso: string;
  fechaCreacion: string;
  aprobada: 'SI' | 'NO' | 'Pendiente';
  responsable: string;
  fechaPrevista: string;
  fechaCierre: string;
}

const IdMActionPlan: React.FC<IdMActionPlanProps> = ({ operarios, passwords }) => {
  const [items, setItems] = useState<IdMItem[]>([]);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<IdMItem>>({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasPendingSync, setHasPendingSync] = useState(false);

  useEffect(() => {
    if (pin.length === 4 && passwords) {
      let isCorrect = false;
      
      // Determinar nivel requerido (IdM TOP 60 -> Nivel 3)
      let requiredLevel = 3;
      
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
  }, [pin, passwords]);

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
        const msg = "Hay cambios en IdM pendientes de sincronizar.";
        e.returnValue = msg;
        return msg;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasPendingSync]);

  useEffect(() => {
    if (isOnline && hasPendingSync && items.length > 0) {
      saveItems(items);
    }
  }, [isOnline, hasPendingSync]);
  
  // Filters
  const [filterResponsable, setFilterResponsable] = useState('');
  const [filterEstado, setFilterEstado] = useState('');

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    if (!isConfigured) {
      const saved = localStorage.getItem('zitron_top60_idm');
      if (saved) setItems(JSON.parse(saved));
      return;
    }

    try {
      const { data, error } = await supabase
        .from('top60_idm')
        .select('*')
        .order('idSugerencia', { ascending: false });

      if (error) throw error;
      if (data) setItems(data);
    } catch (error) {
      console.error('Error loading idm items:', error);
      const saved = localStorage.getItem('zitron_top60_idm');
      if (saved) setItems(JSON.parse(saved));
    }
  };

  const saveItems = async (newItems: IdMItem[]) => {
    setItems(newItems);
    localStorage.setItem('zitron_top60_idm', JSON.stringify(newItems));

    if (isConfigured) {
      if (!navigator.onLine) {
        setHasPendingSync(true);
        return;
      }
      try {
        await supabase.from('top60_idm').delete().neq('id', '0');
        if (newItems.length > 0) {
          await supabase.from('top60_idm').insert(newItems);
        }
        setHasPendingSync(false);
      } catch (error) {
        console.error('Error saving idm items:', error);
        setHasPendingSync(true);
      }
    }
  };

  const handleSave = () => {
    if (!formData.idSugerencia || !formData.sugerencia || !formData.recurso || !formData.fechaCreacion || !formData.aprobada || !formData.responsable || !formData.fechaPrevista) {
      alert('Por favor, rellena todos los campos obligatorios.');
      return;
    }

    let newItems;
    if (editingId) {
      newItems = items.map(item => item.id === editingId ? { ...item, ...formData } as IdMItem : item);
    } else {
      newItems = [{ ...formData, id: Date.now().toString() } as IdMItem, ...items];
    }

    saveItems(newItems);
    setIsAdding(false);
    setEditingId(null);
    setFormData({});
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta sugerencia?')) {
      saveItems(items.filter(item => String(item.id) !== String(id)));
    }
  };

  const getStatus = (item: IdMItem) => {
    if (item.fechaCierre) return { label: 'CERRADO', color: 'bg-emerald-100 text-emerald-700' };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const planned = new Date(item.fechaPrevista);
    planned.setHours(0, 0, 0, 0);

    if (planned >= today) {
      return { label: 'EN MARCHA', color: 'bg-blue-100 text-blue-700' };
    } else {
      return { label: 'RETRASADA', color: 'bg-red-100 text-red-700' };
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const status = getStatus(item).label;
      const matchResponsable = filterResponsable && filterResponsable !== 'TODOS' ? item.responsable === filterResponsable : true;
      const matchEstado = filterEstado && filterEstado !== 'TODOS' ? status === filterEstado : true;
      return matchResponsable && matchEstado;
    });
  }, [items, filterResponsable, filterEstado]);

  return (
    <div className="w-full text-left">
      {/* MODAL PIN */}
      {showPassModal && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-sm rounded-[3rem] shadow-2xl overflow-hidden border-8 border-slate-800">
            <div className="bg-slate-900 p-8 text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>
              </div>
              <h3 className="text-white font-black text-xs uppercase tracking-widest">Acceso Edición IdM</h3>
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

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-800 uppercase tracking-widest">Ideas de Mejora (IdM)</h3>
          <p className="text-slate-400 font-black text-[14px] uppercase tracking-[0.2em]">
            {isAdminMode ? '🔓 MODO EDICIÓN ACTIVO' : '🔒 MODO CONSULTA'}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          {/* FILTERS */}
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-100 shadow-sm mr-2">
            <div className="flex items-center gap-1.5 px-2 border-r border-slate-100">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase">Estado</span>
              <select 
                value={filterEstado || 'TODOS'}
                onChange={(e) => setFilterEstado(e.target.value)}
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
                value={filterResponsable || 'TODOS'}
                onChange={(e) => setFilterResponsable(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0 p-0 cursor-pointer max-w-[120px]"
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
            className={`px-6 py-3 rounded-xl text-[14px] font-black uppercase tracking-widest border-2 transition-all active:scale-95 ${isAdminMode ? 'bg-red-500 border-red-400 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-white shadow-xl'}`}
          >
            {isAdminMode ? 'BLOQUEAR' : 'EDITAR'}
          </button>

          {isAdminMode && !isAdding && (
            <button
              onClick={() => { setIsAdding(true); setFormData({ aprobada: 'Pendiente' }); }}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-[15px] uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
              Nueva IdM
            </button>
          )}
        </div>
      </div>

      {(isAdding || editingId) && (
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[14px] font-black text-slate-400 uppercase tracking-widest mb-1">ID Sugerencia</label>
              <input type="number" value={formData.idSugerencia || ''} onChange={e => setFormData({...formData, idSugerencia: parseInt(e.target.value)})} className="w-full p-3 rounded-xl border-slate-200 text-sm font-bold text-slate-700 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-[14px] font-black text-slate-400 uppercase tracking-widest mb-1">Fecha Creación</label>
              <input type="date" value={formData.fechaCreacion || ''} onChange={e => setFormData({...formData, fechaCreacion: e.target.value})} className="w-full p-3 rounded-xl border-slate-200 text-sm font-bold text-slate-700 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-[14px] font-black text-slate-400 uppercase tracking-widest mb-1">Recurso (Solicitante)</label>
              <select value={formData.recurso || ''} onChange={e => setFormData({...formData, recurso: e.target.value})} className="w-full p-3 rounded-xl border-slate-200 text-sm font-bold text-slate-700 focus:ring-blue-500 focus:border-blue-500">
                <option value="">Seleccionar...</option>
                {operarios.map(o => <option key={o.id} value={o.nombre}>{o.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[14px] font-black text-slate-400 uppercase tracking-widest mb-1">Aprobada</label>
              <select value={formData.aprobada || 'Pendiente'} onChange={e => setFormData({...formData, aprobada: e.target.value as any})} className="w-full p-3 rounded-xl border-slate-200 text-sm font-bold text-slate-700 focus:ring-blue-500 focus:border-blue-500">
                <option value="Pendiente">Pendiente</option>
                <option value="SI">SI</option>
                <option value="NO">NO</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[14px] font-black text-slate-400 uppercase tracking-widest mb-1">Sugerencia</label>
            <textarea value={formData.sugerencia || ''} onChange={e => setFormData({...formData, sugerencia: e.target.value})} rows={3} className="w-full p-3 rounded-xl border-slate-200 text-sm font-bold text-slate-700 focus:ring-blue-500 focus:border-blue-500 resize-none" placeholder="Describe la sugerencia..."></textarea>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[14px] font-black text-slate-400 uppercase tracking-widest mb-1">Responsable</label>
              <select value={formData.responsable || ''} onChange={e => setFormData({...formData, responsable: e.target.value})} className="w-full p-3 rounded-xl border-slate-200 text-sm font-bold text-slate-700 focus:ring-blue-500 focus:border-blue-500">
                <option value="">Seleccionar Responsable...</option>
                {operarios.map(o => <option key={o.id} value={o.nombre}>{o.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[14px] font-black text-slate-400 uppercase tracking-widest mb-1">Fecha Ejecución Prevista</label>
              <input type="date" value={formData.fechaPrevista || ''} onChange={e => setFormData({...formData, fechaPrevista: e.target.value})} className="w-full p-3 rounded-xl border-slate-200 text-sm font-bold text-slate-700 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-[14px] font-black text-slate-400 uppercase tracking-widest mb-1">Fecha Cierre</label>
              <input type="date" value={formData.fechaCierre || ''} onChange={e => setFormData({...formData, fechaCierre: e.target.value})} className="w-full p-3 rounded-xl border-slate-200 text-sm font-bold text-slate-700 focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <button onClick={() => { setIsAdding(false); setEditingId(null); setFormData({}); }} className="px-6 py-3 bg-white text-slate-500 rounded-xl font-black text-[15px] uppercase tracking-widest hover:bg-slate-100 transition-colors border border-slate-200">Cancelar</button>
            <button onClick={handleSave} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-[15px] uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">Guardar</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-100">
              <th className="p-4 text-[14px] font-black text-slate-400 uppercase tracking-widest">ID</th>
              <th className="p-4 text-[14px] font-black text-slate-400 uppercase tracking-widest">Sugerencia</th>
              <th className="p-4 text-[14px] font-black text-slate-400 uppercase tracking-widest">Recurso</th>
              <th className="p-4 text-[14px] font-black text-slate-400 uppercase tracking-widest">Creación</th>
              <th className="p-4 text-[14px] font-black text-slate-400 uppercase tracking-widest text-center">Aprobada</th>
              <th className="p-4 text-[14px] font-black text-slate-400 uppercase tracking-widest">Responsable</th>
              <th className="p-4 text-[14px] font-black text-slate-400 uppercase tracking-widest">Prevista</th>
              <th className="p-4 text-[14px] font-black text-slate-400 uppercase tracking-widest">Cierre</th>
              <th className="p-4 text-[14px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
              <th className="p-4 text-[14px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-400 font-bold text-sm">No hay sugerencias registradas</td>
              </tr>
            ) : (
              filteredItems.map(item => {
                const status = getStatus(item);
                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4 text-xs font-black text-indigo-600 whitespace-nowrap">#{item.idSugerencia}</td>
                    <td className="p-4 text-xs text-slate-600 max-w-[200px] truncate" title={item.sugerencia}>{item.sugerencia}</td>
                    <td className="p-4 text-xs font-bold text-slate-700 whitespace-nowrap">{item.recurso}</td>
                    <td className="p-4 text-xs font-bold text-slate-700 whitespace-nowrap">{new Date(item.fechaCreacion).toLocaleDateString()}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded-md text-[14px] font-black uppercase tracking-wider ${
                        item.aprobada === 'SI' ? 'bg-emerald-100 text-emerald-700' : 
                        item.aprobada === 'NO' ? 'bg-red-100 text-red-700' : 
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {item.aprobada}
                      </span>
                    </td>
                    <td className="p-4 text-xs font-bold text-slate-700 whitespace-nowrap">{item.responsable}</td>
                    <td className="p-4 text-xs font-bold text-slate-700 whitespace-nowrap">{new Date(item.fechaPrevista).toLocaleDateString()}</td>
                    <td className="p-4 text-xs font-bold text-slate-700 whitespace-nowrap">{item.fechaCierre ? new Date(item.fechaCierre).toLocaleDateString() : '-'}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-md text-[14px] font-black uppercase tracking-wider whitespace-nowrap ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      {isAdminMode && (
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingId(item.id); setFormData(item); setIsAdding(false); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default IdMActionPlan;
