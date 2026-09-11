const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const unsafeHostPatterns = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/,
  /\.local$/i,
];

type JsonResult = { body: Record<string, unknown>; response?: never } | { body?: never; response: Response };

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

export function isSlug(value: unknown): value is string {
  return typeof value === "string" && value.length <= 160 && slugPattern.test(value);
}

export function cleanSingleLine(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function cleanMultiline(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim().slice(0, maxLength);
}

export function safeHttpsUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || unsafeHostPatterns.some((pattern) => pattern.test(url.hostname))) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function requestFingerprint(request: Request) {
  const candidate = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return candidate.slice(0, 96);
}

export function isSameOriginMutation(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site" || fetchSite === "same-site") return false;
  const target = new URL(request.url).origin;
  const source = request.headers.get("origin") || request.headers.get("referer");
  if (!source) return false;
  try { return new URL(source).origin === target; } catch { return false; }
}

export async function readJsonObject(request: Request, maxBytes = 16_384): Promise<JsonResult> {
  if (!isSameOriginMutation(request)) return { response: Response.json({ error: "Invalid request origin." }, { status: 403 }) };
  const contentType = request.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.startsWith("application/json")) return { response: Response.json({ error: "Content-Type must be application/json." }, { status: 415 }) };
  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maxBytes) return { response: Response.json({ error: "Request too large." }, { status: 413 }) };
  let text = "";
  try { text = await request.text(); } catch { return { response: Response.json({ error: "Invalid request." }, { status: 400 }) }; }
  if (Buffer.byteLength(text, "utf8") > maxBytes) return { response: Response.json({ error: "Request too large." }, { status: 413 }) };
  try {
    const body: unknown = text ? JSON.parse(text) : {};
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Expected an object");
    return { body: body as Record<string, unknown> };
  } catch {
    return { response: Response.json({ error: "Invalid request." }, { status: 400 }) };
  }
}
