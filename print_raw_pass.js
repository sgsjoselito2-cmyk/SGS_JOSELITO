import dotenv from 'dotenv';
dotenv.config();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.log("No DATABASE_URL");
} else {
  const parsed = new URL(dbUrl);
  console.log("Password:", parsed.password);
}
