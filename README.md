# Guía de Despliegue: Ecosistema Joselito

Esta guía detalla los pasos para desplegar la aplicación en **Vercel** utilizando **Supabase** como base de datos persistente.

## 1. Configuración de Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/).
2. Ve a la sección **SQL Editor** y ejecuta el siguiente script para crear todas las tablas necesarias:

```sql
-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de Actividades (Producción en tiempo real)
CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  operario TEXT NOT NULL,
  tarea TEXT NOT NULL,
  "tipoTarea" TEXT NOT NULL,
  "horaInicio" TEXT NOT NULL,
  "horaFin" TEXT,
  "duracionMin" FLOAT,
  "tipoVentilador" TEXT,
  "numOrden" TEXT,
  cantidad INTEGER,
  "cantidadNok" INTEGER,
  comentarios TEXT,
  fecha TEXT,
  turno TEXT,
  area TEXT,
  "afectaCalidad" BOOLEAN DEFAULT FALSE,
  "tiempoTeoricoManual" FLOAT,
  ancho FLOAT,
  alto FLOAT,
  "numLamas" INTEGER,
  "numLargueros" INTEGER,
  "numCajas" INTEGER,
  "numRosetas" INTEGER,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de Historial (Registros finalizados)
CREATE TABLE history (
  id TEXT PRIMARY KEY,
  operario TEXT NOT NULL,
  tarea TEXT NOT NULL,
  "tipoTarea" TEXT NOT NULL,
  "horaInicio" TEXT NOT NULL,
  "horaFin" TEXT NOT NULL,
  "duracionMin" FLOAT NOT NULL,
  "tipoVentilador" TEXT,
  "numOrden" TEXT,
  cantidad INTEGER,
  "cantidadNok" INTEGER,
  comentarios TEXT,
  fecha TEXT NOT NULL,
  turno TEXT,
  area TEXT NOT NULL,
  "afectaCalidad" BOOLEAN DEFAULT FALSE,
  "tiempoTeoricoManual" FLOAT,
  ancho FLOAT,
  alto FLOAT,
  "numLamas" INTEGER,
  "numLargueros" INTEGER,
  "numCajas" INTEGER,
  "numRosetas" INTEGER,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla de Personal (Operarios)
CREATE TABLE operarios (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT,
  area TEXT, -- NULL para usuarios globales
  activo BOOLEAN DEFAULT TRUE,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabla de Objetivos OEE
CREATE TABLE oee_objectives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area TEXT NOT NULL,
  objetivo FLOAT NOT NULL,
  productividad FLOAT NOT NULL,
  disponibilidad FLOAT NOT NULL,
  rendimiento FLOAT NOT NULL,
  calidad FLOAT NOT NULL,
  "validFrom" TEXT NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(area, "validFrom")
);

-- 5. Tablas Maestras (Velocidades e Incidencias)
CREATE TABLE master_speeds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tarea TEXT NOT NULL,
  maquina TEXT,
  tipo1 FLOAT,
  tipo2 FLOAT,
  tipo3 FLOAT,
  "tiemposArray" JSONB,
  "isFixed" BOOLEAN DEFAULT FALSE,
  "timePerLama" FLOAT,
  area TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE incidence_master (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL,
  "afectaCalidad" BOOLEAN DEFAULT FALSE,
  area TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Tablas Específicas TOP 60
CREATE TABLE top60_seguridad (
  id TEXT PRIMARY KEY,
  fecha TEXT NOT NULL,
  tipo TEXT NOT NULL,
  gap TEXT,
  problema TEXT,
  accion TEXT,
  responsable TEXT,
  "fechaPrevista" TEXT,
  "fechaReal" TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE top60_rrhh (
  id TEXT PRIMARY KEY,
  fecha TEXT NOT NULL,
  "totalMod" INTEGER,
  "totalMoi" INTEGER,
  "modBaja" INTEGER,
  "moiBaja" INTEGER,
  "ettBaja" INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE top60_ausentismo (
  id TEXT PRIMARY KEY,
  fecha TEXT NOT NULL,
  mod INTEGER,
  moi INTEGER,
  "jornadasPerdidasMod" INTEGER,
  "jornadasPerdidasMoi" INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE top60_calidad (
  id TEXT PRIMARY KEY,
  semana INTEGER NOT NULL,
  anio INTEGER NOT NULL,
  imagenes TEXT[], -- Array de base64 o URLs
  "fechaCreacion" TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE top60_idm (
  id TEXT PRIMARY KEY,
  "idSugerencia" INTEGER NOT NULL,
  sugerencia TEXT NOT NULL,
  recurso TEXT,
  "fechaCreacion" TEXT,
  aprobada TEXT,
  responsable TEXT,
  "fechaPrevista" TEXT,
  "fechaCierre" TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Tabla Plan de Acción
CREATE TABLE top60_actionplan (
  id SERIAL PRIMARY KEY,
  asunto TEXT NOT NULL,
  accion TEXT NOT NULL,
  responsable TEXT NOT NULL,
  soporte TEXT,
  "fechaLanzamiento" TEXT NOT NULL,
  "fechaObjetivo" TEXT NOT NULL,
  "fechaCierre" TEXT,
  avance INTEGER DEFAULT 0,
  observaciones TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- IMPORTANTE: Desactivar RLS o añadir políticas
ALTER TABLE activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE history DISABLE ROW LEVEL SECURITY;
ALTER TABLE operarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE oee_objectives DISABLE ROW LEVEL SECURITY;
ALTER TABLE master_speeds DISABLE ROW LEVEL SECURITY;
ALTER TABLE incidence_master DISABLE ROW LEVEL SECURITY;
ALTER TABLE top60_seguridad DISABLE ROW LEVEL SECURITY;
ALTER TABLE top60_rrhh DISABLE ROW LEVEL SECURITY;
ALTER TABLE top60_ausentismo DISABLE ROW LEVEL SECURITY;
ALTER TABLE top60_calidad DISABLE ROW LEVEL SECURITY;
ALTER TABLE top60_idm DISABLE ROW LEVEL SECURITY;
ALTER TABLE top60_actionplan DISABLE ROW LEVEL SECURITY;
```

3. Ve a **Project Settings > API** y copia la `Project URL` y la `anon public API key`.

## 2. Despliegue en Vercel

1. Sube tu código a un repositorio de **GitHub**.
2. En Vercel, crea un **New Project** e importa tu repositorio.
3. En la sección **Environment Variables**, añade las siguientes:
   - `VITE_SUPABASE_URL`: (La URL que copiaste de Supabase)
   - `VITE_SUPABASE_ANON_KEY`: (La clave anon que copiaste de Supabase)
4. Haz clic en **Deploy**.

## 3. Notas para Principiantes

- **Variables de Entorno:** Son claves secretas que permiten que tu App se conecte a la base de datos sin exponer las claves en el código público.
- **Supabase SQL Editor:** Es como una consola donde pegas el código de arriba para "dibujar" los cajones (tablas) donde se guardará la información.
- **Persistencia:** Al usar Supabase, los datos no se borrarán al cerrar el navegador o actualizar la página, ya que se guardan en la nube.
