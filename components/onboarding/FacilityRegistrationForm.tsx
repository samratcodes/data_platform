"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, Car, Check, ClipboardCheck, Cog, Eye, Image as ImageIcon, Lightbulb, Cpu, Factory, Footprints, Hand, LoaderCircle,
  MapPinned, Package, Palette, PencilLine, Pill, Plus, Send, Shirt, ShieldCheck, Sofa, Boxes, Users, UtensilsCrossed, Warehouse,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "@/lib/api-client";
import {
  emptyFacilityDetails, factoryAreas, factoryCategories, factoryCategoryLabel, factoryTasks, formatCount, parseFacilityDetails,
  recordingConsentOptions, workforceIssues, type FactoryCategory, type RecordingConsent,
} from "@/lib/facility";
import ProviderMediaManager from "@/components/media/ProviderMediaManager";
import type { FacilityRecord } from "@/types/supplier";
import FacilityLocationPicker from "./FacilityLocationPicker";
import CompanyLogoPicker from "./CompanyLogoPicker";
import OfficeImagePicker from "./OfficeImagePicker";
import OfficialDocumentPicker from "./OfficialDocumentPicker";
import { companyCapabilities, mergeCompanyLocation, uploadCompanyEvidence, validGoogleMapsUrl, type CompanyEvidence } from "./CompanyProfileSteps";

const categoryIcons: Record<FactoryCategory, LucideIcon> = {
  food: UtensilsCrossed, textiles: Shirt, footwear: Footprints, electronics: Cpu, automotive: Car, metal: Cog, plastics: Boxes,
  furniture: Sofa, pharma: Pill, packaging: Package, handicrafts: Palette, logistics: Warehouse, other: Factory,
};

const railSteps = [
  { title: "Facility", detail: "Name, type, and profile" },
  { title: "Workforce", detail: "Workers and daily tasks" },
  { title: "Data capture", detail: "What can be recorded" },
  { title: "Location", detail: "Where the facility is" },
  { title: "Documents & photos", detail: "Evidence for review" },
  { title: "Review", detail: "Check and submit" },
];
const titles = [
  "Tell us about this facility",
  "Who works at this facility?",
  "What data can be captured here?",
  "Where is the facility located?",
  "Add facility documents and photos",
  "Review your facility before submitting",
];
const descriptions = [
  "Choose the kind of facility and describe it the way you want buyers to see it on the map.",
  "Buyers source real-world task data, so the workforce and the kind of work people do matter most.",
  "Choose each capability this facility can capture today, and the areas where capture happens.",
  "Search an address, paste a Google Maps link, or place the pin exactly on the facility.",
  "Photos show buyers the site. Documents prove the facility is real and are only visible to reviewers.",
  "Check each section. You can jump back to any step to change it.",
];
const LAST_STEP = railSteps.length - 1;
const assetUrl = (key: string) => `/api/company-assets?key=${encodeURIComponent(key)}`;

type Values = {
  businessName: string; description: string; category: FactoryCategory; categoryOther: string;
  totalWorkers: string; seatedWorkers: string; mobileWorkers: string; shiftsPerDay: number; tasks: string[]; recordingConsent: RecordingConsent;
  modalities: string[]; areas: string[]; otherAreas: string;
  mapsUrl: string; physicalAddress: string; city: string; country: string; longitude: string; latitude: string; photos: string[];
};
type FieldKey = "businessName" | "description" | "categoryOther" | "totalWorkers" | "seatedWorkers" | "mobileWorkers" | "shiftsPerDay" | "modalities" | "location" | "mapsUrl" | "physicalAddress" | "city" | "country" | "images" | "documents";
type FieldErrors = Partial<Record<FieldKey, string>>;

const countValue = (value: string) => value.trim() === "" ? NaN : Number(value);
const countText = (value: number) => Number.isFinite(value) ? String(value) : "";

