import { nodes } from "@/components/Landing/nodes";
import { getUser } from "@/lib/auth";
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  if (slug) {
    if (!await getUser()) return Response.json({ error: "Log in to view full profiles." }, { status: 401 });
    const operator = nodes.find((node) => node.slug === slug);
    return operator ? Response.json({ operator }, { headers: { "Cache-Control": "private, no-store" } }) : Response.json({ error: "Operator not found" }, { status: 404 });
  }
  const operators = nodes.map(({ id, slug, name, city, country, coordinates, type, modalities, media }) => ({ id, slug, name, city, country, coordinates, type, modalities, media }));
  return Response.json({ operators });
}
