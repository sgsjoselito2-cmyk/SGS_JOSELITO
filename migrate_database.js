import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;

if (!connectionString) {
  console.error("No DATABASE_URL found!");
  process.exit(1);
}

// Convert pooler URL to direct URL
// From: postgres://postgres.egrqcyyczcnhxqrgfprh:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
// To: postgres://postgres:[PASSWORD]@db.egrqcyyczcnhxqrgfprh.supabase.co:5432/postgres
let directUrl = connectionString;
try {
  const url = new URL(connectionString);
  const match = url.username.match(/^postgres\.(.+)$/);
  if (match) {
    const projectRef = match[1];
    url.username = 'postgres';
    url.hostname = `db.${projectRef}.supabase.co`;
    url.port = '5432';
    directUrl = url.toString();
    console.log("Converted pooler URL to direct connection URL!");
  }
} catch (e) {
  console.error("Error parsing URL:", e.message);
}

let pool = new Pool({
  connectionString: directUrl,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    console.warn("Direct connection failed, trying pooler connection...", err.message);
    pool = new Pool({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false }
    });
    client = await pool.connect();
  }
  try {
    console.log("Adding columns to top60_rrhh...");
    await client.query(`
      ALTER TABLE top60_rrhh ADD COLUMN IF NOT EXISTS jornadas_teoricas NUMERIC DEFAULT 0;
      ALTER TABLE top60_rrhh ADD COLUMN IF NOT EXISTS jornadas_perdidas_baja NUMERIC DEFAULT 0;
      ALTER TABLE top60_rrhh ADD COLUMN IF NOT EXISTS jornadas_perdidas_ausentismo NUMERIC DEFAULT 0;
      ALTER TABLE top60_rrhh ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    `);

    console.log("Creating table tipos_reclamacion...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS tipos_reclamacion (
        id TEXT PRIMARY KEY,
        nombre TEXT NOT NULL
      );
      INSERT INTO tipos_reclamacion (id, nombre) VALUES 
        ('calidad', 'Calidad'), ('cantidad', 'Cantidad')
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log("Creating table areas_causantes_calidad...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS areas_causantes_calidad (
        id TEXT PRIMARY KEY,
        nombre TEXT NOT NULL
      );
      INSERT INTO areas_causantes_calidad (id, nombre) VALUES
        ('sb-preparacion', 'DESHUESADO/PRENSADO'),
        ('sb-loncheado', 'LONCHEADO'),
        ('sb-empaquetado-loncheado', 'EMP. LONCHEADO'),
        ('sb-empaquetado-deshuesado', 'EMP. DESHUESADO'),
        ('env-envasado', 'ENVASADO'),
        ('env-empaquetado', 'EMPAQUETADO'),
        ('expedicion', 'EXPEDICIONES'),
        ('preparacion-exp', 'PREPARACIÓN EXP.'),
        ('movimiento-jamones', 'MOVIMIENTOS'),
        ('ventas', 'VENTAS'),
        ('back-office', 'BACK OFFICE COMERCIAL')
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log("Creating table plan_accion_calidad...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS plan_accion_calidad (
        id TEXT PRIMARY KEY,
        fecha TEXT NOT NULL,
        tipo_reclamacion TEXT,
        area_causante TEXT,
        descripcion_problema TEXT,
        accion_contenedora TEXT,
        responsable_contenedora TEXT,
        fecha_prevista_contenedora TEXT,
        fecha_cierre_contenedora TEXT,
        accion_correctora TEXT,
        responsable_correctora TEXT,
        fecha_prevista_correctora TEXT,
        fecha_cierre_correctora TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log("Ensuring columns exist in plan_accion_calidad...");
    await client.query(`
      ALTER TABLE plan_accion_calidad 
        ADD COLUMN IF NOT EXISTS descripcion_problema TEXT;
    `);

    console.log("Creating table ideas_mejora...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS ideas_mejora (
        id TEXT PRIMARY KEY,
        numero_sugerencia INTEGER NOT NULL,
        sugerencia TEXT,
        recurso TEXT,
        fecha_creacion TEXT,
        aprobada TEXT DEFAULT 'Pendiente',
        responsable TEXT,
        fecha_ejecucion_prevista TEXT,
        fecha_cierre TEXT,
        fecha_emision TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE ideas_mejora ADD COLUMN IF NOT EXISTS fecha_emision TEXT;
    `);

    console.log("Disabling RLS...");
    await client.query(`
      ALTER TABLE tipos_reclamacion DISABLE ROW LEVEL SECURITY;
      ALTER TABLE areas_causantes_calidad DISABLE ROW LEVEL SECURITY;
      ALTER TABLE plan_accion_calidad DISABLE ROW LEVEL SECURITY;
      ALTER TABLE ideas_mejora DISABLE ROW LEVEL SECURITY;
    `);

    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
