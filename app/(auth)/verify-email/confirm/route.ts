import { redirect } from "next/navigation";
import { homePathFor, type UserRole } from "@/lib/auth/roles";
import { createSession } from "@/lib/auth/session";
import { database, query } from "@/lib/db/client";
import { consumeAuthToken } from "@/lib/integrations/email";
import { enqueueUserSheetSync } from "@/lib/integrations/sheet-sync-queue";
import { cleanSingleLine } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = cleanSingleLine(new URL(request.url).searchParams.get("token"), 160);
  const consumed = await consumeAuthToken(token, "email_verification");
  if (!consumed) redirect("/verify-email?status=invalid");
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = $1", [consumed.user_id]);
    await enqueueUserSheetSync(consumed.user_id, client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  await createSession(consumed.user_id);
  const { rows } = await query<{ role: UserRole }>("SELECT role FROM users WHERE id = $1", [consumed.user_id]);
  redirect(rows[0] ? homePathFor(rows[0].role) : "/map");
}
