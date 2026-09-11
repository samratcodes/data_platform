"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, BadgeCheck, Building2, Database, Factory, Filter, LoaderCircle, ShieldCheck, XCircle } from "lucide-react";
import BuyerNavigationRail from "./BuyerNavigationRail";
import AdminLeads from "./AdminLeads";
import { api, type User } from "./model";

type Application = {
  id: string;
  application_kind: "company" | "facility";
  business_name: string;
  applicant_name: string;
  applicant_email: string;
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
  hardware_pictures: string[];
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

function ApplicationEvidence({ item }: { item: Application }) {
  const links = [item.linkedin_url, item.twitter_url, item.huggingface_url, item.website_url].filter((url): url is string => Boolean(url));
  return <details className="application-evidence">
    <summary>Review evidence and capabilities</summary>
    <p>{item.profile_description || "No company description supplied."}</p>
    {item.physical_address && <p><strong>Facility address:</strong> {item.physical_address}</p>}
    {item.capacity && <p><strong>Capacity:</strong> {item.capacity}</p>}
    <p>{[...item.modalities, ...item.robotics_types].join(", ") || "No capabilities supplied"}</p>
    {item.application_kind === "company" && item.has_sample && <a className="sample-download" href={`/api/admin/applications?sample=${item.id}`}>Download optional sample{item.sample_file_name ? `: ${item.sample_file_name}` : ""}{item.sample_size_bytes ? ` (${Math.ceil(item.sample_size_bytes / 1024)} KB)` : ""}</a>}
    <div className="verified-links">{links.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer">{new URL(url).hostname}</a>)}</div>
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
      await load();
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
          <div className="admin-card-title"><Building2/><div><strong>{item.business_name}</strong><span>{item.application_kind === "company" ? "Data company profile" : `Facility · ${item.city}, ${item.country}`}</span></div><em data-status={item.status}>{item.status}</em></div>
          <p>{item.applicant_name} · {item.applicant_email}</p>
          {item.maps_url && <a href={item.maps_url} target="_blank" rel="noreferrer">Review Google Maps location</a>}
          <ApplicationEvidence item={item}/>
          <label className="review-notes">Internal review notes<textarea value={notes[item.id] ?? item.admin_notes ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Record verification evidence, open questions, or rejection reason" maxLength={4000}/></label>
          {approvalBlocker(item) && <p className="approval-blocker"><AlertTriangle/>{approvalBlocker(item)}</p>}
          <div className="admin-actions"><button disabled={busy === item.id || Boolean(approvalBlocker(item))} onClick={() => review(item, "approved", "online")}><BadgeCheck/>Approve online</button><button disabled={busy === item.id || Boolean(approvalBlocker(item))} onClick={() => review(item, "approved", "physical")}><ShieldCheck/>Approve physical</button><button disabled={busy === item.id} onClick={() => review(item, "rejected", "unverified")}><XCircle/>Reject</button>{busy === item.id && <LoaderCircle className="spin"/>}</div>
        </article>)}
      </div>
      <AdminLeads/>
    </section>
  </main>;
}
