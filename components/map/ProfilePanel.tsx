"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import { ArrowLeft, ArrowUpRight, Bookmark, Check, ChevronRight, ExternalLink, Factory, LayoutGrid, LoaderCircle, MapPin, MessageSquare, Minus, Package, Store, X } from "lucide-react";
import type { NodeData } from "@/types/provider";
import { api } from "@/lib/api-client";
import type { PublicOperator, Workspace } from "@/types/app";
import Modal from "@/components/ui/Modal";
import ChatModal from "@/components/messaging/ChatModal";
import ConciergeForm from "@/components/workspace/ConciergeForm";
import { formatCount } from "@/lib/facility";
import { deviceCategoryLabel, priceLabel, productPageUrl, type StoreProduct } from "@/lib/devices";
import ProviderLogo from "@/components/ui/ProviderLogo";
import { ProductPhoto } from "@/components/devices/ProductCard";

const STORE_PREVIEW = 4;

const coverLabel = (operator: PublicOperator) => operator.profile.facility ? `FACILITY · ${operator.profile.facility.categoryLabel.toUpperCase()}`
  : operator.type === "Facility" ? "CAPTURE FACILITY" : operator.type === "Device Supplier" ? "DEVICE COMPANY" : "DATA PROVIDER";

export default function ProfilePanel({ operator, facilities = [], onOpenSlug, workspace, onWorkspace, onClose, onMinimize, onError, onExpand }: {
  operator: PublicOperator;
  /** The data company's facilities, shown once the company is opened. */
  facilities?: PublicOperator[];
  onOpenSlug: (slug: string) => void;
  workspace: Workspace;
  onWorkspace: (workspace: Workspace) => void;
  onClose: () => void;
  onMinimize: () => void;
  onError: (message: string) => void;
  onExpand: () => void;
}) {
  const [profile, setProfile] = useState<NodeData | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [error, setError] = useState("");
  const [request, setRequest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [chat, setChat] = useState(false);
  const reduced = useMotionPreference();
  const saved = workspace.saved.includes(operator.slug);
  const requested = workspace.requests.some((item) => item.operator_slug === operator.slug);
  const isStore = operator.type === "Device Supplier";
  useEffect(() => {
    const controller = new AbortController();
    api<{ operator: NodeData; products: StoreProduct[] }>(`/api/catalogue?slug=${operator.slug}`, { signal: controller.signal }).then((data) => { setProfile(data.operator); setProducts(data.products ?? []); }).catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [operator.slug]);
  const saveButton = <button className={`icon-button ${saved ? "is-saved" : ""}`} aria-label={saved ? "Unsave provider" : "Save provider"} aria-pressed={saved} disabled={busy} onClick={async () => { setBusy(true); try { onWorkspace(await api("/api/workspace", { method: "POST", body: JSON.stringify({ action: saved ? "unsave" : "save", slug: operator.slug }) })); } catch (reason) { onError((reason as Error).message); } finally { setBusy(false); } }}><Bookmark size={19} fill={saved ? "currentColor" : "none"}/></button>;

  return <>
    <motion.aside className={`glass profile-panel ${isStore ? "is-store" : ""}`} aria-label={`${operator.name} profile`} initial={reduced ? false : { opacity: 0, x: 35 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduced ? 0 : 35 }} transition={{ duration: .25 }}>
      <motion.div className="sheet-handle" drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(_, info) => { if (info.offset.y > 70) onClose(); else if (info.offset.y < -40) onExpand(); }}><span/></motion.div>
      <div className="profile-cover"><Image src={operator.media.src} alt={operator.media.alt} fill sizes="400px" className="object-cover"/><div/><span className="sample-badge">{coverLabel(operator)}</span><div className="profile-window-actions"><button onClick={onMinimize} className="icon-button" aria-label="Minimize profile details" title="Minimize"><Minus size={17}/></button><button onClick={onClose} className="icon-button" aria-label="Close profile"><X size={18}/></button></div></div>
      <div className="profile-content"><ProviderLogo incomplete={operator.verificationLevel === "incomplete"} cover={Boolean(operator.profile?.logoIsPhoto)} className="profile-panel-logo" name={operator.name} logo={operator.profile?.logo ?? profile?.profile.logo} type={operator.type} size={76}/><div className="profile-title"><div><span className="eyebrow">{operator.city} · {operator.country}</span><h2>{operator.name}</h2>{operator.company && <button type="button" className="provider-company-line" onClick={() => onOpenSlug(operator.company!.slug)}><ArrowLeft size={12}/><span>by</span>{operator.company.name}</button>}</div>{saveButton}</div>
        <div className="tag-row">{operator.modalities.map((item) => <span key={item}>{item}</span>)}</div>

        {isStore
          ? <Link className="profile-view-link is-store" href={`/operators/${operator.slug}`}><span><Store size={15}/></span><span><strong>Visit store</strong><small>{operator.productCount ?? products.length} devices with full specs and enquiries</small></span><ArrowUpRight size={16}/></Link>
          : <Link className="profile-view-link" href={`/operators/${operator.slug}`}><span><LayoutGrid size={15}/></span><span><strong>View profile</strong><small>Photos, data streams, and facility detail</small></span><ArrowUpRight size={16}/></Link>}

        {facilities.length > 0 && <section className="profile-facilities" aria-label={`${operator.name} facilities`}>
          <h3><Factory size={15}/>{facilities.length} {facilities.length === 1 ? "facility" : "facilities"} <small>now shown on the map</small></h3>
          <ul>{facilities.map((facility) => <li key={facility.slug}><button type="button" onClick={() => onOpenSlug(facility.slug)}>
            <ProviderLogo cover={Boolean(facility.profile?.logoIsPhoto)} name={facility.name} logo={facility.profile?.logo} type={facility.type} size={34}/>
            <span><strong>{facility.name}</strong><small><MapPin size={10}/>{facility.city}, {facility.country}{facility.profile.facility ? ` · ${formatCount(facility.profile.facility.totalWorkers)} workers` : ""}</small></span>
            <ChevronRight size={15}/>
          </button></li>)}</ul>
        </section>}

        {error ? <p role="alert" className="form-error">{error}</p> : !profile ? <p className="loading-inline"><LoaderCircle className="spin" size={16}/> Loading full profile…</p> : isStore ? <>
          <p className="profile-description">{profile.profile.description}</p>
          <span className={`verification-badge ${profile.verificationLevel === "incomplete" ? "is-incomplete" : ""}`}>{profile.verificationLevel === "physical" ? "Physically verified" : profile.verificationLevel === "incomplete" ? "Incomplete profile" : "Online verified"}</span>
          <h3><Package size={15}/> Products</h3>
          {products.length
            ? <div className="profile-products">{products.slice(0, STORE_PREVIEW).map((product) => <Link key={product.id} href={productPageUrl(product.id)} className="profile-product">
              <span className="profile-product-photo"><ProductPhoto product={product} sizes="160px"/></span>
              <small>{deviceCategoryLabel(product)}</small>
              <strong>{product.name}</strong>
              <em>{priceLabel(product.price)}</em>
            </Link>)}</div>
            : <p className="profile-description">This store has not published products yet.</p>}
          {products.length > STORE_PREVIEW && <Link className="secondary-button" href={`/operators/${operator.slug}#products`}>See all {products.length} products<ArrowUpRight size={14}/></Link>}
          <div className="profile-primary-actions"><Link className="primary-button request-button" href={`/operators/${operator.slug}`}>Open store <ArrowUpRight size={17}/></Link></div>
          <button className="secondary-button message-button" onClick={() => setChat(true)}><MessageSquare size={15}/> Message supplier</button>
        </> : <>
          <div className="profile-primary-actions"><ConciergeForm onError={onError}/><button className="primary-button request-button" disabled={requested} onClick={() => setRequest(true)}>{requested ? <><Check size={16}/> Data request sent</> : <>Request data <ArrowUpRight size={17}/></>}</button></div>
          <p className="profile-description">{profile.profile.description.replace("vetted ", "")}</p>
          <span className={`verification-badge ${profile.verificationLevel === "incomplete" ? "is-incomplete" : ""}`}>{profile.verificationLevel === "physical" ? "Physically verified" : profile.verificationLevel === "online" ? "Online verified" : profile.verificationLevel === "incomplete" ? "Incomplete profile" : "Demonstration listing"}</span>
          {profile.profile.facility
            ? <div className="profile-facts profile-facts-factory"><div><span>Total workers</span><strong>{formatCount(profile.profile.facility.totalWorkers)}</strong></div><div><span>Seated, hand tasks</span><strong>{formatCount(profile.profile.facility.seatedWorkers)}</strong></div><div><span>Tasks with movement</span><strong>{formatCount(profile.profile.facility.mobileWorkers)}</strong></div><div><span>Shifts per day</span><strong>{profile.profile.facility.shiftsPerDay}</strong></div></div>
            : <div className="profile-facts"><div><span>Capture capacity</span><strong>{profile.profile.capacity}</strong></div><div><span>{facilities.length ? "Facilities" : "Operating since"}</span><strong>{facilities.length ? facilities.length : profile.profile.established}</strong></div></div>}
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
