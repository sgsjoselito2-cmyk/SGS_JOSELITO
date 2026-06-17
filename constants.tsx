import { MasterSpeed, IncidenceMaster, TaskType, OEEObjectives, User, ActionPlanItem } from './types';

export const JOSELITO_LOGO = "https://www.joselito.com/media/logo/stores/1/logo_joselito.png";

export const INITIAL_ACTION_PLAN_TOP60: ActionPlanItem[] = [];
export const INITIAL_ACTION_PLAN_TOP15: ActionPlanItem[] = [];
export const TOP15_RESPONSABLES: string[] = [];
export const TOP60_RESPONSABLES: string[] = [];
const MASTER_PEOPLE_LIST: string[] = [];

export const getInitialOperarios = (areaId: string): User[] => {
  if (areaId === 'TOP 15') {
    return TOP15_RESPONSABLES.map((nombre, i) => ({
      id: `op-top15-${i}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      nombre: nombre.toUpperCase()
    }));
  }
  if (areaId === 'TOP 60') {
    return TOP60_RESPONSABLES.map((nombre, i) => ({
      id: `op-top60-${i}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      nombre: nombre.toUpperCase()
    }));
  }
  if (['sb-preparacion','sb-loncheado','sb-empaquetado-loncheado','sb-empaquetado-deshuesado','env-envasado','env-empaquetado','expedicion','preparacion-exp','movimiento-jamones'].includes(areaId)) {
    return MASTER_PEOPLE_LIST.map((nombre, i) => ({
      id: `op-jos-${areaId}-${i}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      nombre: nombre.toUpperCase()
    }));
  }
  return MASTER_PEOPLE_LIST.map((nombre, i) => ({
    id: `op-${areaId}-${i}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    nombre: nombre.toUpperCase()
  }));
};

export const INITIAL_OPERARIOS: User[] = getInitialOperarios('sb-preparacion');

export const AREA_NAMES: Record<string, string> = {
  'TOP 5': 'GAPs TOP 5',
  'TOP 15': 'GAPs TOP 15',
  'TOP 60': 'TOP 60',
  'sb-preparacion': 'DESHUESADO/PRENSADO',
  'sb-loncheado': 'LONCHEADO',
  'sb-empaquetado-loncheado': 'EMP. LONCHEADO',
  'sb-empaquetado-deshuesado': 'EMP. DESHUESADO',
  'env-envasado': 'ENVASADO',
  'env-empaquetado': 'EMPAQUETADO',
  'expedicion': 'EXPEDICIONES',
  'preparacion-exp': 'PREPARACIÓN',
  'movimiento-jamones': 'MOVIMIENTOS'
};

export const AREA_COLUMNS: Record<string, string[]> = {
  'sb-preparacion': ['Unidades Hora'],
  'sb-loncheado': ['Unidades Hora'],
  'sb-empaquetado-loncheado': ['Unidades Hora'],
  'sb-empaquetado-deshuesado': ['Unidades Hora'],
  'env-envasado': ['Unidades Hora'],
  'env-empaquetado': ['Unidades Hora'],
  'expedicion': ['Unidades Hora'],
  'preparacion-exp': ['Unidades Hora'],
  'movimiento-jamones': ['Unidades Hora']
};

export const getInitialMasterSpeeds = (areaId: string): MasterSpeed[] => {
  return [
    { id: `ms-${areaId}-1`, formato: 'FORMATO ESTÁNDAR', tiempoTeorico: 60, area: areaId },
    { id: `ms-${areaId}-2`, formato: 'FORMATO GRANDE', tiempoTeorico: 40, area: areaId },
    { id: `ms-${areaId}-3`, formato: 'FORMATO PEQUEÑO', tiempoTeorico: 120, area: areaId }
  ];
};

export const INITIAL_OEE_OBJECTIVES: OEEObjectives = {
  disponibilidad: 90,
  rendimiento: 70,
  calidad: 99,
  productividad: 62.37,
  objetivo: 0,
  area: '',
  valid_from: new Date().toISOString().split('T')[0]
};

export const WORKSHOP_HELP_CONTENT: Record<string, { usage: string; indicators: string }> = {
  'default': {
    usage: "Selecciona tu nombre, elige el formato y pulsa 'INICIAR TAREA'. Al terminar introduce la cantidad fabricada.",
    indicators: "Dispo = T.trabajo(P) / (T.trabajo(P) + T.Esperas(E) + T.Averías(A))\nRen = T.teórico / T.trabajo(P)\nCali = 100% (No se computa pérdida de calidad)\nT.teórico = Tiempo unitario x Cantidad"
  },
  'sb-preparacion': { usage: "Selecciona tu nombre, elige el formato de deshuesado/prensado y pulsa 'INICIAR TAREA'. Al terminar introduce las cantidades.", indicators: "Dispo = T.trabajo(P) / (T.trabajo(P) + T.Esperas(E) + T.Averías(A))\nRen = T.teórico / T.trabajo(P)\nCali = 100%" },
  'sb-loncheado': { usage: "Selecciona tu nombre, elige el formato de loncheado y pulsa 'INICIAR TAREA'. Al terminar introduce las cantidades.", indicators: "Dispo = T.trabajo(P) / (T.trabajo(P) + T.Esperas(E) + T.Averías(A))\nRen = T.teórico / T.trabajo(P)\nCali = 100%" },
  'sb-empaquetado-loncheado': { usage: "Selecciona tu nombre, elige el formato de empaquetado loncheado y pulsa 'INICIAR TAREA'. Al terminar introduce las cantidades.", indicators: "Dispo = T.trabajo(P) / (T.trabajo(P) + T.Esperas(E) + T.Averías(A))\nRen = T.teórico / T.trabajo(P)\nCali = 100%" },
  'sb-empaquetado-deshuesado': { usage: "Selecciona tu nombre, elige el formato de empaquetado deshuesado y pulsa 'INICIAR TAREA'. Al terminar introduce las cantidades.", indicators: "Dispo = T.trabajo(P) / (T.trabajo(P) + T.Esperas(E) + T.Averías(A))\nRen = T.teórico / T.trabajo(P)\nCali = 100%" },
  'env-envasado': { usage: "Selecciona tu nombre, elige el formato de envasado y pulsa 'INICIAR TAREA'. Al finalizar introduce las cantidades.", indicators: "Dispo = T.trabajo(P) / (T.trabajo(P) + T.Esperas(E) + T.Averías(A))\nRen = T.teórico / T.trabajo(P)\nCali = 100%" },
  'env-empaquetado': { usage: "Selecciona tu nombre, elige el formato de empaquetado y pulsa 'INICIAR TAREA'. Al finalizar introduce las cantidades.", indicators: "Dispo = T.trabajo(P) / (T.trabajo(P) + T.Esperas(E) + T.Averías(A))\nRen = T.teórico / T.trabajo(P)\nCali = 100%" },
  'expedicion': { usage: "Selecciona tu nombre, elige el formato de expedición y pulsa 'INICIAR TAREA'. Al finalizar introduce las cantidades.", indicators: "Dispo = T.trabajo(P) / (T.trabajo(P) + T.Esperas(E) + T.Averías(A))\nRen = T.teórico / T.trabajo(P)\nCali = 100%" },
  'preparacion-exp': { usage: "Selecciona tu nombre, elige el formato de prep. expediciones y pulsa 'INICIAR TAREA'. Al terminar introduce las cantidades.", indicators: "Dispo = T.trabajo(P) / (T.trabajo(P) + T.Esperas(E) + T.Averías(A))\nRen = T.teórico / T.trabajo(P)\nCali = 100%" },
  'movimiento-jamones': { usage: "Selecciona tu nombre, elige el tipo de movimiento y pulsa 'INICIAR TAREA'. Al terminar introduce las cantidades.", indicators: "Dispo = T.trabajo(P) / (T.trabajo(P) + T.Esperas(E) + T.Averías(A))\nRen = T.teórico / T.trabajo(P)\nCali = 100%" },
  'TOP 15': { usage: "Indicadores Diarios: Datos del día anterior. Evolución Semanal: Gráficos de tendencia. Análisis IA: Resumen bajo demanda.", indicators: "Dispo = T.trabajo(P) / (T.trabajo(P) + T.Esperas(E) + T.Averías(A))\nRen = T.teórico / T.trabajo(P)\nOEE = Dispo x Ren x Cali (100%)" },
  'TOP 60': { usage: "Registro de datos de RRHH, Seguridad y Calidad. Histórico mensual. Objetivos y Plan de Acción.", indicators: "Evolución mensual de KPIs. Plan Estratégico y Análisis de Desviaciones." }
};

export const getInitialIncidenceMaster = (areaId: string): IncidenceMaster[] => {
  const paradas = [
    { id: `e-${areaId}-0`, nombre: 'FALTA DE MATERIA PRIMA', tipo: TaskType.ESPERAS, afectaCalidad: false },
    { id: `e-${areaId}-1`, nombre: 'FALTA DE MATERIAL AUXILIAR', tipo: TaskType.ESPERAS, afectaCalidad: false },
    { id: `e-${areaId}-2`, nombre: 'FALTA DE PERSONAL EN LA LÍNEA', tipo: TaskType.ESPERAS, afectaCalidad: false },
    { id: `e-${areaId}-3`, nombre: 'CAMBIO DE ORDEN', tipo: TaskType.ESPERAS, afectaCalidad: false },
    { id: `e-${areaId}-4`, nombre: 'FIN DE TURNO', tipo: TaskType.ESPERAS, afectaCalidad: false },
    { id: `e-${areaId}-5`, nombre: 'INICIO TURNO / PREPARACIÓN', tipo: TaskType.ESPERAS, afectaCalidad: false },
    { id: `e-${areaId}-6`, nombre: 'TOP 5', tipo: TaskType.ESPERAS, afectaCalidad: false },
    { id: `e-${areaId}-7`, nombre: 'DESCANSO / ALMUERZO', tipo: TaskType.ESPERAS, afectaCalidad: false },
    { id: `e-${areaId}-8`, nombre: 'FORMACIÓN / REUNIONES', tipo: TaskType.ESPERAS, afectaCalidad: false },
    { id: `e-${areaId}-9`, nombre: 'OTRAS ESPERAS', tipo: TaskType.ESPERAS, afectaCalidad: false },
  ] as IncidenceMaster[];

  const averias = [
    { id: `a-${areaId}-0`, nombre: 'FALLO CINTA', tipo: TaskType.AVERIA, afectaCalidad: false },
    { id: `a-${areaId}-1`, nombre: 'FALLO SOFTWARE', tipo: TaskType.AVERIA, afectaCalidad: false },
    { id: `a-${areaId}-2`, nombre: 'FALLO BÁSCULA', tipo: TaskType.AVERIA, afectaCalidad: false },
    { id: `a-${areaId}-3`, nombre: 'FALLO MECÁNICO', tipo: TaskType.AVERIA, afectaCalidad: false },
    { id: `a-${areaId}-4`, nombre: 'FALLO ELÉCTRICO', tipo: TaskType.AVERIA, afectaCalidad: false },
    { id: `a-${areaId}-5`, nombre: 'OTRAS AVERÍAS', tipo: TaskType.AVERIA, afectaCalidad: false },
  ] as IncidenceMaster[];

  const sinTrabajo: IncidenceMaster = {
    id: `s-${areaId}-0`,
    nombre: 'SIN TRABAJO',
    tipo: TaskType.SIN_TRABAJO,
    afectaCalidad: false
  };

  return [...paradas, ...averias, sinTrabajo];
};

export const INITIAL_INCIDENCE_MASTER: IncidenceMaster[] = getInitialIncidenceMaster('sb-preparacion');

export const INITIAL_WORKSHOP_INDICATORS: Record<string, {id: string, name: string, formula?: string}[]> = {
  'sb-loncheado': [
    { id: 'disponibilidad', name: 'Disponibilidad' },
    { id: 'rendimiento', name: 'Rendimiento' },
    { id: 'calidad', name: 'Calidad' },
    { id: 'productividad', name: 'Productividad (OEE)' },
    { id: 'merma1', name: 'Merma 1' },
    { id: 'merma2', name: 'Merma 2' },
    { id: 'subproducto', name: 'Subproducto' }
  ],
  'sb-preparacion': [
    { id: 'pph', name: 'PPH' }
  ],
  'sb-empaquetado-loncheado': [
    { id: 'pph_blister_emp', name: 'PPH blister empaquetado' },
    { id: 'pph_sin_blister_cuchillo', name: 'PPH sin blister cuchillo' },
    { id: 'pph_sin_marcar', name: 'PPH sin marcar' },
    { id: 'pph_empaquetado_jabu', name: 'PPH empaquetado Jabu' }
  ],
  'sb-empaquetado-deshuesado': [
    { id: 'pph', name: 'PPH' }
  ],
  'env-envasado': [
    { id: 'pph', name: 'PPH' },
    { id: 'disponibilidad', name: 'Disponibilidad' },
    { id: 'rendimiento', name: 'Rendimiento' },
    { id: 'calidad', name: 'Calidad' },
    { id: 'productividad', name: 'Productividad (OEE)' }
  ],
  'env-empaquetado': [
    { id: 'pph', name: 'PPH' },
    { id: 'disponibilidad', name: 'Disponibilidad' },
    { id: 'rendimiento', name: 'Rendimiento' },
    { id: 'calidad', name: 'Calidad' },
    { id: 'productividad', name: 'Productividad (OEE)' }
  ],
  'movimiento-jamones': [
    { id: 'pph_jamones', name: 'PPH COLGAR JAMONES' },
    { id: 'pph_paletas', name: 'PPH COLGAR PALETAS' },
    { id: 'pph_manteca', name: 'PPH COLGAR JAMONES MANTECA' },
    { id: 'cantidad_colgada', name: 'CANTIDAD COLGADA' },
    { id: 'disponibilidad', name: 'DISPONIBILIDAD (%)' }
  ],
  'default': [
    { id: 'disponibilidad', name: 'Disponibilidad' },
    { id: 'rendimiento', name: 'Rendimiento' },
    { id: 'calidad', name: 'Calidad' },
    { id: 'productividad', name: 'Productividad (OEE)' }
  ]
};
