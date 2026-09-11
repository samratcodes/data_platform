import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SupplierVerificationPortal from "@/components/explorer/SupplierVerificationPortal";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Supplier onboarding", robots: { index: false, follow: false } };

export default async function OnboardingPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/onboarding");
  if (user.role !== "supplier" && user.role !== "admin") redirect("/map");
  return <SupplierVerificationPortal user={user}/>;
}
