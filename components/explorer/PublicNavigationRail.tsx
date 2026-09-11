"use client";

import Link from "next/link";
import { BookOpen, Info, LogIn, Map, Search } from "lucide-react";
import Brand from "./Brand";

type Props = {
  active?: "map" | "blog" | "login";
  onSearch?: () => void;
  searchActive?: boolean;
};

export default function PublicNavigationRail({ active, onSearch, searchActive = false }: Props) {
  return <aside className="map-sidebar public-navigation-rail" aria-label="map.filemarket navigation">
    <Brand/>
    <nav className="map-sidebar-actions">
      <Link className={active === "map" ? "active" : ""} href="/login?next=/map" aria-label="Log in to explore the map"><Map size={18}/><span>Explore map</span></Link>
      {onSearch && <button className={searchActive ? "active" : ""} aria-label="Search and filter providers" aria-expanded={searchActive} onClick={onSearch}><Search size={18}/><span>Search & filters</span></button>}
      <Link href="/#trust-and-transparency" aria-label="About map.filemarket"><Info size={18}/><span>About</span></Link>
      <Link className={active === "blog" ? "active" : ""} href="/blog" aria-label="map.filemarket insights"><BookOpen size={18}/><span>Insights</span></Link>
      <Link className={active === "login" ? "active" : ""} href="/login" aria-label="Log in"><LogIn size={18}/><span>Log in</span></Link>
    </nav>
  </aside>;
}
