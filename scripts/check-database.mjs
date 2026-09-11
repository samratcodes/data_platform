import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const configuredUrl = process.env.DATABASE_URL || process.env.database;
if (!configuredUrl) throw new Error("Set database or DATABASE_URL.");
const parsedUrl = new URL(configuredUrl);
parsedUrl.searchParams.delete("sslmode");
parsedUrl.searchParams.delete("uselibpqcompat");
const connectionString = parsedUrl.toString();

const local = /localhost|127\.0\.0\.1/.test(connectionString);
const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";
const pool = new pg.Pool({
  connectionString,
  ssl: local ? undefined : { rejectUnauthorized },
  connectionTimeoutMillis: 10_000,
});
const required = [
  "users", "sessions", "auth_attempts", "auth_tokens", "email_outbox", "providers", "supplier_applications",
  "saved_operators", "access_requests", "conversations", "messages", "concierge_requests",
  "integration_outbox", "admin_audit_logs",
];

try {
  const result = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)",
    [required],
  );
  const found = new Set(result.rows.map((row) => row.table_name));
  const missing = required.filter((name) => !found.has(name));
  console.log(missing.length ? `Missing tables: ${missing.join(", ")}` : "All required tables exist.");
  if (!missing.length) {
    const [counts, emailColumns, supplierColumns] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM providers WHERE status = 'approved') AS providers,
          (SELECT COUNT(*)::int FROM providers WHERE status = 'approved' AND is_demo = FALSE) AS real_providers,
          (SELECT COUNT(*)::int FROM providers WHERE status = 'approved' AND is_demo = TRUE) AS demo_providers,
          (SELECT COUNT(*)::int FROM users WHERE role = 'admin') AS admins
      `),
      pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'email_outbox'
          AND column_name = ANY($1)
      `, [["attempts", "available_at"]]),
      pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'supplier_applications'
          AND column_name = ANY($1)
      `, [["application_kind", "profile_description", "capacity", "capture_environments", "provider_slug", "sample_file_name", "sample_mime_type", "sample_size_bytes", "sample_data"]]),
    ]);
    console.log(`Approved providers: ${counts.rows[0].providers} (${counts.rows[0].real_providers} real, ${counts.rows[0].demo_providers} landing demos). Admin accounts: ${counts.rows[0].admins}.`);
    const foundEmailColumns = new Set(emailColumns.rows.map((row) => row.column_name));
    const missingEmailColumns = ["attempts", "available_at"].filter((name) => !foundEmailColumns.has(name));
    if (missingEmailColumns.length) throw new Error(`Missing email queue columns: ${missingEmailColumns.join(", ")}.`);
    console.log("Email delivery queue is ready.");
    const requiredSupplierColumns = ["application_kind", "profile_description", "capacity", "capture_environments", "provider_slug", "sample_file_name", "sample_mime_type", "sample_size_bytes", "sample_data"];
    const foundSupplierColumns = new Set(supplierColumns.rows.map((row) => row.column_name));
    const missingSupplierColumns = requiredSupplierColumns.filter((name) => !foundSupplierColumns.has(name));
    if (missingSupplierColumns.length) throw new Error(`Missing supplier verification columns: ${missingSupplierColumns.join(", ")}.`);
    console.log("Staged supplier verification schema is ready.");
  }
} finally {
  await pool.end();
}
