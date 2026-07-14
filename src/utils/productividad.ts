import { Activity, MasterSpeed } from '../../types';
import { calculateUniqueMinutes, normalizeFormato } from './index';

export interface ResumenProductividadRow {
  fecha: string;
  area: string;
  producto: string;
  duracion_min: number;
  cantidad: number;
  personas: number;
  unidades_hora: number;
  pph: number;
  obj_maquina: number;
  updated_at: string;
}

// Map activity formats to getIntervals format
const getIntervalsForActs = (acts: Activity[]) => acts
  .filter(a => a.horaInicio && a.horaFin)
  .map(a => ({ start: a.horaInicio, end: a.horaFin! }));

/**
 * Calculates productivity rows for the given activities and history records.
 * If filterStartDate/filterEndDate are provided, only processes activities in that range.
 */
export function calculateProductivityRows(
  activities: Activity[],
  history: Activity[],
  masterSpeeds: MasterSpeed[],
  filterStartDate?: string,
  filterEndDate?: string
): ResumenProductividadRow[] {
  // Combine all activities
  const allActs = [...activities, ...history];

  // Filter: production only, valid date, and optional date range
  const prodActs = allActs.filter(a => {
    // Check if it is production
    const isProd = a.tipoTarea === 'P' || (a.tipoTarea as string) === 'PRODUCCION';
    if (!isProd) return false;

    if (!a.fecha || !a.area || !a.formato) return false;

    if (filterStartDate && a.fecha < filterStartDate) return false;
    if (filterEndDate && a.fecha > filterEndDate) return false;

    return true;
  });

  // Group by date + area + format (product)
  const groups: Record<string, {
    fecha: string;
    area: string;
    producto: string; // Original name with spaces preserved
    productoNormalized: string; // Used internally for speed match
    acts: Activity[];
  }> = {};

  for (const act of prodActs) {
    const fecha = act.fecha!;
    const area = act.area!;
    const normalized = normalizeFormato(act.formato);
    const key = `${fecha}|${area}|${normalized}`;

    if (!groups[key]) {
      groups[key] = {
        fecha,
        area,
        producto: (act.formato || '').trim().toUpperCase(),
        productoNormalized: normalized,
        acts: []
      };
    }
    groups[key].acts.push(act);
  }

  const results: ResumenProductividadRow[] = [];

  for (const key of Object.keys(groups)) {
    const group = groups[key];
    
    // 1. duracion_min: Unique operating time consolidation
    const intervals = getIntervalsForActs(group.acts);
    const duracion_min = calculateUniqueMinutes(intervals);

    // 2. cantidad: sum of cantidad + cantidadNok
    const cantidad = group.acts.reduce((sum, a) => sum + Number(a.cantidad || 0) + Number(a.cantidadNok || 0), 0);

    // 3. personas: unique operarios across all activities in this group
    const uniqueOperarios = new Set<string>();
    for (const a of group.acts) {
      if (Array.isArray(a.operarios)) {
        a.operarios.forEach(o => {
          if (o && o.trim()) {
            uniqueOperarios.add(o.trim().toUpperCase());
          }
        });
      }
    }
    const personas = uniqueOperarios.size || 1; // default to 1 to avoid division by zero if no operarios, though there should be

    // 4. unidades_hora: cantidad / duracion_min * 60
    const unidades_hora = duracion_min > 0 ? (cantidad / duracion_min) * 60 : 0;

    // 5. pph: unidades_hora / personas
    const pph = unidades_hora / personas;

    // 6. obj_maquina: master speed from master_speeds
    const speedMatch = masterSpeeds.find(ms => 
      normalizeFormato(ms.formato) === group.productoNormalized && 
      ms.area === group.area
    );
    const obj_maquina = speedMatch ? speedMatch.tiempoTeorico : 0;

    results.push({
      fecha: group.fecha,
      area: group.area,
      producto: group.producto,
      duracion_min: parseFloat(duracion_min.toFixed(2)),
      cantidad: parseFloat(cantidad.toFixed(2)),
      personas: uniqueOperarios.size, // store actual unique count
      unidades_hora: parseFloat(unidades_hora.toFixed(2)),
      pph: parseFloat(pph.toFixed(2)),
      obj_maquina: obj_maquina,
      updated_at: new Date().toISOString()
    });
  }

  return results;
}