function initialValues(facility?: FacilityRecord): Values {
  const details = parseFacilityDetails(facility?.facility_details) ?? (facility ? null : emptyFacilityDetails);
  const known = new Set<string>(factoryAreas);
  const environments = facility?.capture_environments ?? [];
  return {
    businessName: facility?.business_name ?? "", description: facility?.profile_description ?? "",
    category: details?.category ?? "food", categoryOther: details?.categoryOther ?? "",
    // New facilities start empty; older facilities without details must fill the workforce in.
    totalWorkers: details && facility ? countText(details.totalWorkers) : "", seatedWorkers: details && facility ? countText(details.seatedWorkers) : "",
    mobileWorkers: details && facility ? countText(details.mobileWorkers) : "", shiftsPerDay: details?.shiftsPerDay ?? 1,
    tasks: details?.tasks ?? [], recordingConsent: details?.recordingConsent ?? "willing",
    modalities: facility?.modalities ?? [], areas: environments.filter((item) => known.has(item)), otherAreas: environments.filter((item) => !known.has(item)).join(", "),
    mapsUrl: facility?.maps_url ?? "", physicalAddress: facility?.physical_address ?? "", city: facility?.city ?? "", country: facility?.country ?? "",
    longitude: facility?.longitude == null ? "" : String(facility.longitude), latitude: facility?.latitude == null ? "" : String(facility.latitude),
    photos: facility?.hardware_pictures ?? [],
  };
}

const workforce = (values: Values) => ({
  totalWorkers: countValue(values.totalWorkers), seatedWorkers: countValue(values.seatedWorkers),
  mobileWorkers: countValue(values.mobileWorkers), shiftsPerDay: values.shiftsPerDay,
});

function validate(step: number, values: Values, evidence: CompanyEvidence, savedImages: number): FieldErrors {
  const issues: FieldErrors = {};
  if (step === 0) {
    if (values.businessName.trim().length < 2) issues.businessName = "Enter a facility name with at least 2 characters.";
    if (values.category === "other" && values.categoryOther.trim().length < 2) issues.categoryOther = "Describe the kind of facility.";
    if (values.description.trim().length < 20) issues.description = "Describe the facility in at least 20 characters.";
  }
  if (step === 1) Object.assign(issues, workforceIssues(workforce(values)));
  if (step === 2 && !values.modalities.length) issues.modalities = "Select at least one data capability.";
  if (step === 3) {
    if (!values.longitude || !values.latitude || Math.abs(Number(values.longitude)) > 180 || Math.abs(Number(values.latitude)) > 90) issues.location = "Search for a location or place the pin on the map.";
    if (!validGoogleMapsUrl(values.mapsUrl.trim())) issues.mapsUrl = "Select a location on the map or paste a valid Google Maps URL.";
    if (values.physicalAddress.trim().length < 5) issues.physicalAddress = "Enter the full physical address.";
    if (values.city.trim().length < 2) issues.city = "Enter the city.";
    if (values.country.trim().length < 2) issues.country = "Enter the country.";
  }
  if (step === 4) {
    if (!evidence.officeImages.length && !values.photos.length && !savedImages) issues.images = "Add at least one photo of the facility.";
    if (!evidence.documents.length) issues.documents = "Upload at least one facility document, such as a registration certificate or operating license.";
    else if (evidence.documents.some((document) => document.type.trim().length < 2)) issues.documents = "Name the type of each document.";
  }
  return issues;
}

const stepTips = [
  "Use the name workers and buyers know the site by. The profile should say what is produced and what a normal day looks like.",
  "Counts can be approximate. Seated hand tasks are work done at a bench or machine; movement tasks involve walking, lifting, or loading.",
  "Only choose what you can capture today. You can add capabilities later, and each change is reviewed.",
  "Pin the entrance of the facility. Buyers only see the city; reviewers use the exact pin to verify the site.",
  "Clear photos of the production floor help most. A registration certificate or operating license is the fastest document to verify.",
  "Check every section. After you submit, you can follow the review from the facility's dashboard.",
];

type PreviewProps = { companyName: string; name: string; categoryLabel: string; place: string; cover?: string; profile?: string; workers: number | null; seated: number; mobile: number; modalities: string[] };

