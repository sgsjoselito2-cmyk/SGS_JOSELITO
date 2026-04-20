import express from "express";
import pkg from "pg";
const { Pool } = pkg;

const app = express();
app.use(express.json());

// API routes
app.get("/api/health-v2", (req, res) => {
  const dbUrl = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL || "";
  const sUrl = process.env.VITE_SUPABASE_URL || "";
  const sKey = process.env.VITE_SUPABASE_ANON_KEY || "";
  
  res.status(200).json({ 
    status: "ok", 
    version: "v2-vercel",
    timestamp: new Date().toISOString(),
    dbConfigured: !!dbUrl,
    supabaseConfigured: !!(sUrl && sKey),
    sUrlStart: sUrl ? sUrl.substring(0, 15) + "..." : "N/A"
  });
});

app.get("/api/db-check-v2", async (req, res) => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return res.status(400).json({ error: "DATABASE_URL no configurada en el entorno" });
  }
  
  try {
    const pool = new Pool({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000
    });

    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    await pool.end();
    res.json({ status: "connected", time: result.rows[0].now });
  } catch (err: any) {
    console.error("DB Check Error:", err.message);
    res.status(500).json({ error: `Error de conexión: ${err.message}` });
  }
});

export default app;
