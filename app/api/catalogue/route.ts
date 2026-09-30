import { getUser } from "@/lib/auth/session";
import { companyFacilities, recordProfileView, toPublicOperator, verifiedOperator, verifiedOperators } from "@/lib/data/operators";
import { storeProducts } from "@/lib/data/products";
export async function GET(request: Request) {
  const user = await getUser();
  const slug = new URL(request.url).searchParams.get("slug");
  if (slug) {
    if (!user) return Response.json({ error: "Log in to view full profiles." }, { status: 401 });
    const operator = await verifiedOperator(slug);
    if (!operator) return Response.json({ error: "Operator not found" }, { status: 404 });
    // A data company brings its facilities with it; a device store brings its products.
    const [facilities, products] = await Promise.all([
      operator.type === "Data Company" ? companyFacilities(slug) : [],
      operator.type === "Device Supplier" ? storeProducts(slug) : [],
      recordProfileView(slug),
    ]);
    return Response.json({ operator, facilities: facilities.map(toPublicOperator), products }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const source = await verifiedOperators();
  // Facilities are only revealed to signed-in viewers, through the company that runs them.
  const operators = source.filter((operator) => user || operator.type !== "Facility").map(({ id, slug, name, city, country, coordinates, type, verificationLevel, modalities, media, facilityCount, productCount }) => ({ id, slug, name, city, country, coordinates, type, verificationLevel, modalities, media, facilityCount, productCount }));
  return Response.json({ operators });
}
