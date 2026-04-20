import React, { useState, useEffect, useMemo } from 'react';
import { Activity, TaskType, User } from '../types';
import { calcDuration, cleanText, normalizeDate } from '../src/utils';
import { 
  Lock, 
  Check, 
  X, 
  Filter, 
  Trash2, 
  Edit2, 
  Database,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Upload,
  Download
} from 'lucide-react';
import Papa from 'papaparse';

interface DatabasePanelProps {
  activities: Activity[];
  history: Activity[];
  mermas?: any[];
  onUpdateActivity: (activity: Activity) => void;
  onDeleteActivity: (id: string, isHistory: boolean) => void;
  onDeleteAllHistory?: () => void;
  onImportHistory: (data: Activity[]) => void;
  onAddActivity?: (activity: Activity) => void;
  onResetMasterSpeeds?: () => void;
  selectedArea?: string;
  passwords?: {
    jefeEquipo: string;
    jefeTaller: string;
    directorOperaciones: string;
    asistenciaTecnica: string;
  };
  operarios: User[];
}

const DatabasePanel: React.FC<DatabasePanelProps> = ({
  activities,
  history,
  onUpdateActivity,
  onDeleteActivity,
  onDeleteAllHistory,
  onImportHistory,
  onAddActivity,
  onResetMasterSpeeds,
  selectedArea,
  passwords,
  operarios,
  mermas = []
}) => {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{current: number, total: number} | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newActivity, setNewActivity] = useState<Partial<Activity>>({
    fecha: new Date().toISOString().split('T')[0],
    operarios: [],
    formato: '',
    tipoTarea: TaskType.PRODUCCION,
    horaInicio: '08:00',
    horaFin: '09:00',
    cantidad: 0,
    cantidadNok: 0,
    comentarios: ''
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Activity>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{id: string, isHistory: boolean} | null>(null);
  const [actionConfirm, setActionConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning';
  } | null>(null);

  // Filtros
  const [filterDate, setFilterDate] = useState('');
  const [filterTask, setFilterTask] = useState('');
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    if (pin.length === 4 && passwords) {
      let isCorrect = false;
      
      // Determinar nivel requerido (Histórico es TOP 5 -> Nivel 1)
      let requiredLevel = 1;
      
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

  const allRecords = useMemo(() => {
    let combined = [
      ...activities.map(a => ({ ...a, isHistory: false })),
      ...history.map(h => ({ ...h, isHistory: true }))
    ];

    // Deduplicar por ID y estado de historia para evitar errores de React keys
    const seen = new Set();
    combined = combined.filter(r => {
      const key = `${r.isHistory ? 'h' : 'a'}-${r.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Aplicar filtros
    if (filterDate) {
      combined = combined.filter(r => r.fecha === filterDate);
    }
    if (filterTask) {
      combined = combined.filter(r => r.formato?.toLowerCase().includes(filterTask.toLowerCase()));
    }
    if (filterType) {
      combined = combined.filter(r => r.tipoTarea === filterType);
    }

    return combined.sort((a, b) => {
      const dateA = a.fecha || '';
      const dateB = b.fecha || '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return (b.horaInicio || '').localeCompare(a.horaInicio || '');
    });
  }, [activities, history, filterDate, filterTask, filterType]);

  const handleExportCSV = () => {
    const csv = Papa.unparse(allRecords.map(r => ({
      Fecha: r.fecha,
      Operarios: r.operarios?.join(', '),
      Tarea: r.tipoTarea,
      Formato: r.formato,
      Inicio: r.horaInicio,
      Fin: r.horaFin,
      'T. Real (min)': r.duracionMin,
      'T. Teo (min)': r.tipoTarea === TaskType.PRODUCCION && r.tiempoTeoricoManual !== undefined ? (r.tiempoTeoricoManual * (selectedArea === 'corte-laser' ? 1 : r.cantidad)).toFixed(1) : '-',
      Cantidad: r.cantidad,
      Comentarios: r.comentarios
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `registros_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  const handleEdit = (record: Activity & { isHistory: boolean }) => {
    setEditingId(record.id);
    setEditForm(record);
  };

  const handleSave = () => {
    if (editingId && editForm) {
      const updatedRecord = { ...editForm };
      if (updatedRecord.horaInicio && updatedRecord.horaFin) {
        updatedRecord.duracionMin = calcDuration(updatedRecord.horaInicio, updatedRecord.horaFin);
      }
      onUpdateActivity(updatedRecord as Activity);
      setEditingId(null);
      setEditForm({});
    }
  };

  const handleDelete = (id: string, isHistory: boolean) => {
    setDeleteConfirm({ id, isHistory });
  };

  const handleSaveAdd = () => {
    if (onAddActivity && newActivity.fecha && newActivity.horaInicio) {
      const duracion = calcDuration(newActivity.horaInicio, newActivity.horaFin || "");
      const activityToAdd: Activity = {
        id: `manual-${Date.now()}`,
        fecha: newActivity.fecha,
        operarios: newActivity.operarios || [],
        formato: newActivity.formato || '',
        tipoTarea: newActivity.tipoTarea as TaskType || TaskType.PRODUCCION,
        horaInicio: newActivity.horaInicio,
        horaFin: newActivity.horaFin || '',
        duracionMin: duracion,
        cantidad: Number(newActivity.cantidad) || 0,
        comentarios: newActivity.comentarios || '',
        area: selectedArea || 'manual'
      };
      onAddActivity(activityToAdd);
      setShowAddModal(false);
      setNewActivity({
        fecha: new Date().toISOString().split('T')[0],
        operarios: [],
        formato: '',
        tipoTarea: TaskType.PRODUCCION,
        horaInicio: '08:00',
        horaFin: '09:00',
        cantidad: 0,
        comentarios: ''
      });
    }
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      onDeleteActivity(deleteConfirm.id, deleteConfirm.isHistory);
      if (editingId === deleteConfirm.id) setEditingId(null);
      setDeleteConfirm(null);
    }
  };

  const handleFixDates = () => {
    setActionConfirm({
      title: "¿Corregir Fechas?",
      message: "¿Deseas intentar corregir automáticamente las fechas y limpiar TODOS los errores de texto (Mañana, operarios, etc.)?",
      type: 'warning',
      onConfirm: () => {
        const today = new Date().toISOString().split('T')[0];
        
        const fixedHistory = history.map(act => {
          let updated = { ...act };
          
          // Corregir fecha
          if (updated.fecha) {
            let normalized = normalizeDate(updated.fecha);
            
            // Si la fecha es posterior a hoy, intentamos intercambiar día y mes
            if (normalized > today) {
              const parts = normalized.split('-');
              if (parts.length === 3) {
                const y = parts[0];
                const m = parts[1];
                const d = parts[2];
                // Solo intercambiamos si el nuevo mes es válido (<= 12)
                if (parseInt(d, 10) <= 12) {
                  normalized = `${y}-${d}-${m}`;
                }
              }
            }
            updated.fecha = normalized;
          }

          // Limpiar todos los campos de texto
          updated.operarios = Array.isArray(updated.operarios) ? updated.operarios.map(cleanText) : [cleanText(updated.operarios)];
          updated.formato = cleanText(updated.formato);
          updated.comentarios = cleanText(updated.comentarios);
          
          return updated;
        });

        const changedCount = fixedHistory.filter((act, i) => 
          JSON.stringify(act) !== JSON.stringify(history[i])
        ).length;
        
        if (changedCount > 0) {
          onImportHistory(fixedHistory);
          // alert replaced by nothing or a toast if available, but for now let's just do it
        }
      }
    });
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const importedData: Activity[] = [];
        const now = new Date().toISOString();
        const today = now.split('T')[0];
        let skippedCount = 0;
        
        const data = results.data;
        const totalRows = data.length;
        setImportProgress({ current: 0, total: totalRows });
        
        // Mapeo de cabeceras comunes y posibles errores tipográficos
        const headerMap: Record<string, string> = {
          'horalInicio': 'horaInicio',
          'horainicio': 'horaInicio',
          'horafin': 'horaFin',
          'duracionmin': 'duracionMin',
          'tiempoteoric': 'tiempoTeoricoManual',
          'tiempoteorico': 'tiempoTeoricoManual',
          'tiempoteoricomanual': 'tiempoTeoricoManual',
          'afectacalidad': 'afectaCalidad'
        };

        const processChunk = (startIndex: number) => {
          const chunkSize = 500; // Chunk más pequeño para mayor fluidez
          const endIndex = Math.min(startIndex + chunkSize, totalRows);
          
          for (let i = startIndex; i < endIndex; i++) {
            const row: any = data[i];
            try {
              // Normalizar cabeceras de la fila
              const normalizedRow: any = {};
              Object.keys(row).forEach(key => {
                const trimmedKey = key.trim();
                const normalizedKey = headerMap[trimmedKey.toLowerCase()] || trimmedKey;
                normalizedRow[normalizedKey] = row[key];
              });

              // Validar campos mínimos usando cabeceras normalizadas
              if (!normalizedRow.operarios || !normalizedRow.formato || !normalizedRow.horaInicio || !normalizedRow.horaFin) {
                skippedCount++;
                continue;
              }

              const cleanRow: any = {};
              Object.keys(normalizedRow).forEach(key => {
                const val = normalizedRow[key];
                cleanRow[key] = (val === "" || val === undefined || val === null) ? null : cleanText(val);
              });

              // Normalizar formato de fecha a yyyy-mm-dd
              const formattedDate = normalizeDate(cleanRow.fecha || today);
              
              const activity: any = {
                ...cleanRow,
                id: cleanRow.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
                fecha: formattedDate,
                area: cleanRow.area || selectedArea,
                created_at: now,
                horaFin: cleanRow.horaFin,
                cantidad: cleanRow.cantidad !== null ? parseFloat(String(cleanRow.cantidad).replace(',', '.')) : null,
                duracionMin: cleanRow.duracionMin !== null ? parseFloat(String(cleanRow.duracionMin).replace(',', '.')) : null,
                tiempoTeoricoManual: cleanRow.tiempoTeoricoManual !== null ? parseFloat(String(cleanRow.tiempoTeoricoManual).replace(',', '.')) : null,
                afectaCalidad: String(cleanRow.afectaCalidad).toLowerCase() === 'true' || cleanRow.afectaCalidad === true || String(cleanRow.afectaCalidad).toLowerCase() === '1',
              };
              
              // Eliminar NaN si la conversión falló
              Object.keys(activity).forEach(key => {
                if (typeof activity[key] === 'number' && isNaN(activity[key])) {
                  activity[key] = null;
                }
              });

              importedData.push(activity);
            } catch (err) {
              console.warn("Error parsing row, skipping:", row, err);
            }
          }
          
          setImportProgress({ current: endIndex, total: totalRows });

          if (endIndex < totalRows) {
            setTimeout(() => processChunk(endIndex), 5);
          } else {
            // Finalizar
            if (importedData.length > 0) {
              onImportHistory(importedData);
              setTimeout(() => {
                alert(`Importación finalizada:\n- ${importedData.length} registros cargados correctamente.\n- ${skippedCount} filas saltadas por datos incompletos.`);
                setIsImporting(false);
                setImportProgress(null);
              }, 100);
            } else {
              alert(`No se han podido importar datos. Se han saltado ${skippedCount} filas por falta de campos obligatorios (operarios, formato, inicio, fin).`);
              setIsImporting(false);
              setImportProgress(null);
            }
            e.target.value = '';
          }
        };
        
        processChunk(0);
      },
      error: (error) => {
        console.error("CSV Parse Error:", error);
        alert("Error al procesar el archivo CSV.");
        setIsImporting(false);
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-24">
      {/* MODAL PIN */}
      {showPassModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-[320px] rounded-[2rem] shadow-2xl overflow-hidden border-4 border-slate-800 animate-in zoom-in duration-200">
            <div className="bg-slate-900 p-6 text-center">
              <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-white font-black text-[14px] uppercase tracking-widest">Acceso Histórico</h3>
              <div className="flex justify-center gap-3 mt-6">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={`w-3 h-3 rounded-full border-2 transition-all ${pin.length > i ? 'bg-indigo-500 border-indigo-500 scale-110' : 'bg-transparent border-slate-700'}`}></div>
                ))}
              </div>
            </div>
            <div className="p-6 bg-slate-50">
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'ESC', 0, 'DEL'].map((num) => (
                  <button key={num} type="button" onClick={() => num === 'ESC' ? (setShowPassModal(false), setPin('')) : num === 'DEL' ? setPin(pin.slice(0, -1)) : pin.length < 4 && setPin(pin + num)} className="h-12 rounded-xl bg-white border-b-2 border-slate-200 text-lg font-black text-slate-700 active:scale-90 transition-all hover:bg-slate-100">{num}</button>
                ))}
              </div>
              {pinError && <p className="text-center text-red-500 font-black text-[15px] uppercase mt-3 animate-bounce">❌ PIN INCORRECTO</p>}
            </div>
          </div>
        </div>
      )}

      {/* MODAL AÑADIR REGISTRO */}
      {showAddModal && (
        <div className="fixed inset-0 bg-emerald-900/90 backdrop-blur-xl z-[8000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 border-[12px] border-emerald-50">
            <div className="bg-emerald-700 p-8 text-center text-white">
              <h3 className="font-black text-sm uppercase tracking-[0.2em]">Añadir Registro Manual</h3>
              <p className="text-[14px] opacity-70 mt-1 uppercase">Nuevo Registro</p>
            </div>
            <div className="p-8 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[13px] font-black text-slate-400 uppercase">Fecha</label>
                  <input type="date" value={newActivity.fecha} onChange={e => setNewActivity({...newActivity, fecha: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 font-black text-slate-800 text-xs outline-none focus:border-emerald-500"/>
                </div>
                <div className="space-y-1">
                  <label className="text-[13px] font-black text-slate-400 uppercase">Inicio</label>
                  <input type="time" value={newActivity.horaInicio} onChange={e => setNewActivity({...newActivity, horaInicio: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 font-black text-slate-800 text-xs outline-none focus:border-emerald-500"/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[13px] font-black text-slate-400 uppercase">Fin</label>
                  <input type="time" value={newActivity.horaFin} onChange={e => setNewActivity({...newActivity, horaFin: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 font-black text-slate-800 text-xs outline-none focus:border-emerald-500"/>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[13px] font-black text-slate-400 uppercase">Seleccionar Operarios</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 border-2 border-slate-100 rounded-xl p-3 max-h-40 overflow-y-auto">
                  {operarios.map(op => (
                    <label key={op.id} className="flex items-center gap-2 text-[13px] font-bold text-slate-700 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={newActivity.operarios?.includes(op.nombre)}
                        onChange={e => {
                          const current = newActivity.operarios || [];
                          if (e.target.checked) {
                            setNewActivity({...newActivity, operarios: [...current, op.nombre]});
                          } else {
                            setNewActivity({...newActivity, operarios: current.filter(o => o !== op.nombre)});
                          }
                        }}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      {op.nombre}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[13px] font-black text-slate-400 uppercase">Formato</label>
                <input 
                  type="text" 
                  value={newActivity.formato} 
                  onChange={e => setNewActivity({...newActivity, formato: e.target.value})} 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 font-black text-slate-800 text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[13px] font-black text-slate-400 uppercase">Tipo Tarea</label>
                <select 
                  value={newActivity.tipoTarea} 
                  onChange={e => setNewActivity({...newActivity, tipoTarea: e.target.value as TaskType})} 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 font-black text-slate-800 text-xs outline-none focus:border-emerald-500"
                >
                  <option value={TaskType.PRODUCCION}>Producción (P)</option>
                  <option value={TaskType.ESPERAS}>Esperas (E)</option>
                  <option value={TaskType.AVERIA}>Avería (A)</option>
                  <option value={TaskType.SIN_TRABAJO}>Sin Trabajo (S)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-[13px] font-black text-slate-400 uppercase">Cantidad OK</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    min="0"
                    value={newActivity.cantidad} 
                    onChange={e => setNewActivity({...newActivity, cantidad: Number(e.target.value)})} 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 font-black text-emerald-600 text-base outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[13px] font-black text-red-400 uppercase">Cantidad a Reprocesar</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    min="0"
                    value={newActivity.cantidadNok || 0} 
                    onChange={e => setNewActivity({...newActivity, cantidadNok: Number(e.target.value)})} 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 font-black text-red-600 text-base outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[13px] font-black text-slate-400 uppercase">Comentarios</label>
                <textarea value={newActivity.comentarios} onChange={e => setNewActivity({...newActivity, comentarios: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 font-bold text-slate-600 text-xs min-h-[60px] outline-none focus:border-emerald-500"/>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 text-[14px] font-black rounded-xl uppercase transition-all hover:bg-slate-200">Cancelar</button>
                <button onClick={handleSaveAdd} className="flex-1 py-4 bg-emerald-700 text-white text-[14px] font-black rounded-xl uppercase shadow-xl shadow-emerald-200 transition-all hover:bg-emerald-800 active:scale-95">Añadir Registro</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CABECERA */}
      <div className={`p-4 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 transition-all ${isAdminMode ? 'bg-indigo-900 border-indigo-600 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
        <div className="text-center md:text-left">
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tighter text-indigo-600">
            Histórico de Registros
          </h2>
          <p className="text-[15px] sm:text-[14px] font-black uppercase tracking-[0.3em] opacity-60">
            {isAdminMode ? '🔓 MODO ADMINISTRADOR ACTIVO' : '🔒 MODO CONSULTA (SOLO LECTURA)'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          {isAdminMode && (
            <>
              <button 
                type="button"
                onClick={handleExportCSV}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[13px] font-black uppercase tracking-widest border-2 bg-indigo-600 border-indigo-500 text-white shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                EXPORTAR CSV
              </button>
              <button 
                type="button"
                onClick={() => setShowAddModal(true)}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[13px] font-black uppercase tracking-widest border-2 bg-emerald-600 border-emerald-500 text-white shadow-lg hover:bg-emerald-700 transition-all active:scale-95"
              >
                <Database className="w-4 h-4" />
                AÑADIR REGISTRO
              </button>
              <button 
                type="button"
                onClick={handleFixDates}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[13px] font-black uppercase tracking-widest border-2 bg-amber-600 border-amber-500 text-white shadow-lg hover:bg-amber-700 transition-all active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                CORREGIR FECHAS
              </button>
              <button 
                type="button"
                onClick={() => {
                  setActionConfirm({
                    title: "¿Borrar Todo?",
                    message: "¿ESTÁS SEGURO? Esta acción eliminará TODO el histórico de este taller permanentemente.",
                    type: 'danger',
                    onConfirm: () => onDeleteAllHistory?.()
                  });
                }}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[13px] font-black uppercase tracking-widest border-2 bg-red-600 border-red-500 text-white shadow-lg hover:bg-red-700 transition-all active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                BORRAR TODO
              </button>
              {selectedArea === 'tratamientos' && onResetMasterSpeeds && (
                <button 
                  type="button"
                  onClick={() => {
                    setActionConfirm({
                      title: "¿Reiniciar Tiempos?",
                      message: "¿Estás seguro de que deseas REINICIAR los formatos y tiempos de Tratamientos? Se borrarán los actuales y se cargarán los nuevos.",
                      type: 'warning',
                      onConfirm: () => onResetMasterSpeeds()
                    });
                  }}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[13px] font-black uppercase tracking-widest border-2 bg-amber-600 border-amber-500 text-white shadow-lg hover:bg-amber-700 transition-all active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                  REINICIAR TIEMPOS TRAT.
                </button>
              )}
              <div className="relative">
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleCSVUpload}
                  className="hidden" 
                  id="csv-upload"
                  disabled={isImporting}
                />
                <label 
                  htmlFor="csv-upload"
                  className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[13px] font-black uppercase tracking-widest border-2 transition-all active:scale-95 cursor-pointer ${isImporting ? 'bg-slate-400 border-slate-300' : 'bg-emerald-600 border-emerald-500 text-white shadow-lg hover:bg-emerald-700'}`}
                >
                  <Upload className="w-4 h-4" />
                  {isImporting ? (
                    <span>
                      {importProgress ? `PROCESANDO ${Math.round((importProgress.current / importProgress.total) * 100)}%` : 'IMPORTANDO...'}
                    </span>
                  ) : 'IMPORTAR CSV'}
                </label>
              </div>
            </>
          )}
          <button 
            type="button"
            onClick={() => isAdminMode ? setIsAdminMode(false) : setShowPassModal(true)} 
            className={`px-6 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl text-[13px] sm:text-[14px] font-black uppercase tracking-widest border-2 transition-all active:scale-95 ${isAdminMode ? 'bg-red-500 border-red-400 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-white shadow-2xl'}`}
          >
            {isAdminMode ? 'CERRAR SESIÓN' : 'ACTIVAR EDICIÓN'}
          </button>
        </div>
      </div>
      
      {/* BARRA DE FILTROS */}
      <div className="bg-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="space-y-1">
          <label className="text-[13px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha</label>
          <input 
            type="date" 
            value={filterDate} 
            onChange={e => setFilterDate(e.target.value)}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[13px] font-black text-slate-400 uppercase tracking-widest ml-1">Tarea</label>
          <input 
            type="text" 
            placeholder="Buscar..."
            value={filterTask} 
            onChange={e => setFilterTask(e.target.value)}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[13px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo</label>
          <select 
            value={filterType} 
            onChange={e => setFilterType(e.target.value)}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all"
          >
            <option value="">TODOS LOS TIPOS</option>
            {Object.values(TaskType).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="space-y-1 flex items-end">
          {(filterDate || filterTask || filterType) && (
            <button 
              onClick={() => {
                setFilterDate('');
                setFilterTask('');
                setFilterType('');
              }}
              className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
              title="Limpiar filtros"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* TABLA DE DATOS */}
      <div className="bg-white rounded-[1.5rem] sm:rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto no-scrollbar max-h-[70vh] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b border-slate-200 shadow-sm">
                <th className="p-2 sm:p-4 text-[10px] sm:text-[13px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                <th className="p-2 sm:p-4 text-[10px] sm:text-[13px] font-black text-slate-400 uppercase tracking-widest">Operario</th>
                <th className="p-2 sm:p-4 text-[10px] sm:text-[13px] font-black text-slate-400 uppercase tracking-widest">Tarea</th>
                <th className="p-2 sm:p-4 text-[10px] sm:text-[13px] font-black text-slate-400 uppercase tracking-widest">Tipo</th>
                <th className="p-2 sm:p-4 text-[10px] sm:text-[13px] font-black text-slate-400 uppercase tracking-widest">Inicio</th>
                <th className="p-2 sm:p-4 text-[10px] sm:text-[13px] font-black text-slate-400 uppercase tracking-widest">Fin</th>
                <th className="p-2 sm:p-4 text-[10px] sm:text-[13px] font-black text-slate-400 uppercase tracking-widest">T. Real</th>
                <th className="p-2 sm:p-4 text-[10px] sm:text-[13px] font-black text-slate-400 uppercase tracking-widest">T. Teo</th>
                <th className="p-2 sm:p-4 text-[10px] sm:text-[13px] font-black text-slate-400 uppercase tracking-widest text-center">Cant. OK</th>
                <th className="p-2 sm:p-4 text-[10px] sm:text-[13px] font-black text-red-400 uppercase tracking-widest text-center">Cant. Reprocesar</th>
                <th className="p-2 sm:p-4 text-[10px] sm:text-[13px] font-black text-slate-400 uppercase tracking-widest">Comentarios</th>
                {isAdminMode && <th className="p-2 sm:p-4 text-[10px] sm:text-[13px] font-black text-slate-400 uppercase tracking-widest text-center">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allRecords.map((record) => (
                <tr key={`${record.isHistory ? 'h' : 'a'}-${record.id}`} className="hover:bg-slate-50 transition-colors group">
                  {editingId === record.id ? (
                    <>
                      <td className="p-1"><input type="date" value={editForm.fecha || ''} onChange={e => setEditForm({...editForm, fecha: e.target.value})} className="min-w-[80px] w-full p-1 text-[15px] border rounded-lg font-bold" /></td>
                      <td className="p-1"><input type="text" value={editForm.operarios?.join(', ') || ''} onChange={e => setEditForm({...editForm, operarios: e.target.value.split(',').map(s => s.trim())})} className="min-w-[80px] w-full p-1 text-[15px] border rounded-lg font-bold uppercase" /></td>
                      <td className="p-1">
                        <div className="flex flex-col gap-1">
                          <input type="text" value={editForm.formato || ''} onChange={e => setEditForm({...editForm, formato: e.target.value})} className="min-w-[100px] w-full p-1 text-[15px] border rounded-lg font-bold uppercase" />
                          {editForm.tipoTarea === TaskType.PRODUCCION && (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-black text-emerald-600 uppercase">Teo:</span>
                              <input type="number" step="0.1" value={editForm.tiempoTeoricoManual || 0} onChange={e => setEditForm({...editForm, tiempoTeoricoManual: parseFloat(e.target.value) || 0})} className="w-16 p-1 text-[12px] border rounded bg-white text-slate-900 font-bold" />
                            </div>
                          )}
                        </div>
                      </td>
                      {selectedArea === 'mecanizado' && (
                        <td className="p-1"></td>
                      )}

                      <td className="p-1"><input type="text" value={editForm.horaInicio || ''} onChange={e => setEditForm({...editForm, horaInicio: e.target.value})} className="min-w-[50px] w-full p-1 text-[15px] border rounded-lg font-bold" /></td>
                      <td className="p-1"><input type="text" value={editForm.horaFin || ''} onChange={e => setEditForm({...editForm, horaFin: e.target.value})} className="min-w-[50px] w-full p-1 text-[15px] border rounded-lg font-bold" /></td>
                      <td className="p-1 text-center text-[15px] font-bold text-slate-400 min-w-[50px]">
                        {editForm.horaInicio && editForm.horaFin ? `${calcDuration(editForm.horaInicio, editForm.horaFin)} min` : '-'}
                      </td>
                      <td className="p-1 text-center text-[15px] font-bold text-emerald-600 min-w-[50px]">
                        {editForm.tipoTarea === TaskType.PRODUCCION && editForm.tiempoTeoricoManual !== undefined && (selectedArea === 'corte-laser' || (editForm.cantidad || 0) > 0)
                          ? `${((editForm.tiempoTeoricoManual > 0 ? (60 / editForm.tiempoTeoricoManual) : 0) * (selectedArea === 'corte-laser' ? 1 : (editForm.cantidad || 0))).toFixed(1)}m` 
                          : '-'}
                      </td>
                      <td className="p-1"><input type="number" step={selectedArea === 'corte-laser' ? "1" : "0.1"} value={editForm.cantidadNok || 0} onChange={e => setEditForm({...editForm, cantidadNok: parseFloat(e.target.value) || 0})} className="min-w-[50px] w-full p-1 text-[15px] border rounded-lg font-bold text-center text-red-600" /></td>
                      <td className="p-1"><input type="text" value={editForm.comentarios || ''} onChange={e => setEditForm({...editForm, comentarios: e.target.value})} className="min-w-[120px] w-full p-1 text-[15px] border rounded-lg font-bold" /></td>
                      <td className="p-2 flex justify-center gap-1">
                        <button onClick={handleSave} className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors shadow-sm" title="Guardar">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(record.id, record.isHistory)} className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-sm" title="Eliminar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-2 bg-slate-400 text-white rounded-lg hover:bg-slate-500 transition-colors shadow-sm" title="Cancelar">
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-2 sm:p-4 text-[10px] sm:text-[13px] font-bold text-slate-600">{record.fecha}</td>
                      <td className="p-2 sm:p-4 text-[10px] sm:text-[13px] font-black text-slate-900 uppercase">{record.operarios?.join(', ')}</td>
                      <td className="p-2 sm:p-4 text-[10px] sm:text-[13px] font-bold text-slate-600 uppercase">
                        <span className={`px-1 sm:px-2 py-0.5 rounded-md text-[7px] sm:text-[10px] mr-1 sm:mr-2 ${
                          (record.tipoTarea === TaskType.PRODUCCION || record.formato === 'JAMON') ? 'bg-emerald-100 text-emerald-700' :
                          record.tipoTarea === TaskType.AVERIA ? 'bg-red-100 text-red-700' :
                          record.tipoTarea === TaskType.ESPERAS ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {record.tipoTarea}
                        </span>
                      </td>
                      <td className="p-2 sm:p-4 text-[10px] sm:text-[13px] font-bold text-slate-600 uppercase">
                        {record.formato}
                        {record.afectaCalidad && (
                          <span className="ml-1 sm:ml-2 px-1 sm:px-1.5 py-0.5 bg-red-500 text-white text-[7px] sm:text-[9px] font-black rounded uppercase tracking-tighter">Calidad</span>
                        )}
                      </td>

                      <td className="p-2 sm:p-4 text-[10px] sm:text-[13px] font-bold text-slate-600">{record.horaInicio}</td>
                      <td className="p-2 sm:p-4 text-[10px] sm:text-[13px] font-bold text-slate-600">{record.horaFin || <span className="text-emerald-500 animate-pulse">ACTIVO</span>}</td>
                      <td className="p-2 sm:p-4 text-[10px] sm:text-[13px] font-black text-blue-600 text-center">
                        {record.duracionMin ? `${Number(record.duracionMin).toFixed(1)}m` : '-'}
                      </td>
                      <td className="p-2 sm:p-4 text-[10px] sm:text-[13px] font-black text-emerald-600 text-center">
                        {(record.tipoTarea === TaskType.PRODUCCION || record.formato === 'JAMON') && record.tiempoTeoricoManual !== undefined && (selectedArea === 'corte-laser' || (record.cantidad || 0) > 0)
                          ? `${((record.tiempoTeoricoManual > 0 ? (60 / record.tiempoTeoricoManual) : 0) * (selectedArea === 'corte-laser' ? 1 : (record.cantidad || 0))).toFixed(1)}m` 
                          : '-'}
                      </td>
                      <td className="p-2 sm:p-4 text-[10px] sm:text-[13px] font-black text-emerald-800 text-center">
                        {record.cantidad || 0}
                      </td>
                      <td className="p-2 sm:p-4 text-[10px] sm:text-[13px] font-black text-red-600 text-center">{selectedArea === 'corte-laser' ? (record.cantidadNok || 0) : (record.cantidadNok || 0).toFixed(1)}</td>
                      <td className="p-2 sm:p-4 text-[10px] sm:text-[13px] font-bold text-slate-500 italic max-w-[150px] sm:max-w-[250px] break-words" title={record.comentarios}>{record.comentarios || '-'}</td>
                      {isAdminMode && (
                        <td className="p-2 sm:p-4 text-center">
                          <div className="flex justify-center gap-1 sm:gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(record)} className="p-1 sm:p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                              <Edit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                            <button onClick={() => handleDelete(record.id, record.isHistory)} className="p-1 sm:p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm">
                              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
              {allRecords.length === 0 && (
                <tr>
                  <td colSpan={
                    (isAdminMode ? 1 : 0) + 11
                  } className="p-20 text-center">
                    <div className="flex flex-col items-center opacity-20 grayscale">
                      <Database className="w-16 h-16 mb-4" />
                      <p className="font-black text-xs uppercase tracking-[0.4em]">No hay registros en la base de datos</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* TABLA MERMAS - solo Loncheado */}
      {selectedArea === 'sb-loncheado' && (
        <div className="bg-white rounded-[1.5rem] sm:rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden mt-6">
          <div className="bg-amber-600 px-5 py-4">
            <h3 className="text-white font-black text-[14px] uppercase tracking-widest">Registro de Mermas</h3>
            <p className="text-amber-100 text-[11px] font-bold uppercase tracking-widest mt-0.5">Por día y formato</p>
          </div>
          <div className="overflow-x-auto no-scrollbar max-h-[50vh] overflow-y-auto">
            <table className="w-full text-left border-collapse text-[12px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-amber-50 border-b border-amber-100">
                  {['Fecha','Formato','Kg Entrada','Kg Tacos','Kg Pieles','Kg Hueco','N Envases','Media Comb.','Kg Envasados','Kg Merma','% Merma 1','% Merma 2'].map(h => (
                    <th key={h} className="p-3 font-black text-amber-800 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...mermas].sort((a,b) => (b.fecha||'').localeCompare(a.fecha||'')).map((m, i) => (
                  <tr key={m.id || i} className="hover:bg-amber-50 transition-colors">
                    <td className="p-3 font-bold text-slate-700">{m.fecha}</td>
                    <td className="p-3 font-black text-slate-900 uppercase">{m.formato}</td>
                    <td className="p-3 text-center font-bold">{Number(m.kgEntrada||0).toFixed(2)}</td>
                    <td className="p-3 text-center font-bold">{Number(m.kgTacos||0).toFixed(2)}</td>
                    <td className="p-3 text-center font-bold">{Number(m.kgPieles||0).toFixed(2)}</td>
                    <td className="p-3 text-center font-bold">{Number(m.kgHueco||0).toFixed(2)}</td>
                    <td className="p-3 text-center font-bold">{Number(m.nEnvases||0).toFixed(0)}</td>
                    <td className="p-3 text-center font-bold">{Number(m.mediaCombi||0).toFixed(3)}</td>
                    <td className="p-3 text-center font-bold">{Number(m.kgSalida||0).toFixed(2)}</td>
                    <td className="p-3 text-center font-black text-amber-700">{Number(m.kgMerma||0).toFixed(2)}</td>
                    <td className={`p-3 text-center font-black ${Number(m.pctMerma1||0) > 5 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {Number(m.pctMerma1||0).toFixed(1)}%
                    </td>
                    <td className={`p-3 text-center font-black ${Number(m.pctMerma2||0) > 5 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {Number(m.pctMerma2||0).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL ACCIÓN GENERAL */}
      {actionConfirm && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in border-4 border-slate-100">
            <div className={`${actionConfirm.type === 'danger' ? 'bg-red-600' : 'bg-amber-500'} p-6 text-center text-white`}>
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-black text-lg uppercase tracking-widest">{actionConfirm.title}</h3>
              <p className="text-white/80 text-xs font-bold mt-2 uppercase leading-relaxed">{actionConfirm.message}</p>
            </div>
            <div className="p-6 flex gap-3">
              <button onClick={() => setActionConfirm(null)} className="flex-1 py-4 rounded-xl bg-slate-100 text-slate-400 font-black uppercase text-xs">Cancelar</button>
              <button 
                onClick={() => {
                  actionConfirm.onConfirm();
                  setActionConfirm(null);
                }} 
                className={`flex-1 py-4 rounded-xl text-white font-black uppercase text-xs shadow-lg ${actionConfirm.type === 'danger' ? 'bg-red-600 shadow-red-100' : 'bg-amber-500 shadow-amber-100'}`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRM DELETE */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in border-4 border-red-50">
            <div className="bg-red-600 p-6 text-center text-white">
              <Trash2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="font-black text-lg uppercase tracking-widest">¿Eliminar Registro?</h3>
              <p className="text-red-100 text-xs font-bold mt-2 uppercase">Esta acción no se puede deshacer y afectará a los indicadores.</p>
            </div>
            <div className="p-6 flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-4 rounded-xl bg-slate-100 text-slate-400 font-black uppercase text-xs">Cancelar</button>
              <button onClick={confirmDelete} className="flex-1 py-4 rounded-xl bg-red-600 text-white font-black uppercase text-xs shadow-lg shadow-red-200">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabasePanel;
