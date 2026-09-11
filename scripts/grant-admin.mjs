import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const email = process.argv[2]?.trim().toLowerCase();
if (!email) throw new Error("Usage: npm run admin:grant -- person@company.com");
const configuredUrl = process.env.DATABASE_URL || process.env.database;
if (!configuredUrl) throw new Error("Set database or DATABASE_URL.");
const parsedUrl = new URL(configuredUrl);
parsedUrl.searchParams.delete("sslmode");
parsedUrl.searchParams.delete("uselibpqcompat");
const connectionString = parsedUrl.toString();
const local = /localhost|127\.0\.0\.1/.test(connectionString);
const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";
const pool = new pg.Pool({ connectionString, ssl: local ? undefined : { rejectUnauthorized } });

try {
  const result = await pool.query("UPDATE users SET role = 'admin' WHERE email = $1 RETURNING email", [email]);
  if (!result.rowCount) throw new Error(`No account exists for ${email}. Create the account first.`);
  console.log(`Admin access granted to ${result.rows[0].email}.`);
} finally {
  await pool.end();
}
