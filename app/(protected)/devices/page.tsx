import type { Metadata } from "next";
import DeviceMarketplace from "@/components/devices/DeviceMarketplace";
import { requireAccess } from "@/lib/auth/guards";
import { toPublicOperator, verifiedOperators } from "@/lib/data/operators";
import { marketplaceProducts } from "@/lib/data/products";

export const metadata: Metadata = { title: "Device marketplace", robots: { index: false, follow: false } };

export default async function DevicesPage() {
  const [user, products, operators] = await Promise.all([requireAccess("/devices"), marketplaceProducts(), verifiedOperators()]);
  const stores = operators.filter((operator) => operator.type === "Device Supplier").map(toPublicOperator);
  return <DeviceMarketplace user={user} products={products} stores={stores}/>;
}
