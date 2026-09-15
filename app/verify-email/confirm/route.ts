import { redirect } from "next/navigation";
import { createSession, getUser } from "@/lib/auth";
import { database } from "@/lib/database";
import { consumeAuthToken } from "@/lib/email";
import { enqueueUserSheetSync } from "@/lib/integrations";
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
  const user = await getUser();
  redirect(user?.role === "supplier" ? "/supplier" : user?.role === "admin" ? "/admin" : "/map");
}
