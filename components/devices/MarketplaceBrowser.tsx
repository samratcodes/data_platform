"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, PackageSearch, Search, SlidersHorizontal, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { availabilityLabel, deviceAvailability, deviceCategoryLabel, productPageUrl, type SentEnquiry, type StoreProduct } from "@/lib/devices";
import ProviderLogo from "@/components/ui/ProviderLogo";
import ProductCard from "./ProductCard";

const sorts = { newest: "Newest first", name: "Name A–Z", priced: "Price listed first", photos: "Most photos" } as const;
type Sort = keyof typeof sorts;

/** The multi-select filter groups in the sidebar; values within a group match any, groups combine. */
const facets = {
  type: { title: "Device type", values: (product: StoreProduct) => [deviceCategoryLabel(product)] },
  data: { title: "Data it captures", values: (product: StoreProduct) => product.dataOutputs },
  use: { title: "Use case", values: (product: StoreProduct) => product.useCases },
  availability: { title: "Availability", values: (product: StoreProduct) => [availabilityLabel(product.availability)] },
  store: { title: "Store", values: (product: StoreProduct) => [product.store.name] },
  country: { title: "Ships from", values: (product: StoreProduct) => [product.store.country] },
} as const;
type FacetKey = keyof typeof facets;
type Selection = Record<FacetKey, string[]>;

const noSelection: Selection = { type: [], data: [], use: [], availability: [], store: [], country: [] };
const facetKeys = Object.keys(facets) as FacetKey[];
const availabilityOrder = deviceAvailability.map((item) => item.label as string);

/** Groups longer than this show a "Show all" toggle. */
const FACET_PREVIEW = 6;

function FacetGroup({ facet, options, selected, onToggle, logos }: {
  facet: FacetKey;
  options: Array<{ value: string; count: number }>;
  selected: string[];
  onToggle: (value: string) => void;
  logos?: Map<string, string | null>;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!options.length) return null;
  const shown = expanded ? options : options.slice(0, FACET_PREVIEW);
  return <details className="shop-facet" open>
    <summary>{facets[facet].title}{selected.length > 0 && <small>{selected.length}</small>}<ChevronDown size={15}/></summary>
    <ul>{shown.map((option) => {
      const checked = selected.includes(option.value);
      const logo = logos?.get(option.value);
      return <li key={option.value}>
        <label className={option.count === 0 && !checked ? "is-empty" : ""}>
          <input type="checkbox" checked={checked} onChange={() => onToggle(option.value)}/>
          {logos && <ProviderLogo name={option.value} logo={logo} type="Device Supplier" size={22} className="shop-facet-logo"/>}
          <span className="shop-facet-label">{option.value}</span>
          <small>{option.count}</small>
        </label>
      </li>;
    })}</ul>
    {options.length > FACET_PREVIEW && <button type="button" className="shop-facet-more" onClick={() => setExpanded(!expanded)}>{expanded ? "Show fewer" : `Show all ${options.length}`}</button>}
  </details>;
}

/**
 * The marketplace catalogue as a shop: a filter sidebar with live counts,
 * a sortable product grid, and removable chips for the active filters.
 */
