"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { isPublicAsset } from "@/lib/image";
import { ArrowRight, Building2, Eye, Factory, FileQuestion, ListChecks, MessageSquare, Pencil, Plus, Zap } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { api } from "@/lib/api-client";
import { formatCount, parseFacilityDetails } from "@/lib/facility";
import type { User } from "@/types/app";
import type { SupplierListing } from "@/types/supplier";
import Inbox from "@/components/messaging/Inbox";
import SupplierRequests, { type SupplierAccessRequest } from "./SupplierRequests";
import FacilityCard from "./FacilityCard";
import SupplierShell, { SideCard, SideSteps } from "./SupplierShell";
import { isLive } from "./facility-status";

type Dashboard = {
  listings: SupplierListing[];
  conversations: Array<{ id: string; operator_slug: string }>;
  accessRequests: SupplierAccessRequest[];
};

const PREVIEW_COUNT = 3;

/** The data-company home: activity across every listing, a glance at facilities, and buyer requests. */
export default function SupplierDashboard({ user }: { user: User }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [requestBusy, setRequestBusy] = useState("");
  const load = async () => setData(await api<Dashboard>("/api/supplier/dashboard"));

  useEffect(() => {
    api<Dashboard>("/api/supplier/dashboard").then(setData).catch((reason) => setError(reason.message));
  }, []);

  const company = data?.listings.find((listing) => listing.application_kind === "company");
  const facilities = data?.listings.filter((listing) => listing.application_kind === "facility") ?? [];
  const companyApproved = company?.status === "approved" || Boolean(company && isLive(company));
  const liveListings = data?.listings.filter(isLive) ?? [];
  const total = (key: "profile_views" | "access_requests") => liveListings.reduce((sum, listing) => sum + listing[key], 0);
  const workers = facilities.reduce((sum, listing) => sum + (parseFacilityDetails(listing.facility_details)?.totalWorkers ?? 0), 0);
  const journey = [
    { title: "Company profile", detail: "Submitted for review", done: Boolean(company) },
    { title: "Company approved", detail: "Unlocks facility applications", done: companyApproved },
    { title: "First facility", detail: "Apply with workforce, documents, and photos", done: facilities.length > 0 },
    { title: "Live on the map", detail: "Buyers can find and contact you", done: facilities.some(isLive) },
  ].map((item, index, items) => ({ ...item, current: !item.done && items.slice(0, index).every((previous) => previous.done) }));
  const apply = companyApproved
    ? <Link className="primary-button" href="/supplier/facilities/new"><Plus size={15}/>Apply for a new facility</Link>
    : <span className="primary-button is-disabled" aria-disabled="true" title="Available after your company is approved"><Plus size={15}/>Apply for a new facility</span>;

  return <SupplierShell
    user={user} active="supplier" eyebrow="DATA COMPANY WORKSPACE" title={company?.business_name || "Your workspace"}
    description="Activity across your company and facilities, and the buyer requests waiting on you."
    actions={<><Link className="secondary-button" href="/supplier/facilities"><Factory size={15}/>Facilities</Link>{apply}</>}
    notice={error && <p className="form-error">{error}</p>}
    aside={<>
      {company && <SideCard title="Company" icon={<Building2 size={16}/>}>
        <div className="side-company">
          <span className="provider-logo provider-logo-small">{user.companyLogo ? <Image src={user.companyLogo} alt="" fill unoptimized={!isPublicAsset(user.companyLogo)} sizes="40px"/> : <Building2/>}</span>
          <div><strong>{company.business_name}</strong><small>{isLive(company) ? `${company.profile_views} profile views` : "Data company profile"}</small></div>
          <StatusBadge status={company.status}/>
        </div>
        {company.status === "rejected" && company.admin_notes && <p className="factory-card-feedback">{company.admin_notes}</p>}
        <Link className="secondary-button" href="/onboarding"><Pencil size={14}/>Edit company profile</Link>
      </SideCard>}
      {data && !journey.every((item) => item.done) && <SideCard title="Getting listed" icon={<ListChecks size={16}/>}><SideSteps items={journey}/></SideCard>}
      <SideCard title="Quick actions" icon={<Zap size={16}/>} tone="accent">
        <div className="side-actions">
          <Link href="/supplier/facilities">View all facilities<ArrowRight size={14}/></Link>
          {companyApproved && <Link href="/supplier/facilities/new">Apply for a new facility<ArrowRight size={14}/></Link>}
          <Link href="/onboarding">Update company profile<ArrowRight size={14}/></Link>
          <Link href="/map">See the public map<ArrowRight size={14}/></Link>
        </div>
      </SideCard>
    </>}
  >
    <div className="supplier-metrics">
      <article><Factory/><strong>{facilities.length}</strong><span>Facilities · {formatCount(workers)} workers</span></article>
      <article><Eye/><strong>{total("profile_views")}</strong><span>Profile views</span></article>
      <article><FileQuestion/><strong>{total("access_requests")}</strong><span>Data requests</span></article>
      <article><MessageSquare/><strong>{data?.conversations.length ?? 0}</strong><span>Conversations</span></article>
    </div>

    <section className="supplier-factories" aria-labelledby="facilities-title">
      <div className="supplier-heading"><div><span className="section-kicker">FACILITIES</span><h2 id="facilities-title">Your facilities {facilities.length > 0 && <small>{facilities.length}</small>}</h2></div>{facilities.length > 0 && <Link className="secondary-button" href="/supplier/facilities">View all<ArrowRight size={14}/></Link>}</div>
      {!data ? <p className="workspace-empty">Loading facilities…</p>
        : facilities.length ? <div className="factory-grid">{facilities.slice(0, PREVIEW_COUNT).map((listing) => <FacilityCard key={listing.id} listing={listing} companyLogo={user.companyLogo}/>)}</div>
          : <div className="factory-empty">
            <span><Factory/></span>
            <div><strong>{companyApproved ? "Apply for your first facility" : "Your facilities will appear here"}</strong><p>{companyApproved ? "Tell us the facility type, workforce, and location, and add its documents and photos. Once approved, it gets its own pin on the map." : "Facility applications unlock once your company profile is approved."}</p></div>
            {apply}
          </div>}
    </section>

    <SupplierRequests requests={data?.accessRequests ?? []} busy={requestBusy} onStatus={async (requestId, status) => {
      setRequestBusy(requestId); setError("");
      try { await api("/api/supplier/dashboard", { method: "PATCH", body: JSON.stringify({ action: "request-status", requestId, status }) }); await load(); }
      catch (reason) { setError((reason as Error).message); }
      finally { setRequestBusy(""); }
    }}/>
    <Inbox/>
  </SupplierShell>;
}
