"use client";

import Link from "next/link";
import Image from "next/image";
import { isPublicAsset } from "@/lib/image";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Building2, Factory, Grid2X2, LayoutDashboard, LoaderCircle, LogOut, Map, Search } from "lucide-react";
import Brand from "@/components/ui/Brand";
import { api } from "@/lib/api-client";
import type { User } from "@/types/app";

type Props = {
  user: User;
  active: "map" | "workspace" | "settings" | "supplier" | "facility" | "onboarding" | "admin";
  onSearch?: () => void;
  searchActive?: boolean;
};

const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

export default function AppNavigationRail({ user, active, onSearch, searchActive = false }: Props) {
  const router = useRouter();
  // Keep extension-prone profile text out of the server DOM until hydration finishes.
  const mounted = useSyncExternalStore(subscribeToHydration, getClientHydrationSnapshot, getServerHydrationSnapshot);
  const initials = user.name.split(" ").map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  const [loggingOut, setLoggingOut] = useState(false);

  // Leave the app even if the request fails: an unreachable or already-expired session
  // should never trap the user on a protected page.
  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try { await api("/api/auth/logout", { method: "POST", body: "{}" }); }
    catch (reason) { console.warn("[logout] The server could not end the session.", reason); }
    router.replace("/");
    router.refresh();
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
        <Link className={active === "supplier" ? "active" : ""} href="/supplier" aria-label="Workspace"><Grid2X2 size={18}/><span className="rail-label">Workspace</span></Link>
        <Link className={active === "facility" ? "active" : ""} href="/supplier/facilities" aria-label="Facilities"><Factory size={18}/><span className="rail-label">Facilities</span></Link>
        <Link className={active === "onboarding" ? "active" : ""} href="/onboarding" aria-label="Company profile"><Building2 size={18}/><span className="rail-label">Company profile</span></Link>
      </>}
      {user.role === "admin" && <Link className={active === "admin" ? "active" : ""} href="/admin" aria-label="Admin console"><LayoutDashboard size={18}/><span className="rail-label">Admin console</span></Link>}
    </nav>
    <div className="buyer-rail-bottom">
      {mounted
        ? <Link className={`buyer-rail-avatar ${active === "settings" ? "active" : ""}`} href="/settings" aria-label={`Profile and settings for ${user.name}`} title={`${user.name} · ${user.email}`}>{user.companyLogo ? <b className="buyer-rail-logo"><Image src={user.companyLogo} alt="" fill unoptimized={!isPublicAsset(user.companyLogo)} sizes="30px"/></b> : <b>{initials}</b>}<span className="rail-label">Profile &amp; settings</span></Link>
        : <span className={`buyer-rail-avatar-placeholder ${active === "settings" ? "active" : ""}`} aria-hidden="true"/>}
      <button type="button" className="buyer-rail-logout" onClick={logout} disabled={loggingOut} aria-busy={loggingOut} aria-label="Log out">{loggingOut ? <LoaderCircle size={17} className="spin"/> : <LogOut size={17}/>}<span className="rail-label">Log out</span></button>
    </div>
  </aside>;
}
