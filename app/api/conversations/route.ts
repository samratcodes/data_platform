import { randomUUID } from "node:crypto";
import { emailVerificationRequired, getUser, isEmailVerified } from "@/lib/auth/session";
import { rateLimited } from "@/lib/auth/rate-limit";
import { query } from "@/lib/db/client";
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
    return Response.json({ messages: messages.rows }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const conversations = await query(`
    SELECT conversations.id, conversations.operator_slug, conversations.created_at,
           buyer.name AS buyer_name, supplier.name AS supplier_name,
           (SELECT body FROM messages WHERE conversation_id = conversations.id ORDER BY created_at DESC LIMIT 1) AS latest_message
    FROM conversations
    JOIN users buyer ON buyer.id = conversations.buyer_id
    LEFT JOIN users supplier ON supplier.id = conversations.supplier_id
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
    if (user.role !== "buyer" && user.role !== "admin") return Response.json({ error: "Buyer access required." }, { status: 403 });
    const slug = isSlug(body.slug) ? body.slug : "";
    const provider = (await query<{ owner_id: string | null }>("SELECT owner_id FROM providers WHERE slug = $1 AND status = 'approved' AND is_demo = FALSE", [slug])).rows[0];
    if (!provider?.owner_id) return Response.json({ error: "Direct chat will open after this provider claims its profile." }, { status: 409 });
    const id = randomUUID();
    const result = await query<{ id: string }>(`
      INSERT INTO conversations (id, buyer_id, supplier_id, operator_slug) VALUES ($1,$2,$3,$4)
      ON CONFLICT(buyer_id, supplier_id, operator_slug) DO UPDATE SET operator_slug = EXCLUDED.operator_slug
      RETURNING id
    `, [id, user.id, provider.owner_id, slug]);
    return Response.json({ id: result.rows[0].id }, { status: 201 });
  }

  if (body.action === "send") {
    const conversationId = isUuid(body.conversationId) ? body.conversationId : "";
    const message = cleanMultiline(body.message, 4_000);
    if (!conversationId || typeof body.message !== "string" || body.message.length > 4_000 || message.length < 1) return Response.json({ error: "Messages must be 1–4,000 characters." }, { status: 400 });
    const member = await query("SELECT id FROM conversations WHERE id = $1 AND (buyer_id = $2 OR supplier_id = $2)", [conversationId, user.id]);
    if (!member.rowCount) return Response.json({ error: "Conversation not found." }, { status: 404 });
    const id = randomUUID();
    await query("INSERT INTO messages (id, conversation_id, sender_id, body) VALUES ($1,$2,$3,$4)", [id, conversationId, user.id, message]);
    return Response.json({ id }, { status: 201 });
  }
  return Response.json({ error: "Unknown action." }, { status: 400 });
}
