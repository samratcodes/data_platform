import type { Metadata } from "next";
import SupplierVerificationPortal from "@/components/onboarding/SupplierVerificationPortal";
import { requireAccess } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Supplier onboarding", robots: { index: false, follow: false } };

export default async function OnboardingPage() {
  const user = await requireAccess("/onboarding");
  return <SupplierVerificationPortal user={user}/>;
}
