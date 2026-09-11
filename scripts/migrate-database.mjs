import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const configuredUrl = process.env.DATABASE_URL || process.env.database;
if (!configuredUrl) throw new Error("Set database or DATABASE_URL before running the migration.");
const parsedUrl = new URL(configuredUrl);
parsedUrl.searchParams.delete("sslmode");
parsedUrl.searchParams.delete("uselibpqcompat");
const connectionString = parsedUrl.toString();

const local = /localhost|127\.0\.0\.1/.test(connectionString);
const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";
const pool = new pg.Pool({
  connectionString,
  ssl: local ? undefined : { rejectUnauthorized },
});

try {
  const sql = await readFile(resolve("database/schema.sql"), "utf8");
  await pool.query(sql);
  console.log("FileMarket database schema is ready.");
} finally {
  await pool.end();
}
