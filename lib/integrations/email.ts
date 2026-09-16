import { createHash, randomBytes, randomUUID } from "node:crypto";
import "server-only";
import type { PoolClient } from "pg";
import { Resend } from "resend";
import { query } from "@/lib/db/client";

type EmailPurpose = "email_verification" | "password_reset" | "password_changed";
type TokenPurpose = "email_verification" | "password_reset";

const tokenDigest = (value: string) => createHash("sha256").update(value).digest("hex");
const runQuery = (client: PoolClient | undefined, text: string, values: unknown[]) => client ? client.query(text, values) : query(text, values);

export function appOrigin(request: Request) {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return new URL(request.url).origin;
}

async function createAuthToken(userId: string, purpose: TokenPurpose, ttlMinutes: number, client?: PoolClient) {
  const token = randomBytes(32).toString("base64url");
  await runQuery(client, `
    WITH revoked AS (
      UPDATE auth_tokens SET consumed_at = NOW()
      WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL
    )
    INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at)
    VALUES ($3, $1, $2, $4, NOW() + ($5 || ' minutes')::interval)
  `, [userId, purpose, randomUUID(), tokenDigest(token), ttlMinutes]);
  return token;
}

async function enqueueEmail(
  userId: string | null,
  recipientEmail: string,
  purpose: EmailPurpose,
  subject: string,
  bodyText: string,
  client?: PoolClient,
) {
  const id = randomUUID();
  await runQuery(client, `
    INSERT INTO email_outbox (id, user_id, recipient_email, purpose, subject, body_text)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [id, userId, recipientEmail, purpose, subject, bodyText]);
  return id;
}

export async function queueVerificationEmail(user: { id: string; email: string; name: string }, origin: string, client?: PoolClient) {
  const token = await createAuthToken(user.id, "email_verification", 60 * 24, client);
  const link = `${origin}/verify-email/confirm?token=${encodeURIComponent(token)}`;
  return enqueueEmail(
    user.id,
    user.email,
    "email_verification",
    "Verify your map.filemarket email",
    `Hi ${user.name},\n\nVerify your map.filemarket account:\n${link}\n\nThis link expires in 24 hours.`,
    client,
  );
}

type QueuedEmail = {
  id: string;
  recipient_email: string;
  purpose: EmailPurpose;
  subject: string;
  body_text: string;
};

const deliveryLabel = (purpose: EmailPurpose) => purpose.replaceAll("_", "-");

async function recordDeliveryFailure(outboxId: string, error: unknown) {
  const detail = error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error);
  try {
    await query(
      "UPDATE email_outbox SET status = 'failed', last_error = $1, available_at = NOW() + INTERVAL '2 minutes' WHERE id = $2",
      [(detail || "Unknown email delivery error").slice(0, 500), outboxId],
    );
  } catch (databaseError) {
    console.error("[email-delivery] Could not record the delivery failure in PostgreSQL.", { outboxId, databaseError });
  }
}

export async function deliverQueuedEmail(outboxId: string) {
  let label = "email-delivery";

  try {
    const claimed = await query<QueuedEmail>(`
      UPDATE email_outbox
      SET status = 'processing', attempts = attempts + 1, available_at = NOW() + INTERVAL '15 minutes'
      WHERE id = $1 AND status IN ('queued', 'failed')
      RETURNING id, recipient_email, purpose, subject, body_text
    `, [outboxId]);
    const message = claimed.rows[0];

    if (!message) {
      const existing = await query<{ status: string; provider_message_id: string | null }>(
        "SELECT status, provider_message_id FROM email_outbox WHERE id = $1",
        [outboxId],
      );
      const current = existing.rows[0];
      console.log("[email-delivery] Skipped SDK call because this outbox message was already claimed.", { outboxId, status: current?.status ?? "missing" });
      return { sent: current?.status === "sent", pending: current?.status === "processing", outboxId, data: current?.provider_message_id ? { id: current.provider_message_id } : null };
    }

    label = deliveryLabel(message.purpose);
    const from = process.env.EMAIL_FROM?.trim();
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const replyTo = process.env.EMAIL_REPLY_TO?.trim();

    if (process.env.EMAIL_PROVIDER?.trim().toLowerCase() !== "resend") throw new Error("EMAIL_PROVIDER must be set to resend.");
    if (!apiKey) throw new Error("RESEND_API_KEY is missing.");
    if (!from) throw new Error("EMAIL_FROM is missing.");

    const resend = new Resend(apiKey);
    console.log(`[${label}] About to call resend.emails.send().`, { outboxId, recipient: message.recipient_email, from });
    const { data, error } = await resend.emails.send({
      from,
      to: [message.recipient_email],
      subject: message.subject,
      text: message.body_text,
      ...(replyTo ? { replyTo } : {}),
    }, {
      idempotencyKey: `${label}/${outboxId}`,
    });
    console.log(`[${label}] resend.emails.send() resolved.`, { outboxId, data, error });

    if (error) {
      console.error(`[${label}] Resend returned an error.`, error);
      await recordDeliveryFailure(outboxId, error);
      return { sent: false, pending: false, outboxId, error };
    }
    if (!data?.id) {
      const error = new Error("Resend returned no error and no email ID.");
      console.error(`[${label}] Invalid Resend response.`, error);
      await recordDeliveryFailure(outboxId, error);
      return { sent: false, pending: false, outboxId, error };
    }

    await query(
      "UPDATE email_outbox SET status = 'sent', provider_message_id = $1, last_error = NULL, sent_at = NOW() WHERE id = $2",
      [data.id, outboxId],
    );
    console.log(`[${label}] Resend accepted the email.`, { outboxId, resendEmailId: data.id });
    return { sent: true, pending: false, outboxId, data };
  } catch (error) {
    console.error(`[${label}] Failed before or during resend.emails.send().`, error);
    await recordDeliveryFailure(outboxId, error);
    return { sent: false, pending: false, outboxId, error };
  }
}

export async function sendVerificationEmail(user: { id: string; email: string; name: string }, origin: string) {
  const outboxId = await queueVerificationEmail(user, origin);
  console.log("[email-verification] Verification email queued in PostgreSQL.", { outboxId, recipient: user.email });
  return deliverQueuedEmail(outboxId);
}

export async function sendPasswordResetEmail(user: { id: string; email: string; name: string }, origin: string) {
  const token = await createAuthToken(user.id, "password_reset", 60);
  const link = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = "Reset your map.filemarket password";
  const bodyText = `Hi ${user.name},\n\nReset your map.filemarket password:\n${link}\n\nThis link expires in 60 minutes. Ignore this email if you did not request it.`;
  const outboxId = await enqueueEmail(user.id, user.email, "password_reset", subject, bodyText);
  console.log("[password-reset] Reset email queued in PostgreSQL.", { outboxId, recipient: user.email });
  return deliverQueuedEmail(outboxId);
}

export async function queuePasswordChangedEmail(user: { id: string; email: string; name: string }, client?: PoolClient) {
  await enqueueEmail(
    user.id,
    user.email,
    "password_changed",
    "Your map.filemarket password changed",
    `Hi ${user.name},\n\nYour map.filemarket password was changed. If this was not you, contact map.filemarket support immediately.`,
    client,
  );
}

export async function consumeAuthToken(token: string, purpose: TokenPurpose) {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return null;
  const result = await query<{ user_id: string; email: string; name: string }>(`
    UPDATE auth_tokens
    SET consumed_at = NOW(), attempts = attempts + 1
    FROM users
    WHERE auth_tokens.user_id = users.id
      AND auth_tokens.token_hash = $1
      AND auth_tokens.purpose = $2
      AND auth_tokens.consumed_at IS NULL
      AND auth_tokens.expires_at > NOW()
    RETURNING users.id AS user_id, users.email, users.name
  `, [tokenDigest(token), purpose]);
  return result.rows[0] ?? null;
}


export async function readAuthToken(token: string, purpose: TokenPurpose) {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return null;
  const result = await query<{ user_id: string; email: string; name: string; password_hash: string }>(`
    SELECT users.id AS user_id, users.email, users.name, users.password_hash
    FROM auth_tokens
    JOIN users ON users.id = auth_tokens.user_id
    WHERE auth_tokens.token_hash = $1
      AND auth_tokens.purpose = $2
      AND auth_tokens.consumed_at IS NULL
      AND auth_tokens.expires_at > NOW()
  `, [tokenDigest(token), purpose]);
  return result.rows[0] ?? null;
}
