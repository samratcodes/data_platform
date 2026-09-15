import { randomUUID } from "node:crypto";
import { clearRateLimit, createSession, destroySession, getUser, hashPassword, rateLimited, verifyPassword } from "@/lib/auth";
import { database, query } from "@/lib/database";
import { appOrigin, consumeAuthToken, deliverQueuedEmail, queuePasswordChangedEmail, queueVerificationEmail, readAuthToken, sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import { enqueueUserSheetSync } from "@/lib/integrations";
import { isGoogleMapsUrl } from "@/lib/google-maps-place";
import { validatePassword } from "@/lib/password";
import { cleanMultiline, cleanSingleLine, readJsonObject, requestFingerprint, safeHttpsUrl } from "@/lib/security";
export const runtime = "nodejs";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const genericRecovery = "If an account exists for that email, we sent the next step.";
const companyModalities = new Set(["Egocentric video", "Exocentric video", "Speech", "Images"]);
const imageDataPattern = /^data:image\/(?:jpeg|png|webp);base64,([a-z0-9+/]+=*)$/i;

function companyImage(value: unknown) {
  if (typeof value !== "string" || value.length > 1_050_000) return null;
  const match = imageDataPattern.exec(value);
  if (!match) return null;
  try { return Buffer.from(match[1], "base64").length <= 750_000 ? value : null; } catch { return null; }
}

export async function GET(_request: Request, context: { params: Promise<{ action: string }> }) {
  if ((await context.params).action !== "session") return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ user: await getUser() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  if (!["login", "signup", "logout", "resend-verification", "verify-email", "forgot-password", "reset-password"].includes(action)) return Response.json({ error: "Not found" }, { status: 404 });
  const parsed = await readJsonObject(request, action === "logout" ? 1_024 : action === "signup" ? 4_500_000 : 8_192);
  if (parsed.response) {
    if (action === "forgot-password") console.log("[password-reset] Skipped: request body could not be parsed or exceeded the size limit.");
    return parsed.response;
  }
  if (action === "logout") { await destroySession(); return Response.json({ ok: true }); }
  if (action === "verify-email") {
    const token = cleanSingleLine(parsed.body.token, 160);
    const consumed = await consumeAuthToken(token, "email_verification");
    if (!consumed) return Response.json({ error: "This verification link is invalid or expired." }, { status: 400 });
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
    const refreshed = await getUser();
    return Response.json({ ok: true, user: refreshed });
  }
  if (action === "resend-verification") {
    const user = await getUser();
    if (!user) {
      console.log("[email-verification] Skipped resend: there is no authenticated user.");
      return Response.json({ error: "Please log in." }, { status: 401 });
    }
    console.log("[email-verification] Resend request received.", { userId: user.id, recipient: user.email });
    if (user.emailVerifiedAt || user.role === "admin") {
      console.log("[email-verification] Skipped resend: account is already verified or exempt.", { userId: user.id, role: user.role });
      return Response.json({ ok: true, verified: true });
    }
    if (await rateLimited(`verify-resend:${user.id}`, 3, 60 * 60_000)) {
      console.log("[email-verification] Skipped resend: rate limit reached.", { userId: user.id });
      return Response.json({ error: "Too many verification emails. Try again later." }, { status: 429, headers: { "Retry-After": "3600" } });
    }
    const delivery = await sendVerificationEmail(user, appOrigin(request));
    console.log("[email-verification] Resend delivery attempt completed.", { userId: user.id, sent: delivery.sent, pending: delivery.pending, outboxId: delivery.outboxId });
    if (!delivery.sent && !delivery.pending) return Response.json({ error: "The verification email could not be sent. Please try again." }, { status: 502 });
    return Response.json({ ok: true });
  }

  const body = parsed.body;
  if (action === "forgot-password") {
    const email = cleanSingleLine(body.email, 254).toLowerCase();
    console.log("[password-reset] Request received.", { email });
    try {
      if (!emailPattern.test(email)) {
        console.log("[password-reset] Skipped: invalid email syntax.", { email });
        return Response.json({ message: genericRecovery });
      }

      const clientKey = `password-reset-client:${requestFingerprint(request)}`;
      const emailKey = `password-reset:${email}`;
      const limited = await Promise.all([rateLimited(clientKey, 12, 60 * 60_000), rateLimited(emailKey, 3, 60 * 60_000)]);
      console.log("[password-reset] Rate-limit checks completed.", { email, clientLimited: limited[0], emailLimited: limited[1] });
      if (limited.some(Boolean)) {
        console.log("[password-reset] Skipped: rate limit reached.", { email });
        return Response.json({ message: genericRecovery });
      }

      console.log("[password-reset] Looking up the account.", { email });
      const user = (await query<{ id: string; name: string; email: string }>("SELECT id, name, email FROM users WHERE email = $1", [email])).rows[0];
      console.log("[password-reset] Account lookup completed.", { email, accountFound: Boolean(user) });
      if (!user) {
        console.log("[password-reset] Skipped: no matching account.", { email });
        return Response.json({ message: genericRecovery });
      }

      const delivery = await sendPasswordResetEmail(user, appOrigin(request));
      console.log("[password-reset] Delivery attempt completed.", { email, sent: delivery.sent, outboxId: delivery.outboxId });
    } catch (error) {
      console.error("[password-reset] Request failed before delivery completed.", error);
    }
    return Response.json({ message: genericRecovery });
  }
  if (action === "reset-password") {
    const token = cleanSingleLine(body.token, 160);
    const password = typeof body.password === "string" ? body.password.normalize("NFKC") : "";
    const confirmation = typeof body.confirmation === "string" ? body.confirmation.normalize("NFKC") : "";
    if (password !== confirmation) return Response.json({ error: "Passwords do not match." }, { status: 400 });
    const candidate = await readAuthToken(token, "password_reset");
    if (!candidate) return Response.json({ error: "This reset link is invalid or expired." }, { status: 400 });
    const passwordError = validatePassword(password, candidate.email);
    if (passwordError) return Response.json({ error: passwordError }, { status: 400 });
    if (await verifyPassword(password, candidate.password_hash)) return Response.json({ error: "Choose a password you have not just used." }, { status: 400 });
    const consumed = await consumeAuthToken(token, "password_reset");
    if (!consumed) return Response.json({ error: "This reset link is invalid or expired." }, { status: 400 });
    const hash = await hashPassword(password);
    const client = await database().connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2", [hash, consumed.user_id]);
      await client.query("DELETE FROM sessions WHERE user_id = $1", [consumed.user_id]);
      await queuePasswordChangedEmail({ id: consumed.user_id, email: consumed.email, name: consumed.name }, client);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    await createSession(consumed.user_id);
    const refreshed = await getUser();
    return Response.json({ ok: true, user: refreshed });
  }

  const signingUp = action === "signup";
  const email = cleanSingleLine(body.email, 254).toLowerCase();
  const password = typeof body.password === "string" ? body.password.normalize("NFKC") : "";
  const name = cleanSingleLine(body.name, 80);
  if (!emailPattern.test(email) || password.length < (signingUp ? 12 : 1) || password.length > 128 || (signingUp && (name.length < 2 || String(body.name || "").length > 80))) {
    return Response.json({ error: signingUp ? "Enter a valid email, your name, and a 12–128 character password." : "Email or password is incorrect." }, { status: signingUp ? 400 : 401 });
  }
  const accountKey = `account:${email}`;
  const clientKey = `client:${requestFingerprint(request)}`;
  const [accountLimited, clientLimited] = await Promise.all([rateLimited(accountKey, 8, 15 * 60_000), rateLimited(clientKey, 30, 15 * 60_000)]);
  if (accountLimited || clientLimited) return Response.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429, headers: { "Retry-After": "900" } });
  if (signingUp) {
    const passwordError = validatePassword(password, email);
    if (passwordError) return Response.json({ error: passwordError }, { status: 400 });
    const role = body.role === "supplier" ? "supplier" : "buyer";
    if (role === "supplier" && /@(gmail|yahoo|hotmail|outlook|icloud|aol|protonmail|proton)\./i.test(email)) return Response.json({ error: "Suppliers must use a business email address." }, { status: 400 });
    const companyRegistration = role === "supplier" && body.companyApplication === true;
    const company = companyRegistration ? {
      businessName: cleanSingleLine(body.businessName, 120),
      description: cleanMultiline(body.description, 3_000),
      website: safeHttpsUrl(body.websiteUrl),
      mapsUrl: safeHttpsUrl(body.mapsUrl),
      address: cleanSingleLine(body.physicalAddress, 240),
      city: cleanSingleLine(body.city, 100),
      country: cleanSingleLine(body.country, 100),
      longitude: Number(body.longitude),
      latitude: Number(body.latitude),
      modalities: Array.isArray(body.modalities) ? body.modalities.filter((item): item is string => typeof item === "string" && companyModalities.has(item)).slice(0, 4) : [],
      pictures: Array.isArray(body.hardwarePictures) ? body.hardwarePictures.slice(0, 4).map(companyImage).filter((item): item is string => Boolean(item)) : [],
    } : null;
    if (company && (!company.website || !company.mapsUrl || !isGoogleMapsUrl(company.mapsUrl) || company.businessName.length < 2 || company.description.length < 20 || company.address.length < 5 || company.city.length < 2 || company.country.length < 2 || !Number.isFinite(company.longitude) || !Number.isFinite(company.latitude) || company.longitude < -180 || company.longitude > 180 || company.latitude < -90 || company.latitude > 90 || company.modalities.length === 0)) {
      return Response.json({ error: "Complete the company verification fields, including a Google Maps location and at least one data capability." }, { status: 400 });
    }
    const id = randomUUID();
    const hash = await hashPassword(password);
    const client = await database().connect();
    let created = false;
    let verificationOutboxId: string | null = null;
    try {
      await client.query("BEGIN");
      const result = await client.query(`
        WITH created_user AS (
          INSERT INTO users (id, name, email, password_hash, role)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT(email) DO NOTHING
          RETURNING id
        )
        INSERT INTO integration_outbox (id, event_type, entity_id)
        SELECT $6, 'user.sheet.upsert', id FROM created_user
        RETURNING entity_id
      `, [id, name, email, hash, role, randomUUID()]);
      created = Boolean(result.rowCount);
      if (created && company) {
        await client.query(`
          INSERT INTO supplier_applications (
            id, user_id, application_kind, business_name, maps_url, physical_address, city, country,
            longitude, latitude, hardware_pictures, provider_type, modalities, profile_description, website_url
          ) VALUES ($1,$2,'company',$3,$4,$5,$6,$7,$8,$9,$10::jsonb,'Data Company',$11::jsonb,$12,$13)
        `, [randomUUID(), id, company.businessName, company.mapsUrl, company.address, company.city, company.country, company.longitude, company.latitude, JSON.stringify(company.pictures), JSON.stringify(company.modalities), company.description, company.website]);
      }
      if (created) verificationOutboxId = await queueVerificationEmail({ id, name, email }, appOrigin(request), client);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    if (!created) return Response.json({ error: "Unable to create this account. Try logging in or use another work email." }, { status: 409 });
    if (verificationOutboxId) {
      console.log("[email-verification] Signup transaction committed; starting verification email delivery.", { userId: id, recipient: email, outboxId: verificationOutboxId });
      const delivery = await deliverQueuedEmail(verificationOutboxId);
      console.log("[email-verification] Signup delivery attempt completed.", { userId: id, sent: delivery.sent, pending: delivery.pending, outboxId: delivery.outboxId });
    }
    await createSession(id);
    await clearRateLimit(accountKey);
    return Response.json({ user: { id, name, email, role, emailVerifiedAt: null } }, { status: 201 });
  }
  const user = (await query<{ id: string; name: string; email: string; password_hash: string; role: "buyer" | "supplier" | "admin"; emailVerifiedAt: string | null }>('SELECT id, name, email, password_hash, role, email_verified_at AS "emailVerifiedAt" FROM users WHERE email = $1', [email])).rows[0];
  const valid = await verifyPassword(password, user?.password_hash ?? `scrypt$32768$8$1$${"0".repeat(32)}$${"0".repeat(128)}`);
  if (!user || !valid) return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
  await createSession(user.id);
  await clearRateLimit(accountKey);
  return Response.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, emailVerifiedAt: user.emailVerifiedAt } });
}
