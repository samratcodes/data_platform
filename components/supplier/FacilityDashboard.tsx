"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Bookmark, CalendarClock, Check, Eye, FileLock2, FileQuestion, FileText, Footprints, Hand, Layers, MapPin, MessageSquare, Pencil, ShieldCheck, Users } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import ProviderMediaManager from "@/components/media/ProviderMediaManager";
import { api } from "@/lib/api-client";
import { factoryCategoryLabel, formatCount, parseFacilityDetails, recordingConsentOptions } from "@/lib/facility";
import { formatBytes, formatDate } from "@/lib/format";
import type { User } from "@/types/app";
import type { FacilityDashboardData } from "@/types/supplier";
import SupplierRequests, { type SupplierAccessRequest } from "./SupplierRequests";
import SupplierShell, { SideCard, SideSteps } from "./SupplierShell";
import { facilityState, facilityStateBadge, facilityStateLabels } from "./facility-status";
import { FacilityAvatar } from "./FacilityCard";

/** One facility's dashboard: review state, listing analytics, workforce, photos, documents, and buyer requests. */
export default function FacilityDashboard({ user, facility, requests, updated }: { user: User; facility: FacilityDashboardData; requests: SupplierAccessRequest[]; updated?: boolean }) {
  const router = useRouter();
  const [notice, setNotice] = useState(updated ? "Changes submitted for review. The approved version stays live until then." : "");
  const [error, setError] = useState("");
  const [requestBusy, setRequestBusy] = useState("");
  useEffect(() => { if (updated) window.history.replaceState(null, "", `/supplier/facilities/${facility.id}`); }, [updated, facility.id]);

  const details = parseFacilityDetails(facility.facility_details);
  const state = facilityState(facility);
  const live = state === "live" || state === "changes";
  const other = details ? Math.max(0, details.totalWorkers - details.seatedWorkers - details.mobileWorkers) : 0;
  const share = (value: number) => `${details?.totalWorkers ? (value / details.totalWorkers) * 100 : 0}%`;
  const place = [facility.city, facility.country].filter(Boolean).join(", ");
  const editHref = `/supplier/facilities/${facility.id}/edit`;

  const timeline = [
    { title: "Application submitted", detail: formatDate(facility.submitted_at), done: true },
    { title: state === "rejected" ? "Changes requested" : "Reviewed by our team", detail: facility.reviewed_at ? formatDate(facility.reviewed_at) : "Usually within two business days", done: Boolean(facility.reviewed_at) && state !== "rejected", current: !facility.reviewed_at || state === "rejected" },
    { title: "Live on the map", detail: live ? (state === "changes" ? "Live while your latest changes are reviewed" : "Visible to buyers") : "After approval", done: live },
  ];

  return <SupplierShell
    user={user} active="facility" back={{ href: "/supplier/facilities", label: "All facilities" }}
    eyebrow={details ? `FACILITY · ${factoryCategoryLabel(details).toUpperCase()}` : "FACILITY"}
    title={<span className="facility-title"><FacilityAvatar photoKey={facility.company_logo?.key} companyLogo={user.companyLogo} size={64} approved={facility.status === "approved"}/>{facility.business_name}</span>}
    description={<span className="facility-dashboard-place"><MapPin size={15}/>{place || "Location not set"}<StatusBadge status={facilityStateBadge[state]} label={facilityStateLabels[state]}/></span>}
    actions={<>{live && <Link className="secondary-button" href={`/operators/${facility.provider_slug}`}>View listing<ArrowUpRight size={15}/></Link>}<Link className="primary-button" href={editHref}><Pencil size={15}/>Edit details</Link></>}
    notice={<>{error && <p className="form-error" role="alert">{error}</p>}{notice && !error && <p className="settings-message settings-success" role="status">{notice}</p>}</>}
    aside={<>
      <SideCard title="Review status" icon={<CalendarClock size={16}/>}><SideSteps items={timeline}/></SideCard>
      <SideCard title="Location" icon={<MapPin size={16}/>}>
        <p className="side-strong">{facility.physical_address || "No address"}</p>
        <p>{place}</p>
        {facility.latitude !== null && facility.longitude !== null && <p className="side-muted">{facility.latitude.toFixed(4)}°, {facility.longitude.toFixed(4)}° · buyers see the city only</p>}
        {facility.maps_url && <a className="text-link" href={facility.maps_url} target="_blank" rel="noreferrer">Open in Google Maps<ArrowUpRight size={13}/></a>}
      </SideCard>
      <SideCard title="Documents" icon={<FileLock2 size={16}/>}>
        {facility.official_documents.length
          ? <ul className="side-documents">{facility.official_documents.map((document) => <li key={document.key}><FileText size={15}/><span><strong>{document.type || "Facility document"}</strong><small>{document.name}{document.size ? ` · ${formatBytes(document.size)}` : ""}</small></span></li>)}</ul>
          : <p>No documents uploaded yet.</p>}
        <p className="side-muted">Only reviewers see documents. Change them from Edit details.</p>
      </SideCard>
    </>}
  >
    {state === "rejected" && <section className="company-review-status" data-status="rejected"><ShieldCheck/><div><strong>This facility needs an update</strong><p>{facility.admin_notes || "Review the feedback, update the facility, and submit it again."}</p></div><Link className="secondary-button" href={editHref}>Update facility</Link></section>}
    {state === "changes" && <section className="company-review-status"><ShieldCheck/><div><strong>Your changes are in review</strong><p>Buyers still see the approved version until the update is approved.</p></div></section>}

    <div className="supplier-metrics">
      <article><Eye/><strong>{facility.profile_views}</strong><span>Profile views</span></article>
      <article><Bookmark/><strong>{facility.saves}</strong><span>Buyer saves</span></article>
      <article><FileQuestion/><strong>{facility.access_requests}</strong><span>Data requests</span></article>
      <article><MessageSquare/><strong>{facility.conversations}</strong><span>Conversations</span></article>
    </div>
    {!live && <p className="fieldset-note">Analytics start once the facility is live on the map.</p>}

    <section className="dashboard-card">
      <header><h2><Users size={18}/>Workforce</h2>{details && <span>{details.shiftsPerDay} {details.shiftsPerDay === 1 ? "shift" : "shifts"} per day</span>}</header>
      {details ? <>
        <div className="facility-workforce-bar is-large" aria-hidden><i data-group="seated" style={{ width: share(details.seatedWorkers) }}/><i data-group="mobile" style={{ width: share(details.mobileWorkers) }}/><i data-group="other" style={{ width: share(other) }}/></div>
        <div className="workforce-tiles">
          <div><span><Users size={16}/></span><strong>{formatCount(details.totalWorkers)}</strong><small>Total workers</small></div>
          <div data-group="seated"><span><Hand size={16}/></span><strong>{formatCount(details.seatedWorkers)}</strong><small>Seated, hand tasks</small></div>
          <div data-group="mobile"><span><Footprints size={16}/></span><strong>{formatCount(details.mobileWorkers)}</strong><small>Tasks with movement</small></div>
          <div data-group="other"><span><Users size={16}/></span><strong>{formatCount(other)}</strong><small>Other roles</small></div>
        </div>
        {details.tasks.length > 0 && <div className="dashboard-chips"><small>Typical tasks</small>{details.tasks.map((task) => <span key={task}><Check size={12}/>{task}</span>)}</div>}
        <p className="side-muted">Recording consent: {recordingConsentOptions.find((option) => option.value === details.recordingConsent)?.label}</p>
      </> : <p className="factory-card-missing">This facility has no workforce details yet. <Link href={editHref}>Add them</Link> to complete it.</p>}
    </section>

    <section className="dashboard-card">
      <header><h2><Layers size={18}/>Data capture</h2></header>
      <div className="dashboard-chips"><small>Capabilities</small>{facility.modalities.map((item) => <span key={item}><Check size={12}/>{item}</span>)}</div>
      {facility.capture_environments.length > 0 && <div className="dashboard-chips"><small>Facility areas</small>{facility.capture_environments.map((item) => <span key={item}>{item}</span>)}</div>}
      <p className="dashboard-description">{facility.profile_description}</p>
    </section>

    <section className="dashboard-card">
      <ProviderMediaManager applicationId={facility.id} title="Profile photo and site photos" description="The profile photo appears on this facility's map pin and profile. Site photos show buyers where data is captured." showLogo logoRequired={false} logoLabel="Facility profile photo" logoNoun="profile photo" logoPhoto logo={facility.company_logo} images={facility.office_images} linkedPhotos={facility.hardware_pictures} onChanged={async (message) => { setError(""); setNotice(message); router.refresh(); }}/>
    </section>

    {live && <SupplierRequests requests={requests} busy={requestBusy} onStatus={async (requestId, status) => {
      setRequestBusy(requestId); setError("");
      try { await api("/api/supplier/dashboard", { method: "PATCH", body: JSON.stringify({ action: "request-status", requestId, status }) }); router.refresh(); }
      catch (reason) { setError((reason as Error).message); }
      finally { setRequestBusy(""); }
    }}/>}
  </SupplierShell>;
}
