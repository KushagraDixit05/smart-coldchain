require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("../src/db/pool");

// Usage: node scripts/create-admin.js <email> <password> <company>
async function main() {
  const [email, password, company] = process.argv.slice(2);
  if (!email || !password || !company) {
    console.error("Usage: node scripts/create-admin.js <email> <password> <company>");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    "INSERT INTO admins (email, password_hash, company) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET password_hash = $2, company = $3",
    [email, passwordHash, company]
  );
  console.log(`Admin ${email} created/updated.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
