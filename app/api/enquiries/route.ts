import { randomUUID } from "node:crypto";
import { emailVerificationRequired, getUser, isEmailVerified } from "@/lib/auth/session";
import { rateLimited } from "@/lib/auth/rate-limit";
import { query } from "@/lib/db/client";
import { parseEnquiry } from "@/lib/devices";
import { liveProduct, sentEnquiries } from "@/lib/data/products";
import { appOrigin, deliverQueuedEmail, queueProductEnquiryEmail } from "@/lib/integrations/email";
import { requireDeviceSupplier } from "@/lib/supplier/device-store";
import { isUuid, readJsonObject } from "@/lib/security";

/** Lists the viewer's own enquiries, so product cards and the data-company dashboard can show them. */
export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ error: "Please log in." }, { status: 401 });
  return Response.json({ enquiries: await sentEnquiries(user.id) }, { headers: { "Cache-Control": "private, no-store" } });
}

/**
 * Sends an enquiry about a product to the device company that sells it: saves it in the store's
 * pipeline (one per sender and product, refreshed when sent again), posts it to the product's
 * chat thread so the store can reply there, and emails the store.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Please log in." }, { status: 401 });
  if (!isEmailVerified(user)) return emailVerificationRequired();
  const parsed = await readJsonObject(request, 8_192);
  if (parsed.response) return parsed.response;
  const result = parseEnquiry(parsed.body);
  if (result.error !== undefined) return Response.json({ error: result.error }, { status: 400 });
  const { enquiry } = result;
  if (await rateLimited(`enquiries:${user.id}`, 30, 60 * 60_000)) return Response.json({ error: "Enquiry limit reached. Try again later." }, { status: 429 });

  const found = await liveProduct(enquiry.productId);
  if (!found) return Response.json({ error: "This product is no longer available." }, { status: 404 });
  if (found.ownerId === user.id) return Response.json({ error: "You cannot send an enquiry about your own product." }, { status: 400 });

  const existing = (await query<{ id: string }>("SELECT id FROM product_enquiries WHERE product_id = $1 AND user_id = $2 ORDER BY created_at LIMIT 1", [found.product.id, user.id])).rows[0];
  const enquiryId = existing?.id ?? randomUUID();
  if (existing) {
    await query("UPDATE product_enquiries SET quantity = $1, timeline = $2, message = $3, status = 'new', updated_at = NOW() WHERE id = $4", [enquiry.quantity, enquiry.timeline, enquiry.message, enquiryId]);
  } else {
    await query("INSERT INTO product_enquiries (id, product_id, user_id, quantity, timeline, message) VALUES ($1,$2,$3,$4,$5,$6)", [enquiryId, found.product.id, user.id, enquiry.quantity, enquiry.timeline, enquiry.message]);
  }

  const conversation = await query<{ id: string }>(`
    INSERT INTO conversations (id, buyer_id, supplier_id, operator_slug, product_id) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (buyer_id, product_id) WHERE product_id IS NOT NULL DO UPDATE SET operator_slug = EXCLUDED.operator_slug
    RETURNING id
  `, [randomUUID(), user.id, found.ownerId, found.product.store.slug, found.product.id]);
  const conversationId = conversation.rows[0].id;
  const summary = [enquiry.quantity ? `${enquiry.quantity.toLocaleString("en-US")} units` : "", enquiry.timeline].filter(Boolean).join(" · ");
  await query("INSERT INTO messages (id, conversation_id, sender_id, body) VALUES ($1,$2,$3,$4)", [randomUUID(), conversationId, user.id, summary ? `Enquiry · ${summary}\n\n${enquiry.message}` : enquiry.message]);

  // The enquiry is saved either way; a failed email only means the store sees it in its workspace first.
  try {
    const [owner, company] = await Promise.all([
      query<{ id: string; email: string; name: string }>("SELECT id, email, name FROM users WHERE id = $1", [found.ownerId]),
      query<{ business_name: string }>("SELECT business_name FROM supplier_applications WHERE user_id = $1 AND application_kind = 'company' ORDER BY submitted_at DESC LIMIT 1", [user.id]),
    ]);
    if (owner.rows[0]) {
      const outboxId = await queueProductEnquiryEmail(owner.rows[0], { productName: found.product.name, senderName: user.name, senderCompany: company.rows[0]?.business_name ?? null, ...enquiry }, appOrigin(request));
      await deliverQueuedEmail(outboxId);
    }
  } catch (reason) {
    console.warn("[enquiries] The enquiry email could not be sent.", reason);
  }

  return Response.json({ id: enquiryId, conversationId, status: "new" }, { status: existing ? 200 : 201 });
}

/** Lets the device company track each enquiry it received. */
export async function PATCH(request: Request) {
  const guard = await requireDeviceSupplier();
  if (guard.response) return guard.response;
  const parsed = await readJsonObject(request, 2_048);
  if (parsed.response) return parsed.response;
  const { id, status } = parsed.body;
  if (!isUuid(id) || (status !== "new" && status !== "replied" && status !== "closed")) return Response.json({ error: "Choose a valid enquiry status." }, { status: 400 });
  const result = await query(`
    UPDATE product_enquiries enquiries SET status = $1, updated_at = NOW()
    FROM device_products products
    WHERE enquiries.id = $2 AND products.id = enquiries.product_id AND products.user_id = $3
  `, [status, id, guard.user.id]);
  if (!result.rowCount) return Response.json({ error: "Enquiry not found." }, { status: 404 });
  return Response.json({ ok: true, status });
}
