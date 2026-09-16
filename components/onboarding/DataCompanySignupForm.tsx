"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Building2, Check, Eye, EyeOff, Image as ImageIcon, LoaderCircle, MapPinned, Mic, Radio, ShieldCheck, Video } from "lucide-react";
import PublicNavigationRail from "@/components/navigation/PublicNavigationRail";
import FacilityLocationPicker from "./FacilityLocationPicker";
import type { PickedLocation } from "./FacilityLocationPicker";
import { api } from "@/lib/api-client";
import { validatePassword } from "@/lib/validation/password";
import OfficeImagePicker, { type OfficeImage } from "./OfficeImagePicker";
import OfficialDocumentPicker, { type OfficialDocument } from "./OfficialDocumentPicker";

const capabilities = [{ value: "Egocentric video", icon: Video, detail: "First-person capture" }, { value: "Exocentric video", icon: Radio, detail: "Third-person capture" }, { value: "Speech", icon: Mic, detail: "Voice and conversation" }, { value: "Images", icon: ImageIcon, detail: "Image datasets" }];
const focusCards = [{ value: "collection", title: "Data collection", detail: "Capture and collection operations" }, { value: "platform", title: "Data platform", detail: "Data products and infrastructure" }, { value: "embodied", title: "Embodied AI", detail: "Robotics and real-world AI" }];
const initialValues = { name: "", email: "", password: "", confirmation: "", businessName: "", description: "", websiteUrl: "", mapsUrl: "", physicalAddress: "", city: "", country: "", longitude: "", latitude: "", focus: "collection", modalities: [] as string[] };
const steps = ["Company profile & evidence", "Data capabilities", "Company location", "Account setup"];
type UploadedAsset = { url: string; name: string; contentType: string; file?: File };
type FieldKey = keyof typeof initialValues | "documents" | "location";
type FieldErrors = Partial<Record<FieldKey, string>>;
const validHttpsUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch { return false; }
};
const validGoogleMapsUrl = (value: string) => {
  if (!validHttpsUrl(value)) return false;
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (host === "maps.app.goo.gl" || host === "goo.gl") return true;
  const googleHost = host === "google.com" || host === "www.google.com" || host === "maps.google.com" || /^(?:www\.|maps\.)google\.(?:[a-z]{2,3}|com\.[a-z]{2}|co\.[a-z]{2})$/.test(host);
  return googleHost && url.pathname.startsWith("/maps");
};

async function persistAssets(kind: "office" | "document", assets: UploadedAsset[], documentType = "") {
  if (!assets.length) return;
  const body = new FormData(); body.set("kind", kind); if (documentType) body.set("documentType", documentType);
  assets.forEach((asset) => { if (asset.file) body.append("files", asset.file); });
  const response = await fetch("/api/company-assets", { method: "POST", body });
  const data = await response.json() as { error?: string };
  if (!response.ok) throw new Error(data.error || "Your account was created, but the evidence upload could not finish.");
}

