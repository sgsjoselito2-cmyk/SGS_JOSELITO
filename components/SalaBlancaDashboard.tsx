import React, { useMemo, useState } from 'react';
import { Activity, OEEObjectives, TaskType } from '../types';
import { calculateStats, getWeekNumber } from './Dashboard';
import { calculateUniqueMinutes, mergeIntervals, getIntervalsInMinutes, subtractIntervals } from '../src/utils';
import { INITIAL_OEE_OBJECTIVES } from '../constants';

// Helper to get formatted intervals for calculateUniqueMinutes
const getIntervals = (acts: Activity[]) => acts
  .filter(a => a.horaInicio && a.horaFin)
  .map(a => ({ start: a.horaInicio, end: a.horaFin! }));

interface AreaConfig {
  id: string;
  name: string;
}

interface Props {
  history: Activity[];
  activities: Activity[];
  allObjectives: Record<string, OEEObjectives[]>;
  areas: AreaConfig[];
  title: string;
  subtitle: string;
  mermas?: any[];
  selectedDate?: string;
  setSelectedDate?: (d: string) => void;
}

const GroupDashboard: React.FC<Props> = ({ history, activities, allObjectives, areas, title, subtitle, mermas = [], selectedDate: propDate, setSelectedDate: propSetDate }) => {
  const [localDate, setLocalDate] = useState(new Date().toISOString().split('T')[0]);
  const selectedDate = propDate || localDate;
  const setSelectedDate = propSetDate || setLocalDate;
  const [view, setView] = useState<'daily' | 'weekly' | 'annual'>('daily');

  const allData = useMemo(() => [...history, ...activities], [history, activities]);

  // Helper to get objective for a workshop and indicator
  const getObjectiveValue = (areaId: string, indicator_id: string, dateStr?: string) => {
    const objs = allObjectives[areaId] || [];
    const targetDate = dateStr || selectedDate;
    
    const sorted = [...objs].sort((a, b) => b.valid_from.localeCompare(a.valid_from));
    
    // Helper function for prioritized lookup
    const getVal = (id: string) => {
      const spec = sorted.find(o => o.valid_from <= targetDate && o.indicator_id === id);
      if (spec && spec.objetivo) return spec.objetivo;
      
      const master = sorted.find(o => o.valid_from <= targetDate && (o.indicator_id === 'productividad' || o.indicator_id === 'oee' || !o.indicator_id));
      if (master) {
        if (id === 'disponibilidad') return master.disponibilidad || 0;
        if (id === 'rendimiento') return master.rendimiento || 0;
        if (id === 'calidad') return master.calidad || 0;
      }
      return 0;
    };

    const isOEEPart = ['disponibilidad', 'rendimiento', 'calidad', 'productividad', 'oee'].includes(indicator_id);
    if (isOEEPart) {
      if (indicator_id === 'productividad' || indicator_id === 'oee') {
        const specProd = sorted.find(o => o.valid_from <= targetDate && (o.indicator_id === 'productividad' || o.indicator_id === 'oee'));
        if (specProd && specProd.objetivo) return specProd.objetivo;
        
        // If no explicit OEE goal, calculate from components (which also follow priority)
        const d = getVal('disponibilidad');
        const r = getVal('rendimiento');
        const c = getVal('calidad');
        return parseFloat(((d * r * c) / 10000).toFixed(1));
      }
      return getVal(indicator_id);
    }

    // Default fallbacks for non-OEE indicators
    if (indicator_id.startsWith('pph')) {
      const spec = sorted.find(o => o.valid_from <= targetDate && o.indicator_id === indicator_id) || 
                   sorted.find(o => o.valid_from <= targetDate && o.indicator_id === 'pph');
      return spec ? (spec.objetivo || (spec as any).pph || 0) : null;
    }
    if (indicator_id === 'merma1') {
      const spec = sorted.find(o => o.valid_from <= targetDate && o.indicator_id === 'merma1');
      return spec ? (spec.objetivo || spec.merma1 || 0) : 3;
    }
    if (indicator_id === 'merma2') {
      const spec = sorted.find(o => o.valid_from <= targetDate && o.indicator_id === 'merma2');
      return spec ? (spec.objetivo || spec.merma2 || 0) : 3;
    }
    if (indicator_id === 'subproducto') {
      const spec = sorted.find(o => o.valid_from <= targetDate && o.indicator_id === 'subproducto');
      return spec ? (spec.objetivo || spec.subproducto || 0) : 5;
    }

    const simpleMatch = sorted.find(o => o.valid_from <= targetDate && o.indicator_id === indicator_id);
    if (simpleMatch) return simpleMatch.objetivo || (simpleMatch as any)[indicator_id] || 0;
    return (INITIAL_OEE_OBJECTIVES as any)[indicator_id] || null;
  };

  const columns = useMemo(() => {
    const today = new Date(selectedDate);
    if (view === 'daily') {
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (6 - i));
        const key = d.toISOString().split('T')[0];
        return { label: key, key };
      });
    }
    if (view === 'weekly') {
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (6 - i) * 7);
        const w = getWeekNumber(d);
        return { label: `S${w}`, key: `${d.getFullYear()}-W${w}` };
      });
    }
    const yr = today.getFullYear();
    return [yr - 1, yr].map(y => ({ label: y.toString(), key: y.toString() }));
  }, [selectedDate, view]);

  const hasLoncheado = areas.some(a => a.id === 'sb-loncheado');

  const tableRows = useMemo(() => {
    const rows: any[] = [];
    areas.forEach(area => {
      const areaData = allData.filter(a => a.area === area.id);
      
      // Determine indicators for this area
      let areaIndicators: any[] = [];

      if (area.id === 'sb-preparacion') {
        areaIndicators = [
          { id: 'pph', label: 'PPH PESAR', objKey: 'pph' }
        ];
      } else if (area.id === 'sb-loncheado') {
        areaIndicators = [
          { id: 'disponibilidad', label: 'DISPONIBILIDAD (%)', objKey: 'disponibilidad' as const },
          { id: 'rendimiento',  label: 'RENDIMIENTO (%)',  objKey: 'rendimiento' as const },
          { id: 'calidad',      label: 'CALIDAD (%)', objKey: 'calidad' as const }
        ];
      } else if (area.id === 'sb-empaquetado-loncheado') {
        areaIndicators = [
          { id: 'pph_blister', label: 'PPH - Envasado Blister', objKey: null },
          { id: 'pph_sin_blister', label: 'PPH - Envasado Sin Blister', objKey: null }
        ];
      } else if (area.id === 'sb-empaquetado-deshuesado') {
        areaIndicators = [
          { id: 'pph', label: 'PPH', objKey: 'pph' }
        ];
      } else if (area.id === 'env-envasado') {
        areaIndicators = [
          { id: 'pph', label: 'PPH ENVASADO', objKey: 'pph' as const },
          { id: 'disponibilidad', label: 'DISPONIBILIDAD (%)', objKey: 'disponibilidad' as const },
          { id: 'rendimiento',  label: 'RENDIMIENTO (%)',  objKey: 'rendimiento' as const },
          { id: 'calidad',      label: 'CALIDAD (%)', objKey: 'calidad' as const }
        ];
      } else if (area.id === 'env-empaquetado') {
        areaIndicators = [
          { id: 'pph', label: 'PPH EMPAQUETADO', objKey: 'pph' as const },
          { id: 'disponibilidad', label: 'DISPONIBILIDAD (%)', objKey: 'disponibilidad' as const },
          { id: 'rendimiento',  label: 'RENDIMIENTO (%)',  objKey: 'rendimiento' as const },
          { id: 'calidad',      label: 'CALIDAD (%)', objKey: 'calidad' as const }
        ];
      } else if (area.id === 'movimiento-jamones') {
        areaIndicators = [
          { id: 'pph_jamones', label: 'PPH JAMONES', objKey: 'pph_jamones' },
          { id: 'pph_paletas', label: 'PPH PALETAS', objKey: 'pph_paletas' },
          { id: 'pph_manteca', label: 'PPH JAMONES MANTECA', objKey: 'pph_manteca' },
          { id: 'disponibilidad', label: 'DISPONIBILIDAD (%)', objKey: 'disponibilidad' as const }
        ];
      } else {
        // Default for other dashboards (Expediciones) that use GroupDashboard
        areaIndicators = [
          { id: 'disponibilidad', label: 'DISPONIBILIDAD (%)', objKey: 'disponibilidad' as const },
          { id: 'rendimiento',  label: 'RENDIMIENTO (%)',  objKey: 'rendimiento' as const },
          { id: 'calidad',      label: 'CALIDAD (%)', objKey: 'calidad' as const }
        ];
      }

      const rowsForArea: any[] = [];
      areaIndicators.forEach(ind => {
        const rowCols = columns.map(col => {
          let data: Activity[];
          if (view === 'daily') {
            data = areaData.filter(a => a.fecha === col.key);
          } else if (view === 'weekly') {
            const [yr, w] = col.key.split('-W').map(Number);
            data = areaData.filter(a => {
              if (!a.fecha) return false;
              const d = new Date(a.fecha);
              return d.getFullYear() === yr && getWeekNumber(d) === w;
            });
          } else {
            data = areaData.filter(a => a.fecha?.startsWith(col.key));
          }
          const stats = calculateStats(data, area.id);
          return { ...col, value: stats[ind.id as keyof typeof stats] };
        });
        rowsForArea.push({ area, indicator: ind, cols: rowCols });
      });

      // Special case for Loncheado Mermas
      if (area.id === 'sb-loncheado') {
        const mermaInds = [
          { id: 'merma1', label: '% MERMA 1', obj: 3 },
          { id: 'merma2', label: '% MERMA 2', obj: 3 },
          { id: 'subproducto', label: '% SUBPROD', obj: 5 }
        ];

        mermaInds.forEach(ind => {
          const rowCols = columns.map(col => {
            let data: any[];
            if (view === 'daily') {
              data = mermas.filter(m => {
                const mFecha = typeof m.fecha === 'string' ? m.fecha.substring(0, 10) : '';
                const mArea = (m.area || '').toLowerCase();
                return mFecha === col.key && mArea === area.id.toLowerCase();
              });
            } else if (view === 'weekly') {
              const [yr, w] = col.key.split('-W').map(Number);
              data = mermas.filter(m => { 
                const mArea = (m.area || '').toLowerCase();
                if (!m.fecha || mArea !== area.id.toLowerCase()) return false; 
                const d = new Date(m.fecha); 
                return d.getFullYear() === yr && getWeekNumber(d) === w; 
              });
            } else {
              data = mermas.filter(m => {
                const mArea = (m.area || '').toLowerCase();
                return m.fecha && m.fecha.startsWith(col.key) && mArea === area.id.toLowerCase();
              });
            }
            
            // Calculate merma specifically for this col
            const stats = calculateStats([], area.id, data);
            return { ...col, value: stats[ind.id as keyof typeof stats] };
          });
          rowsForArea.push({ area, indicator: { id: ind.id, label: ind.label, objKey: null, isMerma: true, obj: ind.obj }, cols: rowCols });
        });
      }

      rows.push(...rowsForArea);
    });
    return rows;
  }, [allData, columns, view, areas, mermas]);

  const formatDetailedStats = useMemo(() => {
    const dayData = allData.filter(a => a.fecha === selectedDate && areas.some(area => area.id === a.area));
    const results: any[] = [];

    areas.forEach(area => {
      const areaData = dayData.filter(a => a.area === area.id);
      const formats = Array.from(new Set(areaData.filter(a => a.formato).map(a => a.formato))).sort();

      formats.forEach(f => {
        const fData = areaData.filter(a => a.formato === f);
        
        const fProdActs = fData.filter(act => {
          const tipo = act.tipoTarea || (act as any).tipo_tarea;
          return tipo === TaskType.PRODUCCION || tipo === 'P';
        });
        const fAveriaActs = fData.filter(a => a.tipoTarea === TaskType.AVERIA);
        const fEsperaActs = fData.filter(a => a.tipoTarea === TaskType.ESPERAS);

        const pInts = mergeIntervals(getIntervalsInMinutes(getIntervals(fProdActs)));
        const aIntsRaw = mergeIntervals(getIntervalsInMinutes(getIntervals(fAveriaActs)));
        const eIntsRaw = mergeIntervals(getIntervalsInMinutes(getIntervals(fEsperaActs)));

        const aInts = subtractIntervals(aIntsRaw, pInts);
        const eInts = subtractIntervals(subtractIntervals(eIntsRaw, pInts), aInts);

        results.push({
          areaName: area.name,
          formato: f,
          ok: fProdActs.reduce((sum, a) => sum + Number(a.cantidad || 0), 0),
          nok: fProdActs.reduce((sum, a) => sum + Number(a.cantidadNok || 0), 0),
          prod: pInts.reduce((sum, i) => sum + (i.end - i.start), 0),
          averia: aInts.reduce((sum, i) => sum + (i.end - i.start), 0),
          espera: eInts.reduce((sum, i) => sum + (i.end - i.start), 0),
        });
      });
    });
    
    return results.sort((a, b) => {
      if (a.areaName !== b.areaName) return a.areaName.localeCompare(b.areaName);
      return b.prod - a.prod;
    });
  }, [allData, selectedDate, areas]);

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-widest text-slate-900">{title}</h2>
          <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mt-1">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="p-2 border-2 border-slate-100 rounded-xl text-[13px] font-bold text-slate-700 outline-none focus:border-slate-900"
          />
          <div className="flex rounded-xl border-2 border-slate-100 overflow-hidden">
            {(['daily', 'weekly', 'annual'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-2 text-[11px] font-black uppercase tracking-widest transition-all ${view === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 hover:text-slate-700'}`}
              >
                {v === 'daily' ? '7 Días' : v === 'weekly' ? '7 Sem.' : 'Anual'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla Unificada */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden max-h-[70vh] overflow-y-auto">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead className="sticky top-0 z-30">
              <tr className="bg-slate-900 text-white">
                <th className="p-2 text-left font-black uppercase tracking-wider w-32 border border-slate-700">Área</th>
                <th className="p-2 text-left font-black uppercase tracking-wider w-40 border border-slate-700">Indicador</th>
                <th className="p-2 text-center font-black uppercase tracking-wider w-24 border border-slate-700">Objetivo</th>
                {columns.map(col => (
                  <th key={col.key} className="p-2 text-center font-black uppercase tracking-wider min-w-[80px] border border-slate-700">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, idx) => {
                // Calculate rowspan for Area
                const areaRows = tableRows.filter(r => r.area.id === row.area.id);
                const isFirstOfArea = idx === 0 || tableRows[idx - 1].area.id !== row.area.id;
                
                const currentObj = getObjectiveValue(row.area.id, row.indicator.id);
                const isPPH = row.indicator.id.startsWith('pph');

                return (
                  <tr key={`${row.area.id}-${row.indicator.id}`} className="hover:bg-slate-50 transition-colors">
                    {isFirstOfArea && (
                      <td 
                        rowSpan={areaRows.length} 
                        className="p-3 font-black text-slate-900 uppercase text-[13px] border border-slate-200 bg-slate-50/50"
                        style={{ verticalAlign: 'top' }}
                      >
                        {row.area.name}
                      </td>
                    )}
                    <td className="p-2 font-bold text-slate-500 uppercase text-[11px] border border-slate-200 bg-white">
                      {row.indicator.label}
                    </td>
                    <td className="p-2 text-center font-black text-blue-600 bg-blue-50/30 border border-slate-200">
                      {currentObj && currentObj !== 0 ? (isPPH ? currentObj : `${currentObj}%`) : '—'}
                    </td>
                    {row.cols.map((col: any) => {
                      const val = col.value;
                      const numVal = val === '' ? null : Number(val);
                      
                      let cellStyle = 'text-slate-300';
                      if (numVal !== null) {
                        const colObj = getObjectiveValue(row.area.id, row.indicator.id, col.key.includes('-W') ? undefined : col.key);
                        
                        if (colObj === null || colObj === 0) {
                          cellStyle = 'text-slate-500 font-bold';
                        } else if (row.indicator.id.startsWith('merma') || row.indicator.id === 'subproducto') {
                          cellStyle = numVal <= colObj ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold';
                        } else {
                          cellStyle = numVal >= colObj ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold';
                        }
                      }

                      return (
                        <td key={col.key} className={`p-2 text-center text-[12px] border border-slate-200 ${cellStyle}`}>
                          {val !== '' ? (isPPH ? val : `${val}%`) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-6 text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200"/><span>En Objetivo</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-red-50 border border-red-200"/><span>Fuera de Objetivo</span></div>
        <div className="flex items-center gap-2"><span className="text-slate-300">—</span><span>Sin datos</span></div>
      </div>

      {/* Breakdown by Format Table */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-black text-sm">D</div>
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Detalle por Formato ({selectedDate.split('-').reverse().join('/')})</h3>
        </div>
        
        <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-black text-[11px] uppercase tracking-widest">
                <th className="p-3 text-left border border-slate-700">Área</th>
                <th className="p-3 text-left border border-slate-700">Formato</th>
                <th className="p-3 text-center border border-slate-700">OK</th>
                <th className="p-3 text-center border border-slate-700">NOK</th>
                <th className="p-3 text-center border border-slate-700">T. Prod (min)</th>
                <th className="p-3 text-center border border-slate-700">T. Avería (min)</th>
                <th className="p-3 text-center border border-slate-700">T. Espera (min)</th>
              </tr>
            </thead>
            <tbody>
              {formatDetailedStats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest">No hay datos para esta fecha</td>
                </tr>
              ) : (
                formatDetailedStats.map((f, idx) => {
                  const areaRows = formatDetailedStats.filter(r => r.areaName === f.areaName);
                  const isFirstOfArea = idx === 0 || formatDetailedStats[idx - 1].areaName !== f.areaName;

                  return (
                    <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                      {isFirstOfArea && (
                        <td 
                          rowSpan={areaRows.length}
                          className="p-3 font-black text-slate-900 border border-slate-100 bg-slate-50/50 uppercase text-[11px]"
                          style={{ verticalAlign: 'top' }}
                        >
                          {f.areaName}
                        </td>
                      )}
                      <td className="p-3 font-bold text-slate-700 border border-slate-100">{f.formato}</td>
                      <td className="p-3 text-center border border-slate-100 font-black text-emerald-600">{f.ok}</td>
                      <td className="p-3 text-center border border-slate-100 font-black text-red-500">{f.nok}</td>
                      <td className="p-3 text-center border border-slate-100 font-black text-blue-600">{f.prod}</td>
                      <td className="p-3 text-center border border-slate-100 text-slate-500">{f.averia}</td>
                      <td className="p-3 text-center border border-slate-100 text-slate-500">{f.espera}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Wrappers específicos para cada grupo
export const SalaBlancaDashboard: React.FC<Omit<Props, 'areas' | 'title' | 'subtitle'>> = (props) => (
  <GroupDashboard {...props}
    title="Sala Blanca"
    subtitle="Deshuesado/Prensado · Loncheado · Emp. Loncheado · Emp. Deshuesado"
    areas={[
      { id: 'sb-preparacion',            name: 'DESHUESADO/PRENSADO' },
      { id: 'sb-loncheado',              name: 'LONCHEADO' },
      { id: 'sb-empaquetado-loncheado',  name: 'EMP. LONCHEADO' },
      { id: 'sb-empaquetado-deshuesado', name: 'EMP. DESHUESADO' },
    ]}
    mermas={props.mermas}
  />
);

export const EnvasadoDashboard: React.FC<Omit<Props, 'areas' | 'title' | 'subtitle'>> = (props) => (
  <GroupDashboard {...props}
    title="Envasado"
    subtitle="Envasado · Empaquetado"
    areas={[
      { id: 'env-envasado',    name: 'ENVASADO' },
      { id: 'env-empaquetado', name: 'EMPAQUETADO' },
    ]}
  />
);

export const ExpedicionesDashboard: React.FC<Omit<Props, 'areas' | 'title' | 'subtitle'>> = (props) => (
  <GroupDashboard {...props}
    title="Expediciones"
    subtitle="Expediciones · Prep. Expediciones"
    areas={[
      { id: 'expedicion',      name: 'EXPEDICIONES' },
      { id: 'preparacion-exp', name: 'PREP. EXPEDICIONES' },
    ]}
  />
);

export const MovimientosDashboard: React.FC<Omit<Props, 'areas' | 'title' | 'subtitle'>> = (props) => (
  <GroupDashboard {...props}
    title="Movimientos"
    subtitle="Logística Interna"
    areas={[
      { id: 'movimiento-jamones', name: 'MOVIMIENTOS' },
    ]}
  />
);

export default SalaBlancaDashboard;
