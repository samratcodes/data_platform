import "server-only";

import { query } from "@/lib/db/client";
import { digest } from "./session";

/** Counts an attempt for `key` and reports whether it is over `limit` within the window. */
export async function rateLimited(key: string, limit = 12, windowMs = 900_000) {
  const now = Date.now();
  const result = await query<{ attempts: number }>(`
    INSERT INTO auth_attempts (key, attempts, reset_at) VALUES ($1, 1, $2)
    ON CONFLICT(key) DO UPDATE SET
      attempts = CASE WHEN auth_attempts.reset_at < $3 THEN 1 ELSE auth_attempts.attempts + 1 END,
      reset_at = CASE WHEN auth_attempts.reset_at < $3 THEN $2 ELSE auth_attempts.reset_at END
    RETURNING attempts
  `, [digest(key), now + windowMs, now]);
  return result.rows[0].attempts > limit;
}

export async function clearRateLimit(key: string) {
  await query("DELETE FROM auth_attempts WHERE key = $1", [digest(key)]);
}
