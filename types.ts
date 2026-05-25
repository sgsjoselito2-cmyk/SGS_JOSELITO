export enum TaskType {
  PRODUCCION = 'P',
  ESPERAS = 'E',
  AVERIA = 'A',
  SIN_TRABAJO = 'S'
}

export interface Activity {
  id: string;
  operarios: string[];
  formato: string;
  tipoTarea: TaskType;
  horaInicio: string;
  horaFin?: string;
  duracionMin?: number;
  cantidad?: number; 
  cantidadNok?: number;
  comentarios?: string;
  fecha?: string;
  area?: string;
  afectaCalidad?: boolean;
  tiempoTeoricoManual?: number; 
  jefeEquipo?: string; // nombre del jefe de esta actividad
}

export interface ActionPlanItem {
  id: number;
  asunto: string;
  accion: string;
  responsable: string;
  soporte: string;
  fechaLanzamiento: string;
  fechaObjetivo: string;
  fechaCierre?: string;
  avance: number;
  observaciones: string;
}

export interface OEEObjectives {
  id?: string;
  disponibilidad: number;
  rendimiento: number;
  calidad: number;
  productividad: number;
  objetivo: number;
  merma1?: number;
  merma2?: number;
  subproducto?: number;
  pph?: number;
  pph_jamones?: number;
  pph_paletas?: number;
  pph_blister?: number;
  pph_sin_blister?: number;
  pph_blister_emp?: number;
  pph_sin_blister_cuchillo?: number;
  pph_sin_marcar?: number;
  pph_empaquetado_jabu?: number;
  area: string;
  indicator_id?: string; // Standardized to snake_case
  valid_from: string; // ISO Date string (YYYY-MM-DD)
}

export interface KPIStats {
  disponibilidad: number;
  rendimiento: number;
  calidad: number;
  cargaTrabajo: number;
  productividad: number;
}

export interface MasterSpeed {
  id: string;
  formato: string;
  tiempoTeorico: number;
  area?: string;
  unidad?: 'kg' | 'unidades';
  peso?: number;
}

export interface IncidenceMaster {
  id: string;
  nombre: string;
  tipo: TaskType;
  afectaCalidad: boolean;
  area?: string;
}

export interface User {
  nombre: string;
  id: string;
  areas?: string[];
  email?: string;
  esJefeEquipo?: boolean;
  areaJefeEquipo?: string; // ej: 'movimiento-jamones'
}

export interface Bodega {
  id: string;
  nombre: string;
}

export interface TipoProducto {
  id: string;
  nombre: string;
}

export interface MovimientoBodega {
  id: string;
  fecha: string;
  hora: string;
  jefeEquipo: string;
  bodegaOrigen: string;
  bodegaDestino: string;
  tipoProducto: string;
  anioJamon: string;
  cantidad: number;
  comentarios?: string;
}
