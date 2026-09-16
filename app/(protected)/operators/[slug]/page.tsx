import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OperatorProfile from "@/components/operators/OperatorProfile";
import { requireAccess } from "@/lib/auth/guards";
import { recordProfileView, relatedOperators, toPublicOperator, verifiedOperator } from "@/lib/data/operators";

export async function generateMetadata({ params }: PageProps<"/operators/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const operator = await verifiedOperator(slug);
  if (!operator) return { title: "Provider not found", robots: { index: false, follow: false } };
  return {
    title: operator.name,
    description: `${operator.name} — verified ${operator.type.toLowerCase()} in ${operator.city}, ${operator.country}.`,
    robots: { index: false, follow: false },
  };
}

export default async function OperatorPage({ params }: PageProps<"/operators/[slug]">) {
  const { slug } = await params;
  const [user, operator] = await Promise.all([requireAccess(`/operators/${slug}`), verifiedOperator(slug)]);
  if (!operator) notFound();
  const [related] = await Promise.all([relatedOperators(operator), recordProfileView(slug)]);
  return <OperatorProfile user={user} operator={operator} related={related.map(toPublicOperator)}/>;
}
