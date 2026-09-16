"use client";

import Link from "next/link";
import { BookOpen, LogIn, Map, MapPinned, Search } from "lucide-react";
import Brand from "@/components/ui/Brand";

type Props = {
  active?: "map" | "blog" | "login" | "supplier-signup";
  onSearch?: () => void;
  searchActive?: boolean;
};

export default function PublicNavigationRail({ active, onSearch, searchActive = false }: Props) {
  return <aside className="map-sidebar public-navigation-rail" aria-label="map.filemarket navigation">
    <Brand/>
    <nav className="map-sidebar-actions">
      <Link className={active === "map" ? "active" : ""} href="/" aria-label="Explore the public map"><Map size={18}/><span>Explore map</span></Link>
      {onSearch && <button className={searchActive ? "active" : ""} aria-label="Search and filter providers" aria-expanded={searchActive} onClick={onSearch}><Search size={18}/><span>Search & filters</span></button>}
      <Link className={active === "blog" ? "active" : ""} href="/blog" aria-label="map.filemarket insights"><BookOpen size={18}/><span>Insights</span></Link>
      <Link className={`rail-account-link rail-company-signup ${active === "supplier-signup" ? "active" : ""}`} href="/signup/data-company" aria-label="Register data company"><MapPinned size={18}/><span>Register data company</span></Link>
      <Link className={active === "login" ? "active" : ""} href="/login" aria-label="Log in"><LogIn size={18}/><span>Log in</span></Link>
    </nav>
  </aside>;
}
