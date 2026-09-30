import { randomUUID } from "node:crypto";
import { emailVerificationRequired, getUser, isEmailVerified } from "@/lib/auth/session";
import { rateLimited } from "@/lib/auth/rate-limit";
import { query } from "@/lib/db/client";
import { liveProduct } from "@/lib/data/products";
import { cleanMultiline, isSlug, isUuid, readJsonObject } from "@/lib/security";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Please log in." }, { status: 401 });
  const conversationId = new URL(request.url).searchParams.get("id");
  if (conversationId) {
    if (!isUuid(conversationId)) return Response.json({ error: "Conversation not found." }, { status: 404 });
    const member = await query("SELECT id FROM conversations WHERE id = $1 AND (buyer_id = $2 OR supplier_id = $2)", [conversationId, user.id]);
    if (!member.rowCount) return Response.json({ error: "Conversation not found." }, { status: 404 });
    const messages = await query(`
      SELECT messages.id, messages.body, messages.created_at, messages.sender_id,
             users.name AS sender_name
      FROM messages JOIN users ON users.id = messages.sender_id
      WHERE conversation_id = $1 ORDER BY messages.created_at
    `, [conversationId]);
    return Response.json({ messages: messages.rows, me: user.id }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const conversations = await query(`
    SELECT conversations.id, conversations.operator_slug, conversations.product_id, conversations.created_at,
           buyer.name AS buyer_name, supplier.name AS supplier_name, products.name AS product_name,
           (SELECT body FROM messages WHERE conversation_id = conversations.id ORDER BY created_at DESC LIMIT 1) AS latest_message
    FROM conversations
    JOIN users buyer ON buyer.id = conversations.buyer_id
    LEFT JOIN users supplier ON supplier.id = conversations.supplier_id
    LEFT JOIN device_products products ON products.id = conversations.product_id
    WHERE conversations.buyer_id = $1 OR conversations.supplier_id = $1
    ORDER BY conversations.created_at DESC
  `, [user.id]);
  return Response.json({ conversations: conversations.rows }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Please log in." }, { status: 401 });
  if (!isEmailVerified(user)) return emailVerificationRequired();
  const parsed = await readJsonObject(request, 8_192);
  if (parsed.response) return parsed.response;
  const body = parsed.body;
  if (await rateLimited(`messages:${user.id}`, 120, 15 * 60_000)) return Response.json({ error: "Message limit reached. Try again shortly." }, { status: 429 });

  if (body.action === "start") {
    const slug = isSlug(body.slug) ? body.slug : "";
    const provider = (await query<{ owner_id: string | null; provider_type: string }>("SELECT owner_id, provider_type FROM providers WHERE slug = $1 AND status = 'approved' AND is_demo = FALSE", [slug])).rows[0];
    // Buyers message any provider; data companies can also message device companies about equipment.
    const allowed = user.role === "buyer" || user.role === "admin" || (user.role === "supplier" && provider?.provider_type === "Device Supplier");
    if (!allowed) return Response.json({ error: "Buyer access required." }, { status: 403 });
    if (!provider?.owner_id) return Response.json({ error: "Direct chat will open after this provider claims its profile." }, { status: 409 });
    if (provider.owner_id === user.id) return Response.json({ error: "You cannot message your own listing." }, { status: 400 });
    const result = await query<{ id: string }>(`
      INSERT INTO conversations (id, buyer_id, supplier_id, operator_slug) VALUES ($1,$2,$3,$4)
      ON CONFLICT (buyer_id, supplier_id, operator_slug) WHERE product_id IS NULL DO UPDATE SET operator_slug = EXCLUDED.operator_slug
      RETURNING id
    `, [randomUUID(), user.id, provider.owner_id, slug]);
    return Response.json({ id: result.rows[0].id }, { status: 201 });
  }

  // One enquiry thread per viewer and product, with the device company that sells it.
  if (body.action === "start-product") {
    const found = await liveProduct(typeof body.productId === "string" ? body.productId : "");
    if (!found) return Response.json({ error: "This product is no longer available." }, { status: 404 });
    if (found.ownerId === user.id) return Response.json({ error: "Questions about your own product arrive in your store workspace." }, { status: 400 });
    const result = await query<{ id: string }>(`
      INSERT INTO conversations (id, buyer_id, supplier_id, operator_slug, product_id) VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (buyer_id, product_id) WHERE product_id IS NOT NULL DO UPDATE SET operator_slug = EXCLUDED.operator_slug
      RETURNING id
    `, [randomUUID(), user.id, found.ownerId, found.product.store.slug, found.product.id]);
    return Response.json({ id: result.rows[0].id }, { status: 201 });
  }

  if (body.action === "send") {
    const conversationId = isUuid(body.conversationId) ? body.conversationId : "";
    const message = cleanMultiline(body.message, 4_000);
    if (!conversationId || typeof body.message !== "string" || body.message.length > 4_000 || message.length < 1) return Response.json({ error: "Messages must be 1–4,000 characters." }, { status: 400 });
    const conversation = (await query<{ buyer_id: string; product_id: string | null }>("SELECT buyer_id, product_id FROM conversations WHERE id = $1 AND (buyer_id = $2 OR supplier_id = $2)", [conversationId, user.id])).rows[0];
    if (!conversation) return Response.json({ error: "Conversation not found." }, { status: 404 });
    const id = randomUUID();
    await query("INSERT INTO messages (id, conversation_id, sender_id, body) VALUES ($1,$2,$3,$4)", [id, conversationId, user.id, message]);
    // The first question about a product also lands in the store's enquiry pipeline.
    if (conversation.product_id && conversation.buyer_id === user.id) {
      await query(`
        INSERT INTO product_enquiries (id, product_id, user_id, message)
        SELECT $1, $2, $3, $4
        WHERE NOT EXISTS (SELECT 1 FROM product_enquiries WHERE product_id = $2 AND user_id = $3)
      `, [randomUUID(), conversation.product_id, user.id, message.length >= 10 ? message : `Question about this product: ${message}`]);
    }
    // A reply from the store moves a new enquiry along, so the sender sees it was answered.
    if (conversation.product_id && conversation.buyer_id !== user.id) {
      await query("UPDATE product_enquiries SET status = 'replied', updated_at = NOW() WHERE product_id = $1 AND user_id = $2 AND status = 'new'", [conversation.product_id, conversation.buyer_id]);
    }
    return Response.json({ id }, { status: 201 });
  }
  return Response.json({ error: "Unknown action." }, { status: 400 });
}
