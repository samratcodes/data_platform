import type { Metadata } from "next";
import SupplierDashboard from "@/components/supplier/SupplierDashboard";
import { requireAccess } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Supplier workspace", robots: { index: false, follow: false } };

export default async function SupplierPage() {
  const user = await requireAccess("/supplier");
  return <SupplierDashboard user={user}/>;
}
