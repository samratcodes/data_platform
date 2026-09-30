"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Camera, ClipboardCheck, Eye, EyeOff, ImagePlus, Package, Plus, Store } from "lucide-react";
import type { DeviceProduct } from "@/lib/devices";
import type { StoreSummary } from "@/lib/supplier/device-store";
import type { User } from "@/types/app";
import SupplierShell, { SideCard, SideSteps } from "./SupplierShell";
import { EmptyStore, OwnerProductGrid } from "./StoreProducts";

const notices: Record<string, string> = {
  created: "Product added to your store.",
  updated: "Product changes saved.",
  partial: "Product saved, but some photos could not be uploaded. Open the product and add them again.",
};
const filters = [{ key: "all", label: "All" }, { key: "published", label: "Published" }, { key: "hidden", label: "Hidden" }, { key: "photos", label: "Missing photos" }] as const;
type Filter = (typeof filters)[number]["key"];
const matches = (product: DeviceProduct, filter: Filter) => filter === "all" || (filter === "published" ? product.published : filter === "hidden" ? !product.published : !product.images.length);

/** Every product in the store, with filters and a way to add another. */
export default function ProductsManager({ user, products, company, listing, notice: noticeKey }: { user: User; products: DeviceProduct[]; notice?: string } & StoreSummary) {
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");
  const notice = noticeKey ? notices[noticeKey] : "";
  useEffect(() => { if (noticeKey) window.history.replaceState(null, "", "/supplier/products"); }, [noticeKey]);
  const live = listing?.status === "approved";
  const shown = products.filter((product) => matches(product, filter));

  return <SupplierShell
    user={user} active="products" eyebrow="PRODUCTS" title="Your products"
    description="Each product is a card in your store: its device type, what it is used for, the data it provides, its specs, price, and photos."
    actions={<>{live && listing && <Link className="secondary-button" href={`/operators/${listing.slug}`}><Store size={15}/>View storefront<ArrowUpRight size={14}/></Link>}<Link className="primary-button" href="/supplier/products/new"><Plus size={15}/>Add a product</Link></>}
    notice={(notice || error) && <p className={error ? "form-error" : "settings-message settings-success"} role="status">{error || notice}</p>}
    aside={<>
      {!live && <SideCard title="Store not live yet" icon={<Store size={16}/>} tone="muted"><p>{company?.status === "rejected" ? "Your company profile needs an update before the store can open." : "Published products appear in your store as soon as your company profile is approved."}</p><Link className="secondary-button" href="/onboarding">Company profile</Link></SideCard>}
      <SideCard title="A great product card" icon={<ClipboardCheck size={16}/>}>
        <SideSteps items={[
          { title: "Device type and name", detail: "e.g. Head-mounted camera · Model X2" },
          { title: "What it is used for", detail: "Egocentric recording, factory capture, teleoperation…" },
          { title: "The data it provides", detail: "Video, depth, audio, IMU, hand pose…" },
          { title: "Specs, price, and photos", detail: "Resolution, frame rate, battery, and clear product shots." },
        ]}/>
      </SideCard>
    </>}
  >
    <div className="supplier-metrics facility-summary">
      <article><Package/><strong>{products.length}</strong><span>Products</span></article>
      <article><Eye/><strong>{products.filter((product) => product.published).length}</strong><span>Published</span></article>
      <article><EyeOff/><strong>{products.filter((product) => !product.published).length}</strong><span>Hidden</span></article>
      <article><Camera/><strong>{new Set(products.map((product) => product.category)).size}</strong><span>Device types</span></article>
    </div>
    {products.length > 0 && <div className="facility-filters" role="tablist" aria-label="Filter products">{filters.filter((item) => item.key === "all" || products.some((product) => matches(product, item.key))).map((item) => <button key={item.key} type="button" role="tab" aria-selected={filter === item.key} className={filter === item.key ? "selected" : ""} onClick={() => setFilter(item.key)}>{item.key === "photos" && <ImagePlus size={14}/>}{item.label}<small>{products.filter((product) => matches(product, item.key)).length}</small></button>)}</div>}
    {products.length ? <OwnerProductGrid products={shown} onError={setError}/> : <EmptyStore/>}
  </SupplierShell>;
}
