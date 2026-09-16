"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, BadgeCheck, Building2, Database, ExternalLink, Factory, FileCheck2, Filter, LoaderCircle, ShieldCheck, X, XCircle } from "lucide-react";
import BuyerNavigationRail from "@/components/navigation/BuyerNavigationRail";
import AdminLeads from "./AdminLeads";
import { api } from "@/lib/api-client";
import type { User } from "@/types/app";

type Application = {
  id: string;
  application_kind: "company" | "facility";
  business_name: string;
  applicant_name: string;
  applicant_email: string;
  applicant_email_verified_at?: string | null;
  city: string | null;
  country: string | null;
  provider_type: string;
  status: "pending" | "approved" | "rejected";
  verification_level: string;
  maps_url: string | null;
  submitted_at: string;
  physical_address: string | null;
  profile_description: string;
  capacity: string;
  capture_environments?: string[];
  hardware_pictures: string[];
  office_images?: Array<{ key: string; name: string; contentType: string }>;
  official_documents?: Array<{ key: string; name: string; contentType: string; type?: string }>;
  linkedin_url?: string;
  twitter_url?: string;
  huggingface_url?: string;
  website_url?: string;
  modalities: string[];
  robotics_types: string[];
  has_sample: boolean;
  sample_file_name?: string | null;
  sample_size_bytes?: number | null;
  admin_notes?: string | null;
  company_approved: boolean;
};

