"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, Eye, EyeOff, Factory, Package, Pencil, Plus } from "lucide-react";
import Inbox from "@/components/messaging/Inbox";
import { ProductPhoto } from "@/components/devices/ProductCard";
import { api } from "@/lib/api-client";
import { deviceCategoryLabel, priceLabel, productPageUrl, type DeviceProduct } from "@/lib/devices";
import type { ReceivedEnquiry } from "@/lib/data/products";
import type { StoreSummary } from "@/lib/supplier/device-store";
import type { User } from "@/types/app";
import SupplierShell from "./SupplierShell";
import CompanyProfileCard from "./CompanyProfileCard";
import EnquiryPipeline from "./EnquiryPipeline";
import { DeskEmpty, DeskGrid, DeskHeader, DeskLedger, DeskProgress, DeskSection, DeskSideBlock, useGreeting } from "./Desk";

const PREVIEW_COUNT = 5;

/** Compact product rows with publish and edit actions. */
function ProductRows({ products, onError }: { products: DeviceProduct[]; onError: (message: string) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const toggle = async (product: DeviceProduct) => {
    setBusy(product.id); onError("");
    try { await api(`/api/supplier/products/${product.id}`, { method: "PATCH", body: JSON.stringify({ published: !product.published }) }); router.refresh(); }
    catch (reason) { onError((reason as Error).message); }
    finally { setBusy(""); }
  };
  return <ul className="desk-rows product-rows">{products.map((product) => <li key={product.id}>
    <Link className="product-row-photo" href={productPageUrl(product.id)} aria-label={`View ${product.name}`}><ProductPhoto product={product} sizes="56px"/></Link>
    <div className="product-row-copy">
      <Link href={productPageUrl(product.id)}><strong>{product.name}</strong></Link>
      <small>{deviceCategoryLabel(product)} · {priceLabel(product.price)}</small>
    </div>
    <span className={`product-row-state ${product.published ? "is-published" : ""}`}>{product.published ? "Published" : "Hidden"}</span>
    <div className="product-row-actions">
      <button type="button" className="icon-button" disabled={busy === product.id} onClick={() => toggle(product)} aria-label={product.published ? `Hide ${product.name}` : `Publish ${product.name}`} title={product.published ? "Hide from store" : "Publish to store"}>{product.published ? <EyeOff size={15}/> : <Eye size={15}/>}</button>
      <Link className="icon-button" href={`/supplier/products/${product.id}/edit`} aria-label={`Edit ${product.name}`} title="Edit"><Pencil size={14}/></Link>
    </div>
  </li>)}</ul>;
}

/** The device-company home: enquiries first, then the product list, with conversations beside them. */
export default function StoreDashboard({ user, products, enquiries, company, listing }: { user: User; products: DeviceProduct[]; enquiries: ReceivedEnquiry[] } & StoreSummary) {
  const [error, setError] = useState("");
  const approved = company?.status === "approved";
  const live = listing?.status === "approved";
  const published = products.filter((product) => product.published);
  const fresh = enquiries.filter((enquiry) => enquiry.status === "new").length;
  const units = enquiries.filter((enquiry) => enquiry.status !== "closed").reduce((sum, enquiry) => sum + (enquiry.quantity ?? 0), 0);
  const greeting = useGreeting(user.name);
  const showcase = published.filter((product) => product.images.length).slice(0, 3);

  return <SupplierShell
    user={user} active="supplier"
    notice={error && <p className="form-error">{error}</p>}
    header={<DeskHeader
      tone="device" greeting={greeting} logo={user.companyLogo} name={company?.business_name || user.companyName || user.name} kind="Device manufacturer" kindIcon={<Factory size={13}/>}
      place={[company?.city, company?.country].filter(Boolean).join(", ")} status={company?.status}
      actions={<>
        <Link className="secondary-button" href="/onboarding#company-profile"><Pencil size={14}/>Edit profile</Link>
        {live && listing && <Link className="secondary-button" href={`/operators/${listing.slug}`}>View store<ArrowUpRight size={14}/></Link>}
        <Link className="primary-button" href="/supplier/products/new"><Plus size={15}/>Add product</Link>
      </>}
      notice={company?.status === "rejected" && company.admin_notes ? <p className="factory-card-feedback">{company.admin_notes}</p>
        : !approved && company ? <p className="desk-note">You can add products now. They go live in your store once your company is approved.</p> : null}
    />}
  >
    <DeskLedger items={[
      { label: "New enquiries", value: fresh, detail: `${enquiries.length} total`, highlight: fresh > 0, href: "#store-enquiries-title" },
      { label: "Units requested", value: units.toLocaleString("en-US"), detail: "in open enquiries" },
      { label: "Live products", value: published.length, detail: `of ${products.length}`, href: "/supplier/products" },
      { label: "Store visits", value: listing?.profile_views ?? 0, detail: `${listing?.saves ?? 0} saves` },
    ]}/>
    <DeskProgress steps={[
      { title: "Company profile", done: Boolean(company), href: "/onboarding" },
      { title: "Company approval", done: approved || live },
      { title: "Add your first product", done: products.length > 0, href: "/supplier/products/new" },
      { title: "Publish a product", done: live && published.length > 0, href: "/supplier/products" },
    ]}/>

    <DeskGrid side={<>
      <CompanyProfileCard user={user} name={company?.business_name || user.companyName || user.name} detail={[company?.city, company?.country].filter(Boolean).join(", ") || "Device manufacturer"}
        feedback={company?.status === "rejected" ? company.admin_notes : null} publicHref={live && listing ? `/operators/${listing.slug}` : null}/>
      <DeskSideBlock title="Conversations"><Inbox/></DeskSideBlock>
      {live && listing && <Link className="desk-store-card" href={`/operators/${listing.slug}`}>
        <span className="desk-store-card-media">{showcase.length ? showcase.map((product) => <span key={product.id}><ProductPhoto product={product} sizes="120px"/></span>) : <Factory size={26}/>}</span>
        <span className="desk-store-card-copy"><small>Your storefront</small><strong>{published.length} {published.length === 1 ? "device" : "devices"} live</strong><em>View as a buyer<ArrowUpRight size={13}/></em></span>
      </Link>}
      <DeskSideBlock title="Shortcuts">
        <nav className="desk-links">
          <Link href="/supplier/products">All products<ArrowRight size={14}/></Link>
          <Link href="/devices">Device marketplace<ArrowRight size={14}/></Link>
          <Link href="/onboarding">Company profile<ArrowRight size={14}/></Link>
        </nav>
      </DeskSideBlock>
    </>}>
      <DeskSection id="store-enquiries-title" index={1} title="Enquiries" count={fresh}>
        <EnquiryPipeline enquiries={enquiries}/>
      </DeskSection>

      <DeskSection id="store-products-title" index={2} title="Products" count={products.length} action={products.length > PREVIEW_COUNT && <Link className="desk-link" href="/supplier/products">Manage all<ArrowRight size={14}/></Link>}>
        {products.length
          ? <ProductRows products={products.slice(0, PREVIEW_COUNT)} onError={setError}/>
          : <DeskEmpty icon={<Package size={18}/>} title="No products yet" text="List each device with its type, uses, the data it provides, a spec sheet, and photos." action={<Link className="secondary-button" href="/supplier/products/new"><Plus size={14}/>Add a product</Link>}/>}
      </DeskSection>
    </DeskGrid>
  </SupplierShell>;
}
