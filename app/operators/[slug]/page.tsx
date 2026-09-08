import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { nodes } from "@/components/Landing/nodes";

export default async function OperatorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!nodes.some((operator) => operator.slug === slug)) notFound();
  const destination = `/map?operator=${slug}`;
  if (!await getUser()) redirect(`/login?next=${encodeURIComponent(destination)}`);
  redirect(destination);
}
