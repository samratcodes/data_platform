import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductPage from "@/components/devices/ProductPage";
import { requireAccess } from "@/lib/auth/guards";
import { getUser } from "@/lib/auth/session";
import { productForPage, storeProducts } from "@/lib/data/products";

export async function generateMetadata({ params }: PageProps<"/devices/[id]">): Promise<Metadata> {
  const [{ id }, user] = await Promise.all([params, getUser()]);
  const found = user ? await productForPage(id, user.id) : null;
  return { title: found ? `${found.product.name} · ${found.product.store.name}` : "Device", robots: { index: false, follow: false } };
}

export default async function DevicePage({ params }: PageProps<"/devices/[id]">) {
  const { id } = await params;
  const user = await requireAccess(`/devices/${id}`);
  const found = await productForPage(id, user.id);
  if (!found) notFound();
  const more = found.product.store.slug ? (await storeProducts(found.product.store.slug)).filter((item) => item.id !== found.product.id).slice(0, 4) : [];
  return <ProductPage user={user} product={found.product} isOwner={found.isOwner} isLive={found.isLive} more={more}/>;
}
