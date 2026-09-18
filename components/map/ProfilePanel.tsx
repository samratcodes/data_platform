"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import { ArrowUpRight, Bookmark, Check, ExternalLink, LayoutGrid, LoaderCircle, MapPin, MessageSquare, Minus, X } from "lucide-react";
import type { NodeData } from "@/types/provider";
import { api } from "@/lib/api-client";
import type { PublicOperator, Workspace } from "@/types/app";
import Modal from "@/components/ui/Modal";
import ChatModal from "@/components/messaging/ChatModal";
import ConciergeForm from "@/components/workspace/ConciergeForm";
import { formatCount } from "@/lib/facility";
import ProviderLogo from "@/components/ui/ProviderLogo";

export default function ProfilePanel({ operator, workspace, onWorkspace, onClose, onMinimize, onError, onExpand }: { operator: PublicOperator; workspace: Workspace; onWorkspace: (workspace: Workspace) => void; onClose: () => void; onMinimize: () => void; onError: (message: string) => void; onExpand: () => void }) {
  const [profile, setProfile] = useState<NodeData | null>(null);
  const [error, setError] = useState("");
  const [request, setRequest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [chat, setChat] = useState(false);
  const reduced = useMotionPreference();
  const saved = workspace.saved.includes(operator.slug);
  const requested = workspace.requests.some((item) => item.operator_slug === operator.slug);
  useEffect(() => {
    const controller = new AbortController();
    api<{ operator: NodeData }>(`/api/catalogue?slug=${operator.slug}`, { signal: controller.signal }).then((data) => setProfile(data.operator)).catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [operator.slug]);
  return <>
    <motion.aside className="glass profile-panel" aria-label={`${operator.name} profile`} initial={reduced ? false : { opacity: 0, x: 35 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduced ? 0 : 35 }} transition={{ duration: .25 }}>
      <motion.div className="sheet-handle" drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(_, info) => { if (info.offset.y > 70) onClose(); else if (info.offset.y < -40) onExpand(); }}><span/></motion.div>
      <div className="profile-cover"><Image src={operator.media.src} alt={operator.media.alt} fill sizes="400px" className="object-cover"/><div/><span className="sample-badge">{operator.profile.facility ? `FACILITY · ${operator.profile.facility.categoryLabel.toUpperCase()}` : operator.type === "Facility" ? "CAPTURE FACILITY" : "DATA PROVIDER"}</span><div className="profile-window-actions"><button onClick={onMinimize} className="icon-button" aria-label="Minimize profile details" title="Minimize"><Minus size={17}/></button><button onClick={onClose} className="icon-button" aria-label="Close profile"><X size={18}/></button></div></div>
      <div className="profile-content"><ProviderLogo cover={Boolean(operator.profile?.logoIsPhoto)} className="profile-panel-logo" name={operator.name} logo={operator.profile?.logo ?? profile?.profile.logo} type={operator.type} size={76}/><div className="profile-title"><div><span className="eyebrow">{operator.city} · {operator.country}</span><h2>{operator.name}</h2>{operator.company && <Link className="provider-company-line" href={`/operators/${operator.company.slug}`}><span>by</span>{operator.company.name}</Link>}</div><button className={`icon-button ${saved ? "is-saved" : ""}`} aria-label={saved ? "Unsave provider" : "Save provider"} aria-pressed={saved} disabled={busy} onClick={async () => { setBusy(true); try { onWorkspace(await api("/api/workspace", { method: "POST", body: JSON.stringify({ action: saved ? "unsave" : "save", slug: operator.slug }) })); } catch (reason) { onError((reason as Error).message); } finally { setBusy(false); } }}><Bookmark size={19} fill={saved ? "currentColor" : "none"}/></button></div>
        <div className="tag-row">{operator.modalities.map((item) => <span key={item}>{item}</span>)}</div>
        <Link className="profile-view-link" href={`/operators/${operator.slug}`}><span><LayoutGrid size={15}/></span><span><strong>View profile</strong><small>Photos, data streams, and facility detail</small></span><ArrowUpRight size={16}/></Link>
        {error ? <p role="alert" className="form-error">{error}</p> : !profile ? <p className="loading-inline"><LoaderCircle className="spin" size={16}/> Loading full profile…</p> : <>
          <div className="profile-primary-actions"><ConciergeForm onError={onError}/><button className="primary-button request-button" disabled={requested} onClick={() => setRequest(true)}>{requested ? <><Check size={16}/> Data request sent</> : <>Request data <ArrowUpRight size={17}/></>}</button></div>
          <p className="profile-description">{profile.profile.description.replace("vetted ", "")}</p>
          <span className="verification-badge">{profile.verificationLevel === "physical" ? "Physically verified" : profile.verificationLevel === "online" ? "Online verified" : "Demonstration listing"}</span>
          {profile.profile.facility
            ? <div className="profile-facts profile-facts-factory"><div><span>Total workers</span><strong>{formatCount(profile.profile.facility.totalWorkers)}</strong></div><div><span>Seated, hand tasks</span><strong>{formatCount(profile.profile.facility.seatedWorkers)}</strong></div><div><span>Tasks with movement</span><strong>{formatCount(profile.profile.facility.mobileWorkers)}</strong></div><div><span>Shifts per day</span><strong>{profile.profile.facility.shiftsPerDay}</strong></div></div>
            : <div className="profile-facts"><div><span>Capture capacity</span><strong>{profile.profile.capacity}</strong></div><div><span>Operating since</span><strong>{profile.profile.established}</strong></div></div>}
          <h3><MapPin size={15}/> Geography & facilities</h3><p className="location-detail">{profile.area}, {profile.city}<span>{profile.coordinates[1].toFixed(4)}° latitude · {profile.coordinates[0].toFixed(4)}° longitude</span><small>{profile.profile.publicExactLocation ? "Public Google Maps location." : "City-level location. Exact addresses shared during sourcing review."}</small></p>
          <div className="environment-list">{profile.profile.captureEnvironments.map((item) => <span key={item}><Check size={12}/>{item}</span>)}</div>
          {profile.profile.links && <div className="verified-links">{Object.entries(profile.profile.links).filter((entry): entry is [string, string] => !!entry[1]).map(([name, url]) => <a key={name} href={url} target="_blank" rel="noreferrer"><ExternalLink size={12}/>{name === "huggingFace" ? "Hugging Face" : name[0].toUpperCase() + name.slice(1)}</a>)}</div>}
          <div className="verified-data-notice"><Check size={15}/><span><strong>Supplier-submitted profile</strong>Capabilities and evidence shown here come from the approved facility review.</span></div>
          <button className="secondary-button message-button" onClick={() => setChat(true)}><MessageSquare size={15}/> Request data · Chat with provider</button>
        </>}
      </div>
    </motion.aside>
    {request && <Modal title="Request data access" onClose={() => setRequest(false)}>
      <p className="modal-description">Tell us what you’re building with <strong>{operator.name}</strong>.</p>
      <form className="request-form" onSubmit={async (event) => { event.preventDefault(); setBusy(true); setRequestError(""); const purpose = new FormData(event.currentTarget).get("purpose"); try { onWorkspace(await api("/api/workspace", { method: "POST", body: JSON.stringify({ action: "request", slug: operator.slug, purpose }) })); setRequest(false); } catch (reason) { setRequestError((reason as Error).message); } finally { setBusy(false); } }}>
        <label>Your use case<textarea name="purpose" minLength={10} maxLength={2000} required rows={5} placeholder="We’re training a manipulation model and need multi-view recordings of assembly tasks…"/></label>
        <p className="demo-note">The supplier will receive this request in their workspace and can accept it or contact you through map.filemarket chat.</p>
        {requestError && <p role="alert" className="form-error">{requestError}</p>}<button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <>Submit request <ArrowUpRight size={17}/></>}</button>
      </form>
    </Modal>}
    {chat && <ChatModal operator={operator} onClose={() => setChat(false)}/>}
  </>;
}
