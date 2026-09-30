"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ImagePlus, Package, Pencil, Plus, Trash2 } from "lucide-react";
import ProductCard from "@/components/devices/ProductCard";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { api } from "@/lib/api-client";
import { productPageUrl, type DeviceProduct } from "@/lib/devices";

/** The owner's product cards with publish, edit, and delete actions. */
export function OwnerProductGrid({ products, onError }: { products: DeviceProduct[]; onError: (message: string) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [deleting, setDeleting] = useState<DeviceProduct | null>(null);
  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusy(id); onError("");
    try { await action(); router.refresh(); }
    catch (reason) { onError((reason as Error).message); }
    finally { setBusy(""); }
  };
  return <>
    <div className="product-grid is-owner">{products.map((product) => <ProductCard key={product.id} product={product} href={productPageUrl(product.id)}
      badge={<>
        <span className={`product-card-state ${product.published ? "is-published" : "is-hidden"}`}>{product.published ? <><Eye size={12}/>Published</> : <><EyeOff size={12}/>Hidden</>}</span>
        {!product.images.length && <span className="product-card-warning"><ImagePlus size={12}/>Add a photo</span>}
      </>}
      actions={<div className="product-owner-actions">
        <Link className="secondary-button" href={`/supplier/products/${product.id}/edit`}><Pencil size={13}/>Edit</Link>
        <button type="button" className="icon-button" disabled={busy === product.id} aria-label={product.published ? `Hide ${product.name} from the store` : `Publish ${product.name}`} title={product.published ? "Hide from store" : "Publish to store"} onClick={() => run(product.id, () => api(`/api/supplier/products/${product.id}`, { method: "PATCH", body: JSON.stringify({ published: !product.published }) }))}>{product.published ? <EyeOff size={15}/> : <Eye size={15}/>}</button>
        <button type="button" className="icon-button is-danger" disabled={busy === product.id} aria-label={`Delete ${product.name}`} title="Delete product" onClick={() => setDeleting(product)}><Trash2 size={15}/></button>
      </div>}/>)}
    </div>
    {deleting && <ConfirmDialog title="Delete product" message={`Delete ${deleting.name} and its photos? Enquiries about it are removed too. This cannot be undone.`} busy={busy === deleting.id} onCancel={() => setDeleting(null)} onConfirm={() => void run(deleting.id, () => api(`/api/supplier/products/${deleting.id}`, { method: "DELETE" })).then(() => setDeleting(null))}/>}
  </>;
}

/** Shown when the store has no products yet. */
export function EmptyStore() {
  return <div className="factory-empty">
    <span><Package/></span>
    <div><strong>Add your first product</strong><p>List each device with its type, what it is used for, the data it provides, its spec sheet, and photos. Published products appear in your store once your company is approved.</p></div>
    <Link className="primary-button" href="/supplier/products/new"><Plus size={15}/>Add a product</Link>
  </div>;
}
