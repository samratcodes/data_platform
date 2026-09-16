import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import OperatorProfile from "@/components/explorer/OperatorProfile";
import { recordProfileView, verifiedOperator, verifiedOperators } from "@/lib/operators";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const operator = await verifiedOperator(slug);
  if (!operator) return { title: "Provider not found", robots: { index: false, follow: false } };
  return {
    title: operator.name,
    description: `${operator.name} — verified ${operator.type.toLowerCase()} in ${operator.city}, ${operator.country}.`,
    robots: { index: false, follow: false },
  };
}

export default async function OperatorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const operator = await verifiedOperator(slug);
  if (!operator) notFound();
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/operators/${slug}`)}`);
  await recordProfileView(slug);
  const related = (await verifiedOperators())
    .filter((item) => item.slug !== operator.slug && item.country === operator.country)
    .slice(0, 3)
    .map(({ id, slug: itemSlug, name, city, country, coordinates, type, verificationLevel, modalities, profile, media }) =>
      ({ id, slug: itemSlug, name, city, country, coordinates, type, verificationLevel, modalities, profile, media }));
  return <OperatorProfile user={user} operator={operator} related={related}/>;
}
