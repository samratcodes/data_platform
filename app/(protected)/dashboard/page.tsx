import type { Metadata } from "next";
import BuyerWorkspace from "@/components/workspace/BuyerWorkspace";
import { requireAccess } from "@/lib/auth/guards";
import { toPublicOperator, verifiedOperators } from "@/lib/data/operators";

export const metadata: Metadata = { title: "Buyer workspace", robots: { index: false, follow: false } };

export default async function DashboardPage() {
  const [user, source] = await Promise.all([requireAccess("/dashboard"), verifiedOperators()]);
  return <BuyerWorkspace user={user} operators={source.map(toPublicOperator)}/>;
}
