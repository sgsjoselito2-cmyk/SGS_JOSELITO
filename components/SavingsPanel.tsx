import React, { useMemo, useState, useEffect } from 'react';
import { Activity, TaskType, MasterSpeed } from '../types';
import { AREA_NAMES } from '../constants';
import { getWeekNumber, calculateStats } from './Dashboard';
import { supabase } from '../lib/supabase';

interface SavingsPanelProps {
  onBack: () => void;
  activities: Activity[];
  history: Activity[];
  mermas: any[];
  workshopIndicators: Record<string, { id: string; name: string }[]>;
  masterSpeeds: MasterSpeed[];
}

const SavingsDashboard = ({ allData, globalConfig, wsConfigs, workshopIndicators, mermas, masterSpeeds, propActivities, propHistory }: any) => {
    // 1. Group data by workshop and week
    const weeksData = useMemo(() => {
        if (!allData || !Array.isArray(allData)) return {};
        const weeks: Record<number, Record<string, Activity[]>> = {};
        
        allData.forEach((a: Activity) => {
            if (!a.fecha || !a.area) return;
            const d = new Date(a.fecha);
            const week = getWeekNumber(d);
            if (!weeks[week]) weeks[week] = {};
            if (!weeks[week][a.area]) weeks[week][a.area] = [];
            weeks[week][a.area].push(a);
        });
        return weeks;
    }, [allData]);

    const loncheadoActs = allData.filter((a: any) => a.area === 'sb-loncheado');
    console.log('SAVINGS DEBUG - Total actividades con area=sb-loncheado en allData:', loncheadoActs.length);
    console.log('SAVINGS DEBUG - Muestra de esas actividades:', 
      loncheadoActs.slice(0, 5).map((a: any) => ({
        fecha: a.fecha,
        area: a.area,
        tipoTarea: a.tipoTarea,
        semanaCalculada: getWeekNumber(new Date(a.fecha))
      }))
    );
    console.log('SAVINGS DEBUG - áreas únicas encontradas en allData:', 
      [...new Set(allData.map((a: any) => a.area))]);

    const weekNumbers = Object.keys(weeksData).map(Number).sort((a, b) => a - b);

    console.log('SAVINGS PROPS - propActivities recibidas en SavingsPanel:', propActivities?.length);
    console.log('SAVINGS PROPS - propHistory recibidas en SavingsPanel:', propHistory?.length);
    console.log('SAVINGS allData final:', allData?.length);
    console.log('SAVINGS weekNumbers calculadas:', weekNumbers);
    console.log('SAVINGS workshopIndicators recibido:', workshopIndicators);
    
    // 2. Compute Situación de Partida (avg of first 4 weeks) for OEE
    const referenceData = useMemo(() => {
        const refs: Record<string, number> = {};
        Object.keys(workshopIndicators).forEach(wsId => {
            const firstFourWeeks = weekNumbers.slice(0, 4);
            let totalProd = 0;
            let count = 0;
            firstFourWeeks.forEach(week => {
                const acts = weeksData[week]?.[wsId] || [];
                // Filter mermas for this week and wsId
                const weekMermas = mermas.filter((m: any) => {
                    const d = new Date(m.fecha);
                    return getWeekNumber(d) === week && m.area === wsId;
                });
                const stats = calculateStats(acts, wsId, weekMermas, workshopIndicators, allData, allData, true, masterSpeeds); 
                if (stats.productividad) {
                    totalProd += Number(stats.productividad);
                    count++;
                }
            });
            if (count > 0) refs[wsId] = totalProd / count;
        });
        return refs;
    }, [weeksData, weekNumbers, workshopIndicators, mermas, masterSpeeds]);

    return (
        <div className="space-y-8">
            {Object.entries(workshopIndicators).map(([wsId, indicators]) => {
                const wsConf = wsConfigs[wsId] || { semanasAnio: 48, indicators: {} };
                
                return (
                    <div key={wsId} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <h4 className="font-bold text-slate-800 mb-6 flex justify-between">
                            <span>{AREA_NAMES[wsId] || wsId}</span>
                            {referenceData[wsId] && <span className="text-xs font-normal text-slate-500">Prod. (OEE) Ref: {referenceData[wsId].toFixed(1)}%</span>}
                        </h4>
                        {(indicators as any).map((ind: any) => {
                          const isPPH = ind.id.startsWith('pph');
                          
                          return (
                          <div key={ind.id} className="mb-6">
                            <h5 className="font-bold text-slate-700 mb-2">{ind.name}</h5>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left">
                                    <thead>
                                        <tr className="text-slate-500 uppercase border-b border-slate-100">
                                            <th className="py-2">Semana</th>
                                            {isPPH ? (
                                                <>
                                                    <th className="py-2">PPH</th>
                                                    <th className="py-2">T. Actual</th>
                                                    <th className="py-2">T. Ahorro</th>
                                                </>
                                            ) : (
                                                <>
                                                    <th className="py-2">Horas útiles</th>
                                                    <th className="py-2">Horas reales</th>
                                                    <th className="py-2">Productividad</th>
                                                    <th className="py-2">H. A Product. Ref</th>
                                                    <th className="py-2">Ahorro Horas</th>
                                                </>
                                            )}
                                            <th className="py-2">Ahorro €</th>
                                            <th className="py-2">Proy. Anual €</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {weekNumbers.map((week) => {
                                            const acts = weeksData[week]?.[wsId] || [];
                                            const weekMermas = mermas.filter((m: any) => {
                                              const d = new Date(m.fecha);
                                              return getWeekNumber(d) === week && m.area === wsId;
                                            });
                                            if (wsId === 'sb-loncheado') {
                                              console.log(`SAVINGS DEBUG wsId=${wsId} week=${week} acts.length=${acts.length}`, 
                                                acts.map((a: any) => ({ 
                                                  fecha: a.fecha, area: a.area, tipoTarea: a.tipoTarea, 
                                                  horaInicio: a.horaInicio, horaFin: a.horaFin, 
                                                  cantidad: a.cantidad 
                                                }))
                                              );
                                            }
                                            const stats = calculateStats(acts, wsId, weekMermas, workshopIndicators, allData, allData, true);
                                            if (wsId === 'sb-loncheado') {
                                              console.log(`SAVINGS DEBUG stats week=${week}:`, stats);
                                            }
                                            
                                            // TODO: Need Config for Costs and NumOps
                                            const costeOp = globalConfig.costOperario || 20;
                                            const costeEnc = globalConfig.costEncargado || 30;
                                            const nOps = wsConfigs[wsId]?.indicators[ind.id]?.numOperarios || 1;
                                            
                                            let ahorroEuro = 0;
                                            let proyAnual = 0;
                                            
                                            if (isPPH) {
                                                const val = Number(stats.pph) || 0;
                                                const tActual = 0; // Needs logic
                                                const tAhorro = 0; // Needs logic
                                                ahorroEuro = 0; // Needs logic
                                                
                                                return (
                                                  <tr key={week} className="border-b border-slate-50">
                                                    <td className="py-3 font-black text-slate-700">{week}</td>
                                                    <td className="py-3 px-2">{val.toFixed(1)}</td>
                                                    <td className="py-3 px-2">{tActual.toFixed(1)}</td>
                                                    <td className="py-3 px-2">{tAhorro.toFixed(1)}</td>
                                                    <td className="py-3 px-2 text-emerald-600 font-bold">{ahorroEuro.toFixed(2)} €</td>
                                                    <td className="py-3 px-2 font-black">{proyAnual.toFixed(2)} €</td>
                                                  </tr>
                                                );
                                            } else {
                                                // Correct OEE calculation (as in Dashboard.tsx: oee = (disp * perf * qual) / 10000)
                                                // Assuming stats has disp, perf, qual values or calculating from tiempo_produccion_real, etc.
                                                // For now, let's derive prodPct directly from the stats already computed
                                                const prodPct = Number(stats.productividad) || 0;
                                                
                                                // Ensure stats has the necessary fields for calculation if not already in stats.productividad
                                                const d = Number(stats.disponibilidad || 100);
                                                const r = Number(stats.rendimiento || 100);
                                                const c = Number(stats.calidad || 100);
                                                const correctOEE = (d * r * c) / 10000;
                                                
                                                const finalProdPct = prodPct > 0 ? prodPct : correctOEE;
                                                
                                                const horasReales = (Number(stats.tiempo_produccion_real) + Number(stats.tiempo_esperas) + Number(stats.tiempo_averias)) / 60 || 0;
                                                const horasUtiles = horasReales * (finalProdPct / 100);
                                                const situacionPartida = referenceData[wsId] ? referenceData[wsId] / 100 : 0.606; 
                                                const horasRef = situacionPartida > 0 ? (horasUtiles / situacionPartida) : 0;
                                                const ahorroHoras = horasRef - horasReales;

                                                ahorroEuro = (ahorroHoras * costeOp) + (1/8 * costeEnc / nOps);
                                                
                                                return (
                                                  <tr key={week} className="border-b border-slate-50">
                                                    <td className="py-3 font-black text-slate-700">{week}</td>
                                                    <td className="py-3 px-2">{horasUtiles.toFixed(1)}</td>
                                                    <td className="py-3 px-2">{horasReales.toFixed(1)}</td>
                                                    <td className="py-3 px-2">{finalProdPct.toFixed(1)}%</td>
                                                    <td className="py-3 px-2">{horasRef.toFixed(1)}</td>
                                                    <td className="py-3 px-2 text-emerald-600 font-bold">{ahorroHoras.toFixed(1)}</td>
                                                    <td className="py-3 px-2 text-emerald-600 font-bold">{ahorroEuro.toFixed(2)} €</td>
                                                    <td className="py-3 px-2 font-black">{proyAnual.toFixed(2)} €</td>
                                                  </tr>
                                                );
                                            }
                                        })}
                                    </tbody>
                                </table>
                            </div>
                          </div>
                        )})}
                    </div>
                );
            })}
        </div>
    );
};