export default function MarketplaceBrowser({ products, query, onQuery, canEnquire }: {
  products: StoreProduct[];
  /** The search text, owned by the page so the banner's search box drives it. */
  query: string;
  onQuery: (query: string) => void;
  canEnquire: boolean;
}) {
  const [selection, setSelection] = useState<Selection>(noSelection);
  const [pricedOnly, setPricedOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sent, setSent] = useState<SentEnquiry[]>([]);

  useEffect(() => {
    if (!canEnquire) return;
    const controller = new AbortController();
    api<{ enquiries: SentEnquiry[] }>("/api/enquiries", { signal: controller.signal }).then((data) => setSent(data.enquiries)).catch(() => undefined);
    return () => controller.abort();
  }, [canEnquire]);

  // Close the phone filter drawer with Escape.
  useEffect(() => {
    if (!filtersOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setFiltersOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [filtersOpen]);

  const needle = query.trim().toLowerCase();
  const searched = useMemo(() => products.filter((product) => (!needle || [product.name, product.description, deviceCategoryLabel(product), ...product.useCases, ...product.dataOutputs, product.store.name, product.store.country].join(" ").toLowerCase().includes(needle))
    && (!pricedOnly || Boolean(product.price.trim()))), [products, needle, pricedOnly]);

  const matches = (product: StoreProduct, skip?: FacetKey) => facetKeys.every((key) => key === skip || !selection[key].length || facets[key].values(product).some((value) => selection[key].includes(value)));

  // Each group counts against every other active filter, so a count is what ticking it would add.
  const options = useMemo(() => Object.fromEntries(facetKeys.map((key) => {
    const counts = new Map<string, number>();
    for (const product of products) for (const value of facets[key].values(product)) counts.set(value, 0);
    for (const product of searched) if (matches(product, key)) for (const value of new Set(facets[key].values(product))) counts.set(value, (counts.get(value) ?? 0) + 1);
    const list = [...counts].map(([value, count]) => ({ value, count }));
    list.sort(key === "availability" ? (a, b) => availabilityOrder.indexOf(a.value) - availabilityOrder.indexOf(b.value) : (a, b) => b.count - a.count || a.value.localeCompare(b.value));
    return [key, list];
  })) as Record<FacetKey, Array<{ value: string; count: number }>>, [products, searched, selection]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    const list = searched.filter((product) => matches(product));
    if (sort === "name") return [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "priced") return [...list].sort((a, b) => Number(!a.price.trim()) - Number(!b.price.trim()));
    if (sort === "photos") return [...list].sort((a, b) => b.images.length - a.images.length);
    return list;
  }, [searched, selection, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const logos = useMemo(() => new Map(products.map((product) => [product.store.name, product.store.logo])), [products]);
  const typeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) counts.set(deviceCategoryLabel(product), (counts.get(deviceCategoryLabel(product)) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [products]);

  const toggle = (key: FacetKey, value: string) => setSelection((current) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value] }));
  const active = facetKeys.flatMap((key) => selection[key].map((value) => ({ key, value })));
  const filterCount = active.length + Number(pricedOnly);
  const clearAll = () => { setSelection(noSelection); setPricedOnly(false); onQuery(""); };
  const sentFor = (id: string) => sent.some((item) => item.product_id === id);

  if (!products.length) return <div className="store-empty"><PackageSearch/><strong>No devices listed yet</strong><p>Device companies are setting up their stores. Check back soon.</p></div>;

  return <div className="shop">
    {typeOptions.length > 1 && <nav className="shop-types" aria-label="Shop by device type">
      <button type="button" className={!selection.type.length ? "selected" : ""} aria-pressed={!selection.type.length} onClick={() => setSelection((current) => ({ ...current, type: [] }))}>All devices<small>{products.length}</small></button>
      {typeOptions.map(([label, count]) => {
        const on = selection.type.length === 1 && selection.type[0] === label;
        return <button key={label} type="button" className={on ? "selected" : ""} aria-pressed={on} onClick={() => setSelection((current) => ({ ...current, type: on ? [] : [label] }))}>{label}<small>{count}</small></button>;
      })}
    </nav>}

    <div className="shop-layout">
      <aside className={`shop-filters ${filtersOpen ? "is-open" : ""}`} aria-label="Filters">
        <div className="shop-filters-head">
          <strong><SlidersHorizontal size={15}/>Filters</strong>
          {filterCount > 0 && <button type="button" onClick={clearAll}>Clear all</button>}
          <button type="button" className="shop-filters-close" aria-label="Close filters" onClick={() => setFiltersOpen(false)}><X size={18}/></button>
        </div>
        <label className="shop-toggle">
          <input type="checkbox" checked={pricedOnly} onChange={(event) => setPricedOnly(event.target.checked)}/>
          <span aria-hidden="true"/>
          Price listed only
        </label>
        {facetKeys.map((key) => <FacetGroup key={key} facet={key} options={options[key]} selected={selection[key]} onToggle={(value) => toggle(key, value)} logos={key === "store" ? logos : undefined}/>)}
        <button type="button" className="primary-button shop-filters-done" onClick={() => setFiltersOpen(false)}>Show {shown.length} {shown.length === 1 ? "device" : "devices"}</button>
      </aside>
      {filtersOpen && <button type="button" className="shop-filters-scrim" aria-label="Close filters" onClick={() => setFiltersOpen(false)}/>}

      <div className="shop-results">
        <div className="shop-toolbar">
          <button type="button" className="shop-filter-button" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={15}/>Filters{filterCount > 0 && <small>{filterCount}</small>}</button>
          <p aria-live="polite"><b>{shown.length}</b> {shown.length === 1 ? "device" : "devices"}{needle && <> for “{query.trim()}”</>}</p>
          <label className="shop-sort"><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>{Object.entries(sorts).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>

        {(active.length > 0 || pricedOnly || needle) && <div className="shop-chips" aria-label="Active filters">
          {needle && <button type="button" onClick={() => onQuery("")}><Search size={12}/>“{query.trim()}”<X size={13}/></button>}
          {pricedOnly && <button type="button" onClick={() => setPricedOnly(false)}>Price listed<X size={13}/></button>}
          {active.map((item) => <button key={`${item.key}:${item.value}`} type="button" onClick={() => toggle(item.key, item.value)} aria-label={`Remove ${item.value}`}>{item.value}<X size={13}/></button>)}
          <button type="button" className="is-clear" onClick={clearAll}>Clear all</button>
        </div>}

        {shown.length
          ? <div className="product-grid shop-grid">{shown.map((product) => <ProductCard key={product.id} product={product} href={productPageUrl(product.id)} showStore canEnquire={canEnquire} enquired={sentFor(product.id)}/>)}</div>
          : <div className="store-empty"><Search/><strong>No devices match</strong><p>Try removing a filter or searching for something broader.</p><button type="button" className="secondary-button" onClick={clearAll}>Clear all filters</button></div>}
      </div>
    </div>
  </div>;
}
