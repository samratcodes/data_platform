import { getUser } from "@/lib/auth";
import { recordProfileView, verifiedOperator, verifiedOperators } from "@/lib/operators";
export async function GET(request: Request) {
  const user = await getUser();
  const slug = new URL(request.url).searchParams.get("slug");
  if (slug) {
    if (!user) return Response.json({ error: "Log in to view full profiles." }, { status: 401 });
    const operator = await verifiedOperator(slug);
    if (operator) await recordProfileView(slug);
    return operator ? Response.json({ operator }, { headers: { "Cache-Control": "private, no-store" } }) : Response.json({ error: "Operator not found" }, { status: 404 });
  }
  const source = await verifiedOperators({ includeDemo: !user });
  const operators = source.map(({ id, slug, name, city, country, coordinates, type, verificationLevel, modalities, media }) => ({ id, slug, name, city, country, coordinates, type, verificationLevel, modalities, media }));
  return Response.json({ operators });
}
