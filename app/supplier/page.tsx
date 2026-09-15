import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SupplierDashboard from "@/components/explorer/SupplierDashboard";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Supplier workspace", robots: { index: false, follow: false } };

export default async function SupplierPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/supplier");
  if (user.role !== "supplier" && user.role !== "admin") redirect("/map");
  return <SupplierDashboard user={user}/>;
}
