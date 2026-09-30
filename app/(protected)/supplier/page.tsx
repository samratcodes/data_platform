import type { Metadata } from "next";
import SupplierDashboard from "@/components/supplier/SupplierDashboard";
import StoreDashboard from "@/components/supplier/StoreDashboard";
import { requireAccess } from "@/lib/auth/guards";
import { ownerProducts, receivedEnquiries, sentEnquiries } from "@/lib/data/products";
import { storeSummary } from "@/lib/supplier/device-store";

export const metadata: Metadata = { title: "Supplier workspace", robots: { index: false, follow: false } };

export default async function SupplierPage() {
  const user = await requireAccess("/supplier");
  // Device companies land on their store instead of the facilities workspace.
  if (user.companyFocus === "devices") {
    const [products, enquiries, summary] = await Promise.all([ownerProducts(user.id), receivedEnquiries(user.id), storeSummary(user.id)]);
    return <StoreDashboard user={user} products={products} enquiries={enquiries} company={summary.company} listing={summary.listing}/>;
  }
  // Data companies also track the devices they asked device companies about.
  return <SupplierDashboard user={user} sentEnquiries={await sentEnquiries(user.id)}/>;
}
