import React, { useMemo, useState, useEffect } from 'react';
import { Activity } from '../types';
import { AREA_NAMES } from '../constants';
import { getWeekNumber } from './Dashboard';

interface SavingsPanelProps {
  onBack: () => void;
  activities: Activity[];
  history: Activity[];
  workshopIndicators: Record<string, { id: string; name: string }[]>;
}

const SavingsDashboard = ({ allData, globalConfig, wsConfigs, workshopIndicators }: any) => {
    const firstArea = allData.length > 0 ? allData[0].area : 'N/A';
    
    // Process allData to group by week
    const weeksData = useMemo(() => {
        const weeks: Record<number, Record<string, any>> = {};
        console.log('--- DEBUG: Processing allData ---', allData.length, 'total items');
        
        allData.slice(0, 5).forEach((a, idx) => {
            console.log(`DEBUG: Item ${idx}: area="${a.area}", fecha="${a.fecha}", tipoTarea="${a.tipoTarea}"`);
        });

        allData.forEach((a: Activity, idx: number) => {
            if (!a.fecha) return;
            const d = new Date(a.fecha);
            if (isNaN(d.getTime())) {
                console.warn(`DEBUG: Invalid date for item ${idx}: ${a.fecha}`);
                return;
            }
            const week = getWeekNumber(d);
            if (!weeks[week]) weeks[week] = {};
            
            const rawArea = (a.area && a.area.trim() !== '') ? a.area : 'unknown';
            
            // Map rawArea to the expected workshopIndicator key
            const mappedArea = Object.keys(workshopIndicators).find(id => 
                id === rawArea || rawArea.includes(id) || id.includes(rawArea)
            ) || rawArea;
            
            weeks[week][mappedArea] = (weeks[week][mappedArea] || 0) + (a.cantidad || 0);
        });
        console.log('--- DEBUG: Resulting weeksData ---', weeks);
        return weeks;
    }, [allData, workshopIndicators]);

    const weekNumbers = Object.keys(weeksData).map(Number).sort((a, b) => a - b);

    return (
        <div className="space-y-8">
            <div className="text-sm bg-yellow-100 p-2">Debug: First Activity Area = {firstArea}</div>
            {Object.entries(workshopIndicators).map(([wsId, indicators]) => {
                const wsConf = wsConfigs[wsId] || { semanasAnio: 48, indicators: {} };
                
                return (
                    <div key={wsId} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <h4 className="font-bold text-slate-800 mb-6">{AREA_NAMES[wsId] || wsId}</h4>
                        {indicators.map((ind: any) => (
                          <div key={ind.id} className="mb-6">
                            <h5 className="font-bold text-slate-700 mb-2">{ind.name}</h5>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left">
                                    <thead>
                                        <tr className="text-slate-500 uppercase border-b border-slate-100">
                                            <th className="py-2">Semana</th>
                                            <th className="py-2 px-2">Valor/Prod</th>
                                            <th className="py-2 px-2">T. Actual</th>
                                            <th className="py-2 px-2">T. Ahorro</th>
                                            <th className="py-2 px-2">Ahorro</th>
                                            <th className="py-2 px-2">Proy. Anual</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {weekNumbers.map((week) => {
                                            const val = weeksData[week][wsId] || 0;
                                            return (
                                              <tr key={week} className="border-b border-slate-50">
                                                <td className="py-3 font-black text-slate-700">{week}</td>
                                                <td className="py-3 px-2">{val.toFixed(1)}</td>
                                                <td className="py-3 px-2">--</td>
                                                <td className="py-3 px-2 text-emerald-600 font-bold">--</td>
                                                <td className="py-3 px-2 text-emerald-600 font-bold">--</td>
                                                <td className="py-3 px-2 font-black">--</td>
                                              </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                          </div>
                        ))}
                    </div>
                );
            })}
        </div>
    );
};

const SavingsPanel: React.FC<SavingsPanelProps> = ({ onBack, activities, history, workshopIndicators }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'config'>('dashboard');
  const allData = useMemo(() => [...history, ...activities], [history, activities]);
  const filteredIndicators = useMemo(() => {
    // The requested indicators mapping
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
              <SavingsDashboard allData={allData} globalConfig={globalConfig} wsConfigs={wsConfigs} workshopIndicators={filteredIndicators} />
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
