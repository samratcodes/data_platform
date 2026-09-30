import type { ReactNode } from "react";
import Image from "next/image";
import { Building2, Check, MapPin } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { isPublicAsset } from "@/lib/image";

type Step = { title: string; done: boolean };

/**
 * The top of a company dashboard: a compact profile (logo, name, kind, place, status),
 * its main actions, and a slim setup checklist that disappears once every step is done.
 */
export default function CompanyOverview({ logo, name, kind, kindIcon, place, status, actions, steps, notice }: {
  logo?: string | null;
  name: string;
  kind: string;
  kindIcon: ReactNode;
  place?: string;
  status?: string;
  actions: ReactNode;
  steps?: Step[];
  /** Admin feedback or another short message about the company. */
  notice?: ReactNode;
}) {
  const current = steps?.findIndex((step) => !step.done) ?? -1;
  return <section className="company-overview" aria-label={`${name} overview`}>
    <div className="company-overview-head">
      <span className="company-overview-logo">{logo ? <Image src={logo} alt="" fill unoptimized={!isPublicAsset(logo)} sizes="64px"/> : <Building2/>}</span>
      <div className="company-overview-copy">
        <span className="company-overview-kind">{kindIcon}{kind}</span>
        <h1>{name}</h1>
        <p>{place && <><MapPin size={13}/>{place}</>}{status && <StatusBadge status={status}/>}</p>
      </div>
      <div className="company-overview-actions">{actions}</div>
    </div>
    {notice}
    {steps && current >= 0 && <ol className="company-overview-steps" aria-label="Setup progress">{steps.map((step, index) => <li key={step.title} className={step.done ? "is-done" : index === current ? "is-current" : ""}>
      <span>{step.done ? <Check size={12}/> : index + 1}</span>{step.title}
    </li>)}</ol>}
  </section>;
}
