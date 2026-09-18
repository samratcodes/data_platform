"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ClipboardCheck, Clock3, Factory, FileText, ImagePlus, LockKeyhole, MapPinned, Plus, ShieldAlert, Users } from "lucide-react";
import { formatCount, parseFacilityDetails } from "@/lib/facility";
import type { User } from "@/types/app";
import type { SupplierCompany, SupplierListing } from "@/types/supplier";
import FacilityCard from "./FacilityCard";
import SupplierShell, { SideCard, SideSteps } from "./SupplierShell";
import { facilityState, type FacilityState } from "./facility-status";

const notices: Record<string, string> = {
  submitted: "Application submitted. Our team reviews it, and the facility appears on the map once approved.",
  partial: "Application submitted, but some files could not be uploaded. Open the facility and add them again.",
};
const filters: Array<{ key: "all" | FacilityState; label: string }> = [
  { key: "all", label: "All" }, { key: "live", label: "Live" }, { key: "review", label: "In review" }, { key: "changes", label: "Changes in review" }, { key: "rejected", label: "Needs update" },
];

/** The Facilities section: every facility's status at a glance, with a way to apply for another. */
export default function FacilitiesOverview({ user, company, facilities, notice: noticeKey }: { user: User; company: SupplierCompany | null; facilities: SupplierListing[]; notice?: string }) {
  const [filter, setFilter] = useState<"all" | FacilityState>("all");
  const notice = noticeKey ? notices[noticeKey] : "";
  useEffect(() => { if (noticeKey) window.history.replaceState(null, "", "/supplier/facilities"); }, [noticeKey]);

  const approved = company?.status === "approved";
  const states = facilities.map((facility) => facilityState(facility));
  const count = (state: FacilityState) => states.filter((item) => item === state).length;
  const shown = filter === "all" ? facilities : facilities.filter((_, index) => states[index] === filter);
  const workers = facilities.reduce((sum, facility) => sum + (parseFacilityDetails(facility.facility_details)?.totalWorkers ?? 0), 0);
  const apply = approved
    ? <Link className="primary-button" href="/supplier/facilities/new"><Plus size={15}/>Apply for a new facility</Link>
    : <span className="primary-button is-disabled" aria-disabled="true" title="Available after your company is approved"><Plus size={15}/>Apply for a new facility</span>;

  return <SupplierShell
    user={user} active="facility" eyebrow="FACILITIES" title="Your facilities"
    description="Every facility has its own dashboard with review status, workforce, photos, and buyer activity."
    actions={apply}
    notice={notice && <p className="settings-message settings-success" role="status">{notice}</p>}
    aside={<>
      {!approved && <SideCard title="Applications are locked" icon={<LockKeyhole size={16}/>} tone="muted"><p>{company ? "Your company profile is being reviewed. You can apply for facilities as soon as it is approved." : "Complete your company profile first. Facilities belong to a verified data company."}</p><Link className="secondary-button" href="/onboarding">Company profile</Link></SideCard>}
      <SideCard title="How a facility goes live" icon={<ClipboardCheck size={16}/>}>
        <SideSteps items={[
          { title: "Apply", detail: "Type, workforce, capabilities, location, documents, and photos." },
          { title: "Review", detail: "Our team checks the documents and location, usually within two business days." },
          { title: "Live on the map", detail: "Approved facilities get their own pin and profile for buyers." },
        ]}/>
      </SideCard>
      <SideCard title="What you'll need" icon={<FileText size={16}/>}>
        <ul className="side-list">
          <li><Users size={14}/>Worker counts: total, seated hand tasks, and tasks with movement</li>
          <li><MapPinned size={14}/>The exact location or a Google Maps link</li>
          <li><FileText size={14}/>A registration certificate or operating license</li>
          <li><ImagePlus size={14}/>At least one photo of the site</li>
        </ul>
      </SideCard>
    </>}
  >
    <div className="supplier-metrics facility-summary">
      <article><Factory/><strong>{facilities.length}</strong><span>Facilities</span></article>
      <article><CheckCircle2/><strong>{count("live") + count("changes")}</strong><span>Live on the map</span></article>
      <article><Clock3/><strong>{count("review") + count("changes")}</strong><span>In review</span></article>
      <article><Users/><strong>{formatCount(workers)}</strong><span>Workers</span></article>
    </div>

    {facilities.length > 0 && <div className="facility-filters" role="tablist" aria-label="Filter facilities">{filters.filter((item) => item.key === "all" || count(item.key) > 0).map((item) => <button key={item.key} type="button" role="tab" aria-selected={filter === item.key} className={filter === item.key ? "selected" : ""} onClick={() => setFilter(item.key)}>{item.key === "rejected" && <ShieldAlert size={14}/>}{item.label}<small>{item.key === "all" ? facilities.length : count(item.key)}</small></button>)}</div>}

    {facilities.length
      ? <div className="factory-grid">{shown.map((facility) => <FacilityCard key={facility.id} listing={facility} companyLogo={user.companyLogo}/>)}</div>
      : <div className="factory-empty">
        <span><Factory/></span>
        <div><strong>{approved ? "Apply for your first facility" : "Your facilities will appear here"}</strong><p>{approved ? "Tell us the facility type, workforce, and location, and add its documents and photos. Once approved, it gets its own pin on the map." : "Facility applications unlock once your company profile is approved."}</p></div>
        {apply}
      </div>}
  </SupplierShell>;
}
