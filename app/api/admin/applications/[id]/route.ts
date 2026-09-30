import { randomUUID } from "node:crypto";
import { rateLimited } from "@/lib/auth/rate-limit";
import { database, query } from "@/lib/db/client";
import { enqueueUserSheetSync } from "@/lib/integrations/sheet-sync-queue";
import { appOrigin, deliverQueuedEmail, queueApplicationDecisionEmail } from "@/lib/integrations/email";
import { listingSlug, publishListing, type ListingApplication } from "@/lib/admin/listing";
import { adminRequired, adminUser, listAuditEntries, privateJson } from "@/lib/admin/queries";
import { cleanMultiline, cleanSingleLine, isUuid, readJsonObject } from "@/lib/security";
import type { ApplicationDetail } from "@/types/admin";

const levels = new Set(["unverified", "online", "physical", "incomplete"]);
const statuses = new Set(["pending", "approved", "rejected"]);
const notFound = () => Response.json({ error: "Application not found." }, { status: 404 });

export async function GET(_request: Request, context: RouteContext<"/api/admin/applications/[id]">) {
  if (!await adminUser()) return adminRequired();
  const { id } = await context.params;
  if (!isUuid(id)) return notFound();
  const row = (await query<{ application: Omit<ApplicationDetail, "company" | "facilities">; company: ApplicationDetail["company"]; facilities: ApplicationDetail["facilities"] }>(`
    SELECT (to_jsonb(applications) - 'sample_data')
             || jsonb_build_object(
               'has_sample', applications.sample_data IS NOT NULL,
               'applicant_name', users.name,
               'applicant_email', users.email,
               'applicant_email_verified_at', users.email_verified_at,
               'applicant_joined_at', users.created_at
             ) AS application,
           (SELECT jsonb_build_object('id', company.id, 'business_name', company.business_name, 'status', company.status)
              FROM supplier_applications company
              WHERE company.user_id = applications.user_id AND company.application_kind = 'company' AND company.id <> applications.id
              ORDER BY company.submitted_at DESC LIMIT 1) AS company,
           COALESCE((SELECT jsonb_agg(jsonb_build_object('id', facility.id, 'business_name', facility.business_name, 'city', facility.city, 'country', facility.country, 'status', facility.status) ORDER BY facility.submitted_at DESC)
              FROM supplier_applications facility
              WHERE facility.user_id = applications.user_id AND facility.application_kind = 'facility' AND facility.id <> applications.id), '[]'::jsonb) AS facilities
    FROM supplier_applications applications
    JOIN users ON users.id = applications.user_id
    WHERE applications.id = $1 AND users.email_verified_at IS NOT NULL
  `, [id])).rows[0];
  if (!row) return notFound();
  const history = await listAuditEntries({ targetId: id, limit: 100 });
  return privateJson({ application: { ...row.application, company: row.company, facilities: row.facilities }, history });
}

export async function PATCH(request: Request, context: RouteContext<"/api/admin/applications/[id]">) {
  const user = await adminUser();
  if (!user) return adminRequired();
  const { id } = await context.params;
  if (!isUuid(id)) return notFound();
  const parsed = await readJsonObject(request, 8_192);
  if (parsed.response) return parsed.response;
  const body = parsed.body;
  if (await rateLimited(`admin-review:${user.id}`, 120, 15 * 60_000)) return Response.json({ error: "Review update limit reached. Try again shortly." }, { status: 429 });
  const status = cleanSingleLine(body.status, 20);
  const level = cleanSingleLine(body.verificationLevel, 20);
  const notes = cleanMultiline(body.notes, 4_000);
  if (!statuses.has(status) || !levels.has(level) || String(body.notes || "").length > 4_000) return Response.json({ error: "Invalid review decision." }, { status: 400 });
  if (status === "approved" && level === "unverified") return Response.json({ error: "Approval requires online or physical verification, or publishing as incomplete." }, { status: 400 });
  if (status !== "approved" && level === "incomplete") return Response.json({ error: "Only an approved listing can be incomplete." }, { status: 400 });

  let decision: { applicant: { id: string; email: string; name: string }; kind: "company" | "facility"; businessName: string } | null = null;
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const application = (await client.query<ListingApplication>("SELECT * FROM supplier_applications WHERE id = $1 FOR UPDATE", [id])).rows[0];
    if (!application) {
      await client.query("ROLLBACK");
      return notFound();
    }
    const applicant = (await client.query<{ id: string; email: string; name: string }>("SELECT id, email, name FROM users WHERE id = $1 AND email_verified_at IS NOT NULL", [application.user_id])).rows[0];
    if (!applicant) {
      await client.query("ROLLBACK");
      return Response.json({ error: "This supplier must verify their email before their application can be reviewed." }, { status: 422 });
    }
    await client.query("UPDATE supplier_applications SET status = $1, verification_level = $2, admin_notes = $3, reviewed_at = NOW() WHERE id = $4", [status, level, notes, id]);
    if (status === "approved") {
      const problem = await publishListing(client, application, level);
      if (problem) {
        await client.query("ROLLBACK");
        return Response.json({ error: problem }, { status: 422 });
      }
    } else await client.query("UPDATE providers SET status = $1, verification_level = $2, updated_at = NOW() WHERE slug = $3", [status, level, listingSlug(application)]);
    await enqueueUserSheetSync(application.user_id, client);
    await client.query(`
      INSERT INTO admin_audit_logs (id, admin_user_id, action, target_type, target_id, metadata)
      VALUES ($1, $2, $3, 'supplier_application', $4, $5::jsonb)
    `, [randomUUID(), user.id, `application.${status}`, id, JSON.stringify({ applicationKind: application.application_kind, verificationLevel: level, notes })]);
    await client.query("COMMIT");
    decision = { applicant, kind: application.application_kind, businessName: application.business_name };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  // The supplier hears about every approval or rejection, with the admin's notes in the email.
  // Email is best-effort: the decision is already saved, and a queued email is retried by the outbox job.
  let emailSent: boolean | null = null;
  if (decision && status !== "pending") {
    try {
      const outboxId = await queueApplicationDecisionEmail(decision.applicant, { kind: decision.kind, businessName: decision.businessName, status: status as "approved" | "rejected", notes, incomplete: level === "incomplete" }, appOrigin(request));
      emailSent = (await deliverQueuedEmail(outboxId)).sent;
    } catch (error) {
      console.error("[application-decision] Could not queue the decision email.", { applicationId: id, error });
      emailSent = false;
    }
  }
  return Response.json({ ok: true, emailSent });
}
