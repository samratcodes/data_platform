"use client";

import { useEffect, useMemo, useState } from "react";
import { PackageSearch, Search, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { deviceCategoryLabel, productPageUrl, type SentEnquiry, type StoreProduct } from "@/lib/devices";
import ProductCard from "./ProductCard";

const sorts = { newest: "Newest", name: "Name A–Z", priced: "Price listed first" } as const;
type Sort = keyof typeof sorts;

/**
 * Searchable, filterable product grid; each card links to its product page and enquiry chat.
 * Used by a single store's page and by the marketplace across every store.
 */
export default function ProductBrowser({ products, showStore = false, canEnquire = true, emptyTitle = "No products listed yet", emptyText = "Products appear here as soon as they are published." }: {
  products: StoreProduct[];
  showStore?: boolean;
  /** False when the viewer owns the store or cannot send enquiries. */
  canEnquire?: boolean;
  emptyTitle?: string;
  emptyText?: string;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [output, setOutput] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [sent, setSent] = useState<SentEnquiry[]>([]);

  useEffect(() => {
    if (!canEnquire) return;
    const controller = new AbortController();
    api<{ enquiries: SentEnquiry[] }>("/api/enquiries", { signal: controller.signal }).then((data) => setSent(data.enquiries)).catch(() => undefined);
    return () => controller.abort();
  }, [canEnquire]);

  const categories = useMemo(() => [...new Set(products.map(deviceCategoryLabel))].sort(), [products]);
  const outputs = useMemo(() => [...new Set(products.flatMap((product) => product.dataOutputs))].sort(), [products]);
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = products.filter((product) => (!needle || [product.name, product.description, deviceCategoryLabel(product), ...product.useCases, ...product.dataOutputs, ...(showStore ? [product.store.name, product.store.country] : [])].join(" ").toLowerCase().includes(needle))
      && (!category || deviceCategoryLabel(product) === category)
      && (!output || product.dataOutputs.includes(output)));
    if (sort === "name") return [...matches].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "priced") return [...matches].sort((a, b) => Number(!a.price.trim()) - Number(!b.price.trim()));
    return matches;
  }, [products, query, category, output, sort, showStore]);
  const sentFor = (id: string) => sent.find((item) => item.product_id === id);
  const filtered = Boolean(query.trim() || category || output);
  const clear = () => { setQuery(""); setCategory(""); setOutput(""); };

  if (!products.length) return <div className="store-empty"><PackageSearch/><strong>{emptyTitle}</strong><p>{emptyText}</p></div>;

  return <div className="product-browser">
    <div className="product-toolbar">
      <label className="product-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={showStore ? "Search devices, stores, or data types" : "Search this store"} aria-label="Search products"/>{query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={14}/></button>}</label>
      <label className="product-select"><span>Data type</span><select value={output} onChange={(event) => setOutput(event.target.value)}><option value="">All data types</option>{outputs.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="product-select"><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>{Object.entries(sorts).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {categories.length > 1 && <div className="product-categories" role="tablist" aria-label="Device type">
      <button type="button" role="tab" aria-selected={!category} className={!category ? "selected" : ""} onClick={() => setCategory("")}>All devices<small>{products.length}</small></button>
      {categories.map((item) => <button key={item} type="button" role="tab" aria-selected={category === item} className={category === item ? "selected" : ""} onClick={() => setCategory(category === item ? "" : item)}>{item}<small>{products.filter((product) => deviceCategoryLabel(product) === item).length}</small></button>)}
    </div>}
    <p className="product-result-count" aria-live="polite">{shown.length} {shown.length === 1 ? "device" : "devices"}{filtered && <button type="button" onClick={clear}>Clear filters</button>}</p>
    {shown.length
      ? <div className="product-grid">{shown.map((product) => <ProductCard key={product.id} product={product} href={productPageUrl(product.id)} showStore={showStore} canEnquire={canEnquire} enquired={Boolean(sentFor(product.id))}/>)}</div>
      : <div className="store-empty"><Search/><strong>No matching devices</strong><p>Try another device type or data type.</p><button type="button" className="secondary-button" onClick={clear}>Clear filters</button></div>}
  </div>;
}
