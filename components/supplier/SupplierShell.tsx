import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AppNavigationRail from "@/components/navigation/AppNavigationRail";
import PageHeader from "@/components/ui/PageHeader";
import type { User } from "@/types/app";

/**
 * Shared frame for every data-company page: navigation rail, page header,
 * a main column, and an optional side panel that stacks below on small screens.
 */
export default function SupplierShell({ user, active, eyebrow, title, description, actions, back, aside, notice, children }: {
  user: User;
  active: "supplier" | "facility" | "onboarding";
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  aside?: ReactNode;
  /** Status or error line shown under the header. */
  notice?: ReactNode;
  children: ReactNode;
}) {
  return <main className="sourcing-app admin-page supplier-workspace">
    <AppNavigationRail user={user} active={active}/>
    <section className="admin-shell supplier-shell">
      {back && <Link className="supplier-back" href={back.href}><ArrowLeft size={15}/>{back.label}</Link>}
      <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions}/>
      {notice}
      <div className={`supplier-layout ${aside ? "has-aside" : ""}`}>
        <div className="supplier-main">{children}</div>
        {aside && <aside className="supplier-aside">{aside}</aside>}
      </div>
    </section>
  </main>;
}

/** A titled card for the side panel, used the same way on every data-company page. */
export function SideCard({ title, icon, children, tone }: { title: string; icon?: ReactNode; children: ReactNode; tone?: "accent" | "muted" }) {
  return <section className={`side-card ${tone ? `is-${tone}` : ""}`}>
    <h3>{icon}{title}</h3>
    {children}
  </section>;
}

/** Numbered guidance list for side panels. */
export function SideSteps({ items }: { items: Array<{ title: string; detail: string; done?: boolean; current?: boolean }> }) {
  return <ol className="side-steps">{items.map((item, index) => <li key={item.title} className={item.done ? "is-done" : item.current ? "is-current" : ""}>
    <span>{item.done ? "✓" : index + 1}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div>
  </li>)}</ol>;
}
