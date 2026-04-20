import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface GlobalHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GlobalHelpModal: React.FC<GlobalHelpModalProps> = ({ isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
          />
          
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-[2.5rem] sm:rounded-[4rem] shadow-2xl overflow-hidden flex flex-col border-8 border-white"
          >
            {/* Header */}
            <div className="bg-indigo-600 p-6 sm:p-10 text-white shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-12 opacity-10">
                <svg className="w-32 h-32 sm:w-48 sm:h-48" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
              </div>
              <div className="relative z-10">
                <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter mb-2">Centro de Ayuda & Tutorial</h2>
                <p className="text-indigo-100 text-[14px] sm:text-xs font-bold uppercase tracking-[0.3em] opacity-80">Ecosystem Production Management System</p>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="absolute top-6 right-6 sm:top-10 sm:right-10 w-8 h-8 sm:w-12 sm:h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all group z-[100]"
              >
                <svg className="w-4 h-4 sm:w-6 sm:h-6 group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-12 space-y-12 sm:space-y-20 no-scrollbar">
              
              {/* Sección 0: Guía de Uso Rápida */}
              <section className="space-y-8 bg-slate-50 p-8 sm:p-12 rounded-[3rem] border border-slate-100 shadow-inner">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg">00</div>
                  <h3 className="text-2xl sm:text-4xl font-black text-slate-900 uppercase tracking-tighter">Guía de Uso: Gestión (TOP 5, 15 y 60)</h3>
                </div>

                <div className="grid grid-cols-1 gap-12 pl-4 border-l-4 border-indigo-100">
                  {/* TOP 5 */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🟢</span>
                      <h4 className="text-xl font-black text-emerald-600 uppercase tracking-tight">TOP 5: Gestión del Taller (Operarios)</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pl-10">
                      <div className="space-y-2">
                        <p className="text-slate-900 font-black text-xs uppercase tracking-widest">Registro de Actividad</p>
                        <p className="text-slate-600 text-[14px] font-medium leading-relaxed">Para comenzar, selecciona el Formato/Actividad y pulsa el botón de Inicio.</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-slate-900 font-black text-xs uppercase tracking-widest">Cambio de Formato</p>
                        <p className="text-slate-600 text-[14px] font-medium leading-relaxed">Al cambiar de actividad, el sistema cerrará automáticamente la anterior y abrirá la nueva.</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-slate-900 font-black text-xs uppercase tracking-widest">Nota</p>
                        <p className="text-slate-600 text-[14px] font-medium leading-relaxed">Si vienes de una actividad de producción, deberás introducir la cantidad fabricada y un comentario si es necesario.</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-slate-900 font-black text-xs uppercase tracking-widest">Excepción</p>
                        <p className="text-slate-600 text-[14px] font-medium leading-relaxed">En Mecanizado y Pintura, las actividades no se cierran solas, permitiendo gestionar varias máquinas o piezas simultáneamente.</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-slate-900 font-black text-xs uppercase tracking-widest">Fin de Actividad</p>
                        <p className="text-slate-600 text-[14px] font-medium leading-relaxed">Es obligatorio que todos los operarios pulsen <span className="text-red-600 font-black">Finalizar formato</span> antes de cerrar el día.</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-slate-900 font-black text-xs uppercase tracking-widest">Consultas y Maestros</p>
                        <p className="text-slate-600 text-[14px] font-medium leading-relaxed">Dashboard (Indicadores), Histórico (Filtros) y Maestro (Gestión de averías/formatos).</p>
                      </div>
                    </div>
                  </div>

                  {/* TOP 15 */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🔵</span>
                      <h4 className="text-xl font-black text-blue-600 uppercase tracking-tight">TOP 15: Análisis y Seguimiento</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pl-10">
                      <div className="space-y-2">
                        <p className="text-slate-900 font-black text-xs uppercase tracking-widest">Indicadores Diarios</p>
                        <p className="text-slate-600 text-[14px] font-medium leading-relaxed">Por defecto muestra los datos del día anterior, permitiendo filtrar por cualquier fecha específica.</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-slate-900 font-black text-xs uppercase tracking-widest">Evolución Semanal</p>
                        <p className="text-slate-600 text-[14px] font-medium leading-relaxed">Gráficos que muestran la tendencia de todos los talleres.</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-slate-900 font-black text-xs uppercase tracking-widest">Análisis de Pérdidas</p>
                        <p className="text-slate-600 text-[14px] font-medium leading-relaxed">Visualización de Paretos. <span className="text-indigo-600 font-black">Truco:</span> Haz doble clic en las barras para ver el detalle.</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-slate-900 font-black text-xs uppercase tracking-widest">Análisis IA</p>
                        <p className="text-slate-600 text-[14px] font-medium leading-relaxed">Resumen automático de lo ocurrido en el día (sujeto a cuota).</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-slate-900 font-black text-xs uppercase tracking-widest">Gestión de Personal</p>
                        <p className="text-slate-600 text-[14px] font-medium leading-relaxed">Acceso exclusivo para gestionar polivalencia y activar operarios.</p>
                      </div>
                    </div>
                  </div>

                  {/* TOP 60 */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🟣</span>
                      <h4 className="text-xl font-black text-indigo-600 uppercase tracking-tight">TOP 60: Gestión Estratégica y CMI</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pl-10">
                      <div className="space-y-2">
                        <p className="text-slate-900 font-black text-xs uppercase tracking-widest">Preparación de Reunión</p>
                        <p className="text-slate-600 text-[14px] font-medium leading-relaxed">Registro manual de datos externos (RRHH, Seguridad, IdM, etc.).</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-slate-900 font-black text-xs uppercase tracking-widest">Calidad</p>
                        <p className="text-slate-600 text-[14px] font-medium leading-relaxed">Enlace directo al PowerBI (Cuadro de Mando del entorno).</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-slate-900 font-black text-xs uppercase tracking-widest">Histórico de Datos</p>
                        <p className="text-slate-600 text-[14px] font-medium leading-relaxed">Carga optimizada del último año para análisis a largo plazo.</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-slate-900 font-black text-xs uppercase tracking-widest">Objetivos</p>
                        <p className="text-slate-600 text-[14px] font-medium leading-relaxed">Desde el Maestro se definen y asignan los objetivos anuales/mensuales.</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-slate-900 font-black text-xs uppercase tracking-widest">Dinámica</p>
                        <p className="text-slate-600 text-[14px] font-medium leading-relaxed">Utiliza las pestañas del CMI para navegar y guiar el flujo de la reunión.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Sección 1: ¿Qué es la aplicación? */}
              <section className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner">01</div>
                  <h3 className="text-2xl sm:text-4xl font-black text-slate-900 uppercase tracking-tighter">¿Qué es ECOSYSTEM?</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <p className="text-slate-600 text-base sm:text-lg leading-relaxed font-medium">
                      <span className="font-black text-indigo-600">ECOSYSTEM</span> es el sistema central de gestión de datos de producción de Joselito. Diseñado para eliminar el papel y proporcionar visibilidad total en tiempo real.
                    </p>
                    <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100">
                      <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-4">Filosofía Lean</h4>
                      <p className="text-slate-500 text-sm font-bold uppercase leading-relaxed">
                        Basado en la metodología <span className="text-slate-900">LEAN MANUFACTURING</span>, el sistema se enfoca en la eliminación de desperdicios (Muda) y la optimización del OEE (Efectividad Global de los Equipos).
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { t: 'Transparencia', d: 'Datos reales sin filtros.', icon: '👁️' },
                      { t: 'Agilidad', d: 'Decisiones en minutos.', icon: '🚀' },
                      { t: 'Calidad', d: 'Meta: 100%. El sistema no computa mermas de calidad en este momento.', icon: '💎' },
                      { t: 'Mejora', d: 'Kaizen diario.', icon: '📈' }
                    ].map((item, i) => (
                      <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
                        <span className="text-2xl mb-2">{item.icon}</span>
                        <span className="text-[14px] font-black uppercase text-slate-900">{item.t}</span>
                        <span className="text-[15px] font-bold text-slate-400 uppercase mt-1">{item.d}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Sección SOP: Registro de Producción */}
              <section className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner">02</div>
                  <h3 className="text-2xl sm:text-4xl font-black text-slate-900 uppercase tracking-tighter">SOP: Registro de Producción</h3>
                </div>

                <div className="space-y-12">
                  {/* Paso 1 */}
                  <div className="flex flex-col lg:flex-row gap-8 items-start">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black">1</span>
                        <h4 className="text-lg font-black text-slate-900 uppercase">Identificación de Operarios</h4>
                      </div>
                      <p className="text-slate-600 text-sm font-medium leading-relaxed">
                        El primer paso obligatorio es seleccionar los nombres en el desplegable. Esto vincula todos los registros de tiempo y productividad a sus perfiles profesionales.
                      </p>
                    </div>
                    <div className="w-full lg:w-80 bg-slate-100 p-4 rounded-2xl border-4 border-white shadow-xl">
                      <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                        <div className="text-[15px] font-black text-blue-600 uppercase">1. OPERARIOS</div>
                        <div className="w-full h-8 bg-slate-50 border border-slate-200 rounded flex items-center px-2 text-[14px] font-black text-slate-400">
                          -- SELECCIONE NOMBRES --
                          <svg className="w-3 h-3 ml-auto" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Paso 2 */}
                  <div className="flex flex-col lg:flex-row-reverse gap-8 items-start">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black">2</span>
                        <h4 className="text-lg font-black text-slate-900 uppercase">Datos del Formato</h4>
                      </div>
                      <p className="text-slate-600 text-sm font-medium leading-relaxed">
                        Seleccione el formato específico. El sistema calculará automáticamente el <span className="font-black text-emerald-600">Tiempo Teórico</span> esperado.
                      </p>
                    </div>
                    <div className="w-full lg:w-80 bg-slate-100 p-4 rounded-2xl border-4 border-white shadow-xl">
                      <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-3">
                        <div className="text-[15px] font-black text-emerald-600 uppercase">2. PRODUCCIÓN</div>
                        <div className="w-full h-8 bg-slate-50 border border-slate-200 rounded flex items-center px-2 text-[14px] font-black text-slate-300">SELECCIONE FORMATO...</div>
                        <div className="w-full h-10 bg-emerald-600 rounded-lg flex items-center justify-center text-[14px] font-black text-white uppercase">Iniciar Actividad</div>
                      </div>
                    </div>
                  </div>

                  {/* Paso 3 */}
                  <div className="flex flex-col lg:flex-row gap-8 items-start">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black">3</span>
                        <h4 className="text-lg font-black text-slate-900 uppercase">Cierre y Cantidades</h4>
                      </div>
                      <p className="text-slate-600 text-sm font-medium leading-relaxed">
                        Al finalizar, pulse el botón rojo de "Finalizar Formato". Se abrirá un modal donde debe introducir la <span className="font-black text-slate-900">Cantidad Fabricada</span> real. Sea preciso, estos datos alimentan el KPI de Rendimiento.
                      </p>
                    </div>
                    <div className="w-full lg:w-80 bg-slate-900 p-6 rounded-3xl border-4 border-white shadow-2xl">
                      <div className="text-center text-white mb-4">
                        <div className="text-[15px] font-black uppercase tracking-widest">Finalizar Actividad</div>
                      </div>
                      <div className="bg-white p-4 rounded-2xl space-y-4">
                        <div className="space-y-1">
                          <div className="text-[9px] font-black text-slate-400 uppercase">Cantidad Fabricada</div>
                          <div className="w-full h-10 bg-slate-50 border-2 border-slate-100 rounded-lg flex items-center justify-center text-xl font-black text-emerald-600">150</div>
                        </div>
                        <div className="h-10 bg-blue-600 rounded-xl flex items-center justify-center text-[15px] font-black text-white uppercase">Confirmar Cierre</div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Sección: Gestión de Incidencias */}
              <section className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner">03</div>
                  <h3 className="text-2xl sm:text-4xl font-black text-slate-900 uppercase tracking-tighter">SOP: Gestión de Incidencias</h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <p className="text-slate-600 text-sm font-medium leading-relaxed">
                      Las paradas no planificadas son el mayor enemigo del OEE. El sistema permite registrar dos tipos de incidencias críticas:
                    </p>
                    <div className="space-y-4">
                      <div className="p-6 bg-amber-50 border border-amber-100 rounded-2xl">
                        <h5 className="text-xs font-black text-amber-700 uppercase mb-2">3. ESPERAS</h5>
                        <p className="text-[14px] font-bold text-amber-600 uppercase leading-relaxed">
                          Paradas por falta de material, grúa, instrucciones o limpieza. Afectan a la <span className="text-amber-900">Disponibilidad</span>.
                        </p>
                      </div>
                      <div className="p-6 bg-orange-50 border border-orange-100 rounded-2xl">
                        <h5 className="text-xs font-black text-orange-700 uppercase mb-2">4. AVERÍAS</h5>
                        <p className="text-[14px] font-bold text-orange-600 uppercase leading-relaxed">
                          Fallos mecánicos o eléctricos que impiden la producción. Requieren intervención de mantenimiento.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg text-3xl animate-pulse">⚠️</div>
                    <h4 className="text-sm font-black text-slate-900 uppercase">Regla de Oro</h4>
                    <p className="text-[14px] font-bold text-slate-500 uppercase leading-relaxed max-w-xs">
                      "Registre la incidencia en el momento exacto en que ocurre. El tiempo perdido es irrecuperable si no se mide con precisión."
                    </p>
                  </div>
                </div>
              </section>

              {/* Sección TOP 60: Preparación */}
              <section className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-inner">04</div>
                  <h3 className="text-2xl sm:text-4xl font-black text-slate-900 uppercase tracking-tighter">Preparación TOP 60 (SOP Dirección)</h3>
                </div>

                <div className="bg-slate-900 rounded-[3rem] p-8 sm:p-12 text-white overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-12 opacity-10">
                    <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>
                  </div>
                  
                  <div className="relative z-10 space-y-10">
                    <div>
                      <h4 className="text-xl sm:text-2xl font-black text-blue-400 uppercase tracking-tight mb-4">¿Cómo preparar la reunión TOP 60?</h4>
                      <p className="text-slate-300 text-sm sm:text-base font-medium leading-relaxed max-w-2xl">
                        La reunión TOP 60 es el foro estratégico donde se revisa el rendimiento de toda la planta. Para que sea efectiva, es vital que los datos estén actualizados <span className="text-white font-black underline">antes</span> de comenzar.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <h5 className="text-xs font-black uppercase tracking-widest text-slate-500 border-b border-white/10 pb-2">Datos a Cumplimentar</h5>
                        <ul className="space-y-4">
                          {[
                            { t: 'Seguridad', d: 'Registrar cualquier incidente o "casi-accidente" de la semana.', icon: '🛡️' },
                            { t: 'Calidad', d: 'Actualizar el número de no conformidades externas e internas.', icon: '✅' },
                            { t: 'Plazos', d: 'Revisar el estado de las entregas críticas de la semana.', icon: '📅' },
                            { t: 'Costes', d: 'Validar las desviaciones en consumo de materiales o energía.', icon: '💰' }
                          ].map((item, i) => (
                            <li key={i} className="flex gap-4">
                              <span className="text-xl shrink-0">{item.icon}</span>
                              <div>
                                <div className="text-xs font-black uppercase text-white">{item.t}</div>
                                <div className="text-[14px] font-medium text-slate-400 uppercase leading-tight mt-1">{item.d}</div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-white/5 backdrop-blur-sm p-8 rounded-[2rem] border border-white/10 space-y-6">
                        <h5 className="text-xs font-black uppercase tracking-widest text-blue-400">Checklist de Preparación</h5>
                        <div className="space-y-4">
                          {[
                            'Todos los registros de la semana anterior deben estar CERRADOS.',
                            'Las incidencias de mantenimiento deben estar categorizadas.',
                            'El Plan de Acción TOP 15 debe estar actualizado con el estado real.',
                            'Se debe haber generado el informe de IA para detectar tendencias.'
                          ].map((check, i) => (
                            <div key={i} className="flex items-start gap-3">
                              <div className="w-5 h-5 rounded border-2 border-blue-500/50 flex items-center justify-center shrink-0 mt-0.5">
                                <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"/></svg>
                              </div>
                              <span className="text-[14px] font-bold text-slate-300 uppercase leading-tight">{check}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Footer / Sales Pitch */}
              <section className="bg-slate-900 rounded-[2rem] sm:rounded-[4rem] p-8 sm:p-16 text-center text-white space-y-8">
                <h3 className="text-2xl sm:text-5xl font-black uppercase tracking-tighter leading-tight">
                  Lidere la excelencia <br className="hidden sm:block" /> con <span className="text-blue-500">ECOSYSTEM</span>
                </h3>
                <p className="text-slate-400 text-sm sm:text-xl max-w-3xl mx-auto font-medium leading-relaxed">
                  Este sistema es su mejor aliado para alcanzar los objetivos de producción. Úselo con rigor, analice los datos y actúe para mejorar cada día.
                </p>
                <div className="pt-10">
                  <button 
                    onClick={onClose}
                    className="px-12 py-6 bg-blue-600 hover:bg-blue-700 text-white text-base font-black uppercase tracking-[0.2em] rounded-3xl shadow-2xl shadow-blue-900/40 transition-all active:scale-95"
                  >
                    Entendido, ¡A producir!
                  </button>
                </div>
              </section>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default GlobalHelpModal;
