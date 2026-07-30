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
  turnoId?: string;
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

export interface PlanAccionTop60 {
  id?: number | string;
  numero: number;
  seccion: string;
  problema: string;
  accion: string;
  responsable: string;
  soporte: string;
  fecha_lanzamiento: string;
  fecha_objetivo: string;
  fecha_cierre?: string | null;
  comentarios?: string;
  created_at?: string;
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
  pph_manteca?: number;
  cantidad_colgada?: number;
  pph_blister?: number;
  pph_sin_blister?: number;
  pph_blister_emp?: number;
  pph_sin_blister_cuchillo?: number;
  pph_sin_marcar?: number;
  pph_empaquetado_jabu?: number;
  area: string;
  indicator_id?: string; // Standardized to snake_case
  valid_from: string; // ISO Date string (YYYY-MM-DD)
  showInTop5?: boolean;
  showInTop15?: boolean;
  showInTop60?: boolean;
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

export interface PlanAccionSeguridad {
  id: string;
  fecha: string;
  tipo: 'Accidente' | 'Incidente' | 'Near Miss';
  gap: string;
  queHaOcurrido: string;
  accion: string;
  responsable: string;
  fechaImplantacionPrevista: string;
  fechaImplantacionReal?: string;
  estado: 'Abierto' | 'En Marcha' | 'Cerrado' | 'Retrasado';
}

export interface GapSeguridad {
  id: string;
  nombre: string;
}

export interface RegistroPersonalTop60 {
  id: string;
  fecha: string;
  jornadasTeoricas: number;
  jornadasPerdidasBaja: number;
  jornadasPerdidasAusentismo: number;
}

export interface PlanAccionCalidad {
  id: string;
  fecha: string;
  tipoReclamacion: string;
  areaCausante: string;
  descripcionProblema: string;
  accionContenedora: string;
  responsableContenedora: string;
  fechaPrevistaContenedora: string;
  fechaCierreContenedora?: string;
  accionCorrectora: string;
  responsableCorrectora: string;
  fechaPrevistaCorrectora: string;
  fechaCierreCorrectora?: string;
  origen?: 'Interna' | 'Externa';
}

export interface TipoReclamacion {
  id: string;
  nombre: string;
}

export interface IdeaDeMejora {
  id: string;
  numeroSugerencia: number;
  sugerencia: string;
  recurso: string;
  fechaCreacion: string;
  aprobada: 'Sí' | 'No' | 'Pendiente';
  responsable: string;
  fechaEjecucionPrevista?: string;
  fechaCierre?: string;
  estado: 'Abierto' | 'En Marcha' | 'Cerrado' | 'Retrasado';
  fechaEmision?: string;
}


