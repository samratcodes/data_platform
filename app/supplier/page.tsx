import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SupplierDashboard from "@/components/explorer/SupplierDashboard";
import { getUser } from "@/lib/auth";
import { query } from "@/lib/database";

export const metadata: Metadata = { title: "Supplier workspace", robots: { index: false, follow: false } };

export default async function SupplierPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/supplier");
  if (user.role !== "supplier" && user.role !== "admin") redirect("/map");
  if (user.role === "supplier") {
    const approvedCompany = await query("SELECT 1 FROM supplier_applications WHERE user_id = $1 AND application_kind = 'company' AND status = 'approved' LIMIT 1", [user.id]);
    if (!approvedCompany.rowCount) redirect("/onboarding");
  }
  return <SupplierDashboard user={user}/>;
}
