import "dotenv/config";
import express from "express";
import path from "path";
import pkg from "pg";
import fs from "fs";
const { Pool } = pkg;

// Logging startup info
try {
  fs.appendFileSync("server-log.txt", "Starting Joselito Backend Server at " + new Date().toISOString() + "\n");
  fs.appendFileSync("server-log.txt", "NODE_ENV: " + process.env.NODE_ENV + "\n");
} catch (e) {}

console.log("Starting Joselito Backend Server...");
console.log("NODE_ENV:", process.env.NODE_ENV);

// Run startup database migration to add fecha_emision column if needed
const dbUrlForMigration = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
if (dbUrlForMigration) {
  const pool = new Pool({
    connectionString: dbUrlForMigration,
    ssl: { rejectUnauthorized: false }
  });
  pool.query("ALTER TABLE ideas_mejora ADD COLUMN IF NOT EXISTS fecha_emision TEXT;")
    .then(() => {
      console.log("Database Migration: Checked/Added column fecha_emision to ideas_mejora successfully.");
      try {
        fs.appendFileSync("server-log.txt", "Migration success: added fecha_emision to ideas_mejora\n");
      } catch (e) {}
      return pool.end();
    })
    .catch(err => {
      console.log("Database Migration Status (Postgres direct connection skipped or not available):", err.message);
      try {
        fs.appendFileSync("server-log.txt", "Migration skipped or failed: " + err.message + "\n");
      } catch (e) {}
      return pool.end();
    });
}

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

// Catch all for /api to return JSON 404 instead of HTML
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: "API route not found" });
});

// Avoid returning HTML for Supabase-like routes that might be misdirected
app.all(["/auth/v1/*", "/rest/v1/*", "/storage/v1/*"], (req, res) => {
  res.status(404).json({ 
    error: "Supabase route intercepted by backend", 
    message: "Check your VITE_SUPABASE_URL configuration. It should not point to the application itself.",
    receivedUrl: req.originalUrl
  });
});

// Vite middleware for development and server startup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting Vite in middleware mode...");
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
        optimizeDeps: { force: true },
      });
      app.use(vite.middlewares);
      console.log("Vite middleware attached successfully.");
    } catch (err: any) {
      console.error("Failed to start Vite server:", err.message);
    }
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
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
}

startServer();

export default app;
