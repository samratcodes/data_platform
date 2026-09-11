"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { ClipboardCheck, Grid2X2, ListPlus, LogOut, Map, Search } from "lucide-react";
import Brand from "./Brand";
import { api, type User } from "./model";

type Props = {
  user: User;
  active: "map" | "workspace" | "settings" | "supplier" | "onboarding" | "admin";
  onSearch?: () => void;
  searchActive?: boolean;
};

const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

export default function BuyerNavigationRail({ user, active, onSearch, searchActive = false }: Props) {
  const router = useRouter();
  // Keep extension-prone profile text out of the server DOM until hydration finishes.
  const mounted = useSyncExternalStore(subscribeToHydration, getClientHydrationSnapshot, getServerHydrationSnapshot);
  const initials = user.name.split(" ").map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
    router.replace("/");
  };

  return <aside className={`glass buyer-navigation-rail role-${user.role}`} aria-label={`${user.role} navigation`}>
    <Brand/>
    <nav>
      <Link className={active === "map" ? "active" : ""} href="/map" aria-label="Explore map"><Map size={19}/><span className="rail-label">Explore map</span></Link>
      {user.role === "buyer" && (onSearch
        ? <button type="button" className={searchActive ? "active" : ""} onClick={onSearch} aria-label="Search and filter providers" aria-expanded={searchActive}><Search size={19}/><span className="rail-label">Search and filters</span></button>
        : <Link href="/map?search=1" aria-label="Search and filter providers"><Search size={19}/><span className="rail-label">Search and filters</span></Link>)}
      {user.role === "buyer" && <Link className={active === "workspace" ? "active" : ""} href="/dashboard" aria-label="My workspace"><Grid2X2 size={18}/><span className="rail-label">My workspace</span></Link>}
      {user.role === "supplier" && <>
        <Link className={active === "supplier" ? "active" : ""} href="/supplier" aria-label="Supplier workspace"><Grid2X2 size={18}/><span className="rail-label">Supplier workspace</span></Link>
        <Link className={active === "onboarding" ? "active" : ""} href="/onboarding" aria-label="Company profile and facilities"><ListPlus size={18}/><span className="rail-label">Profile & facilities</span></Link>
      </>}
      {user.role === "admin" && <Link className={active === "admin" ? "active" : ""} href="/admin/companies" aria-label="Verification queue"><ClipboardCheck size={18}/><span className="rail-label">Verification queue</span></Link>}
    </nav>
    <div className="buyer-rail-bottom">
      {mounted
        ? <Link className={`buyer-rail-avatar ${active === "settings" ? "active" : ""}`} href="/settings" aria-label={`Profile and settings for ${user.name}`} title={`${user.name} · ${user.email}`}><b>{initials}</b><span className="rail-label">Profile &amp; settings</span></Link>
        : <span className={`buyer-rail-avatar-placeholder ${active === "settings" ? "active" : ""}`} aria-hidden="true"/>}
      <button type="button" className="buyer-rail-logout" onClick={logout} aria-label="Log out"><LogOut size={17}/><span className="rail-label">Log out</span></button>
    </div>
  </aside>;
}
