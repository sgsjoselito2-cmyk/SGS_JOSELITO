import dotenv from 'dotenv';
dotenv.config();

console.log("Printing all environment keys and masked values:");
for (const key in process.env) {
  const val = process.env[key];
  if (!val) {
    console.log(`${key}: empty`);
    continue;
  }
  // Mask sensitive things
  if (key.includes('PASS') || key.includes('KEY') || key.includes('URL') || key.includes('SECRET') || key.includes('TOKEN')) {
    console.log(`${key}: [MASKED] (${val.substring(0, 15)}... len=${val.length})`);
  } else {
    console.log(`${key}: ${val}`);
  }
}
