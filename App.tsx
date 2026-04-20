import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Header from './components/Header';
import WorkPanel from './components/WorkPanel';
import ConfigPanel from './components/ConfigPanel';
import MainMenu from './components/MainMenu';
import RootMenu from './components/RootMenu';
import ActionPlanPanel from './components/ActionPlanPanel';
import TOP15Indicators from './components/TOP15Indicators';
import TOP60Dashboard from './components/TOP60Dashboard';
import TOP60Preparacion from './components/TOP60Preparacion';
import DatabasePanel from './components/DatabasePanel';
import GlobalUserConfig from './components/GlobalUserConfig';
import PasswordConfigModal from './components/PasswordConfigModal';
import GlobalHelpModal from './components/GlobalHelpModal';
import ConnectionHelpModal from './components/ConnectionHelpModal';
import Login from './components/Login';
import UserManager from './components/UserManager';
import { SalaBlancaDashboard, EnvasadoDashboard, ExpedicionesDashboard } from './components/SalaBlancaDashboard';
import { 
  Home, 
  ChevronLeft, 
  HelpCircle, 
  Users, 
  Settings, 
  Cloud, 
  CloudOff,
  Activity as ActivityIcon,
  Database,
  Terminal,
  LayoutDashboard,
  Calendar,
  BarChart3,
  Lock,
  LogOut
} from 'lucide-react';
import { Activity, MasterSpeed, IncidenceMaster, TaskType, OEEObjectives, User } from './types';
import { getInitialMasterSpeeds, getInitialOperarios, getInitialIncidenceMaster, INITIAL_OEE_OBJECTIVES, AREA_NAMES, INITIAL_ACTION_PLAN_TOP15, JOSELITO_LOGO } from './constants';
import { supabase, isConfigured, debugConfig } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { calcDuration } from './src/utils.ts';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const App: React.FC = () => {
  console.log("App: Component rendering...");
  const [currentView, setCurrentView] = useState<'root-menu' | 'menu' | 'area'>('root-menu');
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [selectedWorkshop, setSelectedWorkshop] = useState<number | null>(null);
  const [selectedArea, setSelectedArea] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'work' | 'config' | 'database'>('work');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [history, setHistory] = useState<Activity[]>([]);
  const globalActivitiesRef = useRef<Activity[]>([]);
  const globalHistoryRef = useRef<Activity[]>([]);
  const lastHistoryLimitRef = useRef<string | null>(null);

  const [userLevel, setUserLevel] = useState<number>(0);
  const [showUserManager, setShowUserManager] = useState(false);

  // Keep global cache in sync with current state to prevent stale data overwrites in loadData
  useEffect(() => {
    if (!selectedArea) return;
    const otherAreasActs = globalActivitiesRef.current.filter(a => a && a.area !== selectedArea);
    globalActivitiesRef.current = [...otherAreasActs, ...activities];
  }, [activities, selectedArea]);
  const loadDataRequestIdRef = useRef<number>(0);
  const globalObjectivesRef = useRef<Record<string, OEEObjectives[]>>({});
  const [operarios, setOperarios] = useState<User[]>([]);
  const [masterSpeeds, setMasterSpeeds] = useState<MasterSpeed[]>([]);
  const [incidenceMaster, setIncidenceMaster] = useState<IncidenceMaster[]>([]);
  const [oeeObjectives, setOeeObjectives] = useState<OEEObjectives>(INITIAL_OEE_OBJECTIVES);
  const [mermas, setMermas] = useState<any[]>([]);
  const [allObjectives, setAllObjectives] = useState<Record<string, OEEObjectives[]>>({});
  const [responsibles, setResponsibles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [globalUsers, setGlobalUsers] = useState<User[]>([]);
  const [top15Users, setTop15Users] = useState<User[]>([]);
  const [top60Users, setTop60Users] = useState<User[]>([]);
  const [showGlobalUserConfig, setShowGlobalUserConfig] = useState(false);
  const [showGlobalPinModal, setShowGlobalPinModal] = useState(false);
  const [showPasswordConfig, setShowPasswordConfig] = useState(false);
  const [showTop60PinModal, setShowTop60PinModal] = useState(false);
  const [top60Pin, setTop60Pin] = useState('');
  const [top60PinError, setTop60PinError] = useState(false);
  const [globalPin, setGlobalPin] = useState('');
  const [globalPinError, setGlobalPinError] = useState(false);
  const [passwords, setPasswords] = useState({
    jefeEquipo: '1234',
    jefeTaller: '1234',
    directorOperaciones: '1234',
    asistenciaTecnica: '1234'
  });

  const [top60SubView, setTop60SubView] = useState<'plan' | 'dashboard'>('dashboard');
  const [top60Access, setTop60Access] = useState<'cmi' | 'preparacion' | null>(null);
  const [top15SubView, setTop15SubView] = useState<'plan' | 'indicators'>('indicators');
  const [isGlobalHelpOpen, setIsGlobalHelpOpen] = useState(false);
  const [isConnectionHelpOpen, setIsConnectionHelpOpen] = useState(false);
  const isFetchingRef = useRef(false);

  // Helper para guardar en localStorage de forma segura
  const safeLocalStorageSetItem = useCallback((key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn(`LocalStorage quota exceeded for key: ${key}. Attempting to prune...`);
        // Si es histórico o cola de sincronización, podemos podarlo
        if (key.includes('history') || key === 'zitron_sync_queue') {
          try {
            const data = JSON.parse(value);
            if (Array.isArray(data)) {
              // Mantener solo los últimos 100 elementos para liberar espacio
              const pruned = data.slice(-100);
              localStorage.setItem(key, JSON.stringify(pruned));
              return true;
            }
          } catch (e2) {
            console.error("Failed to prune data for localStorage:", e2);
          }
        }
        // Si no se pudo podar o es otra clave, intentamos borrar cosas viejas de forma más agresiva
        console.warn("Attempting to clear old history to make room...");
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.includes('history') || k.includes('activities')) && k !== key) {
              keysToRemove.push(k);
            }
          }
          keysToRemove.forEach(k => localStorage.removeItem(k));
          
          localStorage.setItem(key, value);
          return true;
        } catch (e3) {
          console.error("Final LocalStorage failure:", e3);
        }
      }
      console.error(`Error saving to localStorage [${key}]:`, e);
      return false;
    }
  }, []);
  const [lastConnectionError, setLastConnectionError] = useState<string | null>(null);
  const [showForceClose, setShowForceClose] = useState(false);

  const [isBackendReady, setIsBackendReady] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

  const [syncQueue, setSyncQueue] = useState<{
    id: string;
    table: string;
    type: 'insert' | 'update' | 'delete' | 'upsert';
    data?: any;
    filter?: { column: string; value?: any };
    timestamp: number;
  }[]>(() => {
    try {
      const saved = localStorage.getItem('zitron_sync_queue');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.warn("Error parsing sync queue:", e);
    }
    return [];
  });

  const syncQueueRef = useRef(syncQueue);
  useEffect(() => {
    syncQueueRef.current = syncQueue;
  }, [syncQueue]);

  useEffect(() => {
    const fetchUserLevel = async (userId: string, email?: string) => {
      // Hardcoded owner check as fallback
      if (email === 'sgsjoselito2@gmail.com') {
        setUserLevel(3);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_permissions')
          .select('level')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (!error && data) {
          setUserLevel(data.level);
        } else {
          setUserLevel(1);
        }
      } catch (e) {
        setUserLevel(1);
      }
    };

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchUserLevel(session.user.id, session.user.email);
      setIsAuthLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) fetchUserLevel(session.user.id, session.user.email);
      else setUserLevel(0);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentView('root-menu');
    setSelectedArea(undefined);
    setSelectedWorkshop(null);
  };

  useEffect(() => {
    console.log("App: Supabase Config Status:", isConfigured ? "✅" : "❌");
    console.log("App: Debug Config:", debugConfig);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const checkBackend = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const res = await fetch(`/api/health-v2?t=${Date.now()}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (res.ok && isMounted) {
          const data = await res.json();
          console.log("Backend version:", data.version);
          console.log("Backend Supabase Configured:", data.supabaseConfigured);
          if (data.supabaseConfigured && !isConfigured) {
            console.warn("Supabase is configured in backend but NOT in frontend!");
            setBackendError("Error de configuración: Supabase no detectado en el cliente");
          }
          setIsBackendReady(true);
          setBackendError(null);
        } else if (isMounted) {
          setBackendError(`HTTP ${res.status}`);
        }
      } catch (e: any) {
        if (isMounted) {
          console.warn("Backend not ready yet or unreachable...");
          setBackendError(e.message || "Error de red");
        }
      }
    };
    
    checkBackend();
    const interval = setInterval(checkBackend, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Efecto para inicializar contraseñas desde Supabase o LocalStorage
  useEffect(() => {
    const fetchPasswords = async () => {
      const keys = {
        'zitron_pin_jefe_equipo': 'jefeEquipo',
        'zitron_pin_jefe_taller': 'jefeTaller',
        'zitron_pin_director': 'directorOperaciones',
        'zitron_pin_asistencia': 'asistenciaTecnica'
      };
      
      let currentPasswords = { ...passwords };
      let changed = false;

      // 1. Cargar primero de LocalStorage como fallback inmediato
      Object.entries(keys).forEach(([lsKey, stateKey]) => {
        const saved = localStorage.getItem(lsKey);
        if (saved) {
          currentPasswords[stateKey as keyof typeof passwords] = saved;
          changed = true;
        }
      });

      if (changed) {
        setPasswords(currentPasswords);
      }

      // 2. Intentar cargar de Supabase para asegurar persistencia real
      if (isConfigured) {
        try {
          const { data, error } = await supabase
            .from('app_passwords')
            .select('*');
          
          if (error) throw error;
          
          if (data && data.length > 0) {
            const supabasePasswords = { ...currentPasswords };
            let supabaseChanged = false;
            
            data.forEach((row: any) => {
              if (row.key in supabasePasswords) {
                supabasePasswords[row.key as keyof typeof passwords] = row.value;
                supabaseChanged = true;
                
                // Actualizar LocalStorage para mantener sincronía
                const lsKeyMap: Record<string, string> = {
                  'jefeEquipo': 'zitron_pin_jefe_equipo',
                  'jefeTaller': 'zitron_pin_jefe_taller',
                  'directorOperaciones': 'zitron_pin_director',
                  'asistenciaTecnica': 'zitron_pin_asistencia'
                };
                if (lsKeyMap[row.key]) {
                  localStorage.setItem(lsKeyMap[row.key], row.value);
                }
              }
            });
            
            if (supabaseChanged) {
              setPasswords(supabasePasswords);
            }
          }
        } catch (e) {
          console.error("Error fetching passwords from Supabase:", e);
        }
      }
    };

    fetchPasswords();
  }, []);

  // Efecto para cambiar el fondo dinámicamente según la vista
  useEffect(() => {
    if (currentView === 'area') {
      document.body.classList.add('view-area-active');
    } else {
      document.body.classList.remove('view-area-active');
    }
  }, [currentView]);

  useEffect(() => {
    // Safety timeout to ensure the app doesn't stay stuck on loading screen
    let forceCloseTimer: any;
    if (isLoading) {
      forceCloseTimer = setTimeout(() => {
        console.warn("Safety timeout: forcing isLoading to false");
        setIsLoading(false);
      }, 20000); // Increased to 20s to allow for slow networks
      
      // Show manual force close button after 10s
      const showButtonTimer = setTimeout(() => setShowForceClose(true), 10000);
      
      return () => {
        clearTimeout(forceCloseTimer);
        clearTimeout(showButtonTimer);
      };
    } else {
      setShowForceClose(false);
    }
  }, [isLoading]);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addToast("CONEXIÓN RECUPERADA: Sincronizando datos...", "info");
    };
    const handleOffline = () => {
      setIsOnline(false);
      addToast("CONEXIÓN PERDIDA: Trabajando en modo local", "error");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addToast]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Solo mostrar aviso si no está configurado (modo local) o si hay cola de sincronización pendiente
      if (!isConfigured || syncQueue.length > 0) {
        const msg = "Tienes datos que podrían no estar a salvo en la nube. Si cierras la aplicación ahora, podrías perder cambios.";
        e.returnValue = msg;
        return msg;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [syncQueue]);

  useEffect(() => {
    const error = localStorage.getItem('zitron_last_sync_error');
    if (error) setLastConnectionError(error);
  }, [syncQueue]);

  const processSyncQueue = useCallback(async () => {
    if (!isOnline || !isConfigured || syncQueue.length === 0) {
      if (syncQueue.length > 0) console.log(`Sync skipped: Online=${isOnline}, Configured=${isConfigured}`);
      return;
    }

    console.log(`Processing sync queue: ${syncQueue.length} items`);
    const queue = [...syncQueue];
    const remaining: typeof syncQueue = [];
    let successCount = 0;
    let lastErrorMsg = null;

    for (const op of queue) {
      try {
        const sanitizedData = sanitizeData(op.data);
        console.log(`Syncing ${op.type} on ${op.table}...`, sanitizedData);
        let result;
        if (op.type === 'insert') {
          result = await supabase.from(op.table).insert(sanitizedData);
        } else if (op.type === 'update') {
          result = await supabase.from(op.table).update(sanitizedData).eq(op.filter!.column, op.filter!.value);
        } else if (op.type === 'delete') {
          if (op.filter?.value === 'all') {
            result = await supabase.from(op.table).delete().neq('id', '_none_');
          } else {
            result = await supabase.from(op.table).delete().eq(op.filter!.column, op.filter!.value);
          }
        } else if (op.type === 'upsert') {
          // Fix for upsert: ensure it's an array if multiple, or single object
          const dataToUpsert = Array.isArray(sanitizedData) ? sanitizedData : [sanitizedData];
          result = await supabase.from(op.table).upsert(dataToUpsert, { onConflict: op.filter?.column });
        }

        if (result?.error) throw result.error;
        successCount++;
        localStorage.removeItem('zitron_last_sync_error');
        setLastConnectionError(null);
      } catch (e: any) {
        console.error("Sync error for operation:", op, e);
        lastErrorMsg = e.message || "Error desconocido";
        remaining.push(op);
      }
    }

    setSyncQueue(remaining);
    safeLocalStorageSetItem('zitron_sync_queue', JSON.stringify(remaining));
    
    if (successCount > 0) {
      addToast(`SINCRONIZACIÓN: ${successCount} registros subidos`, "success");
    }
    
    if (remaining.length > 0 && lastErrorMsg) {
      // Store last error for the UI to show
      safeLocalStorageSetItem('zitron_last_sync_error', lastErrorMsg);
      setLastConnectionError(lastErrorMsg);
    } else {
      localStorage.removeItem('zitron_last_sync_error');
      setLastConnectionError(null);
    }
  }, [isOnline, isConfigured, syncQueue, addToast]);

  useEffect(() => {
    if (isOnline && syncQueue.length > 0) {
      const timer = setTimeout(processSyncQueue, 500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, syncQueue.length, processSyncQueue]);

  useEffect(() => {
    if (!isConfigured) {
      addToast("MODO LOCAL: Configure Supabase para sincronizar con la nube", "info");
    }
  }, []); // Only on mount

  // Helper para limpiar datos antes de enviar a Supabase (evitar espacios en nombres de columnas)
  const sanitizeData = (data: any): any => {
    if (!data) return data;
    if (Array.isArray(data)) return data.map(sanitizeData);
    if (typeof data !== 'object') return data;
    
    const clean: any = {};
    Object.keys(data).forEach(key => {
      const cleanKey = key.trim();
      let value = data[key];
      
      // Si el valor es un objeto (y no es null), sanitizarlo también
      if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
        value = sanitizeData(value);
      }
      
      clean[cleanKey] = value;
    });
    return clean;
  };

  const executeOrQueue = useCallback(async (op: Omit<typeof syncQueue[0], 'id' | 'timestamp'>, silent = false) => {
    const sanitizedData = sanitizeData(op.data);
    const fullOp = {
      ...op,
      data: sanitizedData,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      timestamp: Date.now()
    };

    if (isOnline && isConfigured && syncQueueRef.current.length === 0) {
      try {
        let result;
        if (op.type === 'insert') {
          result = await supabase.from(op.table).insert(sanitizedData);
        } else if (op.type === 'update') {
          result = await supabase.from(op.table).update(sanitizedData).eq(op.filter!.column, op.filter!.value);
        } else if (op.type === 'delete') {
          if (op.filter?.value === 'all') {
            result = await supabase.from(op.table).delete().neq('id', '_none_');
          } else {
            result = await supabase.from(op.table).delete().eq(op.filter!.column, op.filter!.value);
          }
        } else if (op.type === 'upsert') {
          result = await supabase.from(op.table).upsert(sanitizedData, { onConflict: op.filter?.column });
        }

        if (result?.error) {
          console.error(`Sync Error [${op.table}]:`, result.error);
          const errorMsg = result.error.message || "Error desconocido de Supabase";
          safeLocalStorageSetItem('zitron_last_sync_error', errorMsg);
          setLastConnectionError(errorMsg);
          throw result.error;
        }
        
        console.log(`Sync Success [${op.table}]`);
        if (!silent) {
          addToast(`DATOS SINCRONIZADOS: ${op.table.toUpperCase()}`, "success");
        }
        return true;
      } catch (e: any) {
        console.error("Operation failed deeply:", e);
        const msg = e.message || "Error de conexión (Failed to fetch)";
        
        // Si es un error de red (Failed to fetch), dar más contexto
        if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
          console.error("DETALLE ERROR RED: Verifique conexión a internet o configuración de Supabase URL/Key.");
        }

        safeLocalStorageSetItem('zitron_last_sync_error', msg);
        setLastConnectionError(msg);
        if (!silent) {
          addToast(`ERROR SINCRONIZACIÓN: ${msg}`, "error");
        }
      }
    } else if (!isConfigured) {
      console.log("Sync skipped: Not configured");
      if (!silent) {
        addToast("MODO LOCAL: Datos guardados en el navegador (Sin Cloud)", "info");
      }
    } else if (!isOnline) {
      console.log("Sync skipped: Offline");
      if (!silent) {
        addToast("SIN CONEXIÓN: Datos guardados en cola", "info");
      }
    }

    setSyncQueue(prev => {
      const next = [...prev, fullOp];
      // Solo guardar en localStorage si no es una operación masiva o si la cola es pequeña
      // Para evitar bloqueos en importaciones masivas y errores de cuota
      if (next.length < 50 || next.length % 10 === 0) {
        safeLocalStorageSetItem('zitron_sync_queue', JSON.stringify(next));
      }
      return next;
    });
    return false;
  }, [isOnline, addToast]);

  const loadData = useCallback(async (force = false) => {
    if (!selectedArea || isFetchingRef.current) return;
    isFetchingRef.current = true;
    
    const requestId = Date.now();
    loadDataRequestIdRef.current = requestId;
    
    setIsLoading(true);

    // Helper to fetch all records from a table with pagination to bypass 1000-row limit
    const fetchAll = async (queryBuilder: any, maxRecords = 100000) => {
      let allData: any[] = [];
      let from = 0;
      let to = 999;
      let finished = false;
      
      while (!finished) {
        const { data, error } = await queryBuilder.range(from, to);
        if (error) {
          console.error("Supabase fetch error:", error, "Query:", queryBuilder);
          throw error;
        }
        if (!data || data.length === 0) {
          finished = true;
        } else {
          allData = [...allData, ...data];
          if (data.length < 1000 || allData.length >= maxRecords) {
            finished = true;
          } else {
            from += 1000;
            to += 1000;
          }
        }
      }
      return allData;
    };

    // Calculate date limits for fetching history
    const now = new Date();
    const sixMonthsAgoDate = new Date();
    sixMonthsAgoDate.setMonth(sixMonthsAgoDate.getMonth() - 6);
    const sixMonthsAgo = sixMonthsAgoDate.toISOString().split('T')[0];
    
    // For TOP 60, we want 15 months (current month + 14 previous months)
    // Starting from the 1st day of the month 14 months ago
    const fifteenMonthsAgoDate = new Date();
    fifteenMonthsAgoDate.setDate(1); 
    fifteenMonthsAgoDate.setMonth(fifteenMonthsAgoDate.getMonth() - 14);
    const fifteenMonthsAgo = fifteenMonthsAgoDate.toISOString().split('T')[0];
    
    // Determine required history limit
    const requiredLimit = selectedArea === 'TOP 60' ? fifteenMonthsAgo : sixMonthsAgo;
    console.log(`App: loadData for ${selectedArea}. requiredLimit: ${requiredLimit}`);
    
    // Check if we already have sufficient global data
    const hasSufficientData = globalHistoryRef.current.length > 0 && 
                             lastHistoryLimitRef.current && 
                             lastHistoryLimitRef.current <= requiredLimit;

    try {
      let aggregatedActivities = globalActivitiesRef.current;
      let aggregatedHistory = globalHistoryRef.current;
      let aggregatedObjectives = globalObjectivesRef.current;
      let currentGlobalUsers = globalUsers;
      let currentTop15Users = top15Users;
      let currentTop60Users = top60Users;

      let fetchFailed = false;
      // If we don't have sufficient data or it's a forced refresh, fetch from Supabase
      if (isConfigured && (force || !hasSufficientData || activities.length === 0)) {
        try {
          // Fetch everything globally with a timeout
          const fetchPromise = Promise.allSettled([
            fetchAll(supabase.from('activities').select('*')),
            fetchAll(supabase.from('history').select('*').gte('fecha', requiredLimit).order('fecha', { ascending: false })),
            supabase.from('operarios').select('*').order('nombre'),
            supabase.from('oee_objectives').select('*').order('validFrom', { ascending: false }),
            fetchAll(supabase.from('top60_seguridad').select('*').gte('fecha', requiredLimit).order('fecha', { ascending: false })),
            fetchAll(supabase.from('top60_rrhh').select('*').gte('fecha', requiredLimit).order('fecha', { ascending: false })),
            fetchAll(supabase.from('top60_ausentismo').select('*').gte('fecha', requiredLimit).order('fecha', { ascending: false })),
            fetchAll(supabase.from('top60_calidad').select('*').gte('anio', fifteenMonthsAgoDate.getFullYear()).order('anio', { ascending: false }).order('semana', { ascending: false })),
            fetchAll(supabase.from('top60_idm').select('*').order('idSugerencia', { ascending: false })),
            supabase.from('master_speeds').select('*'),
            supabase.from('incidence_master').select('id, nombre, tipo, area')
          ]);

          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Tiempo de espera de red agotado")), 120000)
          );

          const results = await Promise.race([fetchPromise, timeoutPromise]) as any[];

          const [actsRes, histRes, opsRes, objsRes, segRes, rrhhRes, ausRes, calRes, idmRes, speedsRes, incsRes] = results;

          // Check for errors
          const errors = results.filter(r => (r.status === 'rejected' || (r as any).value?.error));
          if (errors.length > 0) {
            const firstError = errors[0].status === 'rejected' ? errors[0].reason : (errors[0] as any).value.error;
            setLastConnectionError(firstError?.message || "Error de conexión parcial");
            addToast(`ERRORES SUPABASE: ${errors.length} tablas fallaron`, "error");
          } else {
            setLastConnectionError(null);
          }

          // Carregar mermas se área for loncheado
          if (selectedArea === 'sb-loncheado') {
            try {
              const { data: mermasData } = await supabase.from('mermas').select('*').eq('area', 'sb-loncheado').order('fecha', { ascending: false });
              if (mermasData) setMermas(mermasData);
            } catch (e) { console.warn('mermas fetch failed', e); }
          }

          if (actsRes.status === 'fulfilled') {
            aggregatedActivities = actsRes.value.map((a: any) => ({
              ...a,
              tiempoTeorico: a.tiempoTeorico !== undefined ? a.tiempoTeorico : a.tiempo_teorico
            }));
            globalActivitiesRef.current = aggregatedActivities;
          }
          
          if (histRes.status === 'fulfilled') {
            aggregatedHistory = histRes.value.map((h: any) => ({
              ...h,
              tiempoTeorico: h.tiempoTeorico !== undefined ? h.tiempoTeorico : h.tiempo_teorico
            }));
            console.log(`App: Fetched ${aggregatedHistory.length} history records from Supabase`);
            globalHistoryRef.current = aggregatedHistory;
            lastHistoryLimitRef.current = requiredLimit;
          }

          if (opsRes.status === 'fulfilled' && opsRes.value.data) {
            const allOps = opsRes.value.data.map((u: any) => ({
              ...u,
              areas: u.areas || (u.area ? [u.area] : [])
            }));
            
            // Centralize all users in globalUsers
            currentGlobalUsers = allOps;
            currentTop15Users = allOps.filter((u: any) => u.areas?.includes('TOP 15'));
            currentTop60Users = allOps.filter((u: any) => u.areas?.includes('TOP 60'));
            
            setGlobalUsers(currentGlobalUsers);
            setTop15Users(currentTop15Users);
            setTop60Users(currentTop60Users);
            
            localStorage.setItem('zitron_global_users', JSON.stringify(currentGlobalUsers));
            localStorage.setItem('zitron_top15_users', JSON.stringify(currentTop15Users));
            localStorage.setItem('zitron_top60_users', JSON.stringify(currentTop60Users));
          }
          
          if (objsRes.status === 'fulfilled' && objsRes.value.data) {
            const grouped: Record<string, OEEObjectives[]> = {};
            objsRes.value.data.forEach((o: any) => {
              if (o.area) {
                if (!grouped[o.area]) grouped[o.area] = [];
                grouped[o.area].push(o);
              }
            });
            aggregatedObjectives = grouped;
            globalObjectivesRef.current = grouped;
            setAllObjectives(grouped);
            localStorage.setItem('zitron_global_objectives', JSON.stringify(grouped));
          }
          
          // Store TOP 60 specific data in localStorage
          if (segRes.status === 'fulfilled') localStorage.setItem('zitron_top60_seguridad', JSON.stringify(segRes.value));
          if (rrhhRes.status === 'fulfilled') localStorage.setItem('zitron_top60_rrhh', JSON.stringify(rrhhRes.value));
          if (ausRes.status === 'fulfilled') localStorage.setItem('zitron_top60_ausentismo', JSON.stringify(ausRes.value));
          if (calRes.status === 'fulfilled') localStorage.setItem('zitron_top60_calidad', JSON.stringify(calRes.value));
          if (idmRes.status === 'fulfilled') localStorage.setItem('zitron_top60_idm', JSON.stringify(idmRes.value));
          
          if (speedsRes.status === 'fulfilled') {
            const speedsData = (speedsRes.value as any).data;
            if (speedsData) {
              const normalizedSpeeds = speedsData.map((s: any) => ({
                ...s,
                tiempoTeorico: s.tiempoTeorico !== undefined ? s.tiempoTeorico : s.tiempo_teorico
              }));
              localStorage.setItem('zitron_all_speeds', JSON.stringify(normalizedSpeeds));
            } else if ((speedsRes.value as any).error) {
              console.warn("Master speeds fetch error (likely schema cache):", (speedsRes.value as any).error);
            }
          }
          if (incsRes.status === 'fulfilled' && incsRes.value.data) {
            const incsWithDefaults = incsRes.value.data.map((inc: any) => ({ 
              ...inc, 
              afectaCalidad: inc.afectaCalidad !== undefined ? inc.afectaCalidad : inc.afecta_calidad
            }));
            localStorage.setItem('zitron_all_incidences', JSON.stringify(incsWithDefaults));
          }
          
          // Clear any previous error if we reached this point successfully
          localStorage.removeItem('zitron_last_sync_error');
          setLastConnectionError(null);
          
        } catch (e: any) {
          console.warn("Supabase global fetch failed:", e.message);
          setLastConnectionError(e.message);
          fetchFailed = true;
        }
      }

      if (!isConfigured || fetchFailed) {
        // Fallback to local storage aggregation if not configured or fetch failed
        const allAreas = [...Object.keys(AREA_NAMES)];
        aggregatedActivities = [];
        aggregatedHistory = [];
        
        // Load global users and objectives from localStorage if fetch failed
        try {
          const localGlobalUsers = JSON.parse(localStorage.getItem('zitron_global_users') || '[]');
          const localTop15Users = JSON.parse(localStorage.getItem('zitron_top15_users') || '[]');
          const localTop60Users = JSON.parse(localStorage.getItem('zitron_top60_users') || '[]');
          if (localGlobalUsers.length > 0) currentGlobalUsers = localGlobalUsers;
          if (localTop15Users.length > 0) currentTop15Users = localTop15Users;
          if (localTop60Users.length > 0) currentTop60Users = localTop60Users;
          
          const localGlobalObjectives = JSON.parse(localStorage.getItem('zitron_global_objectives') || '{}');
          if (Object.keys(localGlobalObjectives).length > 0) {
            aggregatedObjectives = localGlobalObjectives;
            globalObjectivesRef.current = localGlobalObjectives;
            setAllObjectives(localGlobalObjectives);
          }
        } catch (e) {
          console.warn("Error loading global fallbacks:", e);
        }

        allAreas.forEach(area => {
          const p = `zitron_${area}_`;
          try {
            const localActs = JSON.parse(localStorage.getItem(`${p}activities`) || '[]');
            const localHist = JSON.parse(localStorage.getItem(`${p}history`) || '[]');
            if (Array.isArray(localActs)) aggregatedActivities = [...aggregatedActivities, ...localActs];
            if (Array.isArray(localHist)) aggregatedHistory = [...aggregatedHistory, ...localHist];
          } catch (e) {
            console.warn(`Error parsing local data for area ${area}:`, e);
          }
        });
      }

      // Ensure we have arrays before filtering
      if (!Array.isArray(aggregatedActivities)) aggregatedActivities = [];
      if (!Array.isArray(aggregatedHistory)) aggregatedHistory = [];

      // Filter the aggregated data for the selected area and deduplicate by ID
      const prefix = `zitron_${selectedArea}_`;
      let localActivities = Array.from(new Map(aggregatedActivities.filter(a => a && a.id && a.area === selectedArea).map(a => [a.id, a])).values());
      let localHistory = Array.from(new Map(aggregatedHistory.filter(a => a && a.id && a.area === selectedArea).map(a => [a.id, a])).values());
      let localOperarios: any[] = [];
      let localSpeeds: any[] = [];
      let localIncidences: any[] = [];
      let localObjectives: OEEObjectives[] = aggregatedObjectives[selectedArea || ''] || [];

      // Combine global users assigned to this area with area-specific users
      const globalAssigned = Array.isArray(currentGlobalUsers) ? currentGlobalUsers.filter(u => u && u.areas?.includes(selectedArea)) : [];

      if (selectedArea === 'TOP 15' || selectedArea === 'TOP 60') {
        localActivities = aggregatedActivities;
        localHistory = aggregatedHistory;
        console.log(`App: TOP view. Setting ${localHistory.length} records. Sample:`, localHistory.slice(0, 2));
        
        const areaSpecific = selectedArea === 'TOP 15' ? currentTop15Users : currentTop60Users;
        localOperarios = [...areaSpecific, ...globalAssigned];
      } else {
        // Filter global users that belong to this area
        localOperarios = [...globalAssigned];
        
        // Also check if there are users with this area set explicitly (legacy or specific)
        // This is handled by currentGlobalUsers if we didn't filter them out earlier
        // But for safety, we can check if any user has area === selectedArea
        
        // Filter speeds and incidences
        try {
          const allSpeeds = JSON.parse(localStorage.getItem('zitron_all_speeds') || '[]');
          localSpeeds = Array.isArray(allSpeeds) 
            ? allSpeeds.filter((s: any) => s && s.area === selectedArea).map((s: any) => ({
                ...s,
                tiempoTeorico: s.tiempoTeorico !== undefined ? s.tiempoTeorico : s.tiempo_teorico
              }))
            : [];
        } catch (e) {
          localSpeeds = [];
        }

        try {
          const allIncs = JSON.parse(localStorage.getItem('zitron_all_incidences') || '[]');
          localIncidences = Array.isArray(allIncs) 
            ? allIncs.filter((i: any) => i && i.area === selectedArea).map((i: any) => ({
                ...i,
                afectaCalidad: i.afectaCalidad !== undefined ? i.afectaCalidad : i.afecta_calidad
              }))
            : [];
        } catch (e) {
          localIncidences = [];
        }
      }

      // --- AREA SPECIFIC PATCHES ---
      
      if (selectedArea === 'montaje-rodetes') {
        if (!Array.isArray(localSpeeds) || localSpeeds.length === 0) {
          localSpeeds = [];
        }
      }

      if (selectedArea === 'montaje-chorro' || selectedArea === 'montaje-axiales') {
        if (!Array.isArray(localIncidences) || localIncidences.length !== 21) {
          localIncidences = [];
        } else {
          // Parche para asegurar que las incidencias de calidad tengan el flag correcto
          localIncidences = localIncidences.map(inc => {
            const name = inc.nombre.toUpperCase();
            if (['REPROCESADO AGUJEROS', 'REPROCESADO MOTOR', 'OTROS REPROCESOS', 'REPINTADO', 'REPINTADOS', 'REPASAR PINTURA', 'REPROCESO', 'RETRABAJO'].some(kw => name.includes(kw))) {
              return { ...inc, afectaCalidad: true };
            }
            return inc;
          });
        }
      }

      const isOldDefault = Array.isArray(localIncidences) && localIncidences.some(inc => inc.id === 'e1' && inc.nombre === 'ARRANQUE LINEA');
      const newAreas = ['corte-laser', 'curvadora', 'soldadura-silenciosos', 'soldadura-rodetes', 'soldadura-carcasas'];
      if (isOldDefault && newAreas.includes(selectedArea || '')) {
        localIncidences = [];
      }

      if (selectedArea === 'corte-laser' && (localIncidences?.length !== 20)) localIncidences = [];
      if (selectedArea === 'curvadora' && (localIncidences?.length !== 15)) localIncidences = [];
      if (selectedArea === 'soldadura-silenciosos' && (localIncidences?.length !== 19 || isOldDefault)) localIncidences = [];
      if (selectedArea === 'soldadura-rodetes' && (localIncidences?.length !== 23)) localIncidences = [];
      if (selectedArea === 'soldadura-carcasas' && (localIncidences?.length !== 13)) localIncidences = [];

      // Final fallbacks
      const finalSpeeds = (Array.isArray(localSpeeds) && localSpeeds.length) ? localSpeeds : getInitialMasterSpeeds(selectedArea);
      const finalIncs = (Array.isArray(localIncidences) && localIncidences.length) ? localIncidences : getInitialIncidenceMaster(selectedArea);
      const finalOps = Array.isArray(localOperarios) ? localOperarios : [];
      const finalObj = localObjectives.length > 0 ? localObjectives[0] : { ...INITIAL_OEE_OBJECTIVES, area: selectedArea };

      if (loadDataRequestIdRef.current !== requestId) return;

      // Update state
      console.log(`App: Setting history with ${localHistory.length} records for ${selectedArea}`);
      setActivities(localActivities);
      setHistory(localHistory);
      setOperarios(finalOps);
      if (selectedArea === 'TOP 15') setTop15Users(finalOps);
      if (selectedArea === 'TOP 60') setTop60Users(finalOps);
      setMasterSpeeds(finalSpeeds);
      setIncidenceMaster(finalIncs);
      setOeeObjectives(finalObj);
      setAllObjectives(prev => ({ ...prev, [selectedArea || '']: localObjectives.length > 0 ? localObjectives : [finalObj] }));

      // Update localStorage - Limit history and activities to avoid QuotaExceededError
      // We keep the full history in state, but only save the most recent 500 to localStorage as fallback
      const limitedActivities = localActivities.slice(-500);
      const limitedHistory = localHistory.slice(-500);

      safeLocalStorageSetItem(`${prefix}activities`, JSON.stringify(limitedActivities));
      safeLocalStorageSetItem(`${prefix}history`, JSON.stringify(limitedHistory));
      safeLocalStorageSetItem(`${prefix}speeds`, JSON.stringify(finalSpeeds));
      safeLocalStorageSetItem(`${prefix}incidences`, JSON.stringify(finalIncs));
      safeLocalStorageSetItem(`${prefix}objectives`, JSON.stringify(localObjectives.length > 0 ? localObjectives : [finalObj]));
      safeLocalStorageSetItem(`${prefix}operarios`, JSON.stringify(finalOps));

    } catch (e) {
      console.error("loadData error:", e);
      if (loadDataRequestIdRef.current === requestId) {
        addToast("ERROR DE SINCRONIZADO", "error");
      }
    } finally {
      isFetchingRef.current = false;
      if (loadDataRequestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [selectedArea, isConfigured, addToast]);

  useEffect(() => {
    if (!selectedArea || !isConfigured) return;

    console.log(`Setting up Realtime listener for area: ${selectedArea}`);
    const channel = supabase
      .channel(`activities_changes_${selectedArea}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activities',
          filter: `area=eq.${selectedArea}`
        },
        (payload) => {
          console.log('Realtime activity change detected:', payload.eventType, payload);
          // If a deletion occurred, it might be a shift closure.
          // We trigger loadData to sync local state with Supabase.
          loadData(true);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Realtime subscription active for ${selectedArea}`);
        }
      });

    return () => {
      console.log(`Removing Realtime listener for area: ${selectedArea}`);
      supabase.removeChannel(channel);
    };
  }, [selectedArea, isConfigured, loadData]);

  useEffect(() => { loadData(true); }, [loadData]);

  // Sync data when entering a workshop or specific tabs
  useEffect(() => {
    if (selectedArea || activeTab === 'database') {
      console.log(`App: Context changed (Area: ${selectedArea}, Tab: ${activeTab}), forcing data sync...`);
      loadData(true);
    }
  }, [selectedArea, activeTab, loadData]);

  // Load global users
  useEffect(() => {
    const loadGlobalUsers = async () => {
      let localGlobal: User[] = [];

      try {
        const g = JSON.parse(localStorage.getItem('zitron_global_users') || '[]');
        if (Array.isArray(g)) localGlobal = g;
      } catch (e) {
        console.warn("Error parsing local users:", e);
      }

      if (isConfigured) {
        try {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Timeout Users")), 5000)
          );

          const fetchPromise = supabase.from('operarios').select('*').order('nombre');

          const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

          if (data && data.length > 0) {
            localGlobal = data.map((u: any) => ({
              ...u,
              areas: u.areas || (u.area ? [u.area] : [])
            }));
          }
        } catch (e) {
          console.warn("Error loading users from Supabase or timeout");
        }
      }
      
      setGlobalUsers(localGlobal);
      setTop15Users(localGlobal.filter(u => u.areas?.includes('TOP 15')));
      setTop60Users(localGlobal.filter(u => u.areas?.includes('TOP 60')));
    };
    loadGlobalUsers();
  }, [isConfigured]);

  useEffect(() => {
    if (top60Pin.length === 4) {
      if (top60Pin === passwords.directorOperaciones || top60Pin === passwords.asistenciaTecnica) {
        setTop60Access('preparacion');
        setShowTop60PinModal(false);
        setTop60Pin('');
      } else {
        setTop60PinError(true);
        setTimeout(() => {
          setTop60Pin('');
          setTop60PinError(false);
        }, 1000);
      }
    }
  }, [top60Pin, passwords]);

  useEffect(() => {
    if (globalPin.length === 4) {
      if (globalPin === passwords.jefeTaller || 
          globalPin === passwords.directorOperaciones || 
          globalPin === passwords.asistenciaTecnica) {
        setShowGlobalUserConfig(true);
        setShowGlobalPinModal(false);
        setGlobalPin('');
      } else {
        setGlobalPinError(true);
        setTimeout(() => {
          setGlobalPin('');
          setGlobalPinError(false);
        }, 1000);
      }
    }
  }, [globalPin, passwords]);

  const handleUpdatePasswords = async (newPasswords: any) => {
    setPasswords(newPasswords);
    
    // 1. Guardar en LocalStorage para fallback offline
    safeLocalStorageSetItem('zitron_pin_jefe_equipo', newPasswords.jefeEquipo);
    safeLocalStorageSetItem('zitron_pin_jefe_taller', newPasswords.jefeTaller);
    safeLocalStorageSetItem('zitron_pin_director', newPasswords.directorOperaciones);
    safeLocalStorageSetItem('zitron_pin_asistencia', newPasswords.asistenciaTecnica);
    
    // 2. Guardar en Supabase para persistencia real
    if (isConfigured) {
      try {
        const updates = [
          { key: 'jefeEquipo', value: newPasswords.jefeEquipo },
          { key: 'jefeTaller', value: newPasswords.jefeTaller },
          { key: 'directorOperaciones', value: newPasswords.directorOperaciones },
          { key: 'asistenciaTecnica', value: newPasswords.asistenciaTecnica }
        ];
        
        const { error } = await supabase
          .from('app_passwords')
          .upsert(updates);
          
        if (error) throw error;
        addToast("CONTRASEÑAS SINCRONIZADAS CON LA NUBE", "success");
      } catch (e) {
        console.error("Error saving passwords to Supabase:", e);
        addToast("ERROR AL SINCRONIZAR CON LA NUBE", "error");
      }
    } else {
      addToast("CONTRASEÑAS ACTUALIZADAS LOCALMENTE", "success");
    }
  };

  const handleUpdateGlobalUsers = async (newUsers: User[]) => {
    setGlobalUsers(newUsers);
    setTop15Users(newUsers.filter(u => u.areas?.includes('TOP 15')));
    setTop60Users(newUsers.filter(u => u.areas?.includes('TOP 60')));
    
    safeLocalStorageSetItem('zitron_global_users', JSON.stringify(newUsers));
    safeLocalStorageSetItem('zitron_top15_users', JSON.stringify(newUsers.filter(u => u.areas?.includes('TOP 15'))));
    safeLocalStorageSetItem('zitron_top60_users', JSON.stringify(newUsers.filter(u => u.areas?.includes('TOP 60'))));
    
    // To solve the "reappearing" issue, we must ensure that we delete users from Supabase 
    // that are no longer in the list. The most reliable way is to delete ALL and re-insert,
    // or track deletions explicitly. Given the user wants to manage deletions themselves,
    // we'll use a full sync approach but being careful.
    
    // First, delete ALL operarios to ensure no stale ones remain in any area
    executeOrQueue({
      table: 'operarios',
      type: 'delete',
      filter: { column: 'id', value: 'all' } // Custom handling for "all" might be needed or just empty filter if supported
    }).then(() => {
      if (newUsers.length > 0) {
        // Insert all users as global (area: null)
        executeOrQueue({
          table: 'operarios',
          type: 'insert',
          data: newUsers.map(u => ({ ...u, area: null }))
        });
      }
    });
    
    addToast("OPERARIOS ACTUALIZADOS", "success");
  };

  const handleAreaSelect = (areaId: string) => {
    setSelectedArea(areaId);
    setCurrentView('area');
    setActiveTab('work');
    addToast(`TALLER: ${areaId.toUpperCase().replace('-', ' ')}`, "success");
  };

  const handleGoHome = () => {
    setCurrentView('root-menu');
    setSelectedArea(undefined);
    setSelectedWorkshop(null);
  };

  const handleBack = () => {
    if (currentView === 'area') {
      if (selectedArea === 'TOP 60') {
        if (top60Access !== null) {
          setTop60Access(null);
        } else {
          setCurrentView('root-menu');
          setSelectedArea(undefined);
        }
      } else if (selectedArea === 'TOP 15') {
        setCurrentView('root-menu');
        setSelectedArea(undefined);
      } else {
        setCurrentView('menu');
        setSelectedArea(undefined);
      }
    } else if (currentView === 'menu') {
      if (selectedWorkshop !== null) {
        setSelectedWorkshop(null);
      } else {
        setCurrentView('root-menu');
      }
    }
  };

  const handleSetOperarios = useCallback(async (newOps: User[]) => {
    if (!selectedArea) return;
    
    if (selectedArea === 'TOP 15') {
      setTop15Users(newOps);
      safeLocalStorageSetItem('zitron_top15_users', JSON.stringify(newOps));
      
      // Sync with globalUsers
      setGlobalUsers(prev => {
        const otherAreas = prev.filter(u => !u.areas?.includes('TOP 15') && (u as any).area !== 'TOP 15');
        const normalizedNew = newOps.map(u => ({ ...u, areas: Array.from(new Set([...(u.areas || []), 'TOP 15'])) }));
        return [...otherAreas, ...normalizedNew].sort((a, b) => a.nombre.localeCompare(b.nombre));
      });

      executeOrQueue({
        table: 'operarios',
        type: 'delete',
        filter: { column: 'area', value: 'TOP 15' }
      }).then(() => {
        if (newOps.length > 0) {
          executeOrQueue({
            table: 'operarios',
            type: 'upsert',
            data: newOps.map(u => ({ ...u, area: 'TOP 15' })),
            filter: { column: 'id' }
          });
        }
      });
    } else if (selectedArea === 'TOP 60') {
      setTop60Users(newOps);
      safeLocalStorageSetItem('zitron_top60_users', JSON.stringify(newOps));

      // Sync with globalUsers
      setGlobalUsers(prev => {
        const otherAreas = prev.filter(u => !u.areas?.includes('TOP 60') && (u as any).area !== 'TOP 60');
        const normalizedNew = newOps.map(u => ({ ...u, areas: Array.from(new Set([...(u.areas || []), 'TOP 60'])) }));
        return [...otherAreas, ...normalizedNew].sort((a, b) => a.nombre.localeCompare(b.nombre));
      });

      executeOrQueue({
        table: 'operarios',
        type: 'delete',
        filter: { column: 'area', value: 'TOP 60' }
      }).then(() => {
        if (newOps.length > 0) {
          executeOrQueue({
            table: 'operarios',
            type: 'upsert',
            data: newOps.map(u => ({ ...u, area: 'TOP 60' })),
            filter: { column: 'id' }
          });
        }
      });
    } else {
      setGlobalUsers(prev => {
        // First, remove selectedArea from everyone in global
        const cleared = prev.map(u => ({
          ...u,
          areas: (u.areas || []).filter(a => a !== selectedArea)
        }));

        // Then, add selectedArea to those in newOps
        newOps.forEach(newOp => {
          const existingIdx = cleared.findIndex(u => u.nombre.trim().toUpperCase() === newOp.nombre.trim().toUpperCase());
          if (existingIdx >= 0) {
            cleared[existingIdx].areas = Array.from(new Set([...(cleared[existingIdx].areas || []), selectedArea]));
          } else {
            cleared.push({ ...newOp, areas: [selectedArea] });
          }
        });

        const uniqueFinalMap = new Map<string, User>();
        cleared.forEach((u: User) => {
          if (!uniqueFinalMap.has(u.id)) {
            uniqueFinalMap.set(u.id, u);
          }
        });
        const final = Array.from(uniqueFinalMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
        
        safeLocalStorageSetItem('zitron_global_users', JSON.stringify(final));
        
        executeOrQueue({
          table: 'operarios',
          type: 'delete',
          filter: { column: 'area', value: null }
        }).then(() => {
          if (final.length > 0) {
            executeOrQueue({
              table: 'operarios',
              type: 'insert',
              data: final.map(u => ({ ...u, area: null }))
            });
          }
        });
        return final;
      });
    }
    
    // Also update area-specific operarios for backward compatibility/local storage
    setOperarios(newOps);
    safeLocalStorageSetItem(`zitron_${selectedArea}_operarios`, JSON.stringify(newOps));
    if (selectedArea !== 'TOP 15' && selectedArea !== 'TOP 60') {
      executeOrQueue({
        table: 'operarios',
        type: 'delete',
        filter: { column: 'area', value: selectedArea }
      }).then(() => {
        if (newOps.length > 0) {
          executeOrQueue({
            table: 'operarios',
            type: 'upsert',
            data: newOps.map(o => ({...o, area: selectedArea})),
            filter: { column: 'id' }
          });
        }
      });
    }
    addToast("OPERARIOS ACTUALIZADOS", "success");
  }, [selectedArea, isConfigured, addToast]);

  const handleDeleteOperario = useCallback(async (id: string) => {
    // Centralized deletion: remove from globalUsers and sync
    setGlobalUsers(prev => {
      const next = prev.filter(u => String(u.id) !== String(id));
      safeLocalStorageSetItem('zitron_global_users', JSON.stringify(next));
      
      // Update area-specific states too
      setTop15Users(next.filter(u => u.areas?.includes('TOP 15')));
      setTop60Users(next.filter(u => u.areas?.includes('TOP 60')));
      
      // Delete from Supabase
      executeOrQueue({
        table: 'operarios',
        type: 'delete',
        filter: { column: 'id', value: id }
      });
      
      return next;
    });

    // Also update current area operarios if they were filtered
    setOperarios(prev => prev.filter(op => String(op.id) !== String(id)));
    
    addToast("OPERARIO ELIMINADO", "success");
  }, [addToast, executeOrQueue]);

  const handleSetSpeeds = useCallback(async (newSpeeds: MasterSpeed[]) => {
    console.log(`handleSetSpeeds called for ${selectedArea} with ${newSpeeds.length} items`);
    setMasterSpeeds(newSpeeds);
    if (!selectedArea) return;
    safeLocalStorageSetItem(`zitron_${selectedArea}_speeds`, JSON.stringify(newSpeeds));
    
    if (newSpeeds.length > 0) {
      const success = await executeOrQueue({
        table: 'master_speeds',
        type: 'upsert',
        data: newSpeeds.map(s => ({
          id: s.id,
          formato: s.formato,
          tiempoTeorico: s.tiempoTeorico,
          peso: s.peso || 0,
          unidad: s.unidad || 'unidades',
          area: selectedArea
        })),
        filter: { column: 'id' }
      });
      console.log("Sync result for master_speeds:", success);
    }
  }, [selectedArea, executeOrQueue]);

  const handleDeleteTask = useCallback(async (id: string) => {
    if (!selectedArea) return;
    setMasterSpeeds(prev => {
      const next = prev.filter(task => String(task.id) !== String(id));
      safeLocalStorageSetItem(`zitron_${selectedArea}_speeds`, JSON.stringify(next));
      
      executeOrQueue({
        table: 'master_speeds',
        type: 'delete',
        filter: { column: 'id', value: id }
      });
      
      return next;
    });
    addToast("TAREA ELIMINADA", "success");
  }, [selectedArea, addToast, executeOrQueue]);

  const handleSetIncidences = useCallback(async (newInc: IncidenceMaster[]) => {
    setIncidenceMaster(newInc);
    if (!selectedArea) return;
    safeLocalStorageSetItem(`zitron_${selectedArea}_incidences`, JSON.stringify(newInc));
    
    executeOrQueue({
      table: 'incidence_master',
      type: 'delete',
      filter: { column: 'area', value: selectedArea }
    }).then(() => {
      if (newInc.length > 0) {
        executeOrQueue({
          table: 'incidence_master',
          type: 'upsert',
          data: newInc.map(i => ({
            id: i.id,
            nombre: i.nombre,
            tipo: i.tipo,
            area: selectedArea
          })),
          filter: { column: 'id' }
        });
      }
    });
  }, [selectedArea, executeOrQueue]);

  const handleDeleteIncidence = useCallback(async (id: string) => {
    if (!selectedArea) return;
    setIncidenceMaster(prev => {
      const next = prev.filter(inc => String(inc.id) !== String(id));
      safeLocalStorageSetItem(`zitron_${selectedArea}_incidences`, JSON.stringify(next));
      
      executeOrQueue({
        table: 'incidence_master',
        type: 'delete',
        filter: { column: 'id', value: id }
      });
      
      return next;
    });
    addToast("REGISTRO ELIMINADO", "success");
  }, [selectedArea, addToast, executeOrQueue]);

  const handleSetObjectives = useCallback(async (newObj: OEEObjectives) => {
    setOeeObjectives(newObj);
    if (!selectedArea) return;
    
    setAllObjectives(prev => {
      const current = prev[selectedArea] || [];
      const idx = current.findIndex(o => o.validFrom === newObj.validFrom);
      let updated;
      if (idx >= 0) {
        updated = [...current];
        updated[idx] = newObj;
      } else {
        updated = [newObj, ...current].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
      }
      safeLocalStorageSetItem(`zitron_${selectedArea}_objectives`, JSON.stringify(updated));
      return { ...prev, [selectedArea]: updated };
    });

    const { id, ...objWithoutId } = newObj;
    executeOrQueue({
      table: 'oee_objectives',
      type: 'upsert',
      data: [{...objWithoutId, area: selectedArea}],
      filter: { column: 'area,validFrom', value: null } // onConflict handled by upsert
    });
  }, [selectedArea, executeOrQueue]);

  const handleUpdateAllObjectives = useCallback(async (objectivesMap: Record<string, OEEObjectives>, validFrom: string) => {
    const toUpsert: any[] = [];
    
    setAllObjectives(prev => {
      const next = { ...prev };
      Object.entries(objectivesMap).forEach(([area, obj]) => {
        // Ensure numeric values
        const { id, ...rest } = obj;
        const newObj = { 
          ...rest, 
          area, 
          validFrom,
          disponibilidad: parseFloat(String(obj.disponibilidad)) || 0,
          rendimiento: parseFloat(String(obj.rendimiento)) || 0,
          calidad: parseFloat(String(obj.calidad)) || 0,
          productividad: parseFloat(String(obj.productividad)) || 0,
          objetivo: parseFloat(String(obj.objetivo)) || 0
        };
        const current = next[area] || [];
        const idx = current.findIndex(o => o.validFrom === validFrom);
        let updated;
        if (idx >= 0) {
          updated = [...current];
          updated[idx] = newObj;
        } else {
          updated = [newObj, ...current].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
        }
        next[area] = updated;
        safeLocalStorageSetItem(`zitron_${area}_objectives`, JSON.stringify(updated));
        toUpsert.push(newObj);
      });
      return next;
    });

    executeOrQueue({
      table: 'oee_objectives',
      type: 'upsert',
      data: toUpsert,
      filter: { column: 'area,validFrom' }
    }).then(success => {
      if (success) addToast("OBJETIVOS GUARDADOS EN LA NUBE", "success");
      else addToast("OBJETIVOS GUARDADOS LOCALMENTE (PENDIENTE SUBIR)", "info");
    });
    
    if (selectedArea && objectivesMap[selectedArea]) {
      setOeeObjectives({ 
        ...objectivesMap[selectedArea], 
        area: selectedArea, 
        validFrom,
        disponibilidad: parseFloat(String(objectivesMap[selectedArea].disponibilidad)) || 0,
        rendimiento: parseFloat(String(objectivesMap[selectedArea].rendimiento)) || 0,
        calidad: parseFloat(String(objectivesMap[selectedArea].calidad)) || 0,
        productividad: parseFloat(String(objectivesMap[selectedArea].productividad)) || 0,
        objetivo: parseFloat(String(objectivesMap[selectedArea].objetivo)) || 0
      });
    }
    
    addToast("OBJETIVOS MAESTROS ACTUALIZADOS", "success");
  }, [selectedArea, addToast, executeOrQueue]);

  const handleAddActivity = async (act: any, cierre?: any) => {
    if (!selectedArea) return;
    setIsLoading(true);
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const dateStr = now.toISOString().split('T')[0];

    try {
      const updatedActs = activities.map(openAct => {
        const shouldClose = cierre && (
          (!cierre.idsToClose && act.operarios.some(u => openAct.operarios?.includes(u)) && !openAct.horaFin) ||
          (cierre.idsToClose && cierre.idsToClose.includes(openAct.id))
        );

        if (shouldClose) {
          const duration = calcDuration(openAct.horaInicio, timeStr);
          const closed = { 
            ...openAct, 
            horaFin: timeStr, 
            duracionMin: duration, 
            cantidad: cierre?.cantidad !== undefined ? cierre.cantidad : (openAct.cantidad || 0), 
            comentarios: cierre?.comentarios !== undefined ? cierre.comentarios : (openAct.comentarios || "") 
          };
          if (isConfigured || !isOnline) {
            // Only send fields that exist in the DB table
            const closedForDB = {
              id: closed.id,
              operarios: closed.operarios || [],
              formato: closed.formato || '',
              tipoTarea: closed.tipoTarea || '',
              horaInicio: closed.horaInicio || '',
              horaFin: closed.horaFin || '',
              duracionMin: closed.duracionMin || 0,
              cantidad: closed.cantidad || 0,
              comentarios: closed.comentarios || '',
              fecha: closed.fecha || '',
              area: closed.area || selectedArea,
              tiempoTeoricoManual: closed.tiempoTeoricoManual || 0
            };
            executeOrQueue({
              table: 'activities',
              type: 'update',
              data: closedForDB,
              filter: { column: 'id', value: openAct.id }
            });
          }
          return closed;
        }
        return openAct;
      });

      let finalActs = [...updatedActs];
      if (act.formato) {
        const newAct = {
          id: `act-${selectedArea}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          operarios: act.operarios,
          formato: act.formato,
          tipoTarea: act.tipoTarea,
          horaInicio: timeStr,
          fecha: dateStr,
          area: selectedArea,
          afectaCalidad: act.afectaCalidad,
          tiempoTeoricoManual: act.tiempoTeoricoManual
        };
        finalActs.push(newAct);
        // Only send fields that exist in the DB table
        const newActForDB = {
          id: newAct.id,
          operarios: newAct.operarios || [],
          formato: newAct.formato || '',
          tipoTarea: newAct.tipoTarea || '',
          horaInicio: newAct.horaInicio || '',
          horaFin: null,
          duracionMin: null,
          cantidad: 0,
          comentarios: '',
          fecha: newAct.fecha || '',
          area: newAct.area,
          tiempoTeoricoManual: newAct.tiempoTeoricoManual || 0
        };
        executeOrQueue({
          table: 'activities',
          type: 'insert',
          data: newActForDB
        });
      }

      const deduplicatedActs = Array.from(new Map(finalActs.map(a => [a.id, a])).values());
      setActivities(deduplicatedActs);
      safeLocalStorageSetItem(`zitron_${selectedArea}_activities`, JSON.stringify(deduplicatedActs));
      addToast("REGISTRO COMPLETADO", "success");
      setSelectedUsers([]);
    } catch (e) {
      addToast("Error al sincronizar con nube", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMultipleActivities = async (newActs: any[], closedActsData: any[]) => {
    if (!selectedArea) return;
    setIsLoading(true);
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const dateStr = now.toISOString().split('T')[0];

    try {
      let finalActs = [...activities];

      // Close specified activities
      if (closedActsData && closedActsData.length > 0) {
        // Calculate total time and theoretical time for proportional distribution (only for tratamientos)
        const firstClosed = finalActs.find(a => closedActsData.some(c => c.id === a.id));
        if (firstClosed) {
          const totalDuration = calcDuration(firstClosed.horaInicio, timeStr);
          const totalTheoretical = closedActsData.reduce((sum, c) => sum + (c.tiempoTeoricoManual || 0), 0);
          
          finalActs = finalActs.map(openAct => {
            const closeData = closedActsData.find(c => c.id === openAct.id);
            if (closeData) {
              let finalDuration = calcDuration(openAct.horaInicio, timeStr);
              
              // Proportional distribution only for treatments
              if (selectedArea === 'tratamientos') {
                if (totalTheoretical > 0 && closeData.tiempoTeoricoManual > 0) {
                  finalDuration = (closeData.tiempoTeoricoManual / totalTheoretical) * totalDuration;
                } else if (closedActsData.length > 0) {
                  finalDuration = totalDuration / closedActsData.length;
                }
              }

              const closed = { 
                ...openAct, 
                horaFin: timeStr, 
                duracionMin: Math.round(finalDuration * 10) / 10, 
                cantidad: closeData.cantidad || 0, 
                comentarios: closeData.comentarios || "" 
              };
              if (isConfigured || !isOnline) {
                const closedForDB = {
                  id: closed.id,
                  operarios: closed.operarios || [],
                  formato: closed.formato || '',
                  tipoTarea: closed.tipoTarea || '',
                  horaInicio: closed.horaInicio || '',
                  horaFin: closed.horaFin || '',
                  duracionMin: closed.duracionMin || 0,
                  cantidad: closed.cantidad || 0,
                  comentarios: closed.comentarios || '',
                  fecha: closed.fecha || '',
                  area: closed.area || selectedArea,
                  tiempoTeoricoManual: closed.tiempoTeoricoManual || 0
                };
                executeOrQueue({
                  table: 'activities',
                  type: 'update',
                  data: closedForDB,
                  filter: { column: 'id', value: openAct.id }
                });
              }
              return closed;
            }
            return openAct;
          });
        }
      }

      // Add new activities
      if (newActs && newActs.length > 0) {
        const toInsert = newActs.map((act, index) => ({
          id: `act-${selectedArea}-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 9)}`,
          operarios: act.operarios,
          formato: act.formato,
          tipoTarea: act.tipoTarea,
          horaInicio: timeStr,
          fecha: dateStr,
          area: selectedArea,
          afectaCalidad: act.afectaCalidad,
          tiempoTeoricoManual: act.tiempoTeoricoManual
        }));
        
        finalActs = [...finalActs, ...toInsert];
        const toInsertForDB = toInsert.map((newAct) => ({
          id: newAct.id,
          operarios: newAct.operarios || [],
          formato: newAct.formato || '',
          tipoTarea: newAct.tipoTarea || '',
          horaInicio: newAct.horaInicio || '',
          horaFin: null,
          duracionMin: null,
          cantidad: 0,
          comentarios: '',
          fecha: newAct.fecha || '',
          area: newAct.area,
          tiempoTeoricoManual: newAct.tiempoTeoricoManual || 0
        }));
        executeOrQueue({
          table: 'activities',
          type: 'insert',
          data: toInsertForDB
        });
      }

      const deduplicatedActs = Array.from(new Map(finalActs.map(a => [a.id, a])).values());
      setActivities(deduplicatedActs);
      safeLocalStorageSetItem(`zitron_${selectedArea}_activities`, JSON.stringify(deduplicatedActs));
      addToast("REGISTRO COMPLETADO", "success");
      setSelectedUsers([]);
    } catch (e) {
      addToast("Error al procesar actividades", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndTurn = async (users: string[], cierre: any) => {
    if (!selectedArea) return;
    setIsLoading(true);
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    try {
      const updatedActs = activities.map(openAct => {
        const shouldClose = (
          (!cierre?.id && users.some(u => openAct.operarios?.includes(u)) && !openAct.horaFin) ||
          (cierre?.id && openAct.id === cierre.id)
        );

        if (shouldClose) {
          const duration = calcDuration(openAct.horaInicio, timeStr);
          const closed = { 
            ...openAct, 
            horaFin: timeStr, 
            duracionMin: duration, 
            cantidad: cierre?.cantidad !== undefined ? cierre.cantidad : (openAct.cantidad || 0), 
            comentarios: cierre?.comentarios !== undefined ? cierre.comentarios : (openAct.comentarios || "") 
          };
          if (isConfigured || !isOnline) {
            // Only send fields that exist in the DB table
            const closedForDB = {
              id: closed.id,
              operarios: closed.operarios || [],
              formato: closed.formato || '',
              tipoTarea: closed.tipoTarea || '',
              horaInicio: closed.horaInicio || '',
              horaFin: closed.horaFin || '',
              duracionMin: closed.duracionMin || 0,
              cantidad: closed.cantidad || 0,
              comentarios: closed.comentarios || '',
              fecha: closed.fecha || '',
              area: closed.area || selectedArea,
              tiempoTeoricoManual: closed.tiempoTeoricoManual || 0
            };
            executeOrQueue({
              table: 'activities',
              type: 'update',
              data: closedForDB,
              filter: { column: 'id', value: openAct.id }
            });
          }
          return closed;
        }
        return openAct;
      });

      setActivities(updatedActs);
      safeLocalStorageSetItem(`zitron_${selectedArea}_activities`, JSON.stringify(updatedActs));
      addToast("TAREA CERRADA", "success");
      setSelectedUsers([]);
    } catch (e) {
      addToast("Error al finalizar", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // --- AUTO-FIX FOR CORTE LASER AND DURATION ---
  useEffect(() => {
    if (activities.length > 0 || history.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      let changed = false;

      const fixActivity = (act: Activity) => {
        let updated = { ...act };
        let localChanged = false;

        // 1. Recalcular duración si falta o es inconsistente (solo para hoy)
        if (act.fecha === today && act.horaInicio && act.horaFin && !act.duracionMin) {
          updated.duracionMin = calcDuration(act.horaInicio, act.horaFin);
          localChanged = true;
        }

        // 2. Asegurar que tiempoTeoricoManual es número para corte-laser
        if (act.area === 'corte-laser' && typeof act.tiempoTeoricoManual === 'string') {
          updated.tiempoTeoricoManual = parseFloat(act.tiempoTeoricoManual) || 0;
          localChanged = true;
        }

        return { updated, localChanged };
      };

      const newActivities = activities.map(act => {
        const { updated, localChanged } = fixActivity(act);
        if (localChanged) changed = true;
        return updated;
      });

      const newHistory = history.map(act => {
        const { updated, localChanged } = fixActivity(act);
        if (localChanged) changed = true;
        return updated;
      });

      if (changed) {
        setActivities(newActivities);
        setHistory(newHistory);
        // Persistir cambios locales
        if (selectedArea) {
          safeLocalStorageSetItem(`zitron_${selectedArea}_activities`, JSON.stringify(newActivities));
          safeLocalStorageSetItem(`zitron_${selectedArea}_history`, JSON.stringify(newHistory));
        }
      }
    }
  }, [activities.length, history.length, selectedArea]);

  const handleUpdateActivity = async (updated: Activity) => {
    if (!selectedArea) return;

    // Recalculate duration if both times are present
    if (updated.horaInicio && updated.horaFin) {
      updated.duracionMin = calcDuration(updated.horaInicio, updated.horaFin);
    }
    
    // Strip legacy/non-DB fields before sending to Supabase
    const { isHistory, tiempoTeorico, created_at, ...dataToSync } = updated as any;
    
    // Only keep fields that exist in the DB schema
    const syncData = {
      id: dataToSync.id,
      operarios: dataToSync.operarios || [],
      formato: dataToSync.formato || '',
      tipoTarea: dataToSync.tipoTarea || '',
      horaInicio: dataToSync.horaInicio || '',
      horaFin: dataToSync.horaFin || null,
      duracionMin: dataToSync.duracionMin || null,
      cantidad: dataToSync.cantidad || 0,
      comentarios: dataToSync.comentarios || '',
      fecha: dataToSync.fecha || '',
      area: dataToSync.area || selectedArea,
      afectaCalidad: dataToSync.afectaCalidad || false,
      tiempoTeoricoManual: dataToSync.tiempoTeoricoManual || 0
    };
    
    const isHistoryItem = history.some(a => String(a.id) === String(updated.id));
    if (isHistoryItem) {
      setHistory(prev => {
        const next = prev.map(a => String(a.id) === String(updated.id) ? updated : a);
        safeLocalStorageSetItem(`zitron_${selectedArea}_history`, JSON.stringify(next));
        return next;
      });
      executeOrQueue({
        table: 'history',
        type: 'update',
        data: syncData,
        filter: { column: 'id', value: updated.id }
      });
    } else {
      setActivities(prev => {
        const next = prev.map(a => String(a.id) === String(updated.id) ? updated : a);
        safeLocalStorageSetItem(`zitron_${selectedArea}_activities`, JSON.stringify(next));
        return next;
      });
      executeOrQueue({
        table: 'activities',
        type: 'update',
        data: syncData,
        filter: { column: 'id', value: updated.id }
      });
    }
    addToast("REGISTRO ACTUALIZADO", "success");
  };

  const handleResetMasterSpeeds = async () => {
    if (!selectedArea) return;
    setIsLoading(true);
    try {
      if (isConfigured) {
        const { error: delError } = await supabase
          .from('master_speeds')
          .delete()
          .eq('area', selectedArea);
        
        if (delError) throw delError;

        const initial = getInitialMasterSpeeds(selectedArea);
        const toInsert = initial.map(ms => ({
          id: ms.id,
          formato: ms.formato,
          tiempoTeorico: ms.tiempoTeorico,
          peso: ms.peso || 0,
          unidad: ms.unidad || 'unidades',
          area: selectedArea
        }));

        const { error: insError } = await supabase
          .from('master_speeds')
          .insert(toInsert);

        if (insError) throw insError;
        setMasterSpeeds(initial);
      } else {
        const initial = getInitialMasterSpeeds(selectedArea);
        setMasterSpeeds(initial);
      }
      addToast("TIEMPOS REINICIADOS CORRECTAMENTE", "success");
    } catch (e) {
      console.error(e);
      addToast("Error al reiniciar tiempos", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteActivity = async (id: string, isHistory: boolean) => {
    if (!selectedArea) return;
    if (isHistory) {
      setHistory(prev => {
        const next = prev.filter(a => String(a.id) !== String(id));
        safeLocalStorageSetItem(`zitron_${selectedArea}_history`, JSON.stringify(next));
        return next;
      });
      executeOrQueue({
        table: 'history',
        type: 'delete',
        filter: { column: 'id', value: id }
      });
    } else {
      setActivities(prev => {
        const next = prev.filter(a => String(a.id) !== String(id));
        safeLocalStorageSetItem(`zitron_${selectedArea}_activities`, JSON.stringify(next));
        return next;
      });
      executeOrQueue({
        table: 'activities',
        type: 'delete',
        filter: { column: 'id', value: id }
      });
    }
    addToast("REGISTRO ELIMINADO", "success");
  };

  const handleDeleteAllHistory = async () => {
    if (!selectedArea) return;
    
    // Clear local state
    setHistory([]);
    safeLocalStorageSetItem(`zitron_${selectedArea}_history`, JSON.stringify([]));

    // Clear Supabase
    executeOrQueue({
      table: 'history',
      type: 'delete',
      filter: { column: 'area', value: selectedArea }
    });
    
    addToast("HISTÓRICO VACIADO", "success");
  };

  const handleImportHistory = async (data: Activity[]) => {
    if (!selectedArea) return;
    
    // 1. Actualizar estado local (limitado a 4000)
    setHistory(prev => {
      const existingIds = new Set(prev.map(h => h.id));
      const newData = data.filter(d => !existingIds.has(d.id));
      const next = [...newData, ...prev].slice(0, 4000);
      
      // Guardar en localStorage de forma diferida para no bloquear el renderizado
      setTimeout(() => {
        safeLocalStorageSetItem(`zitron_${selectedArea}_history`, JSON.stringify(next));
      }, 1000);
      
      return next;
    });

    // 2. Sincronizar con Supabase en bloques más grandes para reducir peticiones
    const chunkSize = 1000;
    const totalChunks = Math.ceil(data.length / chunkSize);
    
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      // Usar silent=true para evitar cientos de toasts que bloquean la UI
      await executeOrQueue({
        table: 'history',
        type: 'upsert',
        data: chunk.map(d => ({ ...d, area: selectedArea })),
        filter: { column: 'id' }
      }, true);
      
      // Pequeña pausa para permitir que el navegador procese otros eventos
      if (data.length > chunkSize) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    addToast("HISTÓRICO IMPORTADO Y SINCRONIZADO", "success");
  };

  const handleFinalizeShift = async (fecha: string, forceClose: boolean = false, aggregatedQuantities?: Record<string, { cantidad: number, cantidadNok?: number }>, mermasToSave?: any[]) => {
    if (!selectedArea) return;
    setIsLoading(true);
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    try {
      const readyToArchive: Activity[] = activities.map(a => {
        let cantidad = a.cantidad || 0;
        let cantidadNok = a.cantidadNok || 0;
        
        if (aggregatedQuantities && aggregatedQuantities[a.formato]) {
          // Proportional distribution based on duration (or just assign if only one activity)
          // Simplified: assign to all activities of the same format
          const sameFormatCount = activities.filter(act => act.formato === a.formato).length || 1;
          cantidad = aggregatedQuantities[a.formato].cantidad / sameFormatCount;
          cantidadNok = (aggregatedQuantities[a.formato].cantidadNok || 0) / sameFormatCount;
        }

        if (!a.horaFin) {
          const duration = calcDuration(a.horaInicio, timeStr);
          return { 
            ...a, 
            horaFin: timeStr, 
            duracionMin: duration, 
            cantidad,
            cantidadNok,
            comentarios: a.comentarios ? `${a.comentarios} (CIERRE TURNO)` : "CIERRE TURNO", 
            fecha, 
            area: selectedArea 
          };
        }
        const durMin = (a.duracionMin && a.duracionMin > 0) ? a.duracionMin : calcDuration(a.horaInicio, a.horaFin || timeStr);
        return { ...a, fecha, area: selectedArea, cantidad, cantidadNok, duracionMin: durMin };
      });

      setHistory(prev => {
        const next = [...readyToArchive, ...prev].slice(0, 500);
        safeLocalStorageSetItem(`zitron_${selectedArea}_history`, JSON.stringify(next));
        return next;
      });
      
      setActivities([]);
      safeLocalStorageSetItem(`zitron_${selectedArea}_activities`, JSON.stringify([]));

      // Move to history - only send fields that exist in the DB table
      const archiveData = readyToArchive.map(a => {
        const act = a as any;
        return { 
          id: `hist-${act.id}`,
          operarios: act.operarios || [],
          formato: act.formato || '',
          tipoTarea: act.tipoTarea || '',
          horaInicio: act.horaInicio || '',
          horaFin: act.horaFin || '',
          duracionMin: act.duracionMin || 0,
          cantidad: act.cantidad || 0,
          cantidadNok: act.cantidadNok || 0,
          comentarios: act.comentarios || '',
          fecha: act.fecha || '',
          area: selectedArea,
          afectaCalidad: act.afectaCalidad || false,
          tiempoTeoricoManual: act.tiempoTeoricoManual || 0
        };
      });

      executeOrQueue({
        table: 'history',
        type: 'upsert',
        data: archiveData,
        filter: { column: 'id' }
      }).then(() => {
        executeOrQueue({
          table: 'activities',
          type: 'delete',
          filter: { column: 'area', value: selectedArea }
        });
      });

      // Guardar mermas se existirem
      if (mermasToSave && mermasToSave.length > 0) {
        executeOrQueue({
          table: 'mermas',
          type: 'upsert',
          data: mermasToSave,
          filter: { column: 'id' }
        });
      }

      addToast("TURNO ARCHIVADO", "success");
    } catch (e) {
      addToast("Error al archivar", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const showGlobalNav = selectedWorkshop !== null || selectedArea !== undefined || currentView !== 'root-menu';

  const customHeaderTitle = useMemo(() => {
    if (selectedArea === 'TOP 60') {
      if (top60Access === 'cmi') return 'CMI TOP 60';
      if (top60Access === 'preparacion') return 'PREPARACIÓN TOP 60';
      if (activeTab === 'config') return 'MAESTRO TOP 60';
    }
    return undefined;
  }, [selectedArea, top60Access, activeTab]);

  const filteredOperarios = useMemo(() => {
    if (!selectedArea) return [];
    
    // Combine global users assigned to this area with area-specific users
    const globalAssigned = globalUsers.filter(u => u.areas?.includes(selectedArea));
    
    let source: User[] = [];
    if (selectedArea === 'TOP 15') source = [...top15Users, ...globalAssigned];
    else if (selectedArea === 'TOP 60') source = [...top60Users, ...globalAssigned];
    else source = [...operarios, ...globalAssigned];

    // Remove duplicates by name
    const uniqueMap = new Map<string, User>();
    source.forEach(u => {
      if (u && u.nombre) {
        const nameKey = u.nombre.trim().toUpperCase();
        if (!uniqueMap.has(nameKey)) {
          uniqueMap.set(nameKey, u);
        }
      }
    });
    
    return Array.from(uniqueMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [globalUsers, top15Users, top60Users, selectedArea, operarios]);

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
  };

  const handleRootSelect = (opt: 'top5' | 'top15' | 'top60') => {
    // Verificar niveles de acceso (N1: TOP 5, N2: TOP 15, N3: TOP 60)
    if (opt === 'top15' && userLevel < 2) {
      addToast("NIVEL INSUFICIENTE: Requiere acceso Nivel 2 (TOP 15)", "error");
      return;
    }
    if (opt === 'top60' && userLevel < 3) {
      addToast("NIVEL INSUFICIENTE: Requiere acceso Nivel 3 (TOP 60)", "error");
      return;
    }

    if (opt === 'top5') setCurrentView('menu');
    if (opt === 'top15') {
      setSelectedArea('TOP 15');
      setCurrentView('area');
      setTop15SubView('indicators');
      setActiveTab('work');
    }
    if (opt === 'top60') {
      setSelectedArea('TOP 60');
      setCurrentView('area');
      setTop60Access(null);
      setTop60SubView('dashboard');
      setActiveTab('work');
    }
  };

  const handleUpdateGlobalUser = (updatedUser: User) => {
    setGlobalUsers(prev => {
      const next = prev.map(u => u.id === updatedUser.id ? updatedUser : u);
      safeLocalStorageSetItem('zitron_global_users', JSON.stringify(next));
      return next;
    });
    addToast("POLIVALENCIA ACTUALIZADA", "success");
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-6">
          {JOSELITO_LOGO ? (
            <div className="relative">
              <img 
                src={JOSELITO_LOGO} 
                alt="JOSELITO" 
                className="h-16 sm:h-24 w-auto object-contain animate-pulse"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback');
                  if (fallback) (fallback as HTMLElement).style.display = 'block';
                }}
              />
              <h1 className="logo-fallback text-4xl font-serif font-black text-slate-900 tracking-tight uppercase hidden">JOSELITO</h1>
            </div>
          ) : (
            <h1 className="text-4xl font-serif font-black text-slate-900 tracking-tight uppercase">JOSELITO</h1>
          )}
          <div className="w-16 h-16 border-4 border-slate-100 border-t-joselito-red rounded-full animate-spin" />
          <p className="text-slate-400 font-black uppercase text-[12px] tracking-[0.4em]">Verificando Sesión...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Login onLoginSuccess={() => {}} />;
  }

  return (
    <div className="h-[100dvh] flex flex-col font-sans selection:bg-blue-100 overflow-hidden relative z-10 bg-slate-50">
      <style>{`
        html, body, #root {
          height: 100%;
          overflow: hidden;
        }
        .scroll-container {
          height: 100%;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
      `}</style>
      <Header 
        activeTab={activeTab} 
        setActiveTab={handleTabChange} 
        currentAreaId={selectedArea}
        onGoHome={handleGoHome}
        onBack={handleBack}
        onOpenGlobalConfig={() => setShowGlobalPinModal(true)}
        onOpenPasswordConfig={() => setShowPasswordConfig(true)}
        onOpenHelp={() => setIsGlobalHelpOpen(true)}
        onOpenConnectionHelp={() => setIsConnectionHelpOpen(true)}
        showGlobalNav={showGlobalNav}
        customTitle={customHeaderTitle}
        isConfigured={isConfigured}
        isBackendReady={isBackendReady}
        backendError={backendError}
        syncQueueLength={syncQueue.length}
        lastSyncError={lastConnectionError}
        onLogout={handleLogout}
        onOpenUserManager={() => setShowUserManager(true)}
      />
      
      {!isConfigured && (
        <div className="bg-amber-500 text-white text-[14px] font-black py-1 px-4 text-center uppercase tracking-widest animate-pulse z-50">
          ⚠️ Modo Offline: No se han detectado las claves de Supabase. Los datos son locales.
        </div>
      )}
      
      {currentView === 'area' && (
        <div className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-1.5 flex items-center justify-end gap-3 z-20 shrink-0">
          {/* Connection status moved to Header */}
        </div>
      )}

      <main className="flex-1 overflow-hidden relative flex flex-col">
        <div className="flex-1 overflow-y-auto scroll-container pb-20 sm:pb-0">
          <div className="container mx-auto min-h-full flex flex-col p-1 sm:p-2">
        {currentView === 'root-menu' ? (
          <RootMenu 
            onSelectOption={handleRootSelect} 
            onOpenConfig={() => setShowPasswordConfig(true)}
          />
        ) : currentView === 'menu' ? (
          <div>
            <MainMenu 
              selectedWorkshop={selectedWorkshop} 
              setSelectedWorkshop={setSelectedWorkshop} 
              onSelectArea={handleAreaSelect} 
              operarios={globalUsers}
              onUpdateOperario={handleUpdateGlobalUser}
            />
          </div>
        ) : (
          <>
            {activeTab === 'work' && selectedArea === 'sala-blanca-dashboard' && (
              <SalaBlancaDashboard history={history} activities={activities} allObjectives={allObjectives} mermas={mermas} />
            )}
            {activeTab === 'work' && selectedArea === 'envasado-dashboard' && (
              <EnvasadoDashboard history={history} activities={activities} allObjectives={allObjectives} mermas={mermas} />
            )}
            {activeTab === 'work' && selectedArea === 'expediciones-dashboard' && (
              <ExpedicionesDashboard history={history} activities={activities} allObjectives={allObjectives} mermas={mermas} />
            )}
            {activeTab === 'work' && selectedArea !== 'sala-blanca-dashboard' && selectedArea !== 'envasado-dashboard' && selectedArea !== 'expediciones-dashboard' && (
              <>
                {selectedArea === 'TOP 15' && (
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4 sm:mb-8 animate-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-50 text-emerald-600 rounded-xl sm:rounded-2xl flex items-center justify-center">
                        <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <div>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tighter">TOP 15</h2>
                        <p className="text-[15px] sm:text-[14px] font-black text-emerald-600 uppercase tracking-widest">Mandos Intermedios</p>
                      </div>
                    </div>
                    <div className="flex gap-2 sm:gap-4 w-full sm:w-auto">
                      <button 
                        onClick={() => setTop15SubView('indicators')}
                        className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl text-[13px] sm:text-[14px] font-black uppercase tracking-widest transition-all shadow-lg ${top15SubView === 'indicators' ? 'bg-emerald-600 text-white shadow-emerald-200 scale-105' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                      >
                        Indicadores
                      </button>
                      <button 
                        onClick={() => setTop15SubView('plan')}
                        className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl text-[13px] sm:text-[14px] font-black uppercase tracking-widest transition-all shadow-lg ${top15SubView === 'plan' ? 'bg-emerald-600 text-white shadow-emerald-200 scale-105' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                      >
                        Plan de Acción
                      </button>
                    </div>
                  </div>
                )}

                {selectedArea === 'TOP 60' && top60Access === null && (
                  <div className="flex flex-col items-center gap-8 py-12 animate-in fade-in zoom-in duration-500">
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase mb-8">Gestión Estratégica TOP 60</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
                      <button 
                        onClick={() => setTop60Access('cmi')}
                        className="group p-8 rounded-[3rem] bg-white border-4 border-slate-100 hover:border-indigo-600 hover:shadow-2xl transition-all duration-500 text-left relative overflow-hidden"
                      >
                        <div className="relative z-10">
                          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            <BarChart3 className="w-7 h-7" />
                          </div>
                          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-1">CMI TOP 60</h3>
                          <p className="text-slate-500 text-xs font-medium">Cuadro de Mando Integral y Plan de Acción Estratégico.</p>
                        </div>
                      </button>
                      <button 
                        onClick={() => setTop60Access('preparacion')}
                        className="group p-8 rounded-[3rem] bg-white border-4 border-slate-100 hover:border-blue-600 hover:shadow-2xl transition-all duration-500 text-left relative overflow-hidden"
                      >
                        <div className="relative z-10">
                          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <Settings className="w-7 h-7" />
                          </div>
                          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-1">Preparación TOP 60</h3>
                          <p className="text-slate-500 text-xs font-medium">Módulo de preparación y pre-análisis para reuniones estratégicas.</p>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {selectedArea === 'TOP 60' && top60Access === 'cmi' && (
                  <div className="flex justify-end items-center mb-6 animate-in slide-in-from-top-4 duration-500">
                    <div className="flex gap-4">
                      <button 
                        onClick={() => setTop60SubView('dashboard')}
                        className={`px-6 py-3 rounded-2xl text-[14px] font-black uppercase tracking-widest transition-all shadow-lg ${top60SubView === 'dashboard' ? 'bg-indigo-600 text-white shadow-indigo-200 scale-105' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                      >
                        Cuadro de Mando
                      </button>
                      <button 
                        onClick={() => setTop60SubView('plan')}
                        className={`px-6 py-3 rounded-2xl text-[14px] font-black uppercase tracking-widest transition-all shadow-lg ${top60SubView === 'plan' ? 'bg-indigo-600 text-white shadow-indigo-200 scale-105' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                      >
                        Plan de Acción
                      </button>
                    </div>
                  </div>
                )}

                {selectedArea === 'TOP 60' && top60Access === 'preparacion' && (
                  <div className="animate-in fade-in zoom-in duration-500">
                    <TOP60Preparacion operarios={filteredOperarios} passwords={passwords} />
                  </div>
                )}

                {selectedArea === 'TOP 15' ? (
                  top15SubView === 'plan' ? (
                    <ActionPlanPanel 
                      storageKey="zitron_top15_actionplan"
                      title="Plan de Acción Táctico TOP 15"
                      initialData={INITIAL_ACTION_PLAN_TOP15}
                      responsibles={responsibles.length > 0 ? responsibles : filteredOperarios.map(o => o.nombre)}
                      dbTable="action_plan_top15"
                      passwords={passwords}
                      requiredLevel={2}
                    />
                  ) : (
                    <TOP15Indicators 
                      activities={activities}
                      history={history}
                      masterSpeeds={masterSpeeds}
                      incidenceMaster={incidenceMaster}
                      allObjectives={allObjectives}
                      mermas={mermas}
                    />
                  )
                ) : selectedArea === 'TOP 60' ? (
                  top60Access === 'cmi' ? (
                    top60SubView === 'plan' ? (
                      <ActionPlanPanel 
                        storageKey="zitron_top60_actionplan"
                        title="Plan de Acción Estratégico TOP 60"
                        responsibles={responsibles.length > 0 ? responsibles : filteredOperarios.map(o => o.nombre)}
                        dbTable="action_plan_top60"
                        passwords={passwords}
                        requiredLevel={3}
                      />
                    ) : (
                      <TOP60Dashboard 
                        activities={activities} 
                        history={history} 
                        allObjectives={allObjectives}
                        operarios={operarios}
                      />
                    )
                  ) : null
                ) : (
                  <WorkPanel 
                    selectedUsers={selectedUsers} setSelectedUsers={setSelectedUsers}
                    activities={activities} incidenceMaster={incidenceMaster} masterSpeeds={masterSpeeds}
                    oeeObjectives={oeeObjectives} operarios={filteredOperarios}
                    onAddActivity={handleAddActivity}
                    onAddMultipleActivities={handleAddMultipleActivities}
                    onEndTurn={handleEndTurn}
                    onUpdateActivity={handleUpdateActivity}
                    onDeleteActivity={handleDeleteActivity}
                    onFinalizeShift={handleFinalizeShift}
                    onRefresh={loadData}
                    isEndModalOpen={false} onConfirmEndActivity={() => {}} onCancelEndModal={() => {}} activityToCloseName={''}
                    selectedArea={selectedArea}
                    passwords={passwords}
                  />
                )}
              </>
            )}
            {activeTab === 'config' && (
              <ConfigPanel 
                masterSpeeds={masterSpeeds} 
                setMasterSpeeds={handleSetSpeeds} 
                onDeleteTask={handleDeleteTask}
                incidenceMaster={incidenceMaster} 
                setIncidenceMaster={handleSetIncidences} 
                onDeleteIncidence={handleDeleteIncidence}
                oeeObjectives={oeeObjectives} 
                setOeeObjectives={handleSetObjectives}
                allObjectives={allObjectives}
                onUpdateAllObjectives={handleUpdateAllObjectives}
                selectedArea={selectedArea}
                onlyPeople={selectedArea === 'TOP 15' || selectedArea === 'TOP 60'}
                passwords={passwords}
                responsibles={responsibles}
                setResponsibles={setResponsibles}
              />
            )}
            {activeTab === 'database' && (
              <DatabasePanel 
                activities={activities}
                history={history}
                mermas={mermas}
                onUpdateActivity={handleUpdateActivity}
                onDeleteActivity={handleDeleteActivity}
                onDeleteAllHistory={handleDeleteAllHistory}
                onImportHistory={handleImportHistory}
                onAddActivity={async (act) => {
                  const { id, ...rest } = act;
                  await handleAddActivity(rest);
                }}
                onResetMasterSpeeds={handleResetMasterSpeeds}
                selectedArea={selectedArea}
                passwords={passwords}
                operarios={operarios}
              />
            )}
          </>
        )}
        </div>
      </div>
    </main>

      <GlobalHelpModal 
        isOpen={isGlobalHelpOpen} 
        onClose={() => setIsGlobalHelpOpen(false)} 
      />

      <ConnectionHelpModal 
        isOpen={isConnectionHelpOpen} 
        onClose={() => setIsConnectionHelpOpen(false)} 
        isConfigured={isConfigured}
        debugInfo={debugConfig}
        lastError={lastConnectionError}
        isBackendReady={isBackendReady}
        backendError={backendError}
        syncQueueLength={syncQueue.length}
        syncQueue={syncQueue}
        onClearSyncQueue={() => {
          setSyncQueue([]);
          safeLocalStorageSetItem('zitron_sync_queue', JSON.stringify([]));
          localStorage.removeItem('zitron_last_sync_error');
          setLastConnectionError(null);
          addToast("COLA DE SINCRONIZACIÓN LIMPIADA", "success");
        }}
        onResetAllData={() => {
          localStorage.clear();
          window.location.reload();
        }}
        onForceRefresh={() => {
          loadData(true);
          setIsConnectionHelpOpen(false);
          addToast("ACTUALIZANDO DATOS DESDE LA NUBE...", "info");
        }}
        onTestDirectConnection={async () => {
          try {
            const res = await fetch('/api/db-check-v2');
            const data = await res.json();
            if (res.ok) addToast(`Conexión Directa OK: ${data.time}`, "success");
            else addToast(`Error Conexión Directa: ${data.error}`, "error");
          } catch (e: any) {
            addToast(`Error al contactar con el backend: ${e.message}`, "error");
          }
        }}
      />

      {isLoading && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center z-[5000]">
          <div className="bg-white px-8 py-6 rounded-[2rem] shadow-2xl flex flex-col items-center gap-4 border-2 border-slate-50 animate-in zoom-in duration-300">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-100 border-t-blue-600"></div>
            <div className="flex flex-col items-center gap-1">
              <p className="font-black text-slate-800 text-[13px] uppercase tracking-[0.2em]">Sincronizando...</p>
              {showForceClose && (
                <button 
                  onClick={() => setIsLoading(false)}
                  className="text-[10px] font-black text-blue-500 hover:text-blue-700 uppercase tracking-widest underline animate-in fade-in slide-in-from-bottom-2 duration-500"
                >
                  ¿Tarda demasiado? Forzar cierre
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-4 right-4 z-[6000] flex flex-col gap-2 max-w-xs w-full pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="p-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-right-full duration-300 pointer-events-auto bg-slate-900 border-slate-800 text-white">
            <div className={`w-2 h-2 rounded-full ${toast.type === 'success' ? 'bg-emerald-400' : toast.type === 'error' ? 'bg-red-400' : 'bg-blue-400'}`}></div>
            <div className="flex-1 text-[14px] font-black uppercase tracking-widest leading-none">{toast.message}</div>
          </div>
        ))}
      </div>

      {/* PIN Modal for Global User Config */}
      {showGlobalPinModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className={`bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-sm border-8 ${globalPinError ? 'border-red-100 animate-shake' : 'border-indigo-50'}`}>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Gestión de Personas</h3>
              <p className="text-[14px] font-bold text-slate-400 uppercase tracking-widest mt-1">Introduce PIN de Jefe Taller o Superior</p>
            </div>
            
            <div className="flex justify-center gap-3 mb-8">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`w-12 h-16 rounded-2xl border-4 flex items-center justify-center text-2xl font-black transition-all ${globalPin.length > i ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-100 bg-slate-50 text-slate-300'}`}>
                  {globalPin.length > i ? '●' : ''}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'X'].map((num) => (
                <button
                  key={num}
                  onClick={() => {
                    if (num === 'C') setGlobalPin('');
                    else if (num === 'X') setShowGlobalPinModal(false);
                    else if (globalPin.length < 4) setGlobalPin(prev => prev + num);
                  }}
                  className={`h-16 rounded-2xl font-black text-lg transition-all ${num === 'X' ? 'bg-red-50 text-red-500 hover:bg-red-100' : num === 'C' ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 active:scale-95'}`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PIN Modal for TOP 60 Preparacion */}
      {showTop60PinModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className={`bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-sm border-8 ${top60PinError ? 'border-red-100 animate-shake' : 'border-blue-50'}`}>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Acceso TOP 60</h3>
              <p className="text-[14px] font-bold text-slate-400 uppercase tracking-widest mt-1">Introduce el PIN de Director Operaciones</p>
            </div>
            
            <div className="flex justify-center gap-3 mb-8">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`w-12 h-16 rounded-2xl border-4 flex items-center justify-center text-2xl font-black transition-all ${top60Pin.length > i ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-100 bg-slate-50 text-slate-300'}`}>
                  {top60Pin.length > i ? '●' : ''}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'X'].map((num) => (
                <button
                  key={num}
                  onClick={() => {
                    if (num === 'C') setTop60Pin('');
                    else if (num === 'X') setShowTop60PinModal(false);
                    else if (top60Pin.length < 4) setTop60Pin(prev => prev + num);
                  }}
                  className={`h-16 rounded-2xl font-black text-lg transition-all ${num === 'X' ? 'bg-red-50 text-red-500 hover:bg-red-100' : num === 'C' ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 active:scale-95'}`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showPasswordConfig && (
        <PasswordConfigModal 
          passwords={passwords}
          onUpdatePasswords={handleUpdatePasswords}
          onClose={() => setShowPasswordConfig(false)}
        />
      )}

      {showGlobalUserConfig && (
        <GlobalUserConfig 
          users={globalUsers}
          onUpdateUsers={handleUpdateGlobalUsers}
          onClose={() => setShowGlobalUserConfig(false)}
        />
      )}

      {showUserManager && (
        <UserManager 
          onClose={() => setShowUserManager(false)} 
          currentUserLevel={userLevel}
        />
      )}
    </div>
  );
};

export default App;
