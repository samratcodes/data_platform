"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Camera, Check, Send } from "lucide-react";
import { availabilityLabel, deviceCategoryLabel, priceLabel, productImageUrl, specRows, type DeviceProduct, type StoreProduct } from "@/lib/devices";

/** The product's cover photo, or a device placeholder when it has none. */
export function ProductPhoto({ product, sizes = "(max-width: 760px) 100vw, 320px", index = 0, src }: { product: Pick<DeviceProduct, "images" | "name">; sizes?: string; index?: number; src?: string }) {
  const image = product.images[index];
  const source = src ?? (image ? productImageUrl(image.key) : "");
  return source
    ? <Image src={source} alt={`${product.name} photo`} fill unoptimized sizes={sizes}/>
    : <span className="product-photo-placeholder" aria-hidden="true"><Camera/></span>;
}

/**
 * A storefront product card: photo, type, name, key specs, data it provides, and price.
 * Store cards link to the product page and offer an enquiry; owner cards carry management actions instead.
 */
export default function ProductCard({ product, href, canEnquire = false, enquired = false, showStore = false, badge, actions, photoSrc }: {
  product: DeviceProduct | StoreProduct;
  /** A local photo preview, used while the product form is being filled in. */
  photoSrc?: string;
  /** The product page; cards without one (the form preview) are not links. */
  href?: string;
  /** Shows an enquire button that opens the product page's chat. */
  canEnquire?: boolean;
  enquired?: boolean;
  /** Shows which store sells the product, for the marketplace across stores. */
  showStore?: boolean;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  const specs = specRows(product.specs).slice(0, 3);
  const store = showStore && "store" in product ? product.store : null;
  const photo = <>
    <ProductPhoto product={product} src={photoSrc}/>
    <span className="product-card-availability">{availabilityLabel(product.availability)}</span>
    {badge}
    {product.images.length > 1 && !photoSrc && <span className="product-card-count">{product.images.length} photos</span>}
  </>;
  return <article className="product-card" data-availability={product.availability}>
    {href ? <Link className="product-card-photo" href={href} aria-label={`View ${product.name}`}>{photo}</Link> : <div className="product-card-photo">{photo}</div>}
    <div className="product-card-body">
      <span className="product-card-category">{deviceCategoryLabel(product)}</span>
      <h3>{href ? <Link href={href}>{product.name}</Link> : product.name}</h3>
      {store && <small className="product-card-store">Sold by {store.name} · {store.city}, {store.country}</small>}
      {specs.length > 0 && <dl className="product-card-specs">{specs.map((row) => <div key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>}
      <div className="product-card-outputs" aria-label="Data this device provides">{product.dataOutputs.slice(0, 3).map((output) => <span key={output}>{output}</span>)}{product.dataOutputs.length > 3 && <span>+{product.dataOutputs.length - 3}</span>}</div>
      <div className="product-card-footer">
        <strong className={product.price.trim() ? "" : "is-enquiry"}>{priceLabel(product.price)}</strong>
        {actions ?? (href && canEnquire && <Link className={enquired ? "secondary-button is-sent" : "primary-button"} href={`${href}#enquire`}>{enquired ? <><Check size={14}/>Enquiry sent</> : <><Send size={14}/>Enquire</>}</Link>)}
      </div>
    </div>
  </article>;
}
