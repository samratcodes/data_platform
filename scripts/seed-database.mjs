import { randomBytes, randomUUID, scrypt } from "node:crypto";
import nextEnv from "@next/env";
import pg from "pg";
import { nodes } from "../components/Landing/realNodes.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const configuredUrl = process.env.DATABASE_URL || process.env.database;
if (!configuredUrl) throw new Error("Set database or DATABASE_URL before seeding.");

const parsedUrl = new URL(configuredUrl);
parsedUrl.searchParams.delete("sslmode");
parsedUrl.searchParams.delete("uselibpqcompat");
const connectionString = parsedUrl.toString();
const local = /localhost|127\.0\.0\.1/.test(connectionString);
const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";
const pool = new pg.Pool({ connectionString, ssl: local ? undefined : { rejectUnauthorized } });

const scryptOptions = {
  cost: 32_768,
  blockSize: 8,
  parallelization: 1,
  maxmem: 64 * 1024 * 1024,
};

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

const providersOnly = process.argv.includes("--providers-only");
const generateAdmin = !providersOnly && process.argv.includes("--create-admin");
let adminEmail = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
let adminPassword = process.env.ADMIN_SEED_PASSWORD;
const adminName = process.env.ADMIN_SEED_NAME?.trim() || "map.filemarket Admin";
let generatedPassword = false;

if (generateAdmin && !adminEmail && !adminPassword) {
  adminEmail = "admin@filemarket.local";
  adminPassword = randomBytes(18).toString("base64url");
  generatedPassword = true;
}

if (!providersOnly && ((adminEmail && !adminPassword) || (!adminEmail && adminPassword))) {
  throw new Error("Set both ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD, or leave both empty.");
}
if (!providersOnly && adminPassword && adminPassword.length < 12) {
  throw new Error("ADMIN_SEED_PASSWORD must contain at least 12 characters.");
}

const client = await pool.connect();
try {
  await client.query("BEGIN");
  let insertedProviders = 0;
  const removedDemoProviders = (await client.query("DELETE FROM providers WHERE is_demo = TRUE")).rowCount ?? 0;

  for (const operator of nodes) {
    const profile = {
      ...operator.profile,
      area: operator.area,
      company: operator.company,
    };
    const result = await client.query(`
      INSERT INTO providers (
        slug, name, city, country, longitude, latitude, provider_type,
        modalities, media, profile, verification_level, status, is_demo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, 'physical', 'approved', FALSE)
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name, city = EXCLUDED.city, country = EXCLUDED.country,
        longitude = EXCLUDED.longitude, latitude = EXCLUDED.latitude,
        provider_type = EXCLUDED.provider_type, modalities = EXCLUDED.modalities,
        media = EXCLUDED.media, profile = EXCLUDED.profile,
        verification_level = EXCLUDED.verification_level, status = EXCLUDED.status,
        is_demo = FALSE, updated_at = NOW()
    `, [
      operator.slug,
      operator.name,
      operator.city,
      operator.country,
      operator.coordinates[0],
      operator.coordinates[1],
      operator.type,
      JSON.stringify(operator.modalities),
      JSON.stringify(operator.media),
      JSON.stringify(profile),
    ]);
    insertedProviders += result.rowCount ?? 0;
  }

  if (!providersOnly && adminEmail && adminPassword) {
    const passwordHash = await hashPassword(adminPassword);
    await client.query(`
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES ($1, $2, $3, $4, 'admin')
      ON CONFLICT (email) DO UPDATE
      SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = 'admin'
    `, [randomUUID(), adminName, adminEmail, passwordHash]);
  }

  await client.query("COMMIT");
  console.log(`Provider catalogue updated: ${removedDemoProviders} demo providers removed; ${insertedProviders} real providers upserted.`);
  if (!providersOnly) console.log(adminEmail
    ? `Admin account is ready for ${adminEmail}.`
    : "Admin seed skipped. Set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD, then rerun to create it.");
  if (generatedPassword) console.log(`One-time generated admin password: ${adminPassword}`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
