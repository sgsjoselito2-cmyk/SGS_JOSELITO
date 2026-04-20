import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ConnectionHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  isConfigured: boolean;
  debugInfo?: {
    hasUrl: boolean;
    urlStart: string;
    hasKey: boolean;
    keyLength: number;
    isVitePrefix: boolean;
    hasDbUrl: boolean;
  };
  lastError?: string | null;
  isBackendReady: boolean;
  backendError: string | null;
  onClearSyncQueue?: () => void;
  onResetAllData?: () => void;
  onForceRefresh?: () => void;
  onTestDirectConnection?: () => void;
  syncQueueLength?: number;
  syncQueue?: any[];
}

const ConnectionHelpModal: React.FC<ConnectionHelpModalProps> = ({ 
  isOpen, 
  onClose, 
  isConfigured, 
  debugInfo, 
  lastError, 
  isBackendReady, 
  backendError,
  onClearSyncQueue,
  onResetAllData,
  onForceRefresh,
  onTestDirectConnection,
  syncQueueLength = 0,
  syncQueue = []
}) => {
  const [confirmAction, setConfirmAction] = React.useState<'clearQueue' | 'resetData' | null>(null);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border-8 border-slate-50"
          >
            <div className="p-8 max-h-[90vh] overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isConfigured ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Estado de Conexión</h3>
                    <p className="text-[14px] font-bold text-slate-400 uppercase tracking-widest">Asistente de Sincronización Cloud</p>
                  </div>
                </div>
                <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="space-y-6">
                <div className={`p-6 rounded-3xl border-2 ${isConfigured ? 'bg-emerald-50/50 border-emerald-100' : 'bg-amber-50/50 border-amber-100'}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-3 h-3 rounded-full ${isConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
                    <span className={`text-xs font-black uppercase tracking-widest ${isConfigured ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {isConfigured ? 'Conexión Configurada Correctamente' : 'Configuración Pendiente'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed">
                    {isConfigured 
                      ? 'Tu aplicación está conectada a Supabase. Todos los datos se sincronizan automáticamente en la nube.'
                      : 'La aplicación está funcionando en modo local. Los datos se guardan solo en este navegador.'}
                  </p>
                </div>

                {lastError && (
                  <div className="p-6 rounded-3xl bg-red-50 border-2 border-red-100">
                    <h4 className="text-[14px] font-black text-red-600 uppercase tracking-widest mb-2">Último Error Detectado:</h4>
                    <p className="text-xs text-red-700 font-mono bg-white/50 p-3 rounded-xl border border-red-100">
                      {lastError}
                    </p>
                    <p className="text-[13px] text-red-400 font-bold mt-3 uppercase tracking-tight">
                      TIP: Revisa que las tablas existan en Supabase y que el script SQL se haya ejecutado. Si has renombrado columnas, puede que necesites esperar unos minutos para que Supabase actualice su caché.
                    </p>
                  </div>
                )}

                <div className="p-6 rounded-3xl bg-slate-50 border-2 border-slate-100">
                  <h4 className="text-[14px] font-black text-slate-400 uppercase tracking-widest mb-4">Diagnóstico de Variables:</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[14px] font-bold">
                      <span className="text-slate-500 uppercase">VITE_SUPABASE_URL:</span>
                      <span className={debugInfo?.hasUrl ? 'text-emerald-600' : 'text-red-600'}>
                        {debugInfo?.hasUrl ? `DETECTADA (${debugInfo.urlStart})` : 'NO DETECTADA'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[14px] font-bold">
                      <span className="text-slate-500 uppercase">VITE_SUPABASE_ANON_KEY:</span>
                      <span className={debugInfo?.hasKey ? 'text-emerald-600' : 'text-red-600'}>
                        {debugInfo?.hasKey ? `DETECTADA (${debugInfo.keyLength} carac.)` : 'NO DETECTADA'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[14px] font-bold">
                      <span className="text-slate-500 uppercase">Prefijo VITE_ correcto:</span>
                      <span className={debugInfo?.isVitePrefix ? 'text-emerald-600' : 'text-red-600'}>
                        {debugInfo?.isVitePrefix ? 'SÍ' : 'NO'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[14px] font-bold">
                      <span className="text-slate-500 uppercase">DATABASE_URL (URI):</span>
                      <span className={debugInfo?.hasDbUrl ? 'text-emerald-600' : 'text-slate-400'}>
                        {debugInfo?.hasDbUrl ? 'DETECTADA' : 'NO CONFIGURADA'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[14px] font-bold">
                      <span className="text-slate-500 uppercase">Servidor Backend:</span>
                      <span className={isBackendReady ? 'text-emerald-600' : 'text-amber-600'}>
                        {isBackendReady ? 'EN LÍNEA' : backendError || 'INICIANDO...'}
                      </span>
                    </div>
                    {!isBackendReady && (
                      <button 
                        onClick={() => window.location.reload()}
                        className="mt-2 w-full py-2 bg-amber-100 text-amber-700 rounded-lg text-[14px] font-bold hover:bg-amber-200 transition-colors"
                      >
                        REINTENTAR CONEXIÓN (RECARGAR)
                      </button>
                    )}
                    <div className="pt-2 space-y-2">
                      {onForceRefresh && (
                        <button 
                          onClick={onForceRefresh}
                          className="w-full py-2 rounded-xl bg-emerald-50 text-emerald-600 text-[14px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100 flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Forzar Actualización (Nube)
                        </button>
                      )}
                      {onTestDirectConnection && (
                        <button 
                          onClick={onTestDirectConnection}
                          className="w-full py-2 rounded-xl bg-indigo-50 text-indigo-600 text-[14px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100"
                        >
                          Probar Conexión Directa (DATABASE_URL)
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {!isConfigured && (
                  <div className="space-y-4">
                    <h4 className="text-[14px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Pasos para conectar</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="w-6 h-6 rounded-lg bg-white shadow-sm flex items-center justify-center text-xs font-black text-slate-400 shrink-0">1</div>
                        <p className="text-xs text-slate-600 font-bold leading-tight">
                          Ve al panel de <span className="text-blue-600">Supabase</span> y copia la <span className="bg-slate-200 px-1 rounded">Project URL</span> y la <span className="bg-slate-200 px-1 rounded">anon key</span>.
                        </p>
                      </div>
                      <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="w-6 h-6 rounded-lg bg-white shadow-sm flex items-center justify-center text-xs font-black text-slate-400 shrink-0">2</div>
                        <p className="text-xs text-slate-600 font-bold leading-tight">
                          En este panel de AI Studio, busca la pestaña de <span className="text-indigo-600">Variables de Entorno</span> (o Secrets).
                        </p>
                      </div>
                      <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="w-6 h-6 rounded-lg bg-white shadow-sm flex items-center justify-center text-xs font-black text-slate-400 shrink-0">3</div>
                        <div className="space-y-2">
                          <p className="text-xs text-slate-600 font-bold leading-tight">Añade estas dos variables:</p>
                          <code className="block text-[14px] bg-slate-900 text-slate-300 p-3 rounded-xl font-mono leading-relaxed">
                            VITE_SUPABASE_URL<br/>
                            VITE_SUPABASE_ANON_KEY<br/>
                            DATABASE_URL (Opcional, para conexión directa)
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {isConfigured && (
                  <div className="p-6 rounded-3xl bg-blue-50 border-2 border-blue-100">
                    <h4 className="text-[14px] font-black text-blue-600 uppercase tracking-widest mb-2">Conexión Activa:</h4>
                    <p className="text-xs text-blue-700 font-bold leading-relaxed mb-4">
                      Tu sistema está sincronizado con la base de datos central. Todos los cambios se guardan en tiempo real.
                    </p>
                    {syncQueueLength > 0 && onClearSyncQueue && (
                      <div className="pt-4 border-t border-blue-200 mt-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                              <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                            </div>
                            <span className="text-[14px] font-black text-slate-700 uppercase tracking-tight">Cola de Sincronización</span>
                          </div>
                          <span className="px-2 py-1 bg-amber-500 text-white text-[13px] font-black rounded-lg uppercase tracking-widest">{syncQueueLength} pendientes</span>
                        </div>
                        <p className="text-[13px] text-slate-500 font-medium leading-tight mb-4">
                          Si los datos no se suben a la nube, puede que haya un error en la cola. Limpiarla puede solucionar el problema.
                        </p>
                        
                        {syncQueueLength > 0 && (
                          <div className="mb-4 p-3 bg-slate-100 rounded-xl max-h-40 overflow-y-auto no-scrollbar">
                            <h5 className="text-[15px] font-black text-slate-400 uppercase mb-2">Operaciones en cola:</h5>
                            <div className="space-y-2">
                              {syncQueue.map((op, i) => (
                                <div key={op.id || i} className="p-2 bg-white rounded-lg border border-slate-200">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                                      op.type === 'insert' ? 'bg-emerald-100 text-emerald-700' :
                                      op.type === 'update' ? 'bg-blue-100 text-blue-700' :
                                      op.type === 'delete' ? 'bg-red-100 text-red-700' :
                                      'bg-purple-100 text-purple-700'
                                    }`}>
                                      {op.type}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400">{op.table}</span>
                                  </div>
                                  <p className="text-[15px] text-slate-500 font-medium truncate">
                                    {op.type === 'delete' ? `Filtro: ${op.filter?.column}=${op.filter?.value}` : 
                                     Array.isArray(op.data) ? `${op.data.length} registros` : 
                                     JSON.stringify(op.data).substring(0, 50) + '...'}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <button 
                          onClick={() => setConfirmAction('clearQueue')}
                          className="w-full py-3 rounded-2xl bg-amber-500 text-white text-[14px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-amber-100 flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Limpiar Cola de Datos
                        </button>
                      </div>
                    )}

                    {onResetAllData && (
                      <div className="pt-4 border-t border-slate-200 mt-4">
                        <h4 className="text-[14px] font-black text-red-600 uppercase tracking-widest mb-2">Zona de Peligro:</h4>
                        <p className="text-[13px] text-slate-500 font-medium leading-tight mb-4">
                          Si la aplicación está bloqueada o no carga los datos, puedes intentar un reseteo completo de los datos locales.
                        </p>
                        <button 
                          onClick={() => setConfirmAction('resetData')}
                          className="w-full py-3 rounded-2xl bg-white text-red-600 text-[14px] font-black uppercase tracking-widest hover:bg-red-50 transition-all border-2 border-red-100 flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Resetear Datos Locales
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Confirmation Overlay */}
              <AnimatePresence>
                {confirmAction && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute inset-0 z-[11000] bg-white/95 backdrop-blur-md flex items-center justify-center p-8"
                  >
                    <div className="text-center">
                      <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6 ${confirmAction === 'resetData' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">
                        {confirmAction === 'resetData' ? '¿Borrar todo?' : '¿Limpiar cola?'}
                      </h4>
                      <p className="text-sm text-slate-500 font-bold uppercase tracking-wide mb-8 leading-relaxed">
                        {confirmAction === 'resetData' 
                          ? 'Se borrarán todos los datos locales. Los datos en la nube están a salvo.' 
                          : 'Se perderán los datos pendientes de subir a la nube.'}
                      </p>
                      <div className="flex flex-col gap-3">
                        <button 
                          onClick={() => {
                            if (confirmAction === 'clearQueue' && onClearSyncQueue) onClearSyncQueue();
                            if (confirmAction === 'resetData' && onResetAllData) onResetAllData();
                            setConfirmAction(null);
                          }}
                          className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest text-white shadow-xl transition-all active:scale-95 ${confirmAction === 'resetData' ? 'bg-red-600 shadow-red-100' : 'bg-amber-600 shadow-amber-100'}`}
                        >
                          Confirmar Acción
                        </button>
                        <button 
                          onClick={() => setConfirmAction(null)}
                          className="w-full py-4 rounded-2xl bg-slate-100 text-slate-400 font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-8">
                <button 
                  onClick={onClose}
                  className="w-full py-4 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
                >
                  Entendido
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConnectionHelpModal;
