"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Bookmark, Clock3, Eye, FileQuestion, MessageSquare, Pencil, Plus, ShieldCheck } from "lucide-react";
import BuyerNavigationRail from "./BuyerNavigationRail";
import { api, type User } from "./model";
import Inbox from "./Inbox";
import SupplierRequests, { type SupplierAccessRequest } from "./SupplierRequests";

type Provider = {
  slug: string;
  name: string;
  status: string;
  verification_level: string;
  profile_views: number;
  saves: number;
  access_requests: number;
  conversations: number;
  modalities: string[];
  media: { src: string };
  profile: { description?: string; capacity?: string; captureEnvironments?: string[]; photos?: string[] };
};
type Dashboard = {
  providers: Provider[];
  applications: Array<{ id: string; application_kind: "company" | "facility"; business_name: string; provider_slug: string | null; status: string; verification_level: string; admin_notes: string | null }>;
  conversations: Array<{ id: string; operator_slug: string }>;
  accessRequests: SupplierAccessRequest[];
};

export default function SupplierDashboard({ user }: { user: User }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState("");
  const [requestBusy, setRequestBusy] = useState("");
  const load = async () => setData(await api<Dashboard>("/api/supplier/dashboard"));

  useEffect(() => {
    api<Dashboard>("/api/supplier/dashboard").then(setData).catch((reason) => setError(reason.message));
  }, []);
  const views = data?.providers.reduce((total, provider) => total + provider.profile_views, 0) ?? 0;
  const saves = data?.providers.reduce((total, provider) => total + provider.saves, 0) ?? 0;
  const requests = data?.providers.reduce((total, provider) => total + provider.access_requests, 0) ?? 0;
  const companyApplication = data?.applications.find((application) => application.application_kind === "company");

  return <main className="sourcing-app admin-page">
    <BuyerNavigationRail user={user} active="supplier"/>
    <section className="admin-shell">
      <div className="onboarding-intro"><span>DATA COMPANY WORKSPACE</span><h1>Your presence on map.filemarket</h1><p>Manage your verified company, facility reviews, buyer requests, and conversations.</p></div>
      {error && <p className="form-error">{error}</p>}
      {companyApplication && companyApplication.status !== "approved" && <section className="company-review-status" data-status={companyApplication.status}><Clock3/><div><strong>{companyApplication.status === "rejected" ? "Verification needs an update" : "Company verification is pending"}</strong><p>{companyApplication.status === "rejected" ? companyApplication.admin_notes || "Review the feedback and update your company application." : "Your company application is with the trust team. We will notify you when the review is complete."}</p></div><em>{companyApplication.status}</em></section>}
      <div className="supplier-metrics"><article><Eye/><strong>{views}</strong><span>Profile views</span></article><article><Bookmark/><strong>{saves}</strong><span>Buyer saves</span></article><article><FileQuestion/><strong>{requests}</strong><span>Data requests</span></article><article><MessageSquare/><strong>{data?.conversations.length ?? 0}</strong><span>Conversations</span></article></div>
      <div className="supplier-heading"><h2>Facilities and reviews</h2><Link className="primary-button" href="/onboarding#facility"><Plus size={15}/>Add a facility</Link></div>
      <SupplierRequests requests={data?.accessRequests ?? []} busy={requestBusy} onStatus={async (requestId, status) => {
        setRequestBusy(requestId); setError("");
        try { await api("/api/supplier/dashboard", { method: "PATCH", body: JSON.stringify({ action: "request-status", requestId, status }) }); await load(); }
        catch (reason) { setError((reason as Error).message); }
        finally { setRequestBusy(""); }
      }}/>
      <Inbox/>
      <div className="admin-queue">
        {data?.providers.map((provider) => <article key={provider.slug}>
          <div className="admin-card-title"><BadgeCheck/><div><strong>{provider.name}</strong><span>{provider.verification_level} verified · {provider.profile_views} profile views</span></div><em>{provider.status}</em></div>
          <div className="listing-analytics" aria-label={`${provider.name} listing analytics`}><span><Eye size={13}/><strong>{provider.profile_views}</strong>Views</span><span><Bookmark size={13}/><strong>{provider.saves}</strong>Saves</span><span><FileQuestion size={13}/><strong>{provider.access_requests}</strong>Requests</span><span><MessageSquare size={13}/><strong>{provider.conversations}</strong>Chats</span></div>
          <button className="profile-edit-toggle" onClick={() => setEditing(editing === provider.slug ? "" : provider.slug)}><Pencil size={13}/>Edit profile</button>
          {editing === provider.slug && <form className="supplier-edit-form" onSubmit={async (event) => {
            event.preventDefault(); const values = new FormData(event.currentTarget); setError("");
            try {
              await api("/api/supplier/dashboard", { method: "PATCH", body: JSON.stringify({ slug: provider.slug, modalities: values.getAll("modalities"), photos: String(values.get("photos") || "").split("\n").map((item) => item.trim()).filter(Boolean), description: values.get("description"), capacity: values.get("capacity"), environments: String(values.get("environments") || "").split(",").map((item) => item.trim()).filter(Boolean) }) });
              setEditing(""); await load();
            } catch (reason) { setError((reason as Error).message); }
          }}>
            <label>Description<textarea name="description" defaultValue={provider.profile.description} required minLength={20} maxLength={3000}/></label>
            <label>Collection capacity<input name="capacity" defaultValue={provider.profile.capacity} required maxLength={120}/></label>
            <label>Capture environments<input name="environments" defaultValue={provider.profile.captureEnvironments?.join(", ")} maxLength={2000}/></label>
            <fieldset><legend>Data capabilities</legend>{["Egocentric video", "Exocentric video", "Speech", "Images"].map((value) => <label key={value}><input type="checkbox" name="modalities" value={value} defaultChecked={provider.modalities.includes(value)}/>{value}</label>)}</fieldset>
            <label>Facility photo URLs (one public HTTPS URL per line)<textarea name="photos" maxLength={16000} defaultValue={(provider.profile.photos || [provider.media.src]).join("\n")}/></label>
            <p className="fieldset-note">Submitting changes removes this facility from the public directory until an admin approves the revision.</p>
            <button className="primary-button">Submit changes for review</button>
          </form>}
        </article>)}
        {data?.applications.map((application) => <article key={application.id}><div className="admin-card-title"><ShieldCheck/><div><strong>{application.business_name}</strong><span>{application.application_kind === "company" ? "Data company profile" : "Facility"} · {application.verification_level} verification{application.admin_notes ? ` · ${application.admin_notes}` : ""}</span></div><em>{application.status}</em></div></article>)}
      </div>
    </section>
  </main>;
}