/** How the facility will look to buyers, updated live as the form is filled in. */
function FacilityPreview({ companyName, name, categoryLabel, place, cover, profile, workers, seated, mobile, modalities }: PreviewProps) {
  return <div className="facility-preview">
    <div className="facility-preview-cover">
      {cover ? <Image src={cover} alt="" fill unoptimized sizes="320px"/> : <span><ImageIcon/>Site photo</span>}
      <em>FACILITY · {categoryLabel.toUpperCase()}</em>
    </div>
    <div className="facility-preview-body">
      <span className="facility-preview-profile">{profile ? <Image src={profile} alt="" fill unoptimized sizes="44px"/> : <Factory/>}</span>
      <strong>{name || "Your facility name"}</strong>
      <small className="facility-preview-company">by {companyName}</small>
      <small><MapPinned size={12}/>{place || "City, country"}</small>
      <dl><div><dt>Workers</dt><dd>{workers === null ? "—" : formatCount(workers)}</dd></div><div><dt>Seated</dt><dd>{formatCount(seated)}</dd></div><div><dt>Moving</dt><dd>{formatCount(mobile)}</dd></div></dl>
      {modalities.length > 0 && <p>{modalities.map((item) => <span key={item}>{item}</span>)}</p>}
    </div>
  </div>;
}

/**
 * Full-page facility registration, laid out like the data-company signup wizard.
 * With `facility`, the same steps edit an existing facility and send it back for review.
 */
