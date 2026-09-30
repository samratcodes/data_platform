import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductForm from "@/components/supplier/ProductForm";
import { requireAccess } from "@/lib/auth/guards";
import { ownerProduct } from "@/lib/data/products";

export const metadata: Metadata = { title: "Edit product", robots: { index: false, follow: false } };

export default async function EditProductPage({ params }: PageProps<"/supplier/products/[id]/edit">) {
  const { id } = await params;
  const user = await requireAccess(`/supplier/products/${id}/edit`);
  const product = await ownerProduct(user.id, id);
  if (!product) notFound();
  return <ProductForm user={user} product={product}/>;
}
