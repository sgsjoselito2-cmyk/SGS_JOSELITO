import React, { useMemo, useState } from 'react';
import { Activity, OEEObjectives } from '../types';
import { calculateStats, getWeekNumber } from './Dashboard';

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
}

const GroupDashboard: React.FC<Props> = ({ history, activities, allObjectives, areas, title, subtitle, mermas = [] }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [view, setView] = useState<'daily' | 'weekly' | 'annual'>('daily');

  const allData = useMemo(() => [...history, ...activities], [history, activities]);

  // Helper to get objective for a workshop and indicator
  const getObjectiveValue = (areaId: string, indicatorId: string, dateStr?: string) => {
    const objs = allObjectives[areaId] || [];
    const targetDate = dateStr || selectedDate;
    const found = objs.find(o => o.validFrom <= targetDate && (o.indicatorId === indicatorId || (!o.indicatorId && indicatorId === 'oee')));
    if (found) {
      if (indicatorId === 'availability') return found.disponibilidad;
      if (indicatorId === 'performance') return found.rendimiento;
      if (indicatorId === 'quality') return found.calidad;
      if (indicatorId === 'oee') return parseFloat(((found.disponibilidad * found.rendimiento * found.calidad) / 10000).toFixed(1));
      return found.objetivo;
    }
    // Fallbacks
    if (indicatorId === 'availability' || indicatorId === 'performance' || indicatorId === 'quality') return 85;
    if (indicatorId === 'oee') return 62;
    if (indicatorId === 'merma1' || indicatorId === 'merma2') return 3;
    if (indicatorId === 'subproducto') return 5;
    return 0;
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

  // Merma stats - só para loncheado
  const calcMermaStats = (records: any[]) => {
    if (!records || records.length === 0) return { pctMerma1: '', pctMerma2: '' };
    const valid = records.filter(r => r.kgEntrada > 0);
    if (valid.length === 0) return { pctMerma1: '', pctMerma2: '' };
    const avg1 = valid.reduce((s: number, r: any) => s + Number(r.pctMerma1 || 0), 0) / valid.length;
    const valid2 = records.filter((r: any) => (r.kgMerma + r.kgTacos + r.kgPieles + r.kgHueco + r.kgSalida) > 0);
    const avg2 = valid2.length > 0 ? valid2.reduce((s: number, r: any) => s + Number(r.pctMerma2 || 0), 0) / valid2.length : 0;
    return { pctMerma1: avg1.toFixed(1), pctMerma2: avg2.toFixed(1) };
  };

  const hasLoncheado = areas.some(a => a.id === 'sb-loncheado');

  const mermaScorecard = useMemo(() => {
    if (!hasLoncheado) return null;
    const today = new Date(selectedDate);

    const cols = columns.map(col => {
      let data: any[];
      if (view === 'daily') {
        data = mermas.filter(m => m.fecha === col.key);
      } else if (view === 'weekly') {
        const [yr, w] = col.key.split('-W').map(Number);
        data = mermas.filter(m => { if (!m.fecha) return false; const d = new Date(m.fecha); return d.getFullYear() === yr && getWeekNumber(d) === w; });
      } else {
        data = mermas.filter(m => m.fecha?.startsWith(col.key));
      }
      return { ...col, stats: calcMermaStats(data) };
    });
    return cols;
  }, [mermas, columns, view, hasLoncheado]);

  const tableRows = useMemo(() => {
    const rows: any[] = [];
    areas.forEach(area => {
      const areaData = allData.filter(a => a.area === area.id);
      
      // Determine indicators for this area
      const areaIndicators = [
        { id: 'availability', label: 'DISPO (%)', objKey: 'disponibilidad' as const },
        { id: 'performance',  label: 'REND (%)',  objKey: 'rendimiento' as const },
        { id: 'quality',      label: 'CALID (%)', objKey: 'calidad' as const },
        { id: 'oee',          label: 'OEE (%)',   objKey: null } // OEE uses calculated obj
      ];

      if (area.id === 'sb-preparacion') {
        areaIndicators.unshift({ id: 'pph', label: 'PPH', objKey: null });
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
              data = mermas.filter(m => m.fecha === col.key && m.area === area.id);
            } else if (view === 'weekly') {
              const [yr, w] = col.key.split('-W').map(Number);
              data = mermas.filter(m => { if (!m.fecha || m.area !== area.id) return false; const d = new Date(m.fecha); return d.getFullYear() === yr && getWeekNumber(d) === w; });
            } else {
              data = mermas.filter(m => m.fecha?.startsWith(col.key) && m.area === area.id);
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
                const isPPH = row.indicator.id === 'pph';

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
                      {currentObj !== 0 ? (isPPH ? currentObj : `${currentObj}%`) : '—'}
                    </td>
                    {row.cols.map((col: any) => {
                      const val = col.value;
                      const numVal = val === '' ? null : Number(val);
                      
                      let cellStyle = 'text-slate-300';
                      if (numVal !== null) {
                        const colObj = getObjectiveValue(row.area.id, row.indicator.id, col.key.includes('-W') ? undefined : col.key);
                        
                        if (row.indicator.id.startsWith('merma') || row.indicator.id === 'subproducto') {
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
    </div>
  );
};

// Wrappers específicos para cada grupo
export const SalaBlancaDashboard: React.FC<Omit<Props, 'areas' | 'title' | 'subtitle'>> = (props) => (
  <GroupDashboard {...props}
    title="Sala Blanca"
    subtitle="Preparación · Loncheado · Emp. Loncheado · Emp. Deshuesado"
    areas={[
      { id: 'sb-preparacion',            name: 'PREPARACIÓN' },
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
    subtitle="Expediciones · Preparación Expediciones"
    areas={[
      { id: 'expedicion',      name: 'EXPEDICIONES' },
      { id: 'preparacion-exp', name: 'PREPARACIÓN EXP.' },
    ]}
  />
);

export default SalaBlancaDashboard;
