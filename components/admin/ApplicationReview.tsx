"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, BadgeCheck, CheckCircle2, ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Globe, History, LoaderCircle, MapPin, ShieldCheck, UserRound, XCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ApplicationName from "./ApplicationName";
import { api } from "@/lib/api-client";
import { assetUrl, formatBytes, formatDate, formatDateTime, formatRelative } from "@/lib/format";
import type { ApplicationDetail, AuditEntry } from "@/types/admin";
import { isPublicAsset } from "@/lib/image";
import { factoryCategoryLabel, formatCount, parseFacilityDetails, recordingConsentOptions } from "@/lib/facility";

type Decision = "approved" | "rejected";
type Photo = { src: string; label: string };

const focusLabels: Record<string, string> = { collection: "Data collection", platform: "Data platform", embodied: "Embodied AI" };
const actionLabels: Record<string, string> = { "application.approved": "Approved", "application.rejected": "Rejected", "application.pending": "Moved to pending" };

/** Reasons the application cannot be approved yet, mirrored from the server-side checks. */
function approvalBlockers(application: ApplicationDetail) {
  const blockers: string[] = [];
  if (!application.maps_url || !application.city || !application.country || application.longitude === null || application.latitude === null) blockers.push("The submission is missing its Google Maps location.");
  if (application.application_kind === "facility") {
    if (application.company?.status !== "approved") blockers.push("The supplier's data company must be approved first.");
    if (!application.office_images.length && !application.hardware_pictures.length) blockers.push("The facility has no photo evidence.");
  } else if (!application.company_logo?.key) blockers.push("The company has not uploaded its required logo.");
  return blockers;
}

