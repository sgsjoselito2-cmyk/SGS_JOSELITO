import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TaskType, Activity, IncidenceMaster, MasterSpeed, OEEObjectives, User } from '../types';
import { AREA_COLUMNS } from '../constants';
import { calcDuration } from '../src/utils';
import HelpModal from './HelpModal';
import { Check, X, Edit2, Trash2 } from 'lucide-react';

interface WorkPanelProps {
  selectedUsers: string[];
  setSelectedUsers: (names: string[]) => void;
  activities: Activity[];
  incidenceMaster: IncidenceMaster[];
  masterSpeeds: MasterSpeed[];
  oeeObjectives: OEEObjectives;
  operarios: User[];
  onAddActivity: (activity: Omit<Activity, 'id' | 'horaInicio'>, closureData?: { cantidad: number, comentarios: string, idsToClose?: string[] }) => void;
  onEndTurn: (userNames: string[], closureData?: { cantidad: number, comentarios: string, id?: string }) => void;
  onUpdateActivity?: (activity: Activity) => void;
  onDeleteActivity?: (id: string, isHistory: boolean) => void;
  onFinalizeShift: (fecha: string, forceClose?: boolean, aggregatedQuantities?: Record<string, { cantidad: number, cantidadNok?: number }>, mermasToSave?: any[]) => void;
  onRefresh: () => void;
  onAddMultipleActivities?: (newActivities: any[], closedActivitiesData: any[]) => void;
  isEndModalOpen: boolean;
  onConfirmEndActivity: (cantidad: number, comentarios: string) => void;
  onCancelEndModal: () => void;
  activityToCloseName: string;
  selectedArea?: string;
  passwords?: {
    jefeEquipo: string;
    jefeTaller: string;
    directorOperaciones: string;
    asistenciaTecnica: string;
  };
}