export default function DataCompanySignupForm() {
  const [step, setStep] = useState(0); const [profileStage, setProfileStage] = useState<0 | 1>(0); const [values, setValues] = useState(initialValues);
  const [officeImages, setOfficeImages] = useState<OfficeImage[]>([]); const [documents, setDocuments] = useState<OfficialDocument[]>([]);
  const [showPasswords, setShowPasswords] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [attempted, setAttempted] = useState(false); const [serverFieldError, setServerFieldError] = useState<{ field: "email" | "password"; message: string } | null>(null);
  const router = useRouter();
  const update = (field: keyof typeof initialValues, value: string | string[]) => { setValues((current) => ({ ...current, [field]: value })); if (serverFieldError?.field === field) { setServerFieldError(null); setError(""); } };
  const toggleModality = (value: string) => update("modalities", values.modalities.includes(value) ? values.modalities.filter((item) => item !== value) : [...values.modalities, value]);
  const applyLocation = (location: PickedLocation) => setValues((current) => ({ ...current, longitude: String(location.longitude), latitude: String(location.latitude), mapsUrl: location.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`, physicalAddress: location.label || current.physicalAddress, city: location.city || current.city, country: location.country || current.country }));
  const validateStep = (): FieldErrors => {
    const issues: FieldErrors = {};
    if (step === 0 && profileStage === 0) {
      if (values.businessName.trim().length < 2) issues.businessName = "Enter a company name with at least 2 characters.";
      if (values.description.trim().length < 20) issues.description = "Describe your company in at least 20 characters.";
    }
    if (step === 0 && profileStage === 1 && documents.some((document) => document.type.trim().length < 2)) issues.documents = "Name the type of each selected document.";
    if (step === 1 && !values.modalities.length) issues.modalities = "Select at least one data capability.";
    if (step === 2) {
      if (!validHttpsUrl(values.websiteUrl.trim())) issues.websiteUrl = "Enter a valid company website URL beginning with https://.";
      if (!validGoogleMapsUrl(values.mapsUrl.trim())) issues.mapsUrl = "Select a location on the map or paste a valid Google Maps URL.";
      if (values.physicalAddress.trim().length < 5) issues.physicalAddress = "Enter the full physical address.";
      if (values.city.trim().length < 2) issues.city = "Enter the city.";
      if (values.country.trim().length < 2) issues.country = "Enter the country.";
      if (!values.longitude || !values.latitude || Math.abs(Number(values.longitude)) > 180 || Math.abs(Number(values.latitude)) > 90) issues.location = "Search for a location or place the pin on the map.";
    }
    if (step === 3) {
      if (values.name.trim().length < 2) issues.name = "Enter your full name.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) issues.email = "Enter a valid business email address.";
      else if (/@(gmail|yahoo|hotmail|outlook|icloud|aol|protonmail|proton)\./i.test(values.email.trim())) issues.email = "Use your company email address, not a personal email.";
      const passwordIssue = validatePassword(values.password, values.email);
      if (passwordIssue) issues.password = passwordIssue;
      if (!values.confirmation || values.password !== values.confirmation) issues.confirmation = "Confirm the same password.";
    }
    return issues;
  };
  const fieldErrors: FieldErrors = attempted ? validateStep() : serverFieldError ? { [serverFieldError.field]: serverFieldError.message } : {};
  const fieldError = (field: FieldKey) => fieldErrors[field];
  const focusFirstError = () => window.setTimeout(() => {
    const input = document.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (input) {
      input.focus();
      if (window.innerWidth <= 760) input.scrollIntoView({ block: "center" });
    }
    else document.querySelector<HTMLElement>(".company-wizard-alert")?.scrollIntoView({ block: "center" });
  }, 0);
  const passwordScore = [values.password.length >= 12, /[a-z]/.test(values.password), /[A-Z]/.test(values.password), /\d/.test(values.password), /[^A-Za-z0-9]/.test(values.password)].filter(Boolean).length;
  const next = () => { if (Object.keys(validateStep()).length) { setAttempted(true); setError(""); focusFirstError(); return; } setAttempted(false); setServerFieldError(null); setError(""); if (step === 0 && profileStage === 0) { setProfileStage(1); return; } setStep((current) => Math.min(current + 1, 3)); };
  const back = () => { setAttempted(false); setServerFieldError(null); setError(""); if (step === 0 && profileStage === 1) setProfileStage(0); else setStep((current) => Math.max(current - 1, 0)); };
  const submit = async () => { if (Object.keys(validateStep()).length) { setAttempted(true); setError(""); focusFirstError(); return; } setAttempted(false); setServerFieldError(null); setBusy(true); setError(""); try { await api("/api/auth/signup", { method: "POST", body: JSON.stringify({ ...values, role: "supplier", companyApplication: true }) }); await persistAssets("office", officeImages); for (const document of documents) await persistAssets("document", [document], document.type.trim()); router.push("/verify-email"); router.refresh(); } catch (reason) { const message = reason instanceof Error ? reason.message : "Unable to submit your company application."; setError(message); if (/another work email|business email address/i.test(message)) setServerFieldError({ field: "email", message }); else if (/password/i.test(message)) setServerFieldError({ field: "password", message }); window.setTimeout(() => document.querySelector<HTMLElement>(".company-wizard-alert")?.scrollIntoView({ block: "center" }), 0); } finally { setBusy(false); } };
  const titles = [profileStage === 0 ? "Tell us about your company" : "Add office images and official documents", "What data can you provide?", "Where is your company located?", "Create your secure account"];
  const descriptions = [profileStage === 0 ? "Start with the public-facing details buyers and reviewers should understand." : "Help us validate your company with office images and official company documents. These are only visible to reviewers.", "Choose each capability your company can supply today.", "Search an address, paste a Google Maps location, or place the pin exactly where your company is based.", "Use a business email to receive your verification link and review updates."];
  return <main className="sourcing-app company-signup-page"><PublicNavigationRail active="supplier-signup"/><section className="company-wizard company-wizard-full" aria-labelledby="company-wizard-title"><header className="company-wizard-banner"><span className="company-wizard-mark"><MapPinned/></span><div><p>MAP.FILEMARKET</p><h1 id="company-wizard-title">Register your data company.</h1></div><span>Application · 4 steps</span></header><form className="company-wizard-form" noValidate onSubmit={(event) => { event.preventDefault(); if (step === 3) void submit(); else next(); }}><header><span>STEP {step + 1} OF 4{step === 0 ? ` · ${profileStage + 1} OF 2` : ""}</span><h2>{titles[step]}</h2><p>{descriptions[step]}</p></header><div className="company-wizard-content">
    {(error || (attempted && Object.keys(fieldErrors).length > 0)) && <div className="company-wizard-alert" role="alert"><AlertTriangle size={19}/><span><strong>{error ? "Something needs attention" : "Check the highlighted fields"}</strong><small>{error || "Correct each highlighted field to continue."}</small></span></div>}
    {step === 0 && profileStage === 0 && <div className="company-wizard-fields">
      <label className={`wizard-input-card ${fieldError("businessName") ? "has-error" : ""}`}><span>Company name</span><input value={values.businessName} onChange={(event) => update("businessName", event.target.value)} autoComplete="organization" placeholder="Your company name" aria-invalid={Boolean(fieldError("businessName"))} aria-describedby={fieldError("businessName") ? "businessName-error" : undefined} autoFocus/>{fieldError("businessName") && <small id="businessName-error" className="wizard-field-error">{fieldError("businessName")}</small>}</label>
      <label className={`wizard-input-card ${fieldError("description") ? "has-error" : ""}`}><span>Company profile</span><textarea value={values.description} onChange={(event) => update("description", event.target.value)} placeholder="What data do you provide, and how is it collected?" aria-invalid={Boolean(fieldError("description"))} aria-describedby={fieldError("description") ? "description-error" : undefined}/>{fieldError("description") && <small id="description-error" className="wizard-field-error">{fieldError("description")}</small>}</label>
      <div><span className="wizard-section-label">Primary focus</span><div className="wizard-choice-grid">{focusCards.map((card) => <button type="button" key={card.value} className={values.focus === card.value ? "selected" : ""} onClick={() => update("focus", card.value)}><Building2/><strong>{card.title}</strong><small>{card.detail}</small>{values.focus === card.value && <Check/>}</button>)}</div></div>
    </div>}
{step === 0 && profileStage === 1 && <div className="company-wizard-fields company-evidence-fields"><OfficeImagePicker images={officeImages} onChange={setOfficeImages} onError={setError}/><OfficialDocumentPicker documents={documents} onChange={setDocuments} onError={setError} showTypeErrors={attempted}/>{fieldError("documents") && <p className="wizard-section-error">{fieldError("documents")}</p>}</div>}
    {step === 1 && <div><span className="wizard-section-label">Select all that apply</span><div className={`wizard-capability-grid ${fieldError("modalities") ? "has-error" : ""}`}>{capabilities.map(({ value, icon: Icon, detail }) => <button type="button" key={value} className={values.modalities.includes(value) ? "selected" : ""} onClick={() => toggleModality(value)}><Icon/><span><strong>{value}</strong><small>{detail}</small></span>{values.modalities.includes(value) && <i><Check/></i>}</button>)}</div>{fieldError("modalities") && <p className="wizard-section-error">{fieldError("modalities")}</p>}</div>}
    {step === 2 && <div className="company-wizard-fields">
      <label className={`wizard-input-card ${fieldError("websiteUrl") ? "has-error" : ""}`}><span>Company website</span><input type="url" value={values.websiteUrl} onChange={(event) => update("websiteUrl", event.target.value)} placeholder="https://company.com" aria-invalid={Boolean(fieldError("websiteUrl"))} aria-describedby={fieldError("websiteUrl") ? "websiteUrl-error" : undefined}/>{fieldError("websiteUrl") && <small id="websiteUrl-error" className="wizard-field-error">{fieldError("websiteUrl")}</small>}</label>
      <div className={`wizard-location-picker ${fieldError("location") ? "has-error" : ""}`}><span className="wizard-section-label">Find or pinpoint your company</span><FacilityLocationPicker longitude={values.longitude} latitude={values.latitude} onChange={applyLocation}/>{fieldError("location") && <p className="wizard-section-error">{fieldError("location")}</p>}</div>
      <div className="wizard-field-grid">
        <label className={`wizard-input-card ${fieldError("physicalAddress") ? "has-error" : ""}`}><span>Physical address</span><input value={values.physicalAddress} onChange={(event) => update("physicalAddress", event.target.value)} placeholder="Street address" aria-invalid={Boolean(fieldError("physicalAddress"))} aria-describedby={fieldError("physicalAddress") ? "physicalAddress-error" : undefined}/>{fieldError("physicalAddress") && <small id="physicalAddress-error" className="wizard-field-error">{fieldError("physicalAddress")}</small>}</label>
        <label className={`wizard-input-card ${fieldError("mapsUrl") ? "has-error" : ""}`}><span>Google Maps location</span><input type="url" value={values.mapsUrl} onChange={(event) => update("mapsUrl", event.target.value)} placeholder="Added when you search or pin a location" aria-invalid={Boolean(fieldError("mapsUrl"))} aria-describedby={fieldError("mapsUrl") ? "mapsUrl-error" : undefined}/>{fieldError("mapsUrl") && <small id="mapsUrl-error" className="wizard-field-error">{fieldError("mapsUrl")}</small>}</label>
      </div>
      <div className="wizard-field-grid">
        {(["city", "country"] as const).map((field) => <label className={`wizard-input-card ${fieldError(field) ? "has-error" : ""}`} key={field}><span>{field === "city" ? "City" : "Country"}</span><input value={values[field]} onChange={(event) => update(field, event.target.value)} placeholder={field === "city" ? "Kathmandu" : "Nepal"} aria-invalid={Boolean(fieldError(field))} aria-describedby={fieldError(field) ? `${field}-error` : undefined}/>{fieldError(field) && <small id={`${field}-error`} className="wizard-field-error">{fieldError(field)}</small>}</label>)}
        {(["longitude", "latitude"] as const).map((field) => <label className="wizard-input-card" key={field}><span>{field === "longitude" ? "Longitude" : "Latitude"}</span><input readOnly value={values[field]} placeholder={field === "longitude" ? "85.3240" : "27.7172"}/></label>)}
      </div>
      <p className="wizard-location-note"><MapPinned/> We use the exact pin only to verify your company location before it appears on the map.</p>
    </div>}
    {step === 3 && <div className="company-wizard-fields">
      <div className="wizard-field-grid">{([["name", "Your name", "Alex Morgan", "text"], ["email", "Business email", "you@company.com", "email"], ["password", "Password", "12+ characters", "password"], ["confirmation", "Confirm password", "Type it again", "password"]] as const).map(([field, label, placeholder, type]) => <label className={`wizard-input-card ${fieldError(field) ? "has-error" : ""}`} key={field}><span>{label}</span><div className="wizard-password-input"><input type={type === "password" && showPasswords ? "text" : type} value={values[field]} onChange={(event) => update(field, event.target.value)} autoComplete={field === "email" ? "email" : field === "name" ? "name" : "new-password"} placeholder={placeholder} aria-invalid={Boolean(fieldError(field))} aria-describedby={fieldError(field) ? `${field}-error` : undefined} autoFocus={field === "name"}/>{type === "password" && <button type="button" aria-label={showPasswords ? "Hide password" : "Show password"} onClick={() => setShowPasswords((current) => !current)}>{showPasswords ? <EyeOff/> : <Eye/>}</button>}</div>{fieldError(field) && <small id={`${field}-error`} className="wizard-field-error">{fieldError(field)}</small>}</label>)}</div>
      <div className="wizard-password-strength" aria-live="polite"><span><b>Password strength</b><small>{values.password ? (passwordScore < 3 ? "Needs strengthening" : passwordScore < 5 ? "Good password" : "Strong password") : "Use 12+ characters with a mix of letters, numbers, and symbols."}</small></span><div>{[1, 2, 3, 4, 5].map((level) => <i key={level} className={level <= passwordScore ? `active score-${passwordScore}` : ""}/>)}</div></div>
      <div className="wizard-trust-card"><ShieldCheck/><span><strong>What happens next</strong><small>We email a verification link, then your company application is marked pending for review.</small></span></div>
    </div>}
  </div><footer><div className="company-wizard-progress" aria-label={`Step ${step + 1} of 4`}><span>Application progress</span><div>{steps.map((label, index) => <i key={label} className={index <= step ? "active" : ""} title={label}/>)}</div><small>{steps[step]}{step === 0 ? ` · ${profileStage + 1} of 2` : ""}</small></div><div className="company-wizard-actions">{(step > 0 || profileStage > 0) && <button type="button" className="wizard-back" onClick={back}><ArrowLeft/>Back</button>}<button type="submit" className="wizard-next" disabled={busy}>{busy ? <LoaderCircle className="spin"/> : step === 3 ? <><ShieldCheck/>Submit application</> : <>Continue<ArrowRight/></>}</button></div></footer><p className="company-wizard-login">Already registered? <Link href="/login">Log in</Link></p></form></section>
  </main>;
}