function Section({ title, icon, children, aside }: { title: string; icon: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return <section className="review-section">
    <header><h2>{icon}{title}</h2>{aside}</header>
    {children}
  </section>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="review-field"><dt>{label}</dt><dd>{children || <span className="cell-muted">Not provided</span>}</dd></div>;
}

function Lightbox({ photos, index, onIndex, onClose }: { photos: Photo[]; index: number; onIndex: (index: number) => void; onClose: () => void }) {
  const photo = photos[index];
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") onIndex((index + 1) % photos.length);
      if (event.key === "ArrowLeft") onIndex((index - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, onIndex, photos.length]);
  return <Modal title={`${photo.label} · ${index + 1} of ${photos.length}`} onClose={onClose} wide>
    <div className="lightbox">
      <div className="lightbox-stage"><Image src={photo.src} alt={photo.label} fill unoptimized={!isPublicAsset(photo.src)} sizes="(max-width: 900px) 92vw, 760px"/></div>
      {photos.length > 1 && <div className="lightbox-controls">
        <button type="button" className="secondary-button" onClick={() => onIndex((index - 1 + photos.length) % photos.length)}><ChevronLeft size={16}/>Previous</button>
        <a className="secondary-button" href={photo.src} target="_blank" rel="noreferrer"><ExternalLink size={15}/>Open original</a>
        <button type="button" className="secondary-button" onClick={() => onIndex((index + 1) % photos.length)}>Next<ChevronRight size={16}/></button>
      </div>}
    </div>
  </Modal>;
}

export default function ApplicationReview({ id }: { id: string }) {
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [loadError, setLoadError] = useState("");
  const [level, setLevel] = useState<"online" | "physical">("online");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<Decision | "">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lightbox, setLightbox] = useState<number | null>(null);

  const load = useCallback(() => api<{ application: ApplicationDetail; history: AuditEntry[] }>(`/api/admin/applications/${id}`).then((data) => {
    setApplication(data.application);
    setHistory(data.history);
    setNotes(data.application.admin_notes ?? "");
    setLevel(data.application.verification_level === "physical" ? "physical" : "online");
  }), [id]);

  useEffect(() => {
    load().catch((reason) => setLoadError(reason.message));
  }, [load]);

  if (loadError) return <section className="admin-page-body"><EmptyState icon={<AlertTriangle/>} title="This application could not be opened" description={loadError}><Link className="secondary-button" href="/admin"><ArrowLeft size={15}/>Back to admin</Link></EmptyState></section>;
  if (!application) return <section className="admin-page-body"><p className="table-loading"><LoaderCircle className="spin" size={18}/>Loading application…</p></section>;

  const isCompany = application.application_kind === "company";
  const factory = isCompany ? null : parseFacilityDetails(application.facility_details);
  const queueHref = isCompany ? "/admin/companies" : "/admin/facilities";
  const blockers = approvalBlockers(application);
  const logoKey = application.company_logo?.key ?? null;
  // Approved images are public, so they load resized; pending ones need the admin's session.
  const imageUrl = (key: string) => application.status === "approved" ? `/api/company-assets?public=1&key=${encodeURIComponent(key)}` : assetUrl(key);
  const photos: Photo[] = [
    ...application.office_images.map((asset) => ({ src: imageUrl(asset.key), label: asset.name })),
    ...application.hardware_pictures.map((src, index) => ({ src, label: `Linked photo ${index + 1}` })),
  ];
  const links = [["Website", application.website_url], ["LinkedIn", application.linkedin_url], ["X / Twitter", application.twitter_url], ["Hugging Face", application.huggingface_url]].filter((entry): entry is [string, string] => Boolean(entry[1]));

  const decide = async (status: Decision) => {
    if (status === "rejected" && notes.trim().length < 5) { setError("Add a short reason so the supplier knows what to fix."); return; }
    setBusy(status); setError(""); setNotice("");
    try {
      await api(`/api/admin/applications/${application.id}`, { method: "PATCH", body: JSON.stringify({ status, verificationLevel: status === "approved" ? level : "unverified", notes }) });
      await load();
      setNotice(status === "approved" ? "Application approved. The listing is now live on the map." : "Application rejected. The supplier will see your feedback.");
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(""); }
  };

  return <section className="admin-page-body review-page">
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/admin">Admin</Link><span>/</span><Link href={queueHref}>{isCompany ? "Data companies" : "Facilities"}</Link><span>/</span><span aria-current="page">{application.business_name}</span></nav>

    <header className="review-header">
      <ApplicationName name={application.business_name} kind={application.application_kind} logoKey={logoKey} size="lg" detail={isCompany ? "Data company application" : `Facility${application.company ? ` of ${application.company.business_name}` : ""}`}/>
      <div className="review-header-meta">
        <StatusBadge status={application.status}/>
        {application.status === "approved" && <StatusBadge status={application.verification_level}/>}
        <span>Submitted {formatDate(application.submitted_at)} · {formatRelative(application.submitted_at)}</span>
      </div>
      <div className="review-header-actions">
        {application.maps_url && <a className="secondary-button" href={application.maps_url} target="_blank" rel="noreferrer"><MapPin size={15}/>Google Maps</a>}
        {application.status === "approved" && application.provider_slug && <Link className="secondary-button" href={`/operators/${application.provider_slug}`}><ExternalLink size={15}/>View listing</Link>}
      </div>
    </header>

    <div className="review-layout">
      <div className="review-main">
        <Section title="Applicant" icon={<UserRound size={17}/>}>
          <dl className="review-fields">
            <Field label="Name">{application.applicant_name}</Field>
            <Field label="Email"><a href={`mailto:${application.applicant_email}`}>{application.applicant_email}</a></Field>
            <Field label="Email verified">{application.applicant_email_verified_at && <span className="inline-verified"><BadgeCheck size={14}/>{formatDateTime(application.applicant_email_verified_at)}</span>}</Field>
            <Field label="Account created">{formatDate(application.applicant_joined_at)}</Field>
          </dl>
        </Section>

        <Section title={isCompany ? "Company profile" : "Facility profile"} icon={<ShieldCheck size={17}/>}>
          <p className="review-description">{application.profile_description || "No description supplied."}</p>
          <dl className="review-fields">
            {isCompany ? <Field label="Primary focus">{application.company_focus && (focusLabels[application.company_focus] ?? application.company_focus)}</Field>
              : <>{factory && <Field label="Facility category">{factoryCategoryLabel(factory)}</Field>}<Field label="Capacity">{application.capacity}</Field><Field label="Facility areas">{application.capture_environments.join(", ")}</Field></>}
            <Field label="Data capabilities">{(application.modalities.length || application.robotics_types.length) && <span className="chip-list">{[...application.modalities, ...application.robotics_types].map((item) => <span key={item} className="chip">{item}</span>)}</span>}</Field>
          </dl>
        </Section>

        {factory && <Section title="Workforce" icon={<UserRound size={17}/>}>
          <dl className="review-fields">
            <Field label="Total workers">{formatCount(factory.totalWorkers)}</Field>
            <Field label="Seated, hand-movement tasks">{formatCount(factory.seatedWorkers)}</Field>
            <Field label="Tasks with movement">{formatCount(factory.mobileWorkers)}</Field>
            <Field label="Shifts per day">{factory.shiftsPerDay}</Field>
            <Field label="Typical tasks">{factory.tasks.length > 0 && <span className="chip-list">{factory.tasks.map((task) => <span key={task} className="chip">{task}</span>)}</span>}</Field>
            <Field label="Recording consent">{recordingConsentOptions.find((option) => option.value === factory.recordingConsent)?.label}</Field>
          </dl>
        </Section>}

        <Section title="Location" icon={<MapPin size={17}/>} aside={application.maps_url && <a className="text-link" href={application.maps_url} target="_blank" rel="noreferrer">Open in Google Maps<ExternalLink size={13}/></a>}>
          <dl className="review-fields">
            <Field label="Address">{application.physical_address}</Field>
            <Field label="City / country">{(application.city || application.country) && `${application.city ?? "—"}, ${application.country ?? "—"}`}</Field>
            <Field label="Coordinates">{application.latitude !== null && application.longitude !== null && `${application.latitude.toFixed(5)}, ${application.longitude.toFixed(5)}`}</Field>
          </dl>
        </Section>

        <Section title="Logo and images" icon={<CheckCircle2 size={17}/>} aside={<span className="section-count">{photos.length} image{photos.length === 1 ? "" : "s"}</span>}>
          <div className="review-logo">
            <span className="application-name-mark size-xl" data-kind={application.application_kind}>{logoKey ? <Image src={imageUrl(logoKey)} alt={isCompany ? "Company logo" : "Facility profile photo"} fill unoptimized={!isPublicAsset(imageUrl(logoKey))} sizes="96px"/> : <span className="cell-muted">No logo</span>}</span>
            <span>{application.company_logo ? <><strong>{application.company_logo.name}</strong>{application.company_logo.size ? <small>{formatBytes(application.company_logo.size)}</small> : null}</> : <small>{isCompany ? "The company has not uploaded a logo." : "No facility profile photo (optional). The company logo is shown instead."}</small>}</span>
          </div>
          {photos.length ? <div className="review-gallery">{photos.map((photo, index) => <button key={photo.src} type="button" onClick={() => setLightbox(index)} aria-label={`Open ${photo.label}`}>
            <Image src={photo.src} alt={photo.label} fill unoptimized={!isPublicAsset(photo.src)} sizes="200px"/>
            <span>{photo.label}</span>
          </button>)}</div> : <p className="cell-muted">No images were submitted.</p>}
        </Section>

        <Section title={isCompany ? "Documents and sample" : "Signed facility agreement"} icon={<FileText size={17}/>} aside={<span className="section-count">{application.official_documents.length} document{application.official_documents.length === 1 ? "" : "s"}</span>}>
          {application.official_documents.length ? <ul className="review-documents">{application.official_documents.map((document) => <li key={document.key}>
            <FileText size={18}/>
            <span><strong>{document.type || (isCompany ? "Official company document" : "Facility document")}</strong><small>{document.name}{document.size ? ` · ${formatBytes(document.size)}` : ""} · {document.contentType === "application/pdf" ? "PDF" : "Image"}</small></span>
            <a className="secondary-button" href={assetUrl(document.key)} target="_blank" rel="noreferrer"><ExternalLink size={14}/>Open</a>
          </li>)}</ul> : <p className="cell-muted">{isCompany ? "No official documents were submitted." : "No signed agreement was submitted."}</p>}
          {isCompany && application.has_sample && <a className="secondary-button review-sample" href={`/api/admin/applications/${application.id}/sample`}><Download size={15}/>Download sample{application.sample_file_name ? `: ${application.sample_file_name}` : ""}{application.sample_size_bytes ? ` (${formatBytes(application.sample_size_bytes)})` : ""}</a>}
        </Section>

        {links.length > 0 && <Section title="Public footprint" icon={<Globe size={17}/>}>
          <ul className="review-links">{links.map(([label, url]) => <li key={label}><span>{label}</span><a href={url} target="_blank" rel="noreferrer">{url}<ExternalLink size={13}/></a></li>)}</ul>
        </Section>}

        {(application.company || application.facilities.length > 0) && <Section title={isCompany ? "Facilities from this supplier" : "Parent company"} icon={<ShieldCheck size={17}/>}>
          <ul className="review-related">
            {application.company && <li><Link href={`/admin/applications/${application.company.id}`}>{application.company.business_name}</Link><StatusBadge status={application.company.status}/></li>}
            {application.facilities.map((facility) => <li key={facility.id}><Link href={`/admin/applications/${facility.id}`}>{facility.business_name}</Link><small>{[facility.city, facility.country].filter(Boolean).join(", ")}</small><StatusBadge status={facility.status}/></li>)}
          </ul>
        </Section>}

        <Section title="Review history" icon={<History size={17}/>}>
          {history.length ? <ol className="timeline">{history.map((entry) => <li key={entry.id}>
            <StatusBadge status={entry.action.split(".")[1] ?? entry.action} label={actionLabels[entry.action] ?? entry.action}/>
            <div><strong>{entry.admin_name}</strong>{entry.metadata.verificationLevel && entry.action === "application.approved" && <span> · {entry.metadata.verificationLevel} verification</span>}<small>{formatDateTime(entry.created_at)}</small>{entry.metadata.notes && <p>{entry.metadata.notes}</p>}</div>
          </li>)}</ol> : <p className="cell-muted">No decisions have been recorded yet.</p>}
        </Section>
      </div>

      <aside className="decision-panel" aria-label="Review decision">
        <h2>Decision</h2>
        <p className="decision-current">Current status <StatusBadge status={application.status}/></p>
        {application.reviewed_at && <p className="decision-meta">Last reviewed {formatDateTime(application.reviewed_at)}</p>}
        {blockers.length > 0 && <div className="decision-blockers" role="note"><AlertTriangle size={16}/><div><strong>Cannot approve yet</strong><ul>{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>{!isCompany && application.company && application.company.status !== "approved" && <Link href={`/admin/applications/${application.company.id}`}>Review the company first</Link>}</div></div>}
        <fieldset className="decision-levels" disabled={Boolean(busy)}>
          <legend>Verification level for approval</legend>
          <label className={level === "online" ? "selected" : ""}><input type="radio" name="level" value="online" checked={level === "online"} onChange={() => setLevel("online")}/><span><strong>Online verified</strong><small>Identity, documents, and public footprint checked remotely.</small></span></label>
          <label className={level === "physical" ? "selected" : ""}><input type="radio" name="level" value="physical" checked={level === "physical"} onChange={() => setLevel("physical")}/><span><strong>Physically verified</strong><small>The location was visited or verified in person.</small></span></label>
        </fieldset>
        <label className="decision-notes">Notes for the supplier<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={4000} rows={5} placeholder="Record what you verified, or explain what needs to change. Required when rejecting."/></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="settings-message settings-success" role="status">{notice}</p>}
        <div className="decision-actions">
          <button type="button" className="button-approve" disabled={Boolean(busy) || blockers.length > 0} onClick={() => void decide("approved")}>{busy === "approved" ? <LoaderCircle className="spin" size={16}/> : <BadgeCheck size={16}/>}{application.status === "approved" ? "Save approval" : "Approve"}</button>
          <button type="button" className="button-reject" disabled={Boolean(busy)} onClick={() => void decide("rejected")}>{busy === "rejected" ? <LoaderCircle className="spin" size={16}/> : <XCircle size={16}/>}{application.status === "rejected" ? "Update rejection" : "Reject"}</button>
        </div>
        <p className="decision-meta">Approving publishes the listing on the map. Rejecting hides it and shows your notes to the supplier.</p>
      </aside>
    </div>

    {lightbox !== null && photos[lightbox] && <Lightbox photos={photos} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)}/>}
  </section>;
}
