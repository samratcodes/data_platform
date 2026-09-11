import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const configuredUrl = process.env.DATABASE_URL || process.env.database;
if (!configuredUrl) throw new Error("Set database or DATABASE_URL before running maintenance.");
const parsedUrl = new URL(configuredUrl);
parsedUrl.searchParams.delete("sslmode");
parsedUrl.searchParams.delete("uselibpqcompat");
const connectionString = parsedUrl.toString();
const local = /localhost|127\.0\.0\.1/.test(connectionString);
const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";
const pool = new pg.Pool({ connectionString, ssl: local ? undefined : { rejectUnauthorized } });

try {
  const [sessions, attempts, tokens, integrationOutbox, emailOutbox] = await Promise.all([
    pool.query("DELETE FROM sessions WHERE expires_at < $1", [Date.now()]),
    pool.query("DELETE FROM auth_attempts WHERE reset_at < $1", [Date.now()]),
    pool.query("DELETE FROM auth_tokens WHERE expires_at < NOW() - INTERVAL '7 days' OR consumed_at < NOW() - INTERVAL '7 days'"),
    pool.query("DELETE FROM integration_outbox WHERE status = 'completed' AND processed_at < NOW() - INTERVAL '30 days'"),
    pool.query("DELETE FROM email_outbox WHERE status IN ('sent', 'failed') AND created_at < NOW() - INTERVAL '30 days'"),
  ]);
  console.log(`Database maintenance complete: ${sessions.rowCount ?? 0} sessions, ${attempts.rowCount ?? 0} rate-limit rows, ${tokens.rowCount ?? 0} auth tokens, ${integrationOutbox.rowCount ?? 0} completed integration jobs, and ${emailOutbox.rowCount ?? 0} email records removed.`);
} finally {
  await pool.end();
}
