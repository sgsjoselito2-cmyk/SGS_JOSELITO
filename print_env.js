import dotenv from 'dotenv';
dotenv.config();

console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Exists" : "Not Found");
if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  console.log("Host:", url.hostname);
  console.log("Username:", url.username);
  console.log("Port:", url.port);
  console.log("Pathname:", url.pathname);
}
