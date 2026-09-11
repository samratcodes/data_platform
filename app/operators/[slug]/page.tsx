import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { verifiedOperator } from "@/lib/operators";

export default async function OperatorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!await verifiedOperator(slug)) notFound();
  const destination = `/map?operator=${slug}`;
  if (!await getUser()) redirect(`/login?next=${encodeURIComponent(destination)}`);
  redirect(destination);
}
