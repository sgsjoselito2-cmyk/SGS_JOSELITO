import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "pg";
import fs from "fs";
const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Logging startup info
try {
  fs.appendFileSync("server-log.txt", "Starting Joselito Backend Server at " + new Date().toISOString() + "\n");
  fs.appendFileSync("server-log.txt", "NODE_ENV: " + process.env.NODE_ENV + "\n");
} catch (e) {}

console.log("Starting Joselito Backend Server...");
console.log("NODE_ENV:", process.env.NODE_ENV);

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLine = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)\n`;
    try {
      fs.appendFileSync("server-log.txt", logLine);
    } catch (e) {
      // Ignore log errors in some environments
    }
    console.log(logLine.trim());
  });
  next();
});

app.use(express.json());

// API routes FIRST
app.get("/api/health-v2", (req, res) => {
  const dbUrl = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL || "";
  const sUrl = process.env.VITE_SUPABASE_URL || "";
  const sKey = process.env.VITE_SUPABASE_ANON_KEY || "";
  
  res.status(200).json({ 
    status: "ok", 
    version: "v2",
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

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  console.log("Starting Vite in middleware mode...");
  createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
    optimizeDeps: { force: true },
  }).then(vite => {
    app.use(vite.middlewares);
    console.log("Vite middleware attached.");
  });
} else {
  // Serve static files in production
  const distPath = path.join(__dirname, "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// Only listen if not in a serverless environment (like Vercel)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;
