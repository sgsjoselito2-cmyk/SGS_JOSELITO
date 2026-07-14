import dotenv from 'dotenv';
dotenv.config();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.log("No DATABASE_URL");
} else {
  const parsed = new URL(dbUrl);
  console.log("Password length:", parsed.password.length);
  console.log("Password starts with:", parsed.password.substring(0, 3));
  console.log("Password ends with:", parsed.password.substring(parsed.password.length - 3));
}
