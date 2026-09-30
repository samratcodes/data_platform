import { useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, MapPin } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { isPublicAsset } from "@/lib/image";

/*
 * "Desk" building blocks shared by the data-company and device-company dashboards:
 * a quiet header, a ledger of numbers, a slim setup bar, and numbered sections on
 * hairlines instead of cards, with a side column for conversations and shortcuts.
 */

export function DeskHeader({ logo, name, kind, kindIcon, place, status, actions, notice, tone = "collection", greeting }: {
  /** Colours the banner: green for data-collection companies, teal for device manufacturers. */
  tone?: "collection" | "device";
  /** A short line above the name, e.g. "Good morning, Sam". */
  greeting?: string;
  logo?: string | null;
  name: string;
  kind: string;
  kindIcon: ReactNode;
  place?: string;
  status?: string;
  actions: ReactNode;
  notice?: ReactNode;
}) {
  return <header className={`desk-header is-${tone}`}>
    <span className="desk-header-grid" aria-hidden/>
    <div className="desk-identity">
      <span className="desk-logo">{logo ? <Image src={logo} alt="" fill unoptimized={!isPublicAsset(logo)} sizes="96px"/> : <Building2 size={22}/>}</span>
      <div>
        {greeting && <span className="desk-greeting">{greeting}</span>}
        <span className="desk-kind">{kindIcon}{kind}</span>
        <h1>{name}</h1>
        <p>{place && <span><MapPin size={13}/>{place}</span>}{status && <StatusBadge status={status}/>}</p>
      </div>
    </div>
    <div className="desk-actions">{actions}</div>
    {notice && <div className="desk-notice">{notice}</div>}
  </header>;
}

export type LedgerItem = { label: string; value: number | string; detail?: string; href?: string; highlight?: boolean };

/** The dashboard's key numbers on one ruled line. */
export function DeskLedger({ items }: { items: LedgerItem[] }) {
  return <dl className="desk-ledger">{items.map((item) => {
    const body = <><dt>{item.highlight && <i aria-hidden="true"/>}{item.label}</dt><dd><strong>{item.value}</strong>{item.detail && <small>{item.detail}</small>}</dd></>;
    return item.href
      ? <Link key={item.label} href={item.href} className={`desk-ledger-item ${item.highlight ? "is-highlight" : ""}`}>{body}</Link>
      : <div key={item.label} className={`desk-ledger-item ${item.highlight ? "is-highlight" : ""}`}>{body}</div>;
  })}</dl>;
}

export type DeskStep = { title: string; done: boolean; href?: string };

/** A slim setup bar that names the next step, and disappears once every step is done. */
export function DeskProgress({ steps }: { steps: DeskStep[] }) {
  const next = steps.find((step) => !step.done);
  if (!next) return null;
  const done = steps.filter((step) => step.done).length;
  return <div className="desk-progress" aria-label="Setup progress">
    <div className="desk-progress-bar" aria-hidden="true">{steps.map((step) => <span key={step.title} className={step.done ? "is-done" : step === next ? "is-next" : ""}/>)}</div>
    <p><b>Setup {done}/{steps.length}</b><span>Next: {next.href ? <Link href={next.href}>{next.title}<ArrowRight size={13}/></Link> : next.title}</span></p>
  </div>;
}

/** A numbered section on a hairline, with an optional count and action. */
export function DeskSection({ id, index, title, count, action, children }: { id: string; index: number; title: string; count?: number; action?: ReactNode; children: ReactNode }) {
  return <section className="desk-section" aria-labelledby={id}>
    <div className="desk-section-head">
      <span className="desk-section-index">{String(index).padStart(2, "0")}</span>
      <h2 id={id}>{title}{count !== undefined && count > 0 && <small>{count}</small>}</h2>
      {action && <div className="desk-section-action">{action}</div>}
    </div>
    {children}
  </section>;
}

/** Empty state inside a section: one line of copy and an optional action. */
export function DeskEmpty({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return <div className="desk-empty"><span>{icon}</span><div><strong>{title}</strong><p>{text}</p></div>{action}</div>;
}

/** The dashboard body: the main column and the side column, which stacks below on small screens. */
export function DeskGrid({ side, children }: { side: ReactNode; children: ReactNode }) {
  return <div className="desk-grid"><div className="desk-main">{children}</div><aside className="desk-side">{side}</aside></div>;
}

const noSubscription = () => () => {};

/** "Good morning, Sam" in the viewer's own time zone; empty during server rendering to avoid a hydration mismatch. */
export function useGreeting(name: string) {
  const hour = useSyncExternalStore(noSubscription, () => new Date().getHours(), () => -1);
  if (hour < 0) return "";
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return `${part}, ${name.split(" ")[0]}`;
}

/** A small titled block in the side column. */
export function DeskSideBlock({ title, children }: { title: string; children: ReactNode }) {
  return <section className="desk-side-block"><h3>{title}</h3>{children}</section>;
}