function ApplicationEvidence({ item, expanded = false }: { item: Application; expanded?: boolean }) {
  const links = [item.linkedin_url, item.twitter_url, item.huggingface_url, item.website_url].filter((url): url is string => Boolean(url));
  return <details className="application-evidence" open={expanded}>
    <summary>Review evidence and capabilities</summary>
    <div className="review-data-grid"><span><small>Applicant</small><strong>{item.applicant_name}</strong><em>{item.applicant_email}</em></span><span><small>Email status</small><strong className="review-verified"><BadgeCheck/>Verified</strong><em>{item.applicant_email_verified_at ? new Date(item.applicant_email_verified_at).toLocaleString() : ""}</em></span><span><small>Verification level</small><strong>{item.verification_level}</strong><em>{item.status === "approved" ? "Approved and visible on map" : "Awaiting trust decision"}</em></span><span><small>Location</small><strong>{item.city || "—"}, {item.country || "—"}</strong><em>{item.physical_address || "No address supplied"}</em></span></div>
    <p>{item.profile_description || "No company description supplied."}</p>
    {item.physical_address && <p><strong>Facility address:</strong> {item.physical_address}</p>}
    {item.capacity && <p><strong>Capacity:</strong> {item.capacity}</p>}
    <p><strong>Data capabilities:</strong> {[...item.modalities, ...item.robotics_types].join(", ") || "No capabilities supplied"}</p>
    {item.capture_environments?.length ? <p><strong>Capture environments:</strong> {item.capture_environments.join(", ")}</p> : null}
    {item.application_kind === "company" && item.has_sample && <a className="sample-download" href={`/api/admin/applications?sample=${item.id}`}>Download optional sample{item.sample_file_name ? `: ${item.sample_file_name}` : ""}{item.sample_size_bytes ? ` (${Math.ceil(item.sample_size_bytes / 1024)} KB)` : ""}</a>}
    <div className="verified-links">{links.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer">{new URL(url).hostname}</a>)}</div>
    {item.office_images && item.office_images.length > 0 && <><p><strong>Office images</strong></p><div className="evidence-photos">{item.office_images.map((asset) => <a key={asset.key} href={`/api/company-assets?key=${encodeURIComponent(asset.key)}`} target="_blank" rel="noreferrer"><Image src={`/api/company-assets?key=${encodeURIComponent(asset.key)}`} alt={asset.name} width={152} height={104} sizes="152px" unoptimized/></a>)}</div></>}
    {item.official_documents && item.official_documents.length > 0 && <section className="admin-document-grid"><h3>Official documents</h3>{item.official_documents.map((asset) => <a key={asset.key} href={`/api/company-assets?key=${encodeURIComponent(asset.key)}`} target="_blank" rel="noreferrer"><FileCheck2/><span><strong>{asset.type || "Official company document"}</strong><small>{asset.name} · {asset.contentType === "application/pdf" ? "PDF" : "Image"}</small></span><ExternalLink/></a>)}</section>}
    <div className="evidence-photos">{item.hardware_pictures.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer"><Image src={url} alt="Supplier facility evidence" width={152} height={104} sizes="152px" unoptimized/></a>)}</div>
  </details>;
}

function approvalBlocker(item: Application) {
  if (item.application_kind === "company" && (!item.maps_url || !item.city || !item.country)) return "The data company submission is missing its Google Maps location.";
  if (item.application_kind === "facility" && !item.company_approved) return "Approve this supplier's data company before reviewing its facility.";
  if (item.application_kind === "facility" && (!item.maps_url || !item.city || !item.country || item.hardware_pictures.length === 0)) return "The facility submission is missing location or photo evidence.";
  return "";
}

export default function AdminApplications({ user, kind }: { user: User; kind: "company" | "facility" }) {
  const [items, setItems] = useState<Application[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState<Application | null>(null);
  const load = () => api<{ applications: Application[] }>("/api/admin/applications").then((data) => setItems(data.applications));

  useEffect(() => { load().catch((reason) => setError(reason.message)); }, []);
  const kindItems = useMemo(() => items.filter((item) => item.application_kind === kind), [items, kind]);
  const visible = useMemo(() => filter === "all" ? kindItems : kindItems.filter((item) => item.status === filter), [filter, kindItems]);

  const review = async (item: Application, status: "approved" | "rejected", verificationLevel: "online" | "physical" | "unverified") => {
    const blocker = status === "approved" ? approvalBlocker(item) : "";
    if (blocker) { setError(blocker); return; }
    setBusy(item.id); setError("");
    try {
      await api("/api/admin/applications", { method: "PATCH", body: JSON.stringify({ id: item.id, status, verificationLevel, notes: notes[item.id] ?? item.admin_notes ?? "" }) });
      await load(); setReviewing(null);
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(""); }
  };

  return <main className="sourcing-app admin-page">
    <BuyerNavigationRail user={user} active="admin"/>
    <section className="admin-shell">
      <div className="onboarding-intro"><span>TRUST OPERATIONS</span><h1>{kind === "company" ? "Data company approvals" : "Facility approvals"}</h1><p>{kind === "company" ? "Review company identity, Google Maps location, public footprint, and capabilities." : "Review each approved company's facility location and evidence independently."}</p></div>
      <nav className="admin-review-tabs" aria-label="Verification queues">
        <Link className={kind === "company" ? "active" : ""} href="/admin/companies"><Database/><span><strong>Data companies</strong><small>{items.filter((item) => item.application_kind === "company" && item.status === "pending").length} pending</small></span></Link>
        <Link className={kind === "facility" ? "active" : ""} href="/admin/facilities"><Factory/><span><strong>Facilities</strong><small>{items.filter((item) => item.application_kind === "facility" && item.status === "pending").length} pending</small></span></Link>
      </nav>
      {error && <p className="form-error">{error}</p>}
      <div className="review-overview">{(["pending", "approved", "rejected"] as const).map((status) => <button key={status} className={filter === status ? "active" : ""} onClick={() => setFilter(status)}><strong>{kindItems.filter((item) => item.status === status).length}</strong><span>{status}</span></button>)}<button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}><Filter/><span>All</span></button></div>
      <div className="admin-queue">
        {visible.length === 0 && <div className="onboarding-success"><ShieldCheck size={34}/><h2>No {filter === "all" ? "supplier applications" : `${filter} applications`}</h2></div>}
        {visible.map((item) => <article key={item.id} data-kind={item.application_kind}>
          <div className="admin-card-title"><Building2/><div><strong>{item.business_name}</strong><span>{item.application_kind === "company" ? "Data company profile" : `Facility · ${item.city}, ${item.country}`}</span></div><em data-status={item.status}>{item.status === "approved" ? "verified" : item.status}</em></div>
          <p>{item.applicant_name} · {item.applicant_email}</p>
          <div className="admin-card-footer"><span>{item.office_images?.length || item.hardware_pictures.length} image{(item.office_images?.length || item.hardware_pictures.length) === 1 ? "" : "s"} · {item.official_documents?.length || 0} documents</span><button className="admin-open-review" onClick={() => setReviewing(item)}><FileCheck2/>Open review</button></div>
        </article>)}
      </div>
      {reviewing && <div className="admin-review-modal" role="dialog" aria-modal="true" aria-labelledby="admin-review-title" onClick={() => setReviewing(null)}><section onClick={(event) => event.stopPropagation()}><header><div><span>VERIFICATION REVIEW</span><h2 id="admin-review-title">{reviewing.business_name}</h2><p>{reviewing.applicant_name} · {reviewing.applicant_email}</p></div><button type="button" aria-label="Close review" onClick={() => setReviewing(null)}><X/></button></header><div className="admin-review-modal-body"><aside><span data-status={reviewing.status}>{reviewing.status}</span><strong>{reviewing.application_kind === "company" ? "Data company" : "Facility"}</strong><small>Submitted {new Date(reviewing.submitted_at).toLocaleDateString()}</small>{reviewing.maps_url && <a href={reviewing.maps_url} target="_blank" rel="noreferrer"><ExternalLink/>Open Google Maps</a>}</aside><div><ApplicationEvidence item={reviewing} expanded/><label className="review-notes">Internal review notes<textarea value={notes[reviewing.id] ?? reviewing.admin_notes ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [reviewing.id]: event.target.value }))} placeholder="Record verification evidence, open questions, or rejection reason" maxLength={4000}/></label>{approvalBlocker(reviewing) && <p className="approval-blocker"><AlertTriangle/>{approvalBlocker(reviewing)}</p>}<div className="admin-actions"><button disabled={busy === reviewing.id || Boolean(approvalBlocker(reviewing))} onClick={() => review(reviewing, "approved", "online")}><BadgeCheck/>Approve online</button><button disabled={busy === reviewing.id || Boolean(approvalBlocker(reviewing))} onClick={() => review(reviewing, "approved", "physical")}><ShieldCheck/>Approve physical</button><button disabled={busy === reviewing.id} onClick={() => review(reviewing, "rejected", "unverified")}><XCircle/>Reject</button>{busy === reviewing.id && <LoaderCircle className="spin"/>}</div></div></div></section></div>}
      <AdminLeads/>
    </section>
  </main>;
}
