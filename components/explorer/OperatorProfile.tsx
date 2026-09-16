"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, BadgeCheck, Bookmark, Bot, Check, ChevronRight, Compass, Database, ExternalLink, Factory, Layers, Link2, LoaderCircle, MapPin, MessageSquare, Radio, ShieldCheck, Sparkles, X } from "lucide-react";
import BuyerNavigationRail from "./BuyerNavigationRail";
import ChatModal from "./ChatModal";
import ConciergeForm from "./ConciergeForm";
import Modal from "./Modal";
import OperatorGallery from "./OperatorGallery";
import { api, type PublicOperator, type User, type Workspace } from "./model";
import type { NodeData } from "../Landing/types";

const emptyWorkspace: Workspace = { saved: [], requests: [] };

const verificationLabel = (level: NodeData["verificationLevel"]) =>
  level === "physical" ? "Physically verified" : level === "online" ? "Online verified" : "Demonstration listing";

const typeIcon = (type: NodeData["type"]) =>
  type === "Facility" ? <Factory size={14}/> : type === "Robotics" ? <Bot size={14}/> : <Database size={14}/>;

const linkLabel = (name: string) => (name === "huggingFace" ? "Hugging Face" : name[0].toUpperCase() + name.slice(1));

export default function OperatorProfile({ user, operator, related }: { user: User; operator: NodeData; related: PublicOperator[] }) {
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [request, setRequest] = useState(false);
  const [chat, setChat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [requestError, setRequestError] = useState("");

  const saved = workspace.saved.includes(operator.slug);
  const requested = workspace.requests.some((item) => item.operator_slug === operator.slug);
  const photos = [...new Set([...(operator.profile.photos || []), operator.media.src].filter(Boolean))];
  const links = Object.entries(operator.profile.links || {}).filter((entry): entry is [string, string] => !!entry[1]);

  useEffect(() => {
    const controller = new AbortController();
    api<Workspace>("/api/workspace", { signal: controller.signal })
      .then(setWorkspace)
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const toggleSave = async () => {
    setBusy(true);
    try { setWorkspace(await api("/api/workspace", { method: "POST", body: JSON.stringify({ action: saved ? "unsave" : "save", slug: operator.slug }) })); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); }
    catch { setError("Your browser blocked the clipboard. Copy the link from the address bar instead."); }
  };

  return <main className="sourcing-app operator-profile-page">
    <BuyerNavigationRail user={user} active="map"/>
    <div className="op-shell">
      <nav className="op-topbar" aria-label="Breadcrumb">
        <Link className="op-back" href={`/map?operator=${operator.slug}`}><ArrowLeft size={15}/>Back to map</Link>
        <span className="op-trail"><Link href="/map">Network</Link><ChevronRight size={12}/><span>{operator.country}</span><ChevronRight size={12}/><b>{operator.name}</b></span>
        <div className="op-topbar-actions">
          <button type="button" className="op-ghost-button" onClick={copyLink}>{copied ? <Check size={14}/> : <Link2 size={14}/>}{copied ? "Link copied" : "Copy link"}</button>
          <button type="button" className={`op-ghost-button ${saved ? "is-saved" : ""}`} onClick={toggleSave} disabled={busy} aria-pressed={saved}><Bookmark size={14} fill={saved ? "currentColor" : "none"}/>{saved ? "Saved" : "Save"}</button>
        </div>
      </nav>

      <OperatorGallery photos={photos} name={operator.name} label={operator.media.label}/>

      <header className="op-headline">
        <div>
          <div className="op-chips">
            <span className={`op-chip type-${operator.type.toLowerCase().replace(" ", "-")}`}>{typeIcon(operator.type)}{operator.type}</span>
            <span className="op-chip op-chip-verified"><BadgeCheck size={14}/>{verificationLabel(operator.verificationLevel)}</span>
          </div>
          <h1>{operator.name}</h1>
          <p className="op-place"><MapPin size={14}/>{operator.area}{operator.area === operator.city ? "" : `, ${operator.city}`}, {operator.country}</p>
          {operator.company && <p className="op-operated">Operated by <strong>{operator.company.name}</strong></p>}
        </div>
        <div className="op-headline-actions">
          <button type="button" className="primary-button" disabled={requested} onClick={() => setRequest(true)}>{requested ? <><Check size={16}/>Data request sent</> : <>Request data <ArrowUpRight size={16}/></>}</button>
          <button type="button" className="secondary-button" onClick={() => setChat(true)}><MessageSquare size={15}/>Message provider</button>
        </div>
      </header>

      <div className="op-stats">
        <article><span>Operating since</span><strong>{operator.profile.established || "Not shared"}</strong></article>
        <article><span>Capture capacity</span><strong>{operator.profile.capacity || "Contact provider"}</strong></article>
        <article><span>Data modalities</span><strong>{operator.modalities.length}</strong></article>
        <article><span>Trust level</span><strong>{operator.verificationLevel === "physical" ? "Physical" : "Online"}</strong></article>
      </div>

      <div className="op-layout">
        <div className="op-main">
          <section className="op-card">
            <h2><Sparkles size={15}/>About this provider</h2>
            <p className="op-description">{operator.profile.description.replace("vetted ", "")}</p>
            <div className="op-modalities">{operator.modalities.map((item) => <span key={item}>{item}</span>)}</div>
          </section>

          {operator.profile.dataStreams.length > 0 && <section className="op-card">
            <h2><Layers size={15}/>Data streams</h2>
            <ul className="op-stream-list">{operator.profile.dataStreams.map((item) => <li key={item}><Radio size={13}/>{item}</li>)}</ul>
          </section>}

          {operator.profile.captureEnvironments.length > 0 && <section className="op-card">
            <h2><Compass size={15}/>Capture environments</h2>
            <div className="op-environments">{operator.profile.captureEnvironments.map((item) => <span key={item}><Check size={12}/>{item}</span>)}</div>
          </section>}

          <section className="op-card">
            <h2><MapPin size={15}/>Geography &amp; facilities</h2>
            <div className="op-location">
              <div>
                <strong>{operator.area === operator.city ? operator.city : `${operator.area}, ${operator.city}`}</strong>
                <span>{operator.country}</span>
                <small>{operator.coordinates[1].toFixed(4)}&deg; latitude &middot; {operator.coordinates[0].toFixed(4)}&deg; longitude</small>
                <p>{operator.profile.publicExactLocation ? "This provider publishes its exact public location." : "City-level location. Exact addresses are shared during sourcing review."}</p>
              </div>
              <Link className="op-location-link" href={`/map?operator=${operator.slug}`}>Open on the map<ArrowUpRight size={14}/></Link>
            </div>
          </section>

          {links.length > 0 && <section className="op-card">
            <h2><ExternalLink size={15}/>Verified links</h2>
            <div className="op-links">{links.map(([name, url]) => <a key={name} href={url} target="_blank" rel="noreferrer">{linkLabel(name)}<ArrowUpRight size={13}/></a>)}</div>
          </section>}
        </div>

        <aside className="op-side">
          <div className="op-card op-action-card">
            <span className="op-eyebrow">SOURCING</span>
            <h2>Work with this provider</h2>
            <p>Send a brief and the provider replies in your workspace inbox.</p>
            <button type="button" className="primary-button" disabled={requested} onClick={() => setRequest(true)}>{requested ? <><Check size={16}/>Request sent</> : <>Request data <ArrowUpRight size={16}/></>}</button>
            <button type="button" className="secondary-button" onClick={() => setChat(true)}><MessageSquare size={15}/>Chat with provider</button>
            <button type="button" className={`secondary-button ${saved ? "is-saved" : ""}`} onClick={toggleSave} disabled={busy} aria-pressed={saved}><Bookmark size={15} fill={saved ? "currentColor" : "none"}/>{saved ? "Saved to workspace" : "Save provider"}</button>
            <p className="op-trust-note"><ShieldCheck size={14}/>Capabilities and evidence come from the approved facility review.</p>
          </div>
          <div className="op-card op-concierge-card"><ConciergeForm onError={setError}/></div>
        </aside>
      </div>

      {related.length > 0 && <section className="op-related">
        <div className="op-related-head"><span className="op-eyebrow">MORE IN {operator.country.toUpperCase()}</span><Link href="/map?search=1">Browse the network<ArrowUpRight size={14}/></Link></div>
        <div className="op-related-grid">{related.map((item) => <Link key={item.slug} className="op-related-card" href={`/operators/${item.slug}`}>
          <span className="op-related-media"><Image src={item.media.src} alt="" fill sizes="280px" className="object-cover" unoptimized={!item.media.src.startsWith("/")}/></span>
          <strong>{item.name}</strong>
          <small><MapPin size={11}/>{item.city}, {item.country}</small>
          <em>{item.type}</em>
        </Link>)}</div>
      </section>}
    </div>

    {request && <Modal title="Request data access" onClose={() => setRequest(false)}>
      <p className="modal-description">Tell us what you&rsquo;re building with <strong>{operator.name}</strong>.</p>
      <form className="request-form" onSubmit={async (event) => {
        event.preventDefault(); setBusy(true); setRequestError("");
        const purpose = new FormData(event.currentTarget).get("purpose");
        try { setWorkspace(await api("/api/workspace", { method: "POST", body: JSON.stringify({ action: "request", slug: operator.slug, purpose }) })); setRequest(false); }
        catch (reason) { setRequestError((reason as Error).message); } finally { setBusy(false); }
      }}>
        <label>Your use case<textarea name="purpose" minLength={10} maxLength={2000} required rows={5} placeholder="We are training a manipulation model and need multi-view recordings of assembly tasks…"/></label>
        <p className="demo-note">The supplier will receive this request in their workspace and can accept it or contact you through map.filemarket chat.</p>
        {requestError && <p role="alert" className="form-error">{requestError}</p>}
        <button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <>Submit request <ArrowUpRight size={17}/></>}</button>
      </form>
    </Modal>}
    {chat && <ChatModal operator={operator} onClose={() => setChat(false)}/>}
    {error && <div className="op-toast" role="status"><p>{error}</p><button type="button" onClick={() => setError("")} aria-label="Dismiss notification"><X size={15}/></button></div>}
  </main>;
}
