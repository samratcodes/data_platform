"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ChevronRight, Cpu, Database, EyeOff, Inbox, PackageCheck, Pencil, Target } from "lucide-react";
import AppNavigationRail from "@/components/navigation/AppNavigationRail";
import ProviderLogo from "@/components/ui/ProviderLogo";
import { availabilityLabel, deviceCategoryLabel, priceLabel, productPageUrl, specRows, type StoreProduct } from "@/lib/devices";
import type { User } from "@/types/app";
import ProductCard, { ProductPhoto } from "./ProductCard";
import ProductChat from "./ProductChat";

/**
 * One device's page: gallery, spec sheet, use cases, data outputs, and the viewer's enquiry chat
 * with the store. Owners see the same page as a preview, with management links instead of the chat.
 */
export default function ProductPage({ user, product, isOwner, isLive, more }: { user: User; product: StoreProduct; isOwner: boolean; isLive: boolean; more: StoreProduct[] }) {
  const [photo, setPhoto] = useState(0);
  const specs = specRows(product.specs);
  const store = product.store;
  const storeHref = store.slug && isLive ? `/operators/${store.slug}` : "";
  const back = isOwner && !isLive ? { href: "/supplier/products", label: "Back to products" } : storeHref ? { href: storeHref, label: `Back to ${store.name}` } : { href: "/devices", label: "Back to marketplace" };

  return <main className="sourcing-app store-page product-page">
    <AppNavigationRail user={user} active={isOwner ? "products" : "devices"}/>
    <div className="store-shell">
      <nav className="store-topbar" aria-label="Breadcrumb">
        <Link className="store-back" href={back.href}><ArrowLeft size={15}/>{back.label}</Link>
        <span className="store-trail">
          <Link href="/devices">Device marketplace</Link><ChevronRight size={12}/>
          {storeHref ? <Link href={storeHref}>{store.name}</Link> : <span>{store.name}</span>}<ChevronRight size={12}/>
          <b>{product.name}</b>
        </span>
      </nav>

      {!isLive && <p className="store-owner-note"><EyeOff size={15}/>Preview only. {!product.published ? "This product is hidden, so buyers cannot see it." : "Buyers will see this product once your company is approved and your store is live."}</p>}

      <section className="product-detail product-page-main" aria-label={product.name}>
        <div className="product-detail-gallery">
          <div className="product-detail-photo"><ProductPhoto product={product} index={photo} sizes="(max-width: 760px) 100vw, 560px"/></div>
          {product.images.length > 1 && <div className="product-detail-thumbs">{product.images.map((image, index) => <button key={image.key} type="button" className={index === photo ? "selected" : ""} onClick={() => setPhoto(index)} aria-label={`Show photo ${index + 1}`} aria-pressed={index === photo}><ProductPhoto product={product} index={index} sizes="72px"/></button>)}</div>}
        </div>
        <div className="product-detail-info">
          <span className="product-card-category">{deviceCategoryLabel(product)}</span>
          <h1 className="product-page-title">{product.name}</h1>
          <div className="product-detail-price"><strong>{priceLabel(product.price)}</strong><span data-availability={product.availability}><PackageCheck size={14}/>{availabilityLabel(product.availability)}</span></div>
          {storeHref
            ? <Link className="product-page-store" href={storeHref}><ProviderLogo name={store.name} logo={store.logo} type="Device Supplier" size={36}/><span>Sold by <strong>{store.name}</strong><small>{[store.city, store.country].filter(Boolean).join(", ")}</small></span><ArrowUpRight size={14}/></Link>
            : <p className="product-page-store"><ProviderLogo name={store.name} logo={store.logo} type="Device Supplier" size={36}/><span>Sold by <strong>{store.name}</strong><small>{[store.city, store.country].filter(Boolean).join(", ")}</small></span></p>}
          <p className="product-detail-description">{product.description}</p>
          <h3><Target size={15}/>Used for</h3>
          <div className="product-detail-chips">{product.useCases.map((item) => <span key={item}>{item}</span>)}</div>
          <h3><Database size={15}/>Data it provides</h3>
          <div className="product-detail-chips is-data">{product.dataOutputs.map((item) => <span key={item}>{item}</span>)}</div>
          {specs.length > 0 && <><h3><Cpu size={15}/>Specifications</h3><dl className="product-spec-table">{specs.map((row) => <div key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></>}
        </div>
      </section>

      {isOwner
        ? <section className="product-owner-panel" aria-label="Manage this product">
          <p><Inbox size={16}/>Questions about this product arrive as enquiries and conversations in your store workspace.</p>
          <div><Link className="secondary-button" href="/supplier">Open store workspace</Link><Link className="primary-button" href={`/supplier/products/${product.id}/edit`}><Pencil size={14}/>Edit product</Link></div>
        </section>
        : <ProductChat product={product}/>}

      {more.length > 0 && <section className="store-section" aria-labelledby="product-more-title">
        <div className="supplier-heading"><div><span className="section-kicker">MORE FROM THIS STORE</span><h2 id="product-more-title">Other devices from {store.name}</h2></div>{storeHref && <Link className="secondary-button" href={storeHref}>View store<ArrowUpRight size={14}/></Link>}</div>
        <div className="product-grid">{more.map((item) => <ProductCard key={item.id} product={item} href={productPageUrl(item.id)} canEnquire={!isOwner}/>)}</div>
      </section>}
    </div>
  </main>;
}