const SavingsPanel: React.FC<SavingsPanelProps> = ({ onBack, activities: propActivities, history: propHistory, mermas, workshopIndicators, masterSpeeds }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'config'>('dashboard');

  const allData = useMemo(() => [...propHistory, ...propActivities], [propHistory, propActivities]);
  
  const filteredIndicators = useMemo(() => {
    const allowedMap: Record<string, { id: string, name: string }[]> = {
      'sb-empaquetado-deshuesado': [{ id: 'pph', name: 'PPH DESHUESADO / PRENSADO' }],
      'sb-loncheado': [{ id: 'productividad', name: 'OEE LONCHEADO' }],
      'env-envasado': [{ id: 'productividad', name: 'OEE ENVASADO' }],
      'env-empaquetado': [{ id: 'productividad', name: 'OEE EMPAQUETADO' }],
      'expedicion': [{ id: 'productividad', name: 'OEE EXPEDICIONES' }],
      'preparacion-exp': [{ id: 'productividad', name: 'OEE PREPARACIÓN' }],
      'movimiento-jamones': [
          { id: 'pph_jamones', name: 'PPH COLGAR JAMONES' },
          { id: 'pph_paletas', name: 'PPH COLGAR PALETAS' }
      ]
    };
    
    const filtered: Record<string, { id: string; name: string }[]> = {};
    
    Object.entries(workshopIndicators).forEach(([wsId, indicators]) => {
        if (allowedMap[wsId]) {
            const matching = indicators.filter(ind => allowedMap[wsId].some(a => a.id === ind.id));
            if (matching.length > 0) {
                filtered[wsId] = matching.map(m => ({
                    ...m,
                    name: allowedMap[wsId].find(a => a.id === m.id)?.name || m.name
                }));
            }
        }
    });

    return filtered;
  }, [workshopIndicators]);

  const [globalConfig, setGlobalConfig] = useState(() => {
      const saved = localStorage.getItem('zitron_savings_global');
      return saved ? JSON.parse(saved) : { costOperario: 20, costEncargado: 30 };
  });

  const [wsConfigs, setWsConfigs] = useState<Record<string, { semanasAnio: number, indicators: Record<string, { numOperarios: number }> }>>(() => {
      const saved = localStorage.getItem('zitron_savings_ws_configs');
      return saved ? JSON.parse(saved) : {};
  });

  const updateGlobalConfig = (field: 'costOperario' | 'costEncargado', value: number) => {
      const newConfig = { ...globalConfig, [field]: value };
      setGlobalConfig(newConfig);
      localStorage.setItem('zitron_savings_global', JSON.stringify(newConfig));
  };

  const updateWsConfig = (wsId: string, semanasAnio: number, indicators: Record<string, { numOperarios: number }>) => {
      const newConfigs = {
          ...wsConfigs,
          [wsId]: { semanasAnio, indicators }
      };
      setWsConfigs(newConfigs);
      localStorage.setItem('zitron_savings_ws_configs', JSON.stringify(newConfigs));
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-100">
            <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <h2 className="text-2xl font-black uppercase text-slate-900 tracking-tight">Cálculo de Ahorros</h2>
        </div>
        
        <div className="flex gap-2">
            <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-full font-bold uppercase text-xs ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>Dashboard</button>
            <button onClick={() => setActiveTab('config')} className={`px-4 py-2 rounded-full font-bold uppercase text-xs ${activeTab === 'config' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>Parámetros</button>
        </div>
      </div>
      
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex-1">
          {activeTab === 'dashboard' ? (
              <SavingsDashboard allData={allData} globalConfig={globalConfig} wsConfigs={wsConfigs} workshopIndicators={filteredIndicators} mermas={mermas} masterSpeeds={masterSpeeds} propActivities={propActivities} propHistory={propHistory} />
          ) : (
              <div className="space-y-6">
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <h3 className="text-sm font-black text-slate-900 mb-4">Configuración Común</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Coste Operario/h</label>
                            <input type="number" value={globalConfig.costOperario} onChange={(e) => updateGlobalConfig('costOperario', parseFloat(e.target.value))} className="bg-slate-50 rounded p-2 text-sm font-bold" />
                        </div>
                        <div className="flex flex-col">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Coste Encargado/h</label>
                            <input type="number" value={globalConfig.costEncargado} onChange={(e) => updateGlobalConfig('costEncargado', parseFloat(e.target.value))} className="bg-slate-50 rounded p-2 text-sm font-bold" />
                        </div>
                    </div>
                </div>

                <h3 className="text-xl font-black text-slate-900">Configuración por Taller e Indicador</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(filteredIndicators).map(([wsId, indicators]) => {
                      const wsName = AREA_NAMES[wsId] || wsId;
                      const wsConf = wsConfigs[wsId] || { semanasAnio: 48, indicators: {} };
                      
                      return (
                          <div key={wsId} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                              <h4 className="font-bold text-slate-900 mb-4">{wsName}</h4>
                              <div className="flex flex-col gap-2 mb-4">
                                <label className="text-[9px] font-bold text-slate-500 uppercase">Semanas/Año</label>
                                <input type="number" value={wsConf.semanasAnio} onChange={(e) => updateWsConfig(wsId, parseFloat(e.target.value), wsConf.indicators)} className="w-full bg-white rounded p-2 text-sm" />
                              </div>
                              <div className="space-y-2">
                                  {indicators.map(ind => (
                                      <div key={ind.id} className="flex items-center justify-between gap-2">
                                          <span className="text-xs font-bold text-slate-600">{ind.name}</span>
                                          <div className="flex items-center gap-1">
                                              <label className="text-[9px] font-bold text-slate-500 uppercase">Nº Ops:</label>
                                              <input type="number" value={wsConf.indicators[ind.id]?.numOperarios || 0} onChange={(e) => {
                                                  const newIndicators = { ...wsConf.indicators, [ind.id]: { numOperarios: parseFloat(e.target.value) } };
                                                  updateWsConfig(wsId, wsConf.semanasAnio, newIndicators);
                                              }} className="w-12 bg-white rounded p-1 text-xs" />
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      );
                  })}
                </div>
              </div>
          )}
      </div>
    </div>
  );
};

export default SavingsPanel;
