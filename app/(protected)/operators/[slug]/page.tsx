import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OperatorProfile from "@/components/operators/OperatorProfile";
import StoreFront from "@/components/devices/StoreFront";
import { requireAccess } from "@/lib/auth/guards";
import { companyFacilities, ownsListing, recordProfileView, relatedOperators, toPublicOperator, verifiedOperator } from "@/lib/data/operators";
import { storeProducts } from "@/lib/data/products";

export async function generateMetadata({ params }: PageProps<"/operators/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const operator = await verifiedOperator(slug);
  if (!operator) return { title: "Provider not found", robots: { index: false, follow: false } };
  return {
    title: operator.type === "Device Supplier" ? `${operator.name} store` : operator.name,
    description: `${operator.name} — verified ${operator.type.toLowerCase()} in ${operator.city}, ${operator.country}.`,
    robots: { index: false, follow: false },
  };
}

export default async function OperatorPage({ params }: PageProps<"/operators/[slug]">) {
  const { slug } = await params;
  const [user, operator] = await Promise.all([requireAccess(`/operators/${slug}`), verifiedOperator(slug)]);
  if (!operator) notFound();
  // Device companies get a storefront of their products instead of a capture profile.
  if (operator.type === "Device Supplier") {
    const [products, isOwner] = await Promise.all([storeProducts(slug), ownsListing(slug, user.id)]);
    if (!isOwner) await recordProfileView(slug);
    return <StoreFront user={user} operator={operator} products={products} isOwner={isOwner}/>;
  }
  const [related, facilities] = await Promise.all([relatedOperators(operator), operator.type === "Data Company" ? companyFacilities(slug) : [], recordProfileView(slug)]);
  return <OperatorProfile user={user} operator={operator} related={related.map(toPublicOperator)} facilities={facilities.map(toPublicOperator)}/>;
}
