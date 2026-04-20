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
  area: string;
  indicatorId?: string; // To distinguish between OEE, Merma, etc.
  validFrom: string; // ISO Date string (YYYY-MM-DD)
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
}