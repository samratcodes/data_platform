import { createSession, destroySession, getUser, hashPassword, rateLimited, verifyPassword } from "@/lib/auth";
import { database, query } from "@/lib/database";
import { queuePasswordChangedEmail } from "@/lib/email";
import { enqueueUserSheetSync } from "@/lib/integrations";
import { validatePassword } from "@/lib/password";
import { cleanSingleLine, readJsonObject } from "@/lib/security";

export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Please log in." }, { status: 401 });
  const parsed = await readJsonObject(request, 8_192);
  if (parsed.response) return parsed.response;
  if (await rateLimited(`account:${user.id}`, 20, 60 * 60_000)) return Response.json({ error: "Too many account changes. Try again later." }, { status: 429 });
  const body = parsed.body;

  if (body.action === "profile") {
    const name = cleanSingleLine(body.name, 80);
    if (typeof body.name !== "string" || body.name.length > 80 || name.length < 2) return Response.json({ error: "Enter a name between 2 and 80 characters." }, { status: 400 });
    const client = await database().connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE users SET name = $1 WHERE id = $2", [name, user.id]);
      await enqueueUserSheetSync(user.id, client);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return Response.json({ user: { ...user, name } });
  }

  if (body.action === "password") {
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword.normalize("NFKC") : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword.normalize("NFKC") : "";
    const confirmation = typeof body.confirmation === "string" ? body.confirmation.normalize("NFKC") : "";
    if (newPassword !== confirmation) return Response.json({ error: "New passwords do not match." }, { status: 400 });
    const passwordError = validatePassword(newPassword, user.email);
    if (passwordError) return Response.json({ error: passwordError }, { status: 400 });
    const result = await query<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [user.id]);
    if (!await verifyPassword(currentPassword, result.rows[0]?.password_hash || "")) return Response.json({ error: "Current password is incorrect." }, { status: 400 });
    if (await verifyPassword(newPassword, result.rows[0].password_hash)) return Response.json({ error: "Choose a password you have not just used." }, { status: 400 });
    const passwordHash = await hashPassword(newPassword);
    const client = await database().connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2", [passwordHash, user.id]);
      await client.query("DELETE FROM sessions WHERE user_id = $1", [user.id]);
      await queuePasswordChangedEmail(user, client);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    await createSession(user.id);
    return Response.json({ ok: true });
  }

  if (body.action === "logout-all") {
    await query("DELETE FROM sessions WHERE user_id = $1", [user.id]);
    await destroySession();
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unknown account action." }, { status: 400 });
}
