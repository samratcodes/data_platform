import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import BuyerWorkspace from "@/components/explorer/BuyerWorkspace";
import { verifiedOperators } from "@/lib/operators";
export const metadata: Metadata = { title: "Buyer workspace", robots: { index: false, follow: false } };

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/dashboard");
  const source = await verifiedOperators();
  const operators = source.map(({ id, slug, name, city, country, coordinates, type, verificationLevel, modalities, profile, media }) => ({ id, slug, name, city, country, coordinates, type, verificationLevel, modalities, profile, media }));
  return <BuyerWorkspace user={user} operators={operators}/>;
}
