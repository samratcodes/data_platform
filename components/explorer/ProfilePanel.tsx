"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useMotionPreference } from "./useMotionPreference";
import { ArrowUpRight, Bookmark, Check, ChevronRight, Database, Download, Layers3, LoaderCircle, MapPin, Play, X } from "lucide-react";
import type { NodeData } from "../Landing/types";
import { api, type PublicOperator, type Workspace } from "./model";
import Modal from "./Modal";
import PointCloud from "./PointCloud";

export default function ProfilePanel({ operator, workspace, onWorkspace, onClose, onError, onExpand }: { operator: PublicOperator; workspace: Workspace; onWorkspace: (workspace: Workspace) => void; onClose: () => void; onError: (message: string) => void; onExpand: () => void }) {
  const [profile, setProfile] = useState<NodeData | null>(null);
  const [error, setError] = useState("");
  const [sample, setSample] = useState<"video" | "points" | "metadata" | null>(null);
  const [request, setRequest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState("");
  const reduced = useMotionPreference();
  const saved = workspace.saved.includes(operator.slug);
  const requested = workspace.requests.some((item) => item.operator_slug === operator.slug);
  const scene = operator.modalities.includes("Egocentric video") ? "robotics" : "perception";
  useEffect(() => {
    const controller = new AbortController();
    api<{ operator: NodeData }>(`/api/catalogue?slug=${operator.slug}`, { signal: controller.signal }).then((data) => setProfile(data.operator)).catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [operator.slug]);
  return <>
    <motion.aside className="glass profile-panel" aria-label={`${operator.name} profile`} initial={reduced ? false : { opacity: 0, x: 35 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduced ? 0 : 35 }} transition={{ duration: .25 }}>
      <motion.div className="sheet-handle" drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(_, info) => { if (info.offset.y > 70) onClose(); else if (info.offset.y < -40) onExpand(); }}><span/></motion.div>
      <div className="profile-cover"><Image src={operator.media.src} alt={operator.media.alt} fill sizes="400px" className="object-cover"/><div/><span className="sample-badge">{operator.type === "Facility" ? "CAPTURE FACILITY" : "DATA PROVIDER"}</span><button onClick={onClose} className="icon-button" aria-label="Close profile"><X size={18}/></button></div>
      <div className="profile-content"><div className="profile-title"><div><span className="eyebrow">{operator.city} · {operator.country}</span><h2>{operator.name}</h2></div><button className={`icon-button ${saved ? "is-saved" : ""}`} aria-label={saved ? "Unsave provider" : "Save provider"} aria-pressed={saved} disabled={busy} onClick={async () => { setBusy(true); try { onWorkspace(await api("/api/workspace", { method: "POST", body: JSON.stringify({ action: saved ? "unsave" : "save", slug: operator.slug }) })); } catch (reason) { onError((reason as Error).message); } finally { setBusy(false); } }}><Bookmark size={19} fill={saved ? "currentColor" : "none"}/></button></div>
        <div className="tag-row">{operator.modalities.map((item) => <span key={item}>{item}</span>)}</div>
        {error ? <p role="alert" className="form-error">{error}</p> : !profile ? <p className="loading-inline"><LoaderCircle className="spin" size={16}/> Loading full profile…</p> : <>
          <p className="profile-description">{profile.profile.description.replace("vetted ", "")}</p>
          <div className="profile-facts"><div><span>Capture capacity</span><strong>{profile.profile.capacity}</strong></div><div><span>Operating since</span><strong>{profile.profile.established}</strong></div></div>
          <h3><MapPin size={15}/> Geography & facilities</h3><p className="location-detail">{profile.area}, {profile.city}<span>{profile.coordinates[1].toFixed(4)}° latitude · {profile.coordinates[0].toFixed(4)}° longitude</span><small>City-level location. Exact addresses shared during sourcing review.</small></p>
          <div className="environment-list">{profile.profile.captureEnvironments.map((item) => <span key={item}><Check size={12}/>{item}</span>)}</div>
          {profile.company && <p className="operator-company">Operated by <strong>{profile.company.name}</strong></p>}
          <div className="section-label"><h3>Explore data samples</h3><span>3 previews</span></div>
          <div className="sample-grid">
            <button onClick={() => setSample("video")}><div className="sample-image"><Image src={`/demo/${scene}.jpg`} alt="Synthetic robotics video preview" fill sizes="160px"/><Play size={22}/></div><strong>Motion sample</strong><span>MP4 · 5 seconds</span></button>
            <button onClick={() => setSample("points")}><div className="sample-image"><Image src="/demo/perception.jpg" alt="Synthetic point cloud preview" fill sizes="160px"/><Layers3 size={22}/></div><strong>Point cloud</strong><span>PLY · 360 points</span></button>
            <button className="metadata-sample" onClick={() => setSample("metadata")}><Database size={19}/><div><strong>Dataset manifest</strong><span>JSON · metadata & annotations</span></div><ChevronRight size={15}/></button>
          </div><p className="demo-note">Illustrative catalogue · samples are synthetic demonstrations.</p>
          <button className="primary-button request-button" disabled={requested} onClick={() => setRequest(true)}>{requested ? <><Check size={16}/> Access requested</> : <>Request access <ArrowUpRight size={17}/></>}</button>
          <a className="secondary-button download-button" href={`/api/samples/${operator.slug}`} download><Download size={15}/> Download sample metadata</a>
        </>}
      </div>
    </motion.aside>
    {sample && <Modal title={sample === "video" ? "Motion data sample" : sample === "points" ? "Point cloud preview" : "Dataset manifest"} onClose={() => setSample(null)} wide>
      {sample === "video" ? <video className="full-sample" src={`/demo/${scene}.mp4`} controls autoPlay muted loop playsInline/> : sample === "points" ? <PointCloud/> : <pre className="metadata-preview">{JSON.stringify({ operator: operator.name, city: operator.city, coordinates: operator.coordinates, modalities: operator.modalities, synthetic: true, sampleFrames: 12 }, null, 2)}</pre>}
      <div className="sample-footer"><p>Synthetic demonstration · {operator.name}</p><a className="primary-button" href={sample === "video" ? `/demo/${scene}.mp4` : `/api/samples/${operator.slug}${sample === "points" ? "?format=ply" : ""}`} download><Download size={15}/> Download {sample === "video" ? "MP4" : sample === "points" ? "PLY" : "JSON"}</a></div>
    </Modal>}
    {request && <Modal title="Request data access" onClose={() => setRequest(false)}>
      <p className="modal-description">Tell us what you’re building with <strong>{operator.name}</strong>.</p>
      <form className="request-form" onSubmit={async (event) => { event.preventDefault(); setBusy(true); setRequestError(""); const purpose = new FormData(event.currentTarget).get("purpose"); try { onWorkspace(await api("/api/workspace", { method: "POST", body: JSON.stringify({ action: "request", slug: operator.slug, purpose }) })); setRequest(false); } catch (reason) { setRequestError((reason as Error).message); } finally { setBusy(false); } }}>
        <label>Your use case<textarea name="purpose" minLength={10} maxLength={2000} required rows={5} placeholder="We’re training a manipulation model and need multi-view recordings of assembly tasks…"/></label>
        <p className="demo-note">Your request is saved in your workspace. External provider delivery is not connected yet.</p>
        {requestError && <p role="alert" className="form-error">{requestError}</p>}<button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <>Submit request <ArrowUpRight size={17}/></>}</button>
      </form>
    </Modal>}
  </>;
}
