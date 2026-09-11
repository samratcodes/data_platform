import { randomBytes, randomUUID, scrypt } from "node:crypto";
import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const configuredUrl = process.env.DATABASE_URL || process.env.database;
const adminEmail = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.ADMIN_SEED_PASSWORD;
const adminName = process.env.ADMIN_SEED_NAME?.trim() || "map.filemarket Admin";

if (!configuredUrl) throw new Error("Set database or DATABASE_URL before resetting UI data.");
if (!adminEmail || !adminPassword) throw new Error("Set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD before resetting UI data.");
if (adminPassword.length < 12) throw new Error("ADMIN_SEED_PASSWORD must contain at least 12 characters.");

const parsedUrl = new URL(configuredUrl);
parsedUrl.searchParams.delete("sslmode");
parsedUrl.searchParams.delete("uselibpqcompat");
const connectionString = parsedUrl.toString();
const local = /localhost|127\.0\.0\.1/.test(connectionString);
const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";
const pool = new pg.Pool({ connectionString, ssl: local ? undefined : { rejectUnauthorized } });

const scryptOptions = { cost: 32_768, blockSize: 8, parallelization: 1, maxmem: 64 * 1024 * 1024 };

function derive(password, salt) {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, scryptOptions, (error, key) => error ? reject(error) : resolve(key));
  });
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await derive(password, salt);
  return `scrypt$${scryptOptions.cost}$${scryptOptions.blockSize}$${scryptOptions.parallelization}$${salt}$${hash.toString("hex")}`;
}

const client = await pool.connect();
try {
  await client.query("BEGIN");
  for (const table of [
    "admin_audit_logs", "messages", "conversations", "saved_operators", "access_requests",
    "concierge_requests", "supplier_applications", "integration_outbox", "email_outbox",
    "auth_tokens", "sessions", "auth_attempts", "providers",
  ]) await client.query(`DELETE FROM ${table}`);
  await client.query("DELETE FROM users WHERE email <> $1", [adminEmail]);
  await client.query("ALTER SEQUENCE IF EXISTS providers_id_seq RESTART WITH 1");

  const passwordHash = await hashPassword(adminPassword);
  await client.query(`
    INSERT INTO users (id, name, email, password_hash, role, email_verified_at, password_changed_at)
    VALUES ($1, $2, $3, $4, 'admin', NOW(), NOW())
    ON CONFLICT (email) DO UPDATE SET
      name = EXCLUDED.name,
      password_hash = EXCLUDED.password_hash,
      role = 'admin',
      email_verified_at = NOW(),
      password_changed_at = NOW()
  `, [randomUUID(), adminName, adminEmail, passwordHash]);
  await client.query("COMMIT");
  console.log(`UI data cleared. Seed administrator is ready for ${adminEmail}.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
