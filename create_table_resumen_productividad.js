import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;

if (!connectionString) {
  console.error("No DATABASE_URL found!");
  process.exit(1);
}

// Convert pooler URL to direct URL dynamically
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
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000
});

async function createTable() {
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
    console.log("Creating table resumen_productividad...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS resumen_productividad (
        fecha DATE NOT NULL,
        area TEXT NOT NULL,
        producto TEXT NOT NULL,
        duracion_min NUMERIC DEFAULT 0,
        cantidad NUMERIC DEFAULT 0,
        personas INTEGER DEFAULT 0,
        unidades_hora NUMERIC DEFAULT 0,
        pph NUMERIC DEFAULT 0,
        obj_maquina NUMERIC DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (fecha, area, producto)
      );
    `);

    console.log("Disabling Row Level Security on resumen_productividad...");
    await client.query(`
      ALTER TABLE resumen_productividad DISABLE ROW LEVEL SECURITY;
    `);

    console.log("Table resumen_productividad created successfully!");
  } catch (err) {
    console.error("Error creating table:", err);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

createTable();
