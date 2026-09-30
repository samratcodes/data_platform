"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, MapPin, Search, Webcam, X } from "lucide-react";
import AppNavigationRail from "@/components/navigation/AppNavigationRail";
import { DeskLedger } from "@/components/supplier/Desk";
import VerificationBar from "@/components/supplier/VerificationBar";
import ProviderLogo from "@/components/ui/ProviderLogo";
import type { StoreProduct } from "@/lib/devices";
import type { PublicOperator, User } from "@/types/app";
import MarketplaceBrowser from "./MarketplaceBrowser";

/** Every published device across the verified stores, laid out as a shop for data companies and buyers equipping a capture project. */
export default function DeviceMarketplace({ user, products, stores }: { user: User; products: StoreProduct[]; stores: PublicOperator[] }) {
  const ownStore = user.companyFocus === "devices";
  const [query, setQuery] = useState("");
  const typeCount = new Set(products.map((product) => product.category === "other" ? product.categoryOther : product.category)).size;

  return <main className="sourcing-app store-page device-marketplace">
    <AppNavigationRail user={user} active="devices"/>
    <div className="store-shell">
      <VerificationBar user={user}/>
      <header className="shop-hero">
        <span className="desk-header-grid" aria-hidden/>
        <div className="shop-hero-copy">
          <span className="desk-kind"><Webcam size={14}/>Device marketplace</span>
          <h1>Devices for data collection</h1>
          <p>Cameras, wearables, and capture hardware from verified device companies. Compare spec sheets and send an enquiry straight to the store.</p>
        </div>
        <Link className="secondary-button shop-hero-map" href="/map"><MapPin size={15}/>Find stores on the map</Link>
        <label className="shop-hero-search">
          <Search size={18}/>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search devices, stores, or data types" aria-label="Search devices"/>
          {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={15}/></button>}
        </label>
      </header>

      <DeskLedger items={[
        { label: "Devices listed", value: products.length, highlight: true },
        { label: "Verified stores", value: stores.length },
        { label: "Device types", value: typeCount },
        { label: "Countries", value: new Set(stores.map((store) => store.country)).size },
      ]}/>

      <MarketplaceBrowser products={products} query={query} onQuery={setQuery} canEnquire={!ownStore}/>

      {stores.length > 0 && <section className="shop-stores" aria-labelledby="marketplace-stores-title">
        <div className="desk-section-head">
          <h2 id="marketplace-stores-title">Shop by store<small>{stores.length}</small></h2>
          <Link className="desk-link desk-section-action" href="/map">View on map<ArrowUpRight size={14}/></Link>
        </div>
        <div className="store-strip">{stores.map((store) => <Link key={store.slug} className="store-strip-card" href={`/operators/${store.slug}`}>
          <ProviderLogo name={store.name} logo={store.profile.logo} type={store.type} size={44}/>
          <span><strong>{store.name}</strong><small>{store.city}, {store.country} · {store.productCount ?? 0} {store.productCount === 1 ? "product" : "products"}</small></span>
          <ArrowUpRight size={15}/>
        </Link>)}</div>
      </section>}
    </div>
  </main>;
}