export default function FacilityRegistrationForm({ companyName, facility }: { companyName: string; facility?: FacilityRecord }) {
  const router = useRouter();
  const editing = Boolean(facility);
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(editing ? LAST_STEP : 0);
  const [values, setValues] = useState(() => initialValues(facility));
  const [evidence, setEvidence] = useState<CompanyEvidence>(() => ({
    logo: null, officeImages: [],
    documents: (facility?.official_documents ?? []).map((asset) => ({ key: asset.key, url: assetUrl(asset.key), name: asset.name, contentType: asset.contentType, size: asset.size || 0, type: asset.type || "Facility document" })),
  }));
  // Linked photos can be deleted live by the media manager, so only resend them after a new location is picked.
  const [pickedLocation, setPickedLocation] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mediaNotice, setMediaNotice] = useState("");

  const savedImages = (facility?.office_images.length ?? 0) + (pickedLocation ? 0 : facility?.hardware_pictures.length ?? 0);
  const check = (index: number) => validate(index, values, evidence, savedImages);
  const fieldErrors = attempted ? check(step) : {};
  const fieldError = (field: FieldKey) => fieldErrors[field];
  const update = <K extends keyof Values>(field: K, value: Values[K]) => setValues((current) => ({ ...current, [field]: value }));
  const toggle = (field: "modalities" | "areas" | "tasks", value: string) => update(field, values[field].includes(value) ? values[field].filter((item) => item !== value) : [...values[field], value]);
  const errorProps = (field: FieldKey) => ({ "aria-invalid": Boolean(fieldError(field)), "aria-describedby": fieldError(field) ? `factory-${field}-error` : undefined });
  const errorText = (field: FieldKey) => fieldError(field) && <small id={`factory-${field}-error`} className="wizard-field-error">{fieldError(field)}</small>;
  const inputCard = (field: FieldKey, label: ReactNode, input: ReactNode, className = "") => <label className={`wizard-input-card ${className} ${fieldError(field) ? "has-error" : ""}`}><span>{label}</span>{input}{errorText(field)}</label>;

  const focusProblem = () => window.setTimeout(() => {
    const input = document.querySelector<HTMLElement>('.facility-wizard [aria-invalid="true"]');
    if (input) { input.focus({ preventScroll: true }); input.scrollIntoView({ block: "center", behavior: "smooth" }); }
    else document.querySelector<HTMLElement>(".facility-wizard .company-wizard-alert")?.scrollIntoView({ block: "center" });
  }, 0);
  const goTo = (index: number) => {
    setAttempted(false); setError(""); setStep(index); setFurthest((current) => Math.max(current, index));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const next = () => {
    if (Object.keys(check(step)).length) { setAttempted(true); setError(""); focusProblem(); return; }
    goTo(Math.min(step + 1, LAST_STEP));
  };

  const submit = async () => {
    for (let index = 0; index < LAST_STEP; index += 1) {
      if (Object.keys(check(index)).length) { setStep(index); setAttempted(true); focusProblem(); return; }
    }
    setBusy(true); setError("");
    let savedId = facility?.id ?? "";
    try {
      const areas = [...values.areas, ...values.otherAreas.split(",").map((item) => item.trim()).filter(Boolean)];
      const saved = await api<{ id: string }>("/api/supplier/application", { method: "POST", body: JSON.stringify({
        kind: "facility", applicationId: facility?.id, businessName: values.businessName, description: values.description,
        facility: { ...workforce(values), category: values.category, categoryOther: values.categoryOther, tasks: values.tasks, recordingConsent: values.recordingConsent },
        modalities: values.modalities, captureEnvironments: [...new Set(areas)],
        mapsUrl: values.mapsUrl, physicalAddress: values.physicalAddress, city: values.city, country: values.country, longitude: values.longitude, latitude: values.latitude,
        hardwarePictures: !facility || pickedLocation ? values.photos : undefined,
      }) });
      savedId = saved.id;
      const kept = new Set(evidence.documents.flatMap((document) => document.key ? [document.key] : []));
      for (const document of facility?.official_documents ?? []) {
        if (!kept.has(document.key)) await api(`/api/company-assets?${new URLSearchParams({ key: document.key, applicationId: savedId })}`, { method: "DELETE" });
      }
      await uploadCompanyEvidence(evidence, savedId);
      router.push(editing ? `/supplier/facilities/${savedId}?updated=1` : "/supplier/facilities?facility=submitted");
      router.refresh();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Unable to submit the facility.";
      if (savedId && !editing) {
        // The facility exists; missing files can be added from its card on the workspace.
        router.push("/supplier/facilities?facility=partial");
        router.refresh();
        return;
      }
      setError(message); setBusy(false);
    }
  };

  const total = countValue(values.totalWorkers);
  const seated = countValue(values.seatedWorkers) || 0;
  const mobile = countValue(values.mobileWorkers) || 0;
  const other = Number.isFinite(total) ? Math.max(0, total - seated - mobile) : 0;
  const share = (value: number) => `${total > 0 ? Math.min(100, (value / total) * 100) : 0}%`;
  const categoryLabel = factoryCategoryLabel(values);
  const allAreas = [...values.areas, ...values.otherAreas.split(",").map((item) => item.trim()).filter(Boolean)];
  const photoCount = evidence.officeImages.length + savedImages + (pickedLocation || !facility ? values.photos.length : 0);

  const assetKeyUrl = (key: string) => `/api/company-assets?key=${encodeURIComponent(key)}`;
  const preview: PreviewProps = {
    companyName, name: values.businessName.trim(), categoryLabel, place: [values.city, values.country].filter(Boolean).join(", "),
    cover: evidence.officeImages[0]?.url ?? (facility?.office_images[0] ? assetKeyUrl(facility.office_images[0].key) : values.photos[0] ?? facility?.hardware_pictures[0]),
    profile: evidence.logo?.url ?? (facility?.company_logo ? assetKeyUrl(facility.company_logo.key) : undefined),
    workers: Number.isFinite(total) ? total : null, seated, mobile, modalities: values.modalities,
  };
  const done = (index: number) => !Object.keys(check(index)).length;
  const checklist = [
    { label: "Name, type, and profile", done: done(0) },
    { label: "Workforce", done: done(1) },
    { label: "Data capabilities", done: done(2) },
    { label: "Location pinned", done: done(3) },
    { label: "At least one photo", done: photoCount > 0 },
    { label: "Facility document", done: evidence.documents.length > 0 && evidence.documents.every((document) => document.type.trim().length >= 2) },
  ];

  const reviewSection = (index: number, rows: Array<[string, ReactNode]>) => <section className="facility-review-section">
    <header><span className="wizard-step-dot">{index + 1}</span><strong>{railSteps[index].title}</strong><button type="button" onClick={() => goTo(index)}><PencilLine size={14}/>Edit</button></header>
    <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || <span className="cell-muted">Not provided</span>}</dd></div>)}</dl>
  </section>;

  return <section className="company-wizard company-wizard-full facility-wizard" aria-labelledby="facility-wizard-title">
    <aside className="company-wizard-banner wizard-rail">
      <div className="wizard-rail-head"><span className="company-wizard-mark"><Factory/></span><div><p>{companyName.toUpperCase()}</p><h1 id="facility-wizard-title">{editing ? "Edit facility" : "New facility application"}</h1></div></div>
      <p className="wizard-rail-intro">{editing ? "Update any step, then submit. Your live listing stays on the map until the changes are approved." : "Each facility gets its own map pin and profile once our team approves it."}</p>
      <ol className="wizard-stepper" aria-label="Facility steps">{railSteps.map((item, index) => {
        const state = index === step ? "is-current" : index <= furthest ? "is-done" : "";
        return <li key={item.title} className={state} aria-current={index === step ? "step" : undefined}>
          <button type="button" disabled={index > furthest || index === step || busy} onClick={() => goTo(index)}><span className="wizard-step-dot">{index < furthest || (editing && index !== step) ? <Check size={16}/> : index + 1}</span><span><strong>{item.title}</strong><small>{item.detail}</small></span></button>
        </li>;
      })}</ol>
      <div className="facility-rail-extras">
        <section className="side-card"><h3><Eye size={16}/>Map preview</h3><FacilityPreview {...preview}/></section>
        <section className="side-card"><h3><ClipboardCheck size={16}/>Application checklist<small>{checklist.filter((item) => item.done).length}/{checklist.length}</small></h3>
          <div className="side-progress"><i style={{ width: `${(checklist.filter((item) => item.done).length / checklist.length) * 100}%` }}/></div>
          <ul className="side-checklist">{checklist.map((item) => <li key={item.label} className={item.done ? "is-done" : ""}><span>{item.done ? <Check size={12}/> : null}</span>{item.label}</li>)}</ul>
        </section>
      </div>
      <div className="wizard-rail-footer">
        <p className="wizard-rail-login"><Link href={facility ? `/supplier/facilities/${facility.id}` : "/supplier/facilities"}>← {facility ? "Back to facility dashboard" : "Back to facilities"}</Link></p>
      </div>
    </aside>

    <form className="company-wizard-form" noValidate onSubmit={(event) => { event.preventDefault(); if (step === LAST_STEP) void submit(); else next(); }}>
      <div className="facility-form-column">
      <header><span>STEP {step + 1} OF {railSteps.length}</span><h2>{titles[step]}</h2><p>{descriptions[step]}</p></header>
      <p className="facility-step-tip"><Lightbulb size={16}/><span><strong>Tip</strong>{stepTips[step]}</span></p>
      <div className="company-wizard-content">
        {(error || (attempted && Object.keys(fieldErrors).length > 0)) && <div className="company-wizard-alert" role="alert"><AlertTriangle size={19}/><span><strong>{error ? "Something needs attention" : "Check the highlighted fields"}</strong><small>{error || "Correct each highlighted field to continue."}</small></span></div>}
        {editing && facility?.admin_notes && step === 0 && <div className="review-feedback"><ShieldCheck/><span><strong>Reviewer feedback</strong>{facility.admin_notes}</span></div>}

        {step === 0 && <div className="company-wizard-fields">
          {inputCard("businessName", "Facility name", <input value={values.businessName} onChange={(event) => update("businessName", event.target.value)} maxLength={120} placeholder={`${companyName} — Kathmandu garment facility`} {...errorProps("businessName")} autoFocus/>)}
          <div><span className="wizard-section-label">Facility type</span>
            <div className="wizard-choice-grid is-compact" role="radiogroup" aria-label="Facility type">{factoryCategories.map((option) => {
              const Icon = categoryIcons[option.value]; const selected = values.category === option.value;
              return <button type="button" key={option.value} role="radio" aria-checked={selected} className={selected ? "selected" : ""} onClick={() => update("category", option.value)}><Icon/><strong>{option.label}</strong><small>{option.detail}</small>{selected && <Check/>}</button>;
            })}</div>
          </div>
          {values.category === "other" && inputCard("categoryOther", "What kind of facility is it?", <input value={values.categoryOther} onChange={(event) => update("categoryOther", event.target.value)} maxLength={80} placeholder="e.g. Toy manufacturing" {...errorProps("categoryOther")}/>)}
          {inputCard("description", "Facility profile", <textarea value={values.description} onChange={(event) => update("description", event.target.value)} maxLength={3000} placeholder="What the facility produces, the production setup, and what a normal working day looks like." {...errorProps("description")}/>)}
        </div>}

        {step === 1 && <div className="company-wizard-fields">
          <div className="wizard-field-grid facility-workforce-grid">
            {inputCard("totalWorkers", <><Users size={14}/>Total workers</>, <input type="number" inputMode="numeric" min={1} step={1} value={values.totalWorkers} onChange={(event) => update("totalWorkers", event.target.value)} placeholder="e.g. 250" {...errorProps("totalWorkers")} autoFocus/>)}
            {inputCard("seatedWorkers", <><Hand size={14}/>Seated, hand-movement tasks</>, <><input type="number" inputMode="numeric" min={0} step={1} value={values.seatedWorkers} onChange={(event) => update("seatedWorkers", event.target.value)} placeholder="e.g. 180" {...errorProps("seatedWorkers")}/><small className="wizard-input-hint">Working at a bench or machine: sewing, assembly, sorting.</small></>)}
            {inputCard("mobileWorkers", <><Footprints size={14}/>Tasks with movement</>, <><input type="number" inputMode="numeric" min={0} step={1} value={values.mobileWorkers} onChange={(event) => update("mobileWorkers", event.target.value)} placeholder="e.g. 50" {...errorProps("mobileWorkers")}/><small className="wizard-input-hint">Walking, lifting, loading, or tending several machines.</small></>)}
          </div>
          <div className="facility-workforce-split" aria-live="polite">
            <div className="facility-workforce-bar" aria-hidden><i data-group="seated" style={{ width: share(seated) }}/><i data-group="mobile" style={{ width: share(mobile) }}/><i data-group="other" style={{ width: share(other) }}/></div>
            <ul>
              <li data-group="seated"><strong>{formatCount(seated)}</strong> seated, hand tasks</li>
              <li data-group="mobile"><strong>{formatCount(mobile)}</strong> with movement</li>
              <li data-group="other"><strong>{formatCount(other)}</strong> other roles</li>
            </ul>
          </div>
          <div><span className="wizard-section-label">Shifts per day</span>
            <div className="wizard-segmented" role="radiogroup" aria-label="Shifts per day">{[1, 2, 3, 4].map((count) => <button type="button" key={count} role="radio" aria-checked={values.shiftsPerDay === count} className={values.shiftsPerDay === count ? "selected" : ""} onClick={() => update("shiftsPerDay", count)}>{count} {count === 1 ? "shift" : "shifts"}</button>)}</div>
          </div>
          <div><span className="wizard-section-label">Typical tasks <small>Optional, select all that apply</small></span>
            <div className="wizard-chip-grid">{factoryTasks.map((task) => { const selected = values.tasks.includes(task); return <button type="button" key={task} className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => toggle("tasks", task)}>{selected ? <Check size={14}/> : <Plus size={14}/>}{task}</button>; })}</div>
          </div>
          <div><span className="wizard-section-label">Worker consent to be recorded</span>
            <div className="wizard-choice-grid" role="radiogroup" aria-label="Worker consent to be recorded">{recordingConsentOptions.map((option) => { const selected = values.recordingConsent === option.value; return <button type="button" key={option.value} role="radio" aria-checked={selected} className={selected ? "selected" : ""} onClick={() => update("recordingConsent", option.value)}><ShieldCheck/><strong>{option.label}</strong><small>{option.detail}</small>{selected && <Check/>}</button>; })}</div>
            <p className="fieldset-note">Only reviewers see this. It helps us plan capture with you.</p>
          </div>
        </div>}

        {step === 2 && <div className="company-wizard-fields">
          <div><span className="wizard-section-label">Data capabilities</span><div className={`wizard-capability-grid ${fieldError("modalities") ? "has-error" : ""}`}>{companyCapabilities.map(({ value, icon: Icon, detail }) => <button type="button" key={value} className={values.modalities.includes(value) ? "selected" : ""} aria-pressed={values.modalities.includes(value)} onClick={() => toggle("modalities", value)}><Icon/><span><strong>{value}</strong><small>{detail}</small></span>{values.modalities.includes(value) && <i><Check/></i>}</button>)}</div>{fieldError("modalities") && <p className="wizard-section-error">{fieldError("modalities")}</p>}</div>
          <div><span className="wizard-section-label">Facility areas <small>Optional</small></span>
            <div className="wizard-chip-grid">{factoryAreas.map((area) => { const selected = values.areas.includes(area); return <button type="button" key={area} className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => toggle("areas", area)}>{selected ? <Check size={14}/> : <Plus size={14}/>}{area}</button>; })}</div>
            <label className="wizard-input-card wizard-other-environments"><span>Other areas <small>Optional, comma separated</small></span><input value={values.otherAreas} onChange={(event) => update("otherAreas", event.target.value)} maxLength={400} placeholder="Dye house, cold storage"/></label>
          </div>
        </div>}

        {step === 3 && <div className="company-wizard-fields">
          <div className={`wizard-location-picker ${fieldError("location") ? "has-error" : ""}`}><span className="wizard-section-label">Find or pinpoint the facility</span><FacilityLocationPicker longitude={values.longitude} latitude={values.latitude} onChange={(location) => { setPickedLocation(true); setValues((current) => mergeCompanyLocation(current, location)); }}/>{fieldError("location") && <p className="wizard-section-error">{fieldError("location")}</p>}</div>
          <div className="wizard-field-grid">
            {inputCard("physicalAddress", "Physical address", <input value={values.physicalAddress} onChange={(event) => update("physicalAddress", event.target.value)} maxLength={240} placeholder="Street address" {...errorProps("physicalAddress")}/>)}
            {inputCard("mapsUrl", "Google Maps location", <input type="url" value={values.mapsUrl} onChange={(event) => update("mapsUrl", event.target.value)} placeholder="Added when you search or pin a location" {...errorProps("mapsUrl")}/>)}
          </div>
          <div className="wizard-field-grid">
            {(["city", "country"] as const).map((field) => <label className={`wizard-input-card ${fieldError(field) ? "has-error" : ""}`} key={field}><span>{field === "city" ? "City" : "Country"}</span><input value={values[field]} onChange={(event) => update(field, event.target.value)} maxLength={100} placeholder={field === "city" ? "Kathmandu" : "Nepal"} {...errorProps(field)}/>{errorText(field)}</label>)}
            {(["longitude", "latitude"] as const).map((field) => <label className="wizard-input-card" key={field}><span>{field === "longitude" ? "Longitude" : "Latitude"}</span><input readOnly value={values[field]} placeholder={field === "longitude" ? "85.3240" : "27.7172"}/></label>)}
          </div>
          <p className="wizard-location-note"><MapPinned/> Buyers see the city on the map. The exact pin is used by reviewers to verify the facility.</p>
        </div>}

        {step === 4 && <div className="company-wizard-fields company-evidence-fields">
          {facility
            ? <>
              <ProviderMediaManager applicationId={facility.id} title="Profile photo and site photos" description="Changes to photos save right away. Your live listing keeps its current photos until the update is approved." showLogo logoRequired={false} logoLabel="Facility profile photo" logoNoun="profile photo" logoPhoto logo={facility.company_logo} images={facility.office_images} linkedPhotos={pickedLocation ? [] : facility.hardware_pictures} onChanged={async (message) => { setMediaNotice(message); router.refresh(); }}/>
              {mediaNotice && <p className="settings-message settings-success" role="status">{mediaNotice}</p>}
            </>
            : <>
              <CompanyLogoPicker label="Facility profile photo" noun="profile photo" photo required={false} hint="Shown on this facility's map pin and profile. Without one, your company logo is used." logo={evidence.logo} onChange={(logo) => setEvidence({ ...evidence, logo })} onError={setError}/>
              <OfficeImagePicker title="Facility photos" required={!values.photos.length} images={evidence.officeImages} onChange={(officeImages) => setEvidence({ ...evidence, officeImages })} onError={setError}/>
            </>}
          {values.photos.length > 0 && (!facility || pickedLocation) && <p className="fieldset-note"><BadgeCheck/> {values.photos.length} public {values.photos.length === 1 ? "photo was" : "photos were"} imported from Google Maps and will be included with this facility.</p>}
          {fieldError("images") && <p className="wizard-section-error" role="alert">{fieldError("images")}</p>}
          <OfficialDocumentPicker title="Facility documents" required typePlaceholder="e.g. Facility registration certificate" documents={evidence.documents} onChange={(documents) => setEvidence({ ...evidence, documents })} onError={setError} showTypeErrors={attempted} error={fieldError("documents")}/>
          <p className="fieldset-note">Accepted: business or facility registration, operating license, tax registration, or a lease for the site.</p>
        </div>}

        {step === LAST_STEP && <div className="facility-review">
          {reviewSection(0, [["Name", values.businessName], ["Type", categoryLabel], ["Profile", <span key="description" className="facility-review-text">{values.description}</span>]])}
          {reviewSection(1, [["Total workers", Number.isFinite(total) ? formatCount(total) : ""], ["Seated, hand tasks", formatCount(seated)], ["Tasks with movement", formatCount(mobile)], ["Shifts per day", String(values.shiftsPerDay)], ["Typical tasks", values.tasks.join(", ")], ["Recording consent", recordingConsentOptions.find((option) => option.value === values.recordingConsent)?.label]])}
          {reviewSection(2, [["Capabilities", values.modalities.join(", ")], ["Facility areas", allAreas.join(", ")]])}
          {reviewSection(3, [["Address", values.physicalAddress], ["City", [values.city, values.country].filter(Boolean).join(", ")]])}
          {reviewSection(4, [["Photos", photoCount ? `${photoCount} ${photoCount === 1 ? "photo" : "photos"}` : ""], ["Documents", evidence.documents.map((document) => document.type || document.name).join(", ")]])}
          <div className="facility-review-preview"><FacilityPreview {...preview}/></div>
          <div className="wizard-trust-card"><ShieldCheck/><span><strong>What happens next</strong><small>{editing ? "Your changes go to our review team. The approved version stays live until then." : "Our team reviews the facility, usually within two business days. Once approved, it appears on the map with its own profile."}</small></span></div>
        </div>}
      </div>
      </div>
      <footer><div className="facility-form-column facility-footer-row">
        <div className="company-wizard-progress" aria-label={`Step ${step + 1} of ${railSteps.length}`}><span>Facility progress</span><div>{railSteps.map((item, index) => <i key={item.title} className={index <= step ? "active" : ""} title={item.title}/>)}</div><small>Step {step + 1} of {railSteps.length} · {railSteps[step].title}</small></div>
        <div className="company-wizard-actions">
          {step > 0 && <button type="button" className="wizard-back" onClick={() => goTo(step - 1)} disabled={busy}><ArrowLeft/>Back</button>}
          <button type="submit" className="wizard-next" disabled={busy}>{busy ? <LoaderCircle className="spin"/> : step === LAST_STEP ? <><Send/>{editing ? "Submit changes for review" : "Submit application"}</> : step === LAST_STEP - 1 ? <>Review<ArrowRight/></> : <>Continue<ArrowRight/></>}</button>
        </div>
      </div></footer>
    </form>
  </section>;
}
