import type { Metadata } from "next";
import ProductsManager from "@/components/supplier/ProductsManager";
import { requireAccess } from "@/lib/auth/guards";
import { ownerProducts } from "@/lib/data/products";
import { storeSummary } from "@/lib/supplier/device-store";

export const metadata: Metadata = { title: "Products", robots: { index: false, follow: false } };

export default async function ProductsPage({ searchParams }: PageProps<"/supplier/products">) {
  const [user, params] = await Promise.all([requireAccess("/supplier/products"), searchParams]);
  const [products, summary] = await Promise.all([ownerProducts(user.id), storeSummary(user.id)]);
  return <ProductsManager user={user} products={products} company={summary.company} listing={summary.listing} notice={typeof params.saved === "string" ? params.saved : undefined}/>;
}
