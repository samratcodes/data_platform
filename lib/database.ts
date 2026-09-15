import { Pool, type QueryResultRow } from "pg";

const globalDatabase = globalThis as unknown as { filemarketPool?: Pool; filemarketUnverifiedTls?: boolean };

function connectionString() {
  const value = process.env.DATABASE_URL || process.env.database;
  if (!value) throw new Error("Set database or DATABASE_URL to a PostgreSQL connection URL.");
  const url = new URL(value);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("uselibpqcompat");
  return url.toString();
}

export function database() {
  if (!globalDatabase.filemarketPool) {
    const url = connectionString();
    const local = /localhost|127\.0\.0\.1/.test(url);
    globalDatabase.filemarketPool = new Pool({
      connectionString: url,
      // Serverless and development workers can each create a pool; keep the
      // default deliberately small so they do not exhaust managed PostgreSQL
      // connection limits during bursts of map and authentication requests.
      max: Number(process.env.DATABASE_POOL_MAX || 4),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
      ssl: local ? undefined : { rejectUnauthorized: !globalDatabase.filemarketUnverifiedTls && process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" },
    });
  }
  return globalDatabase.filemarketPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await database().query<T>(text, values);
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      const message = error instanceof Error ? error.message : "";
      const certificateChainFailure = ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "SELF_SIGNED_CERT_IN_CHAIN", "DEPTH_ZERO_SELF_SIGNED_CERT"].includes(code);
      if (certificateChainFailure && process.env.NODE_ENV !== "production" && !globalDatabase.filemarketUnverifiedTls) {
        // A hot-reloaded local dev pool may have opened before .env disabled verification.
        // Recreate the hot-reloaded dev pool, which may have been opened before .env changed.
        globalDatabase.filemarketUnverifiedTls = true;
        const stalePool = globalDatabase.filemarketPool;
        globalDatabase.filemarketPool = undefined;
        await stalePool?.end().catch(() => undefined);
        continue;
      }
      const retryable = ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN"].includes(code) || /timeout exceeded when trying to connect/i.test(message);
      if (!retryable || attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
  throw new Error("Database query retry limit reached.");
}
