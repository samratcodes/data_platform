"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, Building2, Factory, History, LayoutDashboard } from "lucide-react";
import AppNavigationRail from "@/components/navigation/AppNavigationRail";
import { api } from "@/lib/api-client";
import type { AdminOverview } from "@/types/admin";
import type { User } from "@/types/app";

const sections = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/companies", label: "Data companies", icon: Building2 },
  { href: "/admin/facilities", label: "Facilities", icon: Factory },
  { href: "/admin/leads", label: "Concierge leads", icon: BriefcaseBusiness },
  { href: "/admin/activity", label: "Activity log", icon: History },
] as const;

/** Shared frame for every admin page: navigation rail plus section tabs with live queue counts. */
export default function AdminShell({ user, children }: { user: User; children: ReactNode }) {
  const pathname = usePathname();
  const [counts, setCounts] = useState<Partial<Record<(typeof sections)[number]["href"], number>>>({});

  // Refresh the queue badges whenever the administrator moves between sections or finishes a review.
  useEffect(() => {
    const controller = new AbortController();
    api<AdminOverview>("/api/admin/overview", { signal: controller.signal })
      .then((overview) => setCounts({
        "/admin/companies": overview.applications.company.pending,
        "/admin/facilities": overview.applications.facility.pending,
        "/admin/leads": overview.leads.new,
      }))
      .catch(() => {});
    return () => controller.abort();
  }, [pathname]);

  const activeHref = (href: string) => href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return <main className="sourcing-app admin-page">
    <AppNavigationRail user={user} active="admin"/>
    <div className="admin-console">
      <nav className="admin-sections" aria-label="Admin sections">
        {sections.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={activeHref(href) ? "active" : ""} aria-current={activeHref(href) ? "page" : undefined}>
          <Icon size={16}/><span>{label}</span>{counts[href] ? <b aria-label={`${counts[href]} waiting`}>{counts[href]}</b> : null}
        </Link>)}
      </nav>
      {children}
    </div>
  </main>;
}
