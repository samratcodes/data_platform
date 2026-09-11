import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
const apiKey = process.env.RESEND_API_KEY?.trim();
const from = process.env.EMAIL_FROM?.trim();
if (provider !== "resend") throw new Error("Set EMAIL_PROVIDER=resend before sending queued email.");
if (!apiKey || !from) throw new Error("Set RESEND_API_KEY and EMAIL_FROM before sending queued email.");

const configuredUrl = process.env.DATABASE_URL || process.env.database;
if (!configuredUrl) throw new Error("Set database or DATABASE_URL before sending queued email.");
const parsedUrl = new URL(configuredUrl);
parsedUrl.searchParams.delete("sslmode");
parsedUrl.searchParams.delete("uselibpqcompat");
const connectionString = parsedUrl.toString();
const local = /localhost|127\.0\.0\.1/.test(connectionString);
const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";
const pool = new pg.Pool({ connectionString, ssl: local ? undefined : { rejectUnauthorized } });

async function deliver(message) {
  const payload = {
    from,
    to: [message.recipient_email],
    subject: message.subject,
    text: message.body_text,
  };
  if (process.env.EMAIL_REPLY_TO?.trim()) payload.reply_to = process.env.EMAIL_REPLY_TO.trim();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `filemarket-email-${message.id}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(result.message || `Email provider returned ${response.status}`).slice(0, 500));
  if (!result.id) throw new Error("Email provider did not return a message ID.");
  return result.id;
}

try {
  const jobs = await pool.query(`
    UPDATE email_outbox
    SET status = 'processing', attempts = attempts + 1, available_at = NOW() + INTERVAL '15 minutes'
    WHERE id IN (
      SELECT id FROM email_outbox
      WHERE status IN ('queued', 'failed', 'processing') AND available_at <= NOW()
      ORDER BY created_at
      LIMIT 100
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, recipient_email, subject, body_text, attempts
  `);

  let sent = 0;
  let failed = 0;
  for (const message of jobs.rows) {
    try {
      const messageId = await deliver(message);
      await pool.query("UPDATE email_outbox SET status = 'sent', provider_message_id = $1, last_error = NULL, sent_at = NOW() WHERE id = $2", [messageId, message.id]);
      sent += 1;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown email delivery error";
      const delayMinutes = Math.min(24 * 60, 2 ** Math.min(Number(message.attempts), 10));
      await pool.query("UPDATE email_outbox SET status = 'failed', last_error = $1, available_at = NOW() + ($2 * INTERVAL '1 minute') WHERE id = $3", [detail.slice(0, 500), delayMinutes, message.id]);
      failed += 1;
    }
  }
  console.log(`Email delivery complete: ${sent} sent, ${failed} failed, ${jobs.rowCount ?? 0} claimed.`);
  if (failed) process.exitCode = 1;
} finally {
  await pool.end();
}
