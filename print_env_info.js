import dotenv from 'dotenv';
dotenv.config();

const connStr = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
console.log("DATABASE_URL:", connStr ? "Exists" : "Undefined");
if (connStr) {
  try {
    const url = new URL(connStr);
    console.log("Protocol:", url.protocol);
    console.log("Username:", url.username);
    console.log("Hostname:", url.hostname);
    console.log("Port:", url.port);
    console.log("Pathname:", url.pathname);
  } catch (e) {
    console.log("Error parsing:", e.message);
  }
}
