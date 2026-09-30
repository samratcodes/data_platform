"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Database, Factory, Pencil, Plus } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatCount, parseFacilityDetails } from "@/lib/facility";
import type { SentEnquiry } from "@/lib/devices";
import type { User } from "@/types/app";
import type { SupplierListing } from "@/types/supplier";
import Inbox from "@/components/messaging/Inbox";
import SupplierRequests, { type SupplierAccessRequest } from "./SupplierRequests";
import FacilityCard from "./FacilityCard";
import CompanyProfileCard from "./CompanyProfileCard";
import SupplierShell from "./SupplierShell";
import SentEnquiries from "./SentEnquiries";
import { DeskEmpty, DeskGrid, DeskHeader, DeskLedger, DeskProgress, DeskSection, DeskSideBlock, useGreeting } from "./Desk";
import { isLive } from "./facility-status";

type Dashboard = {
  listings: SupplierListing[];
  conversations: Array<{ id: string; operator_slug: string }>;
  accessRequests: SupplierAccessRequest[];
};

const PREVIEW_COUNT = 4;

/** The data-company home: facilities, buyer requests, and the devices it is sourcing, with conversations beside them. */
export default function SupplierDashboard({ user, sentEnquiries }: { user: User; sentEnquiries: SentEnquiry[] }) {
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
  const openRequests = data?.accessRequests.filter((request) => request.status !== "accepted" && request.status !== "declined").length ?? 0;
  const replied = sentEnquiries.filter((enquiry) => enquiry.status === "replied").length;
  const greeting = useGreeting(user.name);
  const apply = companyApproved
    ? <Link className="primary-button" href="/supplier/facilities/new"><Plus size={15}/>Add facility</Link>
    : <span className="primary-button is-disabled" aria-disabled="true" title="Available after your company is approved"><Plus size={15}/>Add facility</span>;

  return <SupplierShell
    user={user} active="supplier"
    notice={error && <p className="form-error">{error}</p>}
    header={<DeskHeader
      greeting={greeting} logo={user.companyLogo} name={company?.business_name || user.companyName || user.name} kind="Data collection company" kindIcon={<Database size={13}/>}
      place={[company?.city, company?.country].filter(Boolean).join(", ")} status={company?.status}
      actions={<>
        <Link className="secondary-button" href="/onboarding#company-profile"><Pencil size={14}/>Edit profile</Link>
        {company?.provider_slug && isLive(company) && <Link className="secondary-button" href={`/operators/${company.provider_slug}`}>Public profile<ArrowUpRight size={14}/></Link>}
        {apply}
      </>}
      notice={company?.status === "rejected" && company.admin_notes ? <p className="factory-card-feedback">{company.admin_notes}</p> : null}
    />}
  >
    <DeskLedger items={[
      { label: "Facilities", value: data ? facilities.length : "–", detail: `${formatCount(workers)} workers`, href: "/supplier/facilities" },
      { label: "Profile views", value: data ? total("profile_views") : "–", detail: "across live listings" },
      { label: "Open data requests", value: data ? openRequests : "–", detail: `${total("access_requests")} total`, highlight: openRequests > 0, href: "#data-requests-title" },
      { label: "Device enquiries", value: sentEnquiries.length, detail: `${replied} replied`, highlight: replied > 0, href: "#device-enquiries-title" },
    ]}/>
    {data && <DeskProgress steps={[
      { title: "Company profile", done: Boolean(company), href: "/onboarding" },
      { title: "Company approval", done: companyApproved },
      { title: "Add your first facility", done: facilities.length > 0, href: "/supplier/facilities/new" },
      { title: "Go live on the map", done: facilities.some(isLive) },
    ]}/>}

    <DeskGrid side={<>
      <CompanyProfileCard user={user} name={company?.business_name || user.companyName || user.name} detail={[company?.city, company?.country].filter(Boolean).join(", ") || "Data collection company"}
        feedback={company?.status === "rejected" ? company.admin_notes : null} publicHref={company?.provider_slug && isLive(company) ? `/operators/${company.provider_slug}` : null}/>
      <DeskSideBlock title="Conversations"><Inbox/></DeskSideBlock>
      <DeskSideBlock title="Shortcuts">
        <nav className="desk-links">
          <Link href="/supplier/facilities">All facilities<ArrowRight size={14}/></Link>
          <Link href="/devices">Device marketplace<ArrowRight size={14}/></Link>
          <Link href="/map">Explore map<ArrowRight size={14}/></Link>
          <Link href="/onboarding">Company profile<ArrowRight size={14}/></Link>
        </nav>
      </DeskSideBlock>
    </>}>
      <DeskSection id="facilities-title" index={1} title="Facilities" count={facilities.length} action={<Link className="desk-link" href="/supplier/facilities">{facilities.length ? "Manage facilities" : "Facilities"}<ArrowRight size={14}/></Link>}>
        {!data ? <p className="desk-quiet">Loading facilities…</p>
          : facilities.length ? <div className="factory-grid desk-facility-grid">{facilities.slice(0, PREVIEW_COUNT).map((listing) => <FacilityCard key={listing.id} listing={listing} companyLogo={user.companyLogo}/>)}</div>
            : <DeskEmpty icon={<Factory size={18}/>}
              title={companyApproved ? "Add your first facility" : "Facilities unlock after approval"}
              text={companyApproved ? "Tell us the facility type, workforce, and location. Once approved, it gets its own pin on the map." : "Your facilities appear here once your company profile is approved."}
              action={companyApproved ? apply : undefined}/>}
      </DeskSection>

      <DeskSection id="data-requests-title" index={2} title="Data requests" count={openRequests}>
        <SupplierRequests embedded requests={data?.accessRequests ?? []} busy={requestBusy} onStatus={async (requestId, status) => {
          setRequestBusy(requestId); setError("");
          try { await api("/api/supplier/dashboard", { method: "PATCH", body: JSON.stringify({ action: "request-status", requestId, status }) }); await load(); }
          catch (reason) { setError((reason as Error).message); }
          finally { setRequestBusy(""); }
        }}/>
      </DeskSection>

      <DeskSection id="device-enquiries-title" index={3} title="Device enquiries" count={sentEnquiries.length} action={sentEnquiries.length > 0 && <Link className="desk-link" href="/devices">Browse devices<ArrowRight size={14}/></Link>}>
        <SentEnquiries enquiries={sentEnquiries}/>
      </DeskSection>
    </DeskGrid>
  </SupplierShell>;
}
