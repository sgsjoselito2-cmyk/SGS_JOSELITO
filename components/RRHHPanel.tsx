import React, { useState, useEffect } from 'react';
import { supabase, isConfigured } from '../lib/supabase';

interface RRHHRecord {
  id: string;
  fecha: string;
  totalMod: number;
  totalMoi: number;
  modBaja: number;
  moiBaja: number;
  ettBaja: number;
}

interface AusentismoRecord {
  id: string;
  fecha: string;
  mod: number;
  moi: number;
  jornadasPerdidasMod: number;
  jornadasPerdidasMoi: number;
}

import { User } from '../types';

interface RRHHPanelProps {
  operarios?: User[];
  passwords?: {
    jefeEquipo: string;
    jefeTaller: string;
    directorOperaciones: string;
    asistenciaTecnica: string;
  };
}

const RRHHPanel: React.FC<RRHHPanelProps> = ({ operarios = [], passwords }) => {
  const [activeTab, setActiveTab] = useState<'personal' | 'ausentismo'>('personal');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  
  const [records, setRecords] = useState<RRHHRecord[]>([]);
  const [ausentismoRecords, setAusentismoRecords] = useState<AusentismoRecord[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasPendingSync, setHasPendingSync] = useState(false);

  useEffect(() => {
    if (pin.length === 4 && passwords) {
      let isCorrect = false;
      
      // Determinar nivel requerido (RRHH TOP 60 -> Nivel 3)
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
        const msg = "Hay cambios en RRHH pendientes de sincronizar.";
        e.returnValue = msg;
        return msg;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasPendingSync]);

  useEffect(() => {
    if (isOnline && hasPendingSync) {
      syncAll();
    }
  }, [isOnline, hasPendingSync]);

  const syncAll = async () => {
    if (!isConfigured || !isOnline) return;
    try {
      // Sync RRHH
      await supabase.from('top60_rrhh').delete().neq('id', '0');
      if (records.length > 0) await supabase.from('top60_rrhh').insert(records);
      
      // Sync Ausentismo
      await supabase.from('top60_ausentismo').delete().neq('id', '0');
      if (ausentismoRecords.length > 0) await supabase.from('top60_ausentismo').insert(ausentismoRecords);
      
      setHasPendingSync(false);
    } catch (e) {
      console.error("Sync error in RRHHPanel:", e);
    }
  };
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<RRHHRecord>>({});

  const [isAddingAusentismo, setIsAddingAusentismo] = useState(false);
  const [editingAusentismoId, setEditingAusentismoId] = useState<string | null>(null);
  const [ausentismoFormData, setAusentismoFormData] = useState<Partial<AusentismoRecord>>({});

  useEffect(() => {
    loadRecords();
    loadAusentismoRecords();
  }, []);

  const loadRecords = async () => {
    if (!isConfigured) {
      const saved = localStorage.getItem('zitron_top60_rrhh');
      if (saved) setRecords(JSON.parse(saved));
      return;
    }
    try {
      const { data, error } = await supabase
        .from('top60_rrhh')
        .select('*')
        .order('fecha', { ascending: false });

      if (error) throw error;
      if (data) setRecords(data);
    } catch (error) {
      console.error('Error loading rrhh records:', error);
      const saved = localStorage.getItem('zitron_top60_rrhh');
      if (saved) setRecords(JSON.parse(saved));
    }
  };

  const loadAusentismoRecords = async () => {
    if (!isConfigured) {
      const saved = localStorage.getItem('zitron_top60_ausentismo');
      if (saved) setAusentismoRecords(JSON.parse(saved));
      return;
    }
    try {
      const { data, error } = await supabase
        .from('top60_ausentismo')
        .select('*')
        .order('fecha', { ascending: false });

      if (error) throw error;
      if (data) setAusentismoRecords(data);
    } catch (error) {
      console.error('Error loading ausentismo records:', error);
      const saved = localStorage.getItem('zitron_top60_ausentismo');
      if (saved) setAusentismoRecords(JSON.parse(saved));
    }
  };

  const handleSave = async () => {
    if (!formData.fecha || formData.totalMod === undefined || formData.totalMoi === undefined || formData.modBaja === undefined || formData.moiBaja === undefined || formData.ettBaja === undefined) {
      alert('Por favor, rellena todos los campos obligatorios.');
      return;
    }

    let newRecords;
    if (editingId) {
      const updatedRecord = { ...records.find(r => String(r.id) === String(editingId)), ...formData } as RRHHRecord;
      newRecords = records.map(r => String(r.id) === String(editingId) ? updatedRecord : r);
      newRecords.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      setRecords(newRecords);
      try {
        localStorage.setItem('zitron_top60_rrhh', JSON.stringify(newRecords));
      } catch (e) {
        console.error("Error saving to localStorage:", e);
      }
      if (isConfigured) {
        if (isOnline) {
          await supabase.from('top60_rrhh').update(updatedRecord).eq('id', editingId);
        } else {
          setHasPendingSync(true);
        }
      }
    } else {
      const newRecord = { ...formData, id: Date.now().toString() } as RRHHRecord;
      newRecords = [newRecord, ...records];
      newRecords.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      setRecords(newRecords);
      try {
        localStorage.setItem('zitron_top60_rrhh', JSON.stringify(newRecords));
      } catch (e) {
        console.error("Error saving to localStorage:", e);
      }
      if (isConfigured) {
        if (isOnline) {
          await supabase.from('top60_rrhh').insert([newRecord]);
        } else {
          setHasPendingSync(true);
        }
      }
    }

    setIsAdding(false);
    setEditingId(null);
    setFormData({});
  };

  const handleSaveAusentismo = async () => {
    if (!ausentismoFormData.fecha || ausentismoFormData.mod === undefined || ausentismoFormData.moi === undefined || ausentismoFormData.jornadasPerdidasMod === undefined || ausentismoFormData.jornadasPerdidasMoi === undefined) {
      alert('Por favor, rellena todos los campos obligatorios.');
      return;
    }

    let newRecords;
    if (editingAusentismoId) {
      const updatedRecord = { ...ausentismoRecords.find(r => String(r.id) === String(editingAusentismoId)), ...ausentismoFormData } as AusentismoRecord;
      newRecords = ausentismoRecords.map(r => String(r.id) === String(editingAusentismoId) ? updatedRecord : r);
      newRecords.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      setAusentismoRecords(newRecords);
      try {
        localStorage.setItem('zitron_top60_ausentismo', JSON.stringify(newRecords));
      } catch (e) {
        console.error("Error saving to localStorage:", e);
      }
      if (isConfigured) {
        if (isOnline) {
          await supabase.from('top60_ausentismo').update(updatedRecord).eq('id', editingAusentismoId);
        } else {
          setHasPendingSync(true);
        }
      }
    } else {
      const newRecord = { ...ausentismoFormData, id: Date.now().toString() } as AusentismoRecord;
      newRecords = [newRecord, ...ausentismoRecords];
      newRecords.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      setAusentismoRecords(newRecords);
      try {
        localStorage.setItem('zitron_top60_ausentismo', JSON.stringify(newRecords));
      } catch (e) {
        console.error("Error saving to localStorage:", e);
      }
      if (isConfigured) {
        if (isOnline) {
          await supabase.from('top60_ausentismo').insert([newRecord]);
        } else {
          setHasPendingSync(true);
        }
      }
    }

    setIsAddingAusentismo(false);
    setEditingAusentismoId(null);
    setAusentismoFormData({});
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este registro?')) {
      const newRecords = records.filter(r => String(r.id) !== String(id));
      setRecords(newRecords);
      try {
        localStorage.setItem('zitron_top60_rrhh', JSON.stringify(newRecords));
      } catch (e) {
        console.error("Error saving to localStorage:", e);
      }
      if (isConfigured) {
        if (isOnline) {
          await supabase.from('top60_rrhh').delete().eq('id', id);
        } else {
          setHasPendingSync(true);
        }
      }
    }
  };

  const handleDeleteAusentismo = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este registro?')) {
      const newRecords = ausentismoRecords.filter(r => String(r.id) !== String(id));
      setAusentismoRecords(newRecords);
      try {
        localStorage.setItem('zitron_top60_ausentismo', JSON.stringify(newRecords));
      } catch (e) {
        console.error("Error saving to localStorage:", e);
      }
      if (isConfigured) {
        if (isOnline) {
          await supabase.from('top60_ausentismo').delete().eq('id', id);
        } else {
          setHasPendingSync(true);
        }
      }
    }
  };

  return (
    <div className="w-full text-left space-y-6">
      {/* MODAL PIN */}
      {showPassModal && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl overflow-hidden border-8 border-slate-800">
            <div className="bg-slate-900 p-8 text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>
              </div>
              <h3 className="text-white font-black text-xs uppercase tracking-widest">Acceso Edición RRHH</h3>
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

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h3 className="text-2xl font-black text-slate-800 uppercase tracking-widest">Recursos Humanos</h3>
          <p className="text-slate-400 font-black text-[14px] uppercase tracking-[0.2em]">
            {isAdminMode ? '🔓 MODO EDICIÓN ACTIVO' : '🔒 MODO CONSULTA'}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            type="button"
            onClick={() => isAdminMode ? setIsAdminMode(false) : setShowPassModal(true)} 
            className={`px-6 py-3 rounded-xl text-[14px] font-black uppercase tracking-widest border-2 transition-all active:scale-95 ${isAdminMode ? 'bg-red-500 border-red-400 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-white shadow-xl'}`}
          >
            {isAdminMode ? 'BLOQUEAR' : 'EDITAR'}
          </button>

          {isAdminMode && activeTab === 'personal' && !isAdding && (
            <button
              onClick={() => { setIsAdding(true); setFormData({ totalMod: 0, totalMoi: 0, modBaja: 0, moiBaja: 0, ettBaja: 0 }); }}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-[15px] uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
              Nuevo Registro
            </button>
          )}
          {isAdminMode && activeTab === 'ausentismo' && !isAddingAusentismo && (
            <button
              onClick={() => { setIsAddingAusentismo(true); setAusentismoFormData({ mod: 0, moi: 0, jornadasPerdidasMod: 0, jornadasPerdidasMoi: 0 }); }}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-[15px] uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
              Nuevo Registro
            </button>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-2 border-b border-slate-200 pb-px">
        <button 
          onClick={() => setActiveTab('personal')}
          className={`px-6 py-3 text-[15px] font-black uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'personal' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          Absentismo
        </button>
        <button 
          onClick={() => setActiveTab('ausentismo')}
          className={`px-6 py-3 text-[15px] font-black uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'ausentismo' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          Ausentismo
        </button>
      </div>

      {/* SECCIÓN 1: GESTIÓN DE ABSENTISMO */}
      {activeTab === 'personal' && (
        <div className="animate-in fade-in duration-300">
          {(isAdding || editingId) && (
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div>
                  <label className="block text-[14px] font-black text-slate-400 uppercase tracking-widest mb-1">Fecha</label>
                  <input type="date" value={formData.fecha || ''} onChange={e => setFormData({...formData, fecha: e.target.value})} className="w-full p-3 rounded-xl border-slate-200 text-sm font-bold text-slate-700 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[14px] font-black text-slate-400 uppercase tracking-widest mb-1">Total MOD</label>
                  <input type="number" min="0" value={formData.totalMod ?? ''} onChange={e => setFormData({...formData, totalMod: parseInt(e.target.value) || 0})} className="w-full p-3 rounded-xl border-slate-200 text-sm font-bold text-slate-700 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[14px] font-black text-slate-400 uppercase tracking-widest mb-1">Total MOI</label>
                  <input type="number" min="0" value={formData.totalMoi ?? ''} onChange={e => setFormData({...formData, totalMoi: parseInt(e.target.value) || 0})} className="w-full p-3 rounded-xl border-slate-200 text-sm font-bold text-slate-700 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[14px] font-black text-slate-400 uppercase tracking-widest mb-1">MOD Baja</label>
                  <input type="number" min="0" value={formData.modBaja ?? ''} onChange={e => setFormData({...formData, modBaja: parseInt(e.target.value) || 0})} className="w-full p-3 rounded-xl border-slate-200 text-sm font-bold text-slate-700 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[14px] font-black text-slate-400 uppercase tracking-widest mb-1">MOI Baja</label>
                  <input type="number" min="0" value={formData.moiBaja ?? ''} onChange={e => setFormData({...formData, moiBaja: parseInt(e.target.value) || 0})} className="w-full p-3 rounded-xl border-slate-200 text-sm font-bold text-slate-700 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[14px] font-black text-slate-400 uppercase tracking-widest mb-1">ETT Baja</label>
                  <input type="number" min="0" value={formData.ettBaja ?? ''} onChange={e => setFormData({...formData, ettBaja: parseInt(e.target.value) || 0})} className="w-full p-3 rounded-xl border-slate-200 text-sm font-bold text-slate-700 focus:ring-blue-500 focus:border-blue-500" />
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
                  <th className="p-4 text-[14px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                  <th className="p-4 text-[14px] font-black text-slate-400 uppercase tracking-widest text-center">Total MOD</th>
                  <th className="p-4 text-[14px] font-black text-slate-400 uppercase tracking-widest text-center">Total MOI</th>
                  <th className="p-4 text-[14px] font-black text-slate-400 uppercase tracking-widest text-center">MOD Baja</th>
                  <th className="p-4 text-[14px] font-black text-slate-400 uppercase tracking-widest text-center">MOI Baja</th>
                  <th className="p-4 text-[14px] font-black text-slate-400 uppercase tracking-widest text-center">ETT Baja</th>
                  <th className="p-4 text-[14px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 font-bold text-sm">No hay registros de absentismo</td>
                  </tr>
                ) : (
                  records.map(record => (
                    <tr key={record.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4 text-sm font-bold text-slate-700 whitespace-nowrap">{new Date(record.fecha).toLocaleDateString()}</td>
                      <td className="p-4 text-sm font-bold text-slate-700 text-center">{record.totalMod}</td>
                      <td className="p-4 text-sm font-bold text-slate-700 text-center">{record.totalMoi}</td>
                      <td className="p-4 text-sm font-bold text-red-600 text-center">{record.modBaja}</td>
                      <td className="p-4 text-sm font-bold text-red-600 text-center">{record.moiBaja}</td>
                      <td className="p-4 text-sm font-bold text-red-600 text-center">{record.ettBaja}</td>
                      <td className="p-4 text-right whitespace-nowrap">
                        {isAdminMode && (
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingId(record.id); setFormData(record); setIsAdding(false); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                            </button>
                            <button onClick={() => handleDelete(record.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECCIÓN 2: AUSENTISMO */}
      {activeTab === 'ausentismo' && (
        <div className="animate-in fade-in duration-300">
          {(isAddingAusentismo || editingAusentismoId) && (
            <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 mb-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-[14px] font-black text-indigo-400 uppercase tracking-widest mb-1">Fecha</label>
                  <input type="date" value={ausentismoFormData.fecha || ''} onChange={e => setAusentismoFormData({...ausentismoFormData, fecha: e.target.value})} className="w-full p-3 rounded-xl border-indigo-200 text-sm font-bold text-slate-700 focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-[14px] font-black text-indigo-400 uppercase tracking-widest mb-1">MOD</label>
                  <input type="number" min="0" value={ausentismoFormData.mod ?? ''} onChange={e => setAusentismoFormData({...ausentismoFormData, mod: parseInt(e.target.value) || 0})} className="w-full p-3 rounded-xl border-indigo-200 text-sm font-bold text-slate-700 focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-[14px] font-black text-indigo-400 uppercase tracking-widest mb-1">MOI</label>
                  <input type="number" min="0" value={ausentismoFormData.moi ?? ''} onChange={e => setAusentismoFormData({...ausentismoFormData, moi: parseInt(e.target.value) || 0})} className="w-full p-3 rounded-xl border-indigo-200 text-sm font-bold text-slate-700 focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-[14px] font-black text-indigo-400 uppercase tracking-widest mb-1">Jornadas Perdidas MOD</label>
                  <input type="number" min="0" value={ausentismoFormData.jornadasPerdidasMod ?? ''} onChange={e => setAusentismoFormData({...ausentismoFormData, jornadasPerdidasMod: parseInt(e.target.value) || 0})} className="w-full p-3 rounded-xl border-indigo-200 text-sm font-bold text-slate-700 focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-[14px] font-black text-indigo-400 uppercase tracking-widest mb-1">Jornadas Perdidas MOI</label>
                  <input type="number" min="0" value={ausentismoFormData.jornadasPerdidasMoi ?? ''} onChange={e => setAusentismoFormData({...ausentismoFormData, jornadasPerdidasMoi: parseInt(e.target.value) || 0})} className="w-full p-3 rounded-xl border-indigo-200 text-sm font-bold text-slate-700 focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-indigo-100">
                <button onClick={() => { setIsAddingAusentismo(false); setEditingAusentismoId(null); setAusentismoFormData({}); }} className="px-6 py-3 bg-white text-slate-500 rounded-xl font-black text-[15px] uppercase tracking-widest hover:bg-slate-100 transition-colors border border-slate-200">Cancelar</button>
                <button onClick={handleSaveAusentismo} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-[15px] uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">Guardar</button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-100">
                  <th className="p-4 text-[14px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                  <th className="p-4 text-[14px] font-black text-slate-400 uppercase tracking-widest text-center">MOD</th>
                  <th className="p-4 text-[14px] font-black text-slate-400 uppercase tracking-widest text-center">MOI</th>
                  <th className="p-4 text-[14px] font-black text-slate-400 uppercase tracking-widest text-center">Jornadas Perdidas MOD</th>
                  <th className="p-4 text-[14px] font-black text-slate-400 uppercase tracking-widest text-center">Jornadas Perdidas MOI</th>
                  <th className="p-4 text-[14px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ausentismoRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 font-bold text-sm">No hay registros de ausentismo</td>
                  </tr>
                ) : (
                  ausentismoRecords.map(record => (
                    <tr key={record.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4 text-sm font-bold text-slate-700 whitespace-nowrap">{new Date(record.fecha).toLocaleDateString()}</td>
                      <td className="p-4 text-sm font-bold text-slate-700 text-center">{record.mod}</td>
                      <td className="p-4 text-sm font-bold text-slate-700 text-center">{record.moi}</td>
                      <td className="p-4 text-sm font-bold text-red-600 text-center">{record.jornadasPerdidasMod}</td>
                      <td className="p-4 text-sm font-bold text-red-600 text-center">{record.jornadasPerdidasMoi}</td>
                      <td className="p-4 text-right whitespace-nowrap">
                        {isAdminMode && (
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingAusentismoId(record.id); setAusentismoFormData(record); setIsAddingAusentismo(false); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                            </button>
                            <button onClick={() => handleDeleteAusentismo(record.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default RRHHPanel;