const WorkPanel: React.FC<WorkPanelProps> = ({ 
  selectedUsers, 
  setSelectedUsers, 
  activities = [],
  incidenceMaster,
  masterSpeeds = [],
  oeeObjectives,
  operarios = [],
  onAddActivity,
  onAddMultipleActivities,
  onEndTurn,
  onUpdateActivity,
  onDeleteActivity,
  onFinalizeShift,
  onRefresh,
  selectedArea,
  passwords
}) => {
  const isLaserArea = selectedArea === 'corte-laser';
  const isLoncheadoArea = selectedArea === 'sb-loncheado';
  
  // Eliminados fanType y otros locales obsoletos
  const [productionTask, setProductionTask] = useState('');
  const [theoreticalTime, setTheoreticalTime] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Estado para modales de parada/cierre múltiple
  const [showMultipleClosureModal, setShowMultipleClosureModal] = useState(false);
  const [showMultipleStartModal, setShowMultipleStartModal] = useState(false);
  const [showMachineSelectionModal, setShowMachineSelectionModal] = useState(false);
  const [machineSelectionType, setMachineSelectionType] = useState<'start' | 'stop' | 'finish' | 'incidence' | 'start_conflict'>('start');
  const [selectedMachineIds, setSelectedMachineIds] = useState<string[]>([]);
  const [pendingMecanizadoAction, setPendingMecanizadoAction] = useState<{type: 'start' | 'stop', category?: string, activityId?: string, payload?: any} | null>(null);
  const [fanType, setFanType] = useState('');
  const [pendingActivities, setPendingActivities] = useState<any[]>([]);
  const [closureDataMap, setClosureDataMap] = useState<Record<string, { cantidad: string, comentarios: string, selected: boolean }>>({});

  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<{id: string, isHistory: boolean} | null>(null);

  const availableProductionTasks = useMemo(() => {
    return Array.from(new Set(masterSpeeds.map(ms => ms.formato)));
  }, [masterSpeeds]);

  useEffect(() => {
    setProductionTask('');
  }, [selectedArea]);

  // Efecto separado para auto-seleccionar tarea en Laser
  useEffect(() => {
    if (isLaserArea && availableProductionTasks.length > 0 && !productionTask) {
      setProductionTask(availableProductionTasks[0]);
    }
  }, [isLaserArea, availableProductionTasks, productionTask]);

  const qtyInputRef = useRef<HTMLInputElement>(null);
  const commentsRef = useRef<HTMLTextAreaElement>(null);

  const stats = useMemo(() => {
    let totalTime = 0;
    let timeP = 0;
    let timeS = 0;
    let timeA_Quality = 0;
    let timeA_NoQuality = 0;
    let timeE_Quality = 0;
    let timeE_NoQuality = 0;
    let totalParts = 0;
    let theoreticalTimeSum = 0;

    const timeStr = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    activities.forEach(act => {
      let duration = act.duracionMin || 0;
      if (!act.horaFin) {
        duration = calcDuration(act.horaInicio, timeStr);
      }
      
      totalTime += duration;

      if (act.tipoTarea === TaskType.PRODUCCION) {
        timeP += duration;
        totalParts += (act.cantidad || 0);
        
        const isLaser = selectedArea === 'corte-laser';
        const teoManual = Number(act.tiempoTeoricoManual || 0);
        const cant = Number(act.cantidad || 0);

        if (isLaser) {
          theoreticalTimeSum += (teoManual > 0 ? (60 / teoManual) : 0);
        } else {
          theoreticalTimeSum += (teoManual > 0 ? (60 / teoManual) : 0) * cant;
        }
      }

      if (act.tipoTarea === TaskType.SIN_TRABAJO) {
        timeS += duration;
      }

      if (act.tipoTarea === TaskType.AVERIA) {
        if (act.afectaCalidad) {
          timeA_Quality += duration;
        } else {
          timeA_NoQuality += duration;
        }
      }

      if (act.tipoTarea === TaskType.ESPERAS) {
        if (act.afectaCalidad) {
          timeE_Quality += duration;
        } else {
          timeE_NoQuality += duration;
        }
      }
    });

    let availability = 0;
    let quality = 100;
    let performance = 0;

    // Standard OEE logic
    let downtimeSum = timeE_NoQuality + timeE_Quality + timeS;
    availability = totalTime > 0 ? ((totalTime - downtimeSum) / totalTime) * 100 : 0;
    quality = 100; // Calidad is 100 as we don't track NOK anymore according to request
    const prodTime = totalTime - downtimeSum;
    performance = prodTime > 0 ? (theoreticalTimeSum / prodTime) * 100 : 0;

    const finalAvailability = Math.min(100, availability > 0 ? availability : 0);
    const finalPerformance = Math.min(100, performance > 0 ? performance : 0);
    const finalQuality = Math.min(100, quality > 0 ? quality : 0);
    const oee = (finalAvailability * finalPerformance * finalQuality) / 10000;

    const hasData = activities.length > 0;

    return {
      availability: hasData ? finalAvailability.toFixed(1) : '',
      performance: hasData ? finalPerformance.toFixed(1) : '',
      quality: hasData ? finalQuality.toFixed(1) : '',
      oee: hasData ? oee.toFixed(1) : ''
    };
  }, [activities, currentTime, selectedArea]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const [showClosureModal, setShowClosureModal] = useState(false);
  const [showShiftClosureModal, setShowShiftClosureModal] = useState(false);
  const [shiftClosureData, setShiftClosureData] = useState<Record<string, { cantidad: string, cantidadNok?: string, esProduccion?: boolean, kgEntrada?: string, kgTacos?: string, kgPieles?: string, kgHueco?: string, mediaCombi?: string, nEnvases?: string }>>({});
  const [closureQty, setClosureQty] = useState<string>('0');
  const [closureComments, setClosureComments] = useState('');
  const [pendingAction, setPendingAction] = useState<{ type: 'add' | 'end', payload?: any } | null>(null);

  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Activity>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [showShiftConflictModal, setShowShiftConflictModal] = useState(false);
  const [showShiftConfirmModal, setShowShiftConfirmModal] = useState(false);
  const [isForcingClosure, setIsForcingClosure] = useState(false);
  const [shiftDate, setShiftDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [activeOperators, setActiveOperators] = useState<string[]>([]);
  const [pendingShiftFinalization, setPendingShiftFinalization] = useState<{fecha: string, force: boolean, aggregatedQuantities?: Record<string, { cantidad: number, cantidadNok?: number }>, mermasToSave?: any[]} | null>(null);

  const handleEdit = (record: Activity) => {
    setEditingId(record.id);
    setEditForm(record);
  };

  const handleSaveEdit = () => {
    if (editingId && editForm && onUpdateActivity) {
      const updatedRecord = { ...editForm };
      if (updatedRecord.horaInicio && updatedRecord.horaFin) {
        updatedRecord.duracionMin = calculateDuration(updatedRecord.horaInicio, updatedRecord.horaFin);
      }
      onUpdateActivity(updatedRecord as Activity);
      setEditingId(null);
      setEditForm({});
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      onDeleteActivity?.(deleteConfirmId, false);
      setDeleteConfirmId(null);
    }
  };
  const calculateDuration = (start: string, end: string): number => {
    if (!start || !end || !start.includes(':') || !end.includes(':')) return 0;
    try {
      const [h1, m1] = start.split(':').map(Number);
      const [h2, m2] = end.split(':').map(Number);
      const d1 = new Date(); d1.setHours(h1, m1, 0, 0);
      const d2 = new Date(); d2.setHours(h2, m2, 0, 0);
      let diff = (d2.getTime() - d1.getTime()) / 60000;
      if (diff < 0) diff += 1440; 
      return Math.max(0.1, Number(diff.toFixed(1)));
    } catch (e) { return 0; }
  };

  const currentActivities = useMemo(() => {
    return activities.filter(a => 
      a.operarios?.some(u => selectedUsers.includes(u)) && 
      (!a.horaFin || String(a.horaFin).trim() === "")
    );
  }, [activities, selectedUsers]);

  const currentActivity = currentActivities[0];

  const sortedActivities = useMemo(() => {
    return [...activities].sort((a, b) => {
      const aIsActive = !a.horaFin || String(a.horaFin).trim() === "";
      const bIsActive = !b.horaFin || String(b.horaFin).trim() === "";
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;
      
      // Sort by date first (most recent first)
      const dateA = a.fecha || '';
      const dateB = b.fecha || '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      
      // Then by start time (most recent first)
      return (b.horaInicio || "").localeCompare(a.horaInicio || "");
    });
  }, [activities]);

  const calculatedTheoreticalTime = useMemo(() => {
    const speedRecord = masterSpeeds.find(ms => ms.formato === productionTask);
    const teo = speedRecord?.tiempoTeorico || 0;
    return teo > 0 ? (60 / teo) : 0;
  }, [productionTask, masterSpeeds]);

  useEffect(() => {
    if (pin.length === 4 && passwords) {
      let isCorrect = false;
      if (pin === passwords.asistenciaTecnica) isCorrect = true;
      if (pin === passwords.directorOperaciones) isCorrect = true;
      if (pin === passwords.jefeTaller) isCorrect = true;
      if (pin === passwords.jefeEquipo) isCorrect = true;

      if (isCorrect) {
        if (pendingShiftFinalization) {
          onFinalizeShift(pendingShiftFinalization.fecha, pendingShiftFinalization.force, pendingShiftFinalization.aggregatedQuantities, pendingShiftFinalization.mermasToSave);
          setPendingShiftFinalization(null);
          setIsAdminMode(false);
        } else {
          setIsAdminMode(true);
        }
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
    } else if (pin.length === 4 && !passwords) {
      // Fallback if passwords not loaded
      if (pin === "1234") {
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
    if (showClosureModal) {
      if (currentActivity?.tipoTarea === TaskType.PRODUCCION) setTimeout(() => qtyInputRef.current?.focus(), 100);
      else setTimeout(() => commentsRef.current?.focus(), 100);
    }
  }, [showClosureModal, currentActivity]);

  const handleActionIntercept = (nextAction: 'add' | 'end', nextPayload?: any) => {
    if (currentActivity) {
      // Por petición de usuario: No pedir cantidad al finalizar actividades para talleres TOP 5
      // Esta lógica se traslada al cierre de turno (Shift Closure Modal)
      const closureData = { cantidad: 0, comentarios: '', idsToClose: [currentActivity.id] };

      if (nextAction === 'end') {
        onAddActivity({} as any, closureData);
      } else {
        // nextAction === 'add' (Cambio de actividad)
        onAddActivity(nextPayload, closureData);
      }
    } else {
      if (nextAction === 'add') onAddActivity(nextPayload);
    }
  };

  const confirmClosure = () => {
    const rawQty = parseFloat(closureQty) || 0;
    const qty = Math.max(0, rawQty);
    const closureData = { cantidad: qty, comentarios: closureComments };
    if (pendingAction?.type === 'add') onAddActivity(pendingAction.payload, closureData);
    else if (pendingAction?.type === 'end') onEndTurn(selectedUsers, closureData);
    setShowClosureModal(false); setPendingAction(null);
  };

  const confirmMultipleClosure = () => {
    // Validate all selected have quantity
    const selectedIds = Object.keys(closureDataMap).filter(id => closureDataMap[id].selected);
    const closedActsData = selectedIds.map(id => {
      const act = currentActivities.find(a => a.id === id);
      return {
        id,
        cantidad: 0,
        comentarios: closureDataMap[id].comentarios || '',
        tiempoTeoricoManual: act?.tiempoTeoricoManual || 0
      };
    });

    const newActs = pendingActivities;
    
    if (onAddMultipleActivities) {
      onAddMultipleActivities(newActs, closedActsData);
    } else {
      // Fallback if not provided
      closedActsData.forEach(c => onEndTurn(selectedUsers, c));
      if (newActs.length > 0) {
        newActs.forEach(a => onAddActivity(a));
      }
    }

    setShowMultipleClosureModal(false);
    setPendingAction(null);
    setPendingActivities([]);
    setClosureDataMap({});
    
    if (newActs.length > 0) {
      setProductionTask('');
    }
  };

  const confirmMultipleStart = () => {
    if (currentActivities.length > 0) {
      // Prepare closure map
      const initialMap: Record<string, { cantidad: string, comentarios: string, selected: boolean }> = {};
      currentActivities.forEach(a => {
        initialMap[a.id] = { 
          cantidad: String(a.cantidad || ''), 
          comentarios: a.comentarios || '', 
          selected: false 
        };
      });
      setClosureDataMap(initialMap);
      setShowMultipleClosureModal(true);
      setShowMultipleStartModal(false);
    } else {
      if (onAddMultipleActivities) {
        onAddMultipleActivities(pendingActivities, []);
      } else {
        pendingActivities.forEach(a => onAddActivity(a));
      }
      setShowMultipleStartModal(false);
      setPendingActivities([]);
      setFanType('');
      setProductionTask('');
    }
  };

  const addAnotherActivity = () => {
    // The activity was already added by handleProductionClick
    // Just clear selection for next one
    setProductionTask('');
    setShowMultipleStartModal(false);
  };

  const confirmMecanizadoMachineSelection = () => {
    if (selectedMachineIds.length === 0 && machineSelectionType !== 'start_conflict') {
      setValidationError('⚠️ Seleccione al menos una máquina');
      return;
    }

    if (machineSelectionType === 'start_conflict') {
      // Si el usuario decidió cerrar las máquinas seleccionadas
      if (selectedMachineIds.length > 0) {
        // Si hay varias a cerrar, usamos el modal de cierre múltiple
        const initialMap: Record<string, { cantidad: string, comentarios: string, selected: boolean }> = {};
        currentActivities.forEach(a => {
          initialMap[a.id] = { cantidad: '', comentarios: '', selected: selectedMachineIds.includes(a.id) };
        });
        setClosureDataMap(initialMap);
        setPendingAction({ type: 'add', payload: pendingMecanizadoAction?.payload });
        setShowMultipleClosureModal(true);
      } else {
        // Si decidió no cerrar ninguna, simplemente añadimos la nueva
        if (pendingMecanizadoAction?.payload) {
          onAddActivity(pendingMecanizadoAction.payload);
        }
      }
    } else if (machineSelectionType === 'incidence') {
      // Crear una incidencia por cada máquina seleccionada
      if (pendingMecanizadoAction?.payload) {
        selectedMachineIds.forEach(id => {
          const act = currentActivities.find(a => a.id === id);
          onAddActivity(
            pendingMecanizadoAction.payload,
            { idsToClose: [id], cantidad: 0, comentarios: '' }
          );
        });
      }
      setShowMachineSelectionModal(false);
    } else if (machineSelectionType === 'finish') {
      // Finalizar las máquinas seleccionadas - Por petición de usuario: No pedir cantidad
      const closedActsData = selectedMachineIds.map(id => {
        const act = currentActivities.find(a => a.id === id);
        return { 
          id, 
          cantidad: 0, 
          comentarios: '', 
          tiempoTeoricoManual: act?.tiempoTeoricoManual || 0 
        };
      });
      
      if (onAddMultipleActivities) {
        onAddMultipleActivities([], closedActsData);
      } else {
        closedActsData.forEach(c => onEndTurn(selectedUsers, c));
      }
      setShowMachineSelectionModal(false);
      setPendingMecanizadoAction(null);
      return;
    }

    setShowMachineSelectionModal(false);
    setPendingMecanizadoAction(null);
  };

  const handleProductionClick = () => {
    if (selectedUsers.length === 0) {
      setValidationError('⚠️ Seleccione Operarios en el Paso 1');
      return;
    }
    if (!productionTask) {
      setValidationError('⚠️ Seleccione un Formato');
      return;
    }
    
    const payload = { 
      operarios: selectedUsers, 
      formato: productionTask, 
      tipoTarea: TaskType.PRODUCCION, 
      tiempoTeoricoManual: calculatedTheoreticalTime,
    };
    
    handleActionIntercept('add', payload);
    setProductionTask('');
  };

  const handleIncidence = (incidence: IncidenceMaster) => {
    if (selectedUsers.length === 0) {
      setValidationError('⚠️ Seleccione Operarios en el Paso 1');
      return;
    }
    
    handleActionIntercept('add', { 
      operarios: selectedUsers, 
      formato: incidence.nombre, 
      tipoTarea: incidence.tipo, 
      afectaCalidad: incidence.afectaCalidad
    });
  };

  const handleShiftFinalizeRequest = () => {
    if (activities.length === 0) {
      setValidationError("⚠️ El diario está vacío.");
      return;
    }
    const oldestRecord = activities[0];
    const defaultDate = oldestRecord?.fecha || new Date().toISOString().split('T')[0];
    setShiftDate(defaultDate);
    const openSessions = activities.filter(a => !a.horaFin || String(a.horaFin).trim() === "");
    if (openSessions.length > 0) { 
      const allOps: string[] = [];
      openSessions.forEach(s => {
        if (s.operarios) allOps.push(...s.operarios);
      });
      setActiveOperators(Array.from(new Set(allOps))); 
      setIsForcingClosure(false);
      setShowShiftConflictModal(true); 
    }
    else {
      setIsForcingClosure(false);
      // Group production activities by format
      const prodActivities = activities.filter(a => a.tipoTarea === TaskType.PRODUCCION);
      const formats = Array.from(new Set(prodActivities.map(a => a.formato)));
      
      if (formats.length === 0) {
        // No hay actividades de producción, procedemos directamente al PIN
        executeFinalizeShift({});
        return;
      }

      const initialData: Record<string, any> = {};
      formats.forEach(f => {
        const pedirMerma = selectedArea === 'sb-loncheado';
        initialData[f] = {
          cantidad: '0', 
          cantidadNok: '0',
          esProduccion: true,
          ...(pedirMerma ? {
            kgEntrada: '', kgTacos: '', kgPieles: '', kgHueco: '', mediaCombi: '', nEnvases: ''
          } : {})
        };
      });
      setShiftClosureData(initialData);
      setShowShiftClosureModal(true);
    }
  };

  const executeFinalizeShift = (aggregatedQuantities?: Record<string, { cantidad: number, cantidadNok?: number }>, mermasToSave?: any[]) => {
    setPendingShiftFinalization({ fecha: shiftDate, force: isForcingClosure, aggregatedQuantities, mermasToSave });
    setShowPassModal(true);
    setShowShiftConfirmModal(false);
    setShowShiftConflictModal(false);
    setShowShiftClosureModal(false);
    setIsForcingClosure(false);
  };

  const handleConfirmClosure = () => {
    const isValid = Object.values(shiftClosureData).every(d => d.cantidad !== '');
    if (!isValid) {
      setValidationError('⚠️ Por favor, rellene todas las cantidades.');
      return;
    }
    const aggregated: Record<string, { cantidad: number, cantidadNok?: number }> = {};
    const mermasToSave: any[] = [];
    const fecha = shiftDate || new Date().toISOString().split('T')[0];

    Object.entries(shiftClosureData).forEach(([formato, data]) => {
      aggregated[formato] = { 
        cantidad: parseFloat(data.cantidad) || 0,
        cantidadNok: parseFloat(data.cantidadNok || '0') || 0
      };
      // Guardar merma se loncheado e produção
        if (selectedArea === 'sb-loncheado' && data.esProduccion && data.kgEntrada !== undefined) {
          const formatInfo = masterSpeeds.find(ms => ms.formato === formato);
          const formatPeso = formatInfo?.peso || 0;
          const cantOk = parseFloat(data.cantidad || '0') || 0;
          const cantNok = parseFloat(data.cantidadNok || '0') || 0;

          const kgEntrada = parseFloat(data.kgEntrada || '0') || 0;
          const kgTacos = parseFloat(data.kgTacos || '0') || 0;
          const kgPieles = parseFloat(data.kgPieles || '0') || 0;
          const kgHueco = parseFloat(data.kgHueco || '0') || 0;
          const mediaCombi = formatPeso;
          const nEnvases = cantOk + cantNok;
          const kgSalida = nEnvases * mediaCombi;
          const kgMerma = kgEntrada - kgTacos - kgPieles - kgHueco - kgSalida;
          const pctMerma1 = kgEntrada > 0 ? (kgMerma / kgEntrada) * 100 : 0;
          const pctMerma2 = kgEntrada > 0 ? ((kgMerma + kgTacos + kgPieles + kgHueco) / kgEntrada) * 100 : 0;
          mermasToSave.push({
          id: `merma-${Date.now()}-${formato}`,
          fecha, area: selectedArea, formato,
          kgEntrada, kgTacos, kgPieles, kgHueco,
          mediaCombi, nEnvases, kgSalida,
          kgMerma, pctMerma1, pctMerma2
        });
      }
    });
    executeFinalizeShift(aggregated, mermasToSave);
  };

  const getIncidenceBtnClass = (i: IncidenceMaster) => {
    if (i.tipo === TaskType.SIN_TRABAJO) return 'bg-blue-50 text-blue-900 border-blue-100';
    
    if (i.afectaCalidad) return 'bg-red-50 text-red-600 border-red-100';
    
    if (i.tipo === TaskType.AVERIA) return 'bg-orange-50 text-orange-900 border-orange-100';
    return 'bg-amber-50 text-amber-800 border-amber-100';
  };

  const terminalBtnClass = "p-1 text-[16px] font-black rounded-lg uppercase transition-all shadow-sm border h-full flex items-center justify-center text-center tracking-tighter focus:ring-4 outline-none active:scale-95 disabled:opacity-30 min-h-[44px] sm:min-h-[54px]";

  return (
    <div className="flex flex-col gap-0.5 sm:gap-1 relative max-w-full h-full overflow-hidden">
      {/* Error de Validación */}
      {validationError && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-bottom-4">
          <div className="bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border-2 border-red-500">
            <span className="font-black text-[13px] uppercase tracking-widest">{validationError}</span>
            <button 
              onClick={() => setValidationError(null)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      <HelpModal 
        isOpen={isHelpModalOpen} 
        onClose={() => setIsHelpModalOpen(false)} 
        areaId={selectedArea || 'default'} 
      />

      {/* KPI SUMMARY */}
      <div className="grid grid-cols-4 gap-0.5 sm:gap-1 mb-0.5 relative shrink-0">
        <button 
          onClick={() => setIsHelpModalOpen(true)}
          className="absolute -top-1 -right-1 z-20 w-4 h-4 sm:w-6 sm:h-6 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-all active:scale-90 border-2 border-white"
          title="Ayuda"
        >
          <span className="text-[15px] sm:text-xs font-black">?</span>
        </button>
        <div className="bg-white p-0.5 rounded-lg border border-slate-100 shadow-sm flex items-center gap-1 px-1.5">
          <span className="text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-tighter">Dispo</span>
          <span className="text-[15px] sm:text-xs font-black text-slate-900 tracking-tighter">{stats.availability}{stats.availability !== '' ? '%' : ''}</span>
        </div>
        <div className="bg-white p-0.5 rounded-lg border border-slate-100 shadow-sm flex items-center gap-1 px-1.5">
          <span className="text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-tighter">Rend</span>
          <span className="text-[15px] sm:text-xs font-black text-slate-900 tracking-tighter">{stats.performance}{stats.performance !== '' ? '%' : ''}</span>
        </div>
        <div className="bg-white p-0.5 rounded-lg border border-slate-100 shadow-sm flex items-center gap-1 px-1.5">
          <span className="text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-tighter">Calid</span>
          <span className="text-[15px] sm:text-xs font-black text-slate-900 tracking-tighter">{stats.quality}{stats.quality !== '' ? '%' : ''}</span>
        </div>
        <div className="bg-slate-900 p-0.5 rounded-lg border border-slate-800 shadow-md flex items-center gap-1 px-1.5">
          <span className="text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-tighter">Prod</span>
          <span className="text-[15px] sm:text-xs font-black text-white tracking-tighter">{stats.oee}{stats.oee !== '' ? '%' : ''}</span>
        </div>
      </div>

      {/* MODALES OMADOS... */}
      {showShiftConflictModal && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[9700] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden border-[12px] border-amber-50 animate-in zoom-in">
            <div className="bg-amber-500 p-8 text-center text-white">
              <h3 className="font-black text-xs uppercase tracking-widest">⚠️ Tareas aún abiertas</h3>
              <p className="text-amber-100 text-[13px] font-bold mt-2 uppercase">Hay operarios activos en el sistema</p>
            </div>
            <div className="p-8">
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 mb-6 flex flex-wrap gap-2">
                {activeOperators.map(name => <span key={name} className="px-3 py-1 bg-white border border-amber-200 rounded-lg text-[13px] font-bold text-amber-900 uppercase">{name}</span>)}
              </div>
              <p className="text-[14px] font-bold text-slate-500 uppercase text-center mb-6 leading-relaxed">
                No se puede cerrar el turno mientras haya formatos activos. <br/> <span className="text-amber-600 font-black">Por favor, pida a los operarios listados que cierren sus formatos antes de proceder.</span>
              </p>
              <div className="flex flex-col gap-3">
                <button onClick={() => { setShowShiftConflictModal(false); setIsForcingClosure(false); }} className="w-full py-5 rounded-2xl bg-slate-900 text-white text-[14px] font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95">Entendido</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showShiftClosureModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9000] p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="bg-slate-900 p-5">
              <h2 className="text-white font-black text-[15px] uppercase tracking-widest">Cerrar Turno</h2>
              <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mt-0.5">Introduce las cantidades por formato</p>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-5 space-y-4">
              {Object.keys(shiftClosureData).map(formato => {
                const d = shiftClosureData[formato];
                const showMerma = isLoncheadoArea && d.esProduccion;
                const kgEntrada = parseFloat(d.kgEntrada || '0') || 0;
                const kgTacos = parseFloat(d.kgTacos || '0') || 0;
                const kgPieles = parseFloat(d.kgPieles || '0') || 0;
                const kgHueco = parseFloat(d.kgHueco || '0') || 0;
                
                const formatInfo = masterSpeeds.find(ms => ms.formato === formato);
                const formatPeso = formatInfo?.peso || 0;
                const cantOk = parseFloat(d.cantidad || '0') || 0;
                const cantNok = parseFloat(d.cantidadNok || '0') || 0;

                const mediaCombi = formatPeso;
                const nEnvases = cantOk + cantNok;
                const kgSalida = nEnvases * mediaCombi;
                const kgMerma = kgEntrada - kgTacos - kgPieles - kgHueco - kgSalida;
                const pctMerma1 = kgEntrada > 0 ? (kgMerma / kgEntrada * 100) : 0;
                const pctMerma2 = kgEntrada > 0 ? ((kgMerma + kgTacos + kgPieles + kgHueco) / kgEntrada) * 100 : 0;
                return (
                  <div key={formato} className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <h3 className="font-black text-slate-900 uppercase mb-3 text-[13px] tracking-wide">{formato}</h3>
                    {/* Cantidades */}
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Cantidad OK</label>
                        <input type="number" value={d.cantidad}
                          onChange={(e) => setShiftClosureData(prev => ({ ...prev, [formato]: { ...prev[formato], cantidad: e.target.value } }))}
                          className="w-full border-2 border-slate-200 p-2 rounded-xl font-bold text-[14px] focus:border-slate-900 outline-none" placeholder="0" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-red-500 uppercase mb-1">CANTIDAD A REPROCESAR</label>
                        <input type="number" value={d.cantidadNok || ''}
                          onChange={(e) => setShiftClosureData(prev => ({ ...prev, [formato]: { ...prev[formato], cantidadNok: e.target.value } }))}
                          className="w-full border-2 border-red-50 p-2 rounded-xl font-bold text-[14px] focus:border-red-400 outline-none text-red-600" placeholder="0" />
                      </div>
                    </div>
                    {/* Merma - só Loncheado e produção */}
                    {showMerma && (
                      <div className="border-t border-slate-200 pt-3 mt-1">
                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2">Merma</p>
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          {[
                            { label: 'Kg Entrada', key: 'kgEntrada' },
                            { label: 'Kg Tacos', key: 'kgTacos' },
                            { label: 'Kg Pieles', key: 'kgPieles' },
                            { label: 'Kg Hueco', key: 'kgHueco' },
                          ].map(({ label, key }) => (
                            <div key={key}>
                              <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">{label}</label>
                              <input type="number" step="0.01" min="0"
                                value={(d as any)[key] || ''}
                                onChange={(e) => setShiftClosureData(prev => ({ ...prev, [formato]: { ...prev[formato], [key]: e.target.value } }))}
                                className="w-full border-2 border-slate-200 p-1.5 rounded-lg font-bold text-[13px] focus:border-amber-400 outline-none"
                                placeholder="0" />
                            </div>
                          ))}
                          <div>
                            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Media combinada</label>
                            <input type="number" readOnly
                              value={mediaCombi}
                              className="w-full border-2 border-slate-100 bg-slate-100 p-1.5 rounded-lg font-bold text-[13px] outline-none text-slate-500" />
                          </div>
                          <div>
                            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">nº envases</label>
                            <input type="number" readOnly
                              value={nEnvases}
                              className="w-full border-2 border-slate-100 bg-slate-100 p-1.5 rounded-lg font-bold text-[13px] outline-none text-slate-500" />
                          </div>
                        </div>
                        {/* Resultados calculados */}
                        {kgEntrada > 0 && (
                          <div className="grid grid-cols-4 gap-2 mt-2">
                            <div className="bg-white rounded-lg p-2 border border-slate-200 text-center">
                              <p className="text-[8px] font-black text-slate-400 uppercase">Kg Envasados</p>
                              <p className="text-[13px] font-black text-slate-900">{kgSalida.toFixed(1)}</p>
                            </div>
                            <div className="bg-white rounded-lg p-2 border border-slate-200 text-center">
                              <p className="text-[8px] font-black text-slate-400 uppercase">Kg Merma</p>
                              <p className="text-[13px] font-black text-amber-600">{kgMerma.toFixed(1)}</p>
                            </div>
                            <div className={`rounded-lg p-2 border text-center ${pctMerma1 > 5 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                              <p className="text-[8px] font-black text-slate-400 uppercase">% Merma 1</p>
                              <p className={`text-[13px] font-black ${pctMerma1 > 5 ? 'text-red-600' : 'text-emerald-600'}`}>{pctMerma1.toFixed(1)}%</p>
                            </div>
                            <div className={`rounded-lg p-2 border text-center ${pctMerma2 > 5 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                              <p className="text-[8px] font-black text-slate-400 uppercase">% Merma 2</p>
                              <p className={`text-[13px] font-black ${pctMerma2 > 5 ? 'text-red-600' : 'text-emerald-600'}`}>{pctMerma2.toFixed(1)}%</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 p-4 border-t border-slate-100">
              <button onClick={() => setShowShiftClosureModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-400 font-black rounded-xl uppercase text-[12px]">Cancelar</button>
              <button onClick={() => handleConfirmClosure()} className="flex-[2] py-3 bg-blue-600 text-white font-black rounded-xl uppercase text-[12px] hover:bg-blue-700 transition-colors">
                Confirmar Cierre
              </button>
            </div>
          </div>
        </div>
      )}

      {showShiftConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[9600] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[3rem] border-[12px] border-blue-50 animate-in zoom-in shadow-2xl overflow-hidden">
            <div className={`p-8 text-center text-white ${isForcingClosure ? 'bg-amber-600' : 'bg-blue-600'}`}>
              <h3 className="font-black text-xs uppercase tracking-[0.2em]">
                {isForcingClosure ? 'Confirmar Cierre Forzado' : 'Cierre y Archivado'}
              </h3>
              <p className="text-blue-100 text-[13px] font-bold mt-2 uppercase tracking-widest opacity-80">
                Seleccione los parámetros finales del turno
              </p>
            </div>
            <div className="p-10 space-y-8">
              <div className="space-y-3">
                <label className="text-[14px] font-black text-slate-400 uppercase tracking-widest ml-1">FECHA DEL TURNO</label>
                <input 
                  type="date" 
                  value={shiftDate}
                  onChange={(e) => setShiftDate(e.target.value)}
                  className={`w-full p-4 bg-slate-50 border-2 rounded-2xl font-black outline-none focus:ring-4 ring-blue-50 transition-all text-sm ${isForcingClosure ? 'text-amber-600 border-amber-100' : 'text-blue-600 border-slate-100'}`}
                />
              </div>
              <div className={`p-4 rounded-2xl border ${isForcingClosure ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'}`}>
                <p className={`text-[13px] font-bold text-center uppercase tracking-widest leading-relaxed ${isForcingClosure ? 'text-amber-800' : 'text-blue-700'}`}>
                  {isForcingClosure 
                    ? `⚠️ Todas las tareas abiertas se cerrarán ahora con cantidad 0.` 
                    : `Confirmado: Los registros se archivarán con fecha `} 
                  <span className="font-black underline">{shiftDate}</span>
                </p>
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => { setShowShiftConfirmModal(false); setIsForcingClosure(false); }} className="flex-1 py-5 rounded-2xl bg-slate-100 text-slate-400 text-[14px] font-black uppercase tracking-widest transition-all">Cancelar</button>
                <button 
                  onClick={() => executeFinalizeShift()} 
                  className={`flex-[2] py-5 rounded-2xl text-white text-[14px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 ${isForcingClosure ? 'bg-amber-600 shadow-amber-100 hover:bg-amber-700' : 'bg-blue-600 shadow-blue-100 hover:bg-blue-700'}`}
                >
                  {isForcingClosure ? 'Archivar Forzado' : 'Archivar Turno'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PANEL DE CONTROL SUPERIOR */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-1 no-scrollbar">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-1 sm:gap-1.5">
          <div className="flex flex-col gap-1 sm:gap-1.5">
            <section className={`p-1 sm:p-1.5 rounded-lg border bg-white shadow-sm ${selectedUsers.length === 0 ? 'border-blue-400 ring-2 ring-blue-50' : 'border-slate-200'}`}>
              <h2 className="text-[14px] font-black mb-0.5 text-blue-600 uppercase">1. OPERARIOS</h2>
            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1 bg-slate-50 rounded-md border border-slate-100">
              {operarios.map(u => (
                <label key={u.id} className={`flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer transition-all ${selectedUsers.includes(u.nombre) ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
                  <input 
                    type="checkbox" 
                    className="hidden"
                    checked={selectedUsers.includes(u.nombre)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedUsers([...selectedUsers, u.nombre]);
                      else setSelectedUsers(selectedUsers.filter(n => n !== u.nombre));
                    }}
                  />
                  <span className="text-[12px] font-black uppercase">{u.nombre}</span>
                </label>
              ))}
            </div>
            {selectedUsers.length > 0 && (
              <div className="flex gap-2 mt-3">
                <button onClick={() => setSelectedUsers(operarios.map(u => u.nombre))} className="flex-1 py-3 bg-blue-100 text-blue-600 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-blue-200 transition-all">Seleccionar Todos</button>
                <button onClick={() => setSelectedUsers([])} className="flex-1 py-3 bg-slate-200 text-slate-600 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-red-100 hover:text-red-500 transition-all">Limpiar Selección</button>
              </div>
            )}
            {selectedUsers.length === 0 && (
              <button onClick={() => setSelectedUsers(operarios.map(u => u.nombre))} className="w-full mt-3 py-3 bg-blue-100 text-blue-600 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-blue-200 transition-all">Seleccionar Todos</button>
            )}
            {currentActivities.length > 0 && (
              <div className="mt-0.5 p-0.5 bg-blue-50 border border-blue-100 rounded-md">
                <p className="font-black text-slate-900 text-[14px] leading-tight uppercase">{currentActivity.formato}</p>
              </div>
            )}
            <button onClick={() => handleActionIntercept('end')} disabled={selectedUsers.length === 0 || currentActivities.length === 0} className="w-full mt-0.5 py-1 text-[14px] font-black rounded-md border border-red-100 bg-red-50 text-red-600 uppercase disabled:opacity-10">
              Finalizar Tarea
            </button>
          </section>
          
          <section className={`p-1 sm:p-1.5 rounded-lg border bg-white shadow-sm border-slate-200 ${selectedUsers.length === 0 ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
            <h2 className="text-[14px] font-black text-emerald-600 mb-0.5 uppercase">2. PRODUCCIÓN</h2>
            <div className="space-y-0.5">
              <div className="flex flex-col">
                <label className="text-[9px] sm:text-[10px] font-black text-blue-500 uppercase tracking-widest mb-0.5 ml-1">FORMATO</label>
                <select value={productionTask} onChange={(e) => setProductionTask(e.target.value)} className="w-full p-1 sm:p-1.5 bg-slate-50 border rounded-lg text-[10px] sm:text-[15px] font-black uppercase outline-none focus:ring-2 ring-blue-100">
                  <option value="">-- SELECCIONE FORMATO --</option>
                  {availableProductionTasks.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              
              {productionTask && (
                <div className="mt-2 p-2 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center justify-between animate-in slide-in-from-bottom-2">
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Tiempo Teórico</span>
                  <span className="text-xs font-black text-emerald-700">{calculatedTheoreticalTime} min</span>
                </div>
              )}
            </div>
            
            <button 
              disabled={selectedUsers.length === 0 || !productionTask} 
              onClick={handleProductionClick} 
              className="w-full mt-2 py-4 text-[15px] font-black rounded-lg uppercase bg-emerald-600 text-white shadow-md disabled:bg-slate-200 active:scale-95 transition-all"
            >
              Iniciar Actividad
            </button>
          </section>
        </div>

        <div className={`lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3 ${selectedUsers.length === 0 ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
            <section className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl border bg-white shadow-sm border-slate-200 ${selectedUsers.length === 0 ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
              <h2 className="text-[14px] font-black text-amber-600 uppercase mb-1">3. ESPERAS</h2>
              <div className="grid grid-cols-2 gap-1 flex-1">{incidenceMaster.filter(i => i.tipo === TaskType.ESPERAS).map(i => <button key={i.id} onClick={() => handleIncidence(i)} className={`${terminalBtnClass} ${getIncidenceBtnClass(i)}`}>{i.nombre}</button>)}</div>
            </section>
            <section className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl border bg-white border-slate-200 shadow-sm h-full flex flex-col">
              <h2 className="text-[14px] font-black text-orange-600 uppercase mb-1">4. AVERÍAS</h2>
              <div className="grid grid-cols-2 gap-1 flex-1">{incidenceMaster.filter(i => i.tipo === TaskType.AVERIA || i.tipo === TaskType.SIN_TRABAJO).map(i => <button key={i.id} onClick={() => handleIncidence(i)} className={`${terminalBtnClass} ${getIncidenceBtnClass(i)}`}>{i.nombre}</button>)}</div>
            </section>
        </div>
        </div>
      </div>

      {/* DIARIO DE TURNO */}
      <section className={`flex-1 min-h-0 p-2 rounded-2xl border-2 shadow-xl flex flex-col w-full overflow-hidden mb-4 ${isAdminMode ? 'bg-blue-900 border-blue-700' : 'bg-white border-slate-50'}`}>
        <div className="flex justify-between items-center mb-1 px-1 shrink-0">
          <div className="flex items-center gap-1.5">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[14px] shadow-md ${isAdminMode ? 'bg-white text-blue-900' : 'bg-slate-900 text-white'}`}>DT</div>
            <h2 className={`text-[14px] font-black uppercase ${isAdminMode ? 'text-white' : 'text-slate-900'}`}>Diario de Turno</h2>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => isAdminMode ? setIsAdminMode(false) : setShowPassModal(true)} className={`px-2 py-1 rounded-lg text-[14px] font-black border ${isAdminMode ? 'bg-red-500 text-white' : 'bg-slate-900 text-white'}`}>{isAdminMode ? 'SALIR MODO JEFE' : 'JEFE TURNO'}</button>
            <button onClick={handleShiftFinalizeRequest} className="px-2 py-1 text-[14px] font-black rounded-lg bg-blue-600 text-white border-b-2 border-blue-800">Cerrar Turno</button>
          </div>
        </div>
        <div className={`flex-1 overflow-hidden rounded-xl border ${isAdminMode ? 'bg-blue-950/40 border-blue-800' : 'bg-slate-50/10 border-slate-100'}`}>
          <div className="max-h-[70vh] overflow-auto no-scrollbar">
            <table className="w-full text-left text-[14px] border-collapse">
              <thead className={`font-black uppercase tracking-wider border-b sticky top-0 z-10 ${isAdminMode ? 'text-blue-300 bg-blue-900' : 'text-slate-500 bg-slate-50'}`}>
                <tr>
             <th className="px-2 py-2">OPERARIOS</th>
                  <th className="px-2 py-2">FORMATO</th>
                  <th className="px-2 py-2 text-center">INTERVALO</th>
                  <th className="px-2 py-2 text-center">T. REAL</th>
                  {selectedArea !== 'sb-preparacion' && <th className="px-2 py-2 text-center">T. TEO</th>}
                  <th className="px-2 py-2">COMENTARIOS</th>
                  {isAdminMode && <th className="px-2 py-2 text-center">ACCIONES</th>}
                </tr>
              </thead>
              <tbody className={`divide-y ${isAdminMode ? 'divide-blue-900 text-blue-100' : 'divide-slate-50 text-slate-700'}`}>
                {sortedActivities.map((act, idx) => (
                  <tr key={`${act.id}-${idx}`}>
                    {editingId === act.id ? (
                      <>
                        <td className="px-2 py-1.5"><input type="text" value={act.operarios?.join(', ') || ''} readOnly className="w-full p-1 text-[14px] border rounded bg-slate-100 text-slate-500 font-bold uppercase" /></td>
                        <td className="px-2 py-1.5">
                          <div className="flex flex-col gap-1">
                            <input type="text" value={editForm.formato || ''} onChange={e => setEditForm({...editForm, formato: e.target.value})} className="w-full p-1 text-[14px] border rounded bg-white text-slate-900 font-bold uppercase" placeholder="FORMATO" />
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-black text-emerald-600 uppercase">U/H:</span>
                              <input type="number" step="0.1" value={editForm.tiempoTeoricoManual || 0} onChange={e => setEditForm({...editForm, tiempoTeoricoManual: parseFloat(e.target.value) || 0})} className="w-16 p-1 text-[12px] border rounded bg-white text-slate-900 font-bold" />
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <div className="flex gap-1 items-center justify-center">
                            <input type="text" value={editForm.horaInicio || ''} onChange={e => setEditForm({...editForm, horaInicio: e.target.value})} className="w-12 p-1 text-[15px] border rounded bg-white text-slate-900 font-bold" />
                            <span>-</span>
                            <input type="text" value={editForm.horaFin || ''} onChange={e => setEditForm({...editForm, horaFin: e.target.value})} className="w-12 p-1 text-[15px] border rounded bg-white text-slate-900 font-bold" />
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-center">-</td>
                        <td className="px-2 py-1.5 text-center">-</td>
                        <td className="px-2 py-1.5"><input type="text" value={editForm.comentarios || ''} onChange={e => setEditForm({...editForm, comentarios: e.target.value})} className="w-full p-1 text-[14px] border rounded bg-white text-slate-900 font-bold" /></td>
                        <td className="px-2 py-1.5 flex justify-center gap-1">
                          <button onClick={handleSaveEdit} className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors shadow-sm">
                            <Check className="w-3 h-3" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1 bg-slate-400 text-white rounded hover:bg-slate-500 transition-colors shadow-sm">
                            <X className="w-3 h-3" />
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-2 py-1.5 font-black uppercase text-[12px]">{act.operarios?.join(', ')}</td>
                        <td className="px-2 py-1.5">
                          <span className="font-black uppercase">{act.formato}</span> 
                          {act.tiempoTeoricoManual !== undefined && <span className="text-[14px] text-emerald-600 block font-black uppercase tracking-tighter">U/H: {act.tiempoTeoricoManual}</span>}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[14px] font-black text-white shrink-0 ${
                              act.tipoTarea === TaskType.PRODUCCION ? 'bg-emerald-500' :
                              act.tipoTarea === TaskType.ESPERAS ? 'bg-amber-500' :
                              act.tipoTarea === TaskType.AVERIA ? 'bg-orange-600' :
                              'bg-blue-600'
                            }`}>
                              {act.tipoTarea}
                            </div>
                            <span className="font-bold">{act.horaInicio} - {act.horaFin || 'ACTIVO'}</span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-center"><span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-lg font-black">{act.duracionMin || calculateDuration(act.horaInicio, currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}))}m</span></td>
                        {selectedArea !== 'sb-preparacion' && (
                          <td className="px-2 py-1.5 text-center font-black text-emerald-600">
                            {act.tipoTarea === TaskType.PRODUCCION && act.tiempoTeoricoManual !== undefined && act.cantidad > 0
                              ? `${((act.tiempoTeoricoManual > 0 ? (60 / act.tiempoTeoricoManual) : 0) * act.cantidad).toFixed(1)}m` 
                              : '-'}
                          </td>
                        )}
                        <td className="px-2 py-1.5 text-[14px] font-medium italic opacity-70 max-w-[150px] break-words">{act.comentarios || '---'}</td>
                        {isAdminMode && (
                          <td className="px-2 py-1.5">
                            <div className="flex justify-center gap-1">
                              <button onClick={() => handleEdit(act)} className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button onClick={() => handleDelete(act.id)} className="p-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* MODAL SELECCIÓN MÁQUINAS MECANIZADO */}
      {showMachineSelectionModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[8000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in border-8 border-blue-50">
            <div className="bg-blue-600 p-8 text-center text-white relative">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-900 px-6 py-2 rounded-full text-[12px] font-black uppercase tracking-widest shadow-xl animate-pulse z-10 border-2 border-white">
                MARCA LAS QUE QUIERES CERRAR
              </div>
              <h3 className="font-black text-xs uppercase tracking-widest mt-2">
                {machineSelectionType === 'incidence' ? 'Aplicar Incidencia' : 
                 machineSelectionType === 'finish' ? 'Finalizar Tareas' : 
                 'Nueva Tarea Detectada'}
              </h3>
              <p className="text-blue-100 text-[14px] font-bold mt-2 uppercase">
                {machineSelectionType === 'start_conflict' 
                  ? '¿Deseas cerrar alguno de los formatos actuales?' 
                  : 'Selecciona las máquinas afectadas'}
              </p>
            </div>
            <div className="p-8">
              <div className="space-y-2 mb-6 max-h-60 overflow-y-auto pr-2 no-scrollbar">
                {currentActivities.map((act, idx) => (
                  <label key={`${act.id}-${idx}`} className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer group ${selectedMachineIds.includes(act.id) ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                    <input 
                      type="checkbox" 
                      checked={selectedMachineIds.includes(act.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMachineIds([...selectedMachineIds, act.id]);
                        } else {
                          setSelectedMachineIds(selectedMachineIds.filter(id => id !== act.id));
                        }
                      }}
                      className="w-6 h-6 rounded-lg border-2 border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <p className="text-slate-900 text-[16px] font-black uppercase">{act.formato}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    setShowMachineSelectionModal(false);
                    setPendingMecanizadoAction(null);
                  }} 
                  className="flex-1 py-5 rounded-2xl bg-slate-100 text-slate-400 font-black uppercase text-[14px]"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmMecanizadoMachineSelection}
                  className="flex-[2] py-5 rounded-2xl bg-blue-600 text-white font-black uppercase text-[14px] shadow-xl hover:bg-blue-700 transition-all active:scale-95"
                >
                  Continuar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CIERRE DE ACTIVIDAD Y PIN... */}
      {showClosureModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[7000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in border-8 border-slate-50">
            <div className="bg-slate-900 p-8 text-center text-white"><h3 className="font-black text-xs uppercase tracking-widest">Finalizar Actividad</h3><p className="text-blue-400 text-[14px] font-bold mt-2 uppercase">{currentActivity?.formato}</p></div>
            <div className="p-10 space-y-6">
              <div className="space-y-3">
                <label className="text-[16px] font-black text-slate-400 uppercase tracking-widest ml-1">COMENTARIOS / OBSERVACIONES</label>
                <textarea ref={commentsRef} value={closureComments} onChange={(e) => setClosureComments(e.target.value)} className="w-full bg-slate-50 border-4 border-slate-100 rounded-3xl p-5 text-base font-bold text-slate-700 outline-none focus:border-blue-500 min-h-[100px]" placeholder="Añade algún detalle..." />
              </div>
              <div className="flex gap-4">
                <button onClick={() => setShowClosureModal(false)} className="flex-1 py-5 rounded-2xl bg-slate-100 text-slate-400 text-[16px] font-black uppercase">Cancelar</button>
                <button onClick={confirmClosure} className="flex-[2] py-5 rounded-2xl bg-blue-600 text-white text-[16px] font-black uppercase shadow-xl hover:bg-blue-700">Confirmar Cierre</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPassModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-[320px] rounded-[2rem] shadow-2xl overflow-hidden border-4 border-slate-800 animate-in zoom-in duration-200">
            <div className="bg-slate-900 p-6 text-center text-white">
              <h3 className="font-black text-[16px] uppercase tracking-[0.3em]">Acceso Jefe de Turno</h3>
              <div className="flex justify-center gap-3 mt-6">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={`w-3 h-3 rounded-full border-2 ${pin.length > i ? 'bg-blue-500 border-blue-500' : 'bg-transparent border-slate-700'}`}></div>
                ))}
              </div>
            </div>
            <div className="p-6 bg-slate-50 grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'ESC', 0, 'DEL'].map((num) => (
                <button key={num} onClick={() => num === 'ESC' ? (setShowPassModal(false), setPin('')) : num === 'DEL' ? setPin(pin.slice(0, -1)) : pin.length < 4 && setPin(pin + num)} className="h-12 rounded-xl bg-white border-b-2 border-slate-200 text-lg font-black text-slate-700 active:scale-90 transition-all hover:bg-slate-100">{num}</button>
              ))}
              {pinError && <p className="col-span-3 text-center text-red-500 font-black text-[17px] uppercase mt-3 animate-bounce">❌ PIN INCORRECTO</p>}
            </div>
          </div>
        </div>
      )}

      {/* MODAL MULTIPLE START (TRATAMIENTOS) */}
      {showMultipleStartModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[8000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in border-8 border-blue-50">
            <div className="bg-blue-600 p-8 text-center text-white">
              <h3 className="font-black text-sm uppercase tracking-widest">¿Iniciar otra actividad?</h3>
              <p className="text-blue-100 text-[16px] font-bold mt-2 uppercase">Has seleccionado {pendingActivities.length} actividad(es)</p>
            </div>
            <div className="p-8 space-y-4">
              <div className="max-h-40 overflow-y-auto space-y-2 mb-4">
                {pendingActivities.map((act, i) => (
                  <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-[16px] font-black text-slate-900 uppercase">{act.formato}</span>
                    </div>
                    <button onClick={() => setPendingActivities(pendingActivities.filter((_, idx) => idx !== i))} className="text-red-500 p-1 hover:bg-red-50 rounded-lg">✖</button>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                <button onClick={addAnotherActivity} className="w-full py-4 rounded-2xl bg-blue-50 text-blue-600 text-[14px] font-black uppercase tracking-widest border-2 border-blue-100 hover:bg-blue-100 transition-all">
                  ➕ Añadir otra actividad
                </button>
                <button onClick={confirmMultipleStart} className="w-full py-5 rounded-2xl bg-blue-600 text-white text-[14px] font-black uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">
                  🚀 Iniciar Actividades ({pendingActivities.length})
                </button>
                <button onClick={() => { setShowMultipleStartModal(false); setPendingActivities([]); }} className="w-full py-3 rounded-2xl bg-slate-100 text-slate-400 text-[14px] font-black uppercase">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MULTIPLE CLOSURE (TRATAMIENTOS / MECANIZADO) */}
      {showMultipleClosureModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[8000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in border-8 border-indigo-50">
            <div className="bg-indigo-600 p-8 text-center text-white relative">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-900 px-6 py-2 rounded-full text-[12px] font-black uppercase tracking-widest shadow-xl animate-pulse z-10 border-2 border-white">
                MARCA LAS QUE QUIERES CERRAR
              </div>
              <h3 className="font-black text-xs uppercase tracking-widest mt-2">Cierre de Actividades Simultáneas</h3>
              <p className="text-indigo-100 text-[14px] font-bold mt-2 uppercase">Selecciona las actividades a finalizar e indica su cantidad</p>
            </div>
            <div className="p-8 space-y-6">
              <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
                {currentActivities.map((act, idx) => (
                  <div key={`${act.id}-${idx}`} className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${closureDataMap[act.id]?.selected ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100 opacity-50'}`}>
                    <input 
                      type="checkbox" 
                      checked={closureDataMap[act.id]?.selected || false} 
                      onChange={(e) => setClosureDataMap({...closureDataMap, [act.id]: {...closureDataMap[act.id], selected: e.target.checked}})}
                      className="w-6 h-6 rounded-lg border-2 border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-[16px] font-black text-slate-900 uppercase block leading-tight truncate">{act.formato}</span>
                    </div>
                    <div className="flex gap-3 items-end flex-1">
                      <div className="flex-1">
                        <label className="text-[11px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Comentario</label>
                        <input 
                          type="text" 
                          placeholder="Opcional..."
                          value={closureDataMap[act.id]?.comentarios || ''} 
                          onChange={(e) => setClosureDataMap({...closureDataMap, [act.id]: {...closureDataMap[act.id], comentarios: e.target.value}})}
                          className="w-full p-2 bg-white border-2 border-indigo-100 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-indigo-500"
                          disabled={!closureDataMap[act.id]?.selected}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-4">
                <button onClick={() => { setShowMultipleClosureModal(false); setPendingAction(null); setPendingActivities([]); }} className="flex-1 py-5 rounded-2xl bg-slate-100 text-slate-400 text-[14px] font-black uppercase">Cancelar</button>
                <button onClick={confirmMultipleClosure} className="flex-[2] py-5 rounded-2xl bg-indigo-600 text-white text-[14px] font-black uppercase shadow-xl hover:bg-indigo-700 transition-all">Continuar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* MODAL CONFIRM DELETE */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in border-4 border-red-50">
            <div className="bg-red-600 p-6 text-center text-white">
              <Trash2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="font-black text-lg uppercase tracking-widest">¿Eliminar Registro?</h3>
              <p className="text-red-100 text-xs font-bold mt-2 uppercase">Esta acción no se puede deshacer y afectará a los indicadores.</p>
            </div>
            <div className="p-6 flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-4 rounded-xl bg-slate-100 text-slate-400 font-black uppercase text-xs">Cancelar</button>
              <button onClick={confirmDelete} className="flex-1 py-4 rounded-xl bg-red-600 text-white font-black uppercase text-xs shadow-lg shadow-red-200">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkPanel;
