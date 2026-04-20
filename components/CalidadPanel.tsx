import React, { useState, useEffect, useRef } from 'react';
import { supabase, isConfigured } from '../lib/supabase';

interface CalidadRecord {
  id: string;
  semana: number;
  anio: number;
  imagenes: string[]; // base64 strings
  fechaCreacion: string;
}

interface CalidadPanelProps {
  passwords?: {
    jefeEquipo: string;
    jefeTaller: string;
    directorOperaciones: string;
    asistenciaTecnica: string;
  };
}

const CalidadPanel: React.FC<CalidadPanelProps> = ({ passwords }) => {
  const [records, setRecords] = useState<CalidadRecord[]>([]);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Partial<CalidadRecord>>({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasPendingSync, setHasPendingSync] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pin.length === 4 && passwords) {
      let isCorrect = false;
      
      // Determinar nivel requerido (Calidad TOP 60 -> Nivel 3)
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
        const msg = "Hay cambios en Calidad pendientes de sincronizar.";
        e.returnValue = msg;
        return msg;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasPendingSync]);

  useEffect(() => {
    if (isOnline && hasPendingSync && records.length > 0) {
      syncRecords(records);
    }
  }, [isOnline, hasPendingSync]);

  const syncRecords = async (newRecords: CalidadRecord[]) => {
    if (!isConfigured || !isOnline) return;
    try {
      await supabase.from('top60_calidad').delete().neq('id', '0');
      if (newRecords.length > 0) {
        await supabase.from('top60_calidad').insert(newRecords);
      }
      setHasPendingSync(false);
    } catch (e) {
      console.error("Sync error in CalidadPanel:", e);
      setHasPendingSync(true);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    if (!isConfigured) {
      const saved = localStorage.getItem('zitron_top60_calidad');
      if (saved) setRecords(JSON.parse(saved));
      return;
    }
    try {
      const { data, error } = await supabase
        .from('top60_calidad')
        .select('*')
        .order('anio', { ascending: false })
        .order('semana', { ascending: false });

      if (error) throw error;
      if (data) setRecords(data);
    } catch (error) {
      console.error('Error loading calidad records:', error);
      const saved = localStorage.getItem('zitron_top60_calidad');
      if (saved) setRecords(JSON.parse(saved));
    }
  };

  const handleSave = async () => {
    if (!formData.semana || !formData.anio) {
      alert('Por favor, introduce la semana y el año.');
      return;
    }

    const newRecord: CalidadRecord = {
      id: Date.now().toString(),
      semana: formData.semana,
      anio: formData.anio,
      imagenes: formData.imagenes || [],
      fechaCreacion: new Date().toISOString()
    };

    const newRecords = [newRecord, ...records];
    setRecords(newRecords);
    
    try {
      localStorage.setItem('zitron_top60_calidad', JSON.stringify(newRecords));
    } catch (e) {
      console.error('LocalStorage quota exceeded', e);
      alert('No hay suficiente espacio local para guardar la imagen. Intenta con una imagen más pequeña.');
      return;
    }

    if (isConfigured) {
      if (isOnline) {
        try {
          await supabase.from('top60_calidad').insert([newRecord]);
        } catch (error) {
          console.error('Error saving calidad records:', error);
          setHasPendingSync(true);
        }
      } else {
        setHasPendingSync(true);
      }
    }

    setIsAdding(false);
    setFormData({});
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este registro?')) {
      const newRecords = records.filter(r => String(r.id) !== String(id));
      setRecords(newRecords);
      localStorage.setItem('zitron_top60_calidad', JSON.stringify(newRecords));
      
      if (isConfigured) {
        if (isOnline) {
          try {
            await supabase.from('top60_calidad').delete().eq('id', id);
          } catch (error) {
            console.error('Error deleting calidad record:', error);
            setHasPendingSync(true);
          }
        } else {
          setHasPendingSync(true);
        }
      }
    }
  };

  const processImage = (file: File) => {
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 1024;
          const MAX_HEIGHT = 1024;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newImages = [...(formData.imagenes || [])];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        if (file.type.startsWith('image/')) {
          const base64 = await processImage(file);
          newImages.push(base64);
        }
      }
      setFormData({ ...formData, imagenes: newImages });
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const newImages = [...(formData.imagenes || [])];
    let added = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const base64 = await processImage(file);
          newImages.push(base64);
          added = true;
        }
      }
    }
    if (added) {
      setFormData({ ...formData, imagenes: newImages });
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...(formData.imagenes || [])];
    newImages.splice(index, 1);
    setFormData({ ...formData, imagenes: newImages });
  };

  const getWeekNumber = (d: Date) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    var weekNo = Math.ceil(( ( (d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
    return weekNo;
  };

  const startAdding = () => {
    const now = new Date();
    setIsAdding(true);
    setFormData({
      semana: getWeekNumber(now),
      anio: now.getFullYear(),
      imagenes: []
    });
  };

  return (
    <div className="w-full text-left">
      {/* MODAL PIN */}
      {showPassModal && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl overflow-hidden border-8 border-slate-800">
            <div className="bg-slate-900 p-8 text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>
              </div>
              <h3 className="text-white font-black text-xs uppercase tracking-widest">Acceso Edición Calidad</h3>
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

      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-2xl font-black text-slate-800 uppercase tracking-widest">Calidad</h3>
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

          {isAdminMode && !isAdding && (
            <button
              onClick={startAdding}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-[15px] uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
              Nuevo Registro
            </button>
          )}
        </div>
      </div>

      {isAdding && (
        <div 
          className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-8 space-y-6"
          onPaste={handlePaste}
        >
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span className="text-xs font-bold text-slate-500">Puedes pegar imágenes directamente aquí (Ctrl+V)</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[14px] font-black text-slate-400 uppercase tracking-widest mb-1">Semana</label>
              <input type="number" min="1" max="53" value={formData.semana || ''} onChange={e => setFormData({...formData, semana: parseInt(e.target.value)})} className="w-full p-3 rounded-xl border-slate-200 text-sm font-bold text-slate-700 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-[14px] font-black text-slate-400 uppercase tracking-widest mb-1">Año</label>
              <input type="number" min="2000" max="2100" value={formData.anio || ''} onChange={e => setFormData({...formData, anio: parseInt(e.target.value)})} className="w-full p-3 rounded-xl border-slate-200 text-sm font-bold text-slate-700 focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-[14px] font-black text-slate-400 uppercase tracking-widest mb-2">Imágenes</label>
            <div className="flex flex-wrap gap-4 mb-4">
              {formData.imagenes?.map((img, idx) => (
                <div key={idx} className="relative group rounded-xl overflow-hidden border-2 border-slate-200 w-32 h-32 bg-slate-100 flex items-center justify-center">
                  {img ? (
                    <img src={img} alt={`Preview ${idx}`} className="max-w-full max-h-full object-contain" />
                  ) : null}
                  <button 
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-32 h-32 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:text-blue-500 hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                <span className="text-[14px] font-black uppercase tracking-widest">Añadir</span>
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                accept="image/*" 
                multiple 
                className="hidden" 
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <button onClick={() => { setIsAdding(false); setFormData({}); }} className="px-6 py-3 bg-white text-slate-500 rounded-xl font-black text-[15px] uppercase tracking-widest hover:bg-slate-100 transition-colors border border-slate-200">Cancelar</button>
            <button onClick={handleSave} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-[15px] uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">Guardar</button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {records.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-bold text-sm bg-slate-50 rounded-2xl border border-slate-100">
            No hay registros de calidad
          </div>
        ) : (
          records.map(record => (
            <div key={record.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative group">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="text-lg font-black text-slate-800 uppercase tracking-widest">Semana {record.semana} - {record.anio}</h4>
                  <p className="text-xs text-slate-400 font-bold">Registrado el {new Date(record.fechaCreacion).toLocaleDateString()}</p>
                </div>
                {isAdminMode && (
                  <button 
                    onClick={() => handleDelete(record.id)} 
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100" 
                    title="Eliminar"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                )}
              </div>
              
              {record.imagenes && record.imagenes.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {record.imagenes.map((img, idx) => (
                    <div key={idx} className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 aspect-square flex items-center justify-center cursor-pointer hover:border-blue-400 transition-colors" onClick={() => window.open(img, '_blank')}>
                      {img ? (
                        <img src={img} alt={`Calidad Sem ${record.semana} - ${idx}`} className="max-w-full max-h-full object-contain" />
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic">Sin imágenes adjuntas</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CalidadPanel;
