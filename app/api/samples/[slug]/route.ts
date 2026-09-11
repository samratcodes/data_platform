import { getUser } from "@/lib/auth";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!await getUser()) return Response.json({ error: "Log in to download samples." }, { status: 401 });
  await context.params;
  return Response.json({ error: "Samples are shared by the supplier after an access request is approved." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
}
