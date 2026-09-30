import type { Metadata } from "next";
import ProductForm from "@/components/supplier/ProductForm";
import { requireAccess } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Add a product", robots: { index: false, follow: false } };

export default async function NewProductPage() {
  const user = await requireAccess("/supplier/products/new");
  return <ProductForm user={user}/>;
}
