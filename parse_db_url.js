import dotenv from 'dotenv';
dotenv.config();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.log("No DATABASE_URL");
} else {
  const parsed = new URL(dbUrl);
  console.log("Protocol:", parsed.protocol);
  console.log("Username:", parsed.username);
  console.log("Password:", parsed.password);
  console.log("Hostname:", parsed.hostname);
  console.log("Port:", parsed.port);
  console.log("Pathname:", parsed.pathname);
}
