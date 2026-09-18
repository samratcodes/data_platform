"use client";

import type { ReactNode } from "react";
import { Building2, Check, Image as ImageIcon, MapPinned, Mic, Radio, Video } from "lucide-react";
import FacilityLocationPicker, { type PickedLocation } from "./FacilityLocationPicker";
import CompanyLogoPicker, { type CompanyLogo } from "./CompanyLogoPicker";
import OfficeImagePicker, { type OfficeImage } from "./OfficeImagePicker";
import OfficialDocumentPicker, { type OfficialDocument } from "./OfficialDocumentPicker";

/**
 * Company profile steps shared by data-company signup and the supplier profile editor,
 * so both surfaces collect and present the company profile identically.
 */

export const companyCapabilities = [{ value: "Egocentric video", icon: Video, detail: "First-person capture" }, { value: "Exocentric video", icon: Radio, detail: "Third-person capture" }, { value: "Speech", icon: Mic, detail: "Voice and conversation" }, { value: "Images", icon: ImageIcon, detail: "Image datasets" }];
export const companyFocusCards = [{ value: "collection", title: "Data collection", detail: "Capture and collection operations" }, { value: "platform", title: "Data platform", detail: "Data products and infrastructure" }, { value: "embodied", title: "Embodied AI", detail: "Robotics and real-world AI" }];
export const emptyCompanyProfile = { businessName: "", description: "", websiteUrl: "", mapsUrl: "", physicalAddress: "", city: "", country: "", longitude: "", latitude: "", focus: "collection", modalities: [] as string[], photos: [] as string[] };

export type CompanyProfileValues = typeof emptyCompanyProfile;
export type CompanyEvidence = { logo: CompanyLogo | null; officeImages: OfficeImage[]; documents: OfficialDocument[] };
export type CompanyFieldKey = Exclude<keyof CompanyProfileValues, "photos"> | "logo" | "documents" | "location";
export type CompanyFieldErrors = Partial<Record<CompanyFieldKey, string>>;

export const companyStepTitles = (profileStage: 0 | 1) => [profileStage === 0 ? "Tell us about your company" : "Add your logo, office images, and official documents", "What data can you provide?", "Where is your company located?"];
export const companyStepDescriptions = (profileStage: 0 | 1) => [profileStage === 0 ? "Start with the public-facing details buyers and reviewers should understand." : "Your logo is required and appears on your map pin and public profile after approval. Office images and official documents help us validate your company and are only visible to reviewers.", "Choose each capability your company can supply today.", "Search an address, paste a Google Maps location, or place the pin exactly where your company is based."];

export const validHttpsUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch { return false; }
};
export const validGoogleMapsUrl = (value: string) => {
  if (!validHttpsUrl(value)) return false;
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (host === "maps.app.goo.gl" || host === "goo.gl") return true;
  const googleHost = host === "google.com" || host === "www.google.com" || host === "maps.google.com" || /^(?:www\.|maps\.)google\.(?:[a-z]{2,3}|com\.[a-z]{2}|co\.[a-z]{2})$/.test(host);
  return googleHost && url.pathname.startsWith("/maps");
};

/** `hasLogo` counts a newly picked logo or one already saved for the company. */
export function validateCompanyStep(step: number, profileStage: 0 | 1, values: CompanyProfileValues, documents: OfficialDocument[], hasLogo: boolean): CompanyFieldErrors {
  const issues: CompanyFieldErrors = {};
  if (step === 0 && profileStage === 0) {
    if (values.businessName.trim().length < 2) issues.businessName = "Enter a company name with at least 2 characters.";
    if (values.description.trim().length < 20) issues.description = "Describe your company in at least 20 characters.";
  }
  if (step === 0 && profileStage === 1 && !hasLogo) issues.logo = "Upload your company logo. It is shown on the map and your public profile.";
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
  return issues;
}

type LocationFields = { longitude: string; latitude: string; mapsUrl: string; physicalAddress: string; city: string; country: string; photos: string[] };

/** Applies a picked map location to any form that stores the shared location fields. */
export function mergeCompanyLocation<T extends LocationFields>(current: T, location: PickedLocation): T {
  return { ...current, longitude: String(location.longitude), latitude: String(location.latitude), mapsUrl: location.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`, physicalAddress: location.label || current.physicalAddress, city: location.city || current.city, country: location.country || current.country, photos: location.photos || (location.label ? [] : current.photos) };
}

/**
 * Uploads new logo, images, and documents for the signed-in supplier's company application,
 * or for one of their facilities when `applicationId` is given.
 */
export async function uploadCompanyEvidence({ logo, officeImages, documents }: CompanyEvidence, applicationId?: string) {
  const send = async (kind: "logo" | "office" | "document", files: File[], documentType = "") => {
    if (!files.length) return;
    const body = new FormData(); body.set("kind", kind); if (applicationId) body.set("applicationId", applicationId); if (documentType) body.set("documentType", documentType);
    files.forEach((file) => body.append("files", file));
    const response = await fetch("/api/company-assets", { method: "POST", body });
    const data = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(data.error || "The company evidence upload could not finish.");
  };
  if (logo?.file) await send("logo", [logo.file]);
  await send("office", officeImages.flatMap((image) => image.file ? [image.file] : []));
  for (const document of documents) if (document.file) await send("document", [document.file], document.type.trim());
}

export default function CompanyProfileStep({ step, profileStage, values, onChange, onLocation, evidence, onEvidence, fieldErrors, showTypeErrors, onError, savedMedia }: {
  step: number;
  profileStage: 0 | 1;
  values: CompanyProfileValues;
  onChange: (field: Exclude<keyof CompanyProfileValues, "photos">, value: string | string[]) => void;
  onLocation: (location: PickedLocation) => void;
  evidence: CompanyEvidence;
  onEvidence: (evidence: CompanyEvidence) => void;
  fieldErrors: CompanyFieldErrors;
  showTypeErrors: boolean;
  onError: (message: string) => void;
  /** Replaces the local logo and image pickers once the company already has saved media. */
  savedMedia?: ReactNode;
}) {
  const fieldError = (field: CompanyFieldKey) => fieldErrors[field];
  const toggleModality = (value: string) => onChange("modalities", values.modalities.includes(value) ? values.modalities.filter((item) => item !== value) : [...values.modalities, value]);
  const errorProps = (field: CompanyFieldKey) => ({ "aria-invalid": Boolean(fieldError(field)), "aria-describedby": fieldError(field) ? `${field}-error` : undefined });
  const errorText = (field: CompanyFieldKey) => fieldError(field) && <small id={`${field}-error`} className="wizard-field-error">{fieldError(field)}</small>;

  if (step === 0 && profileStage === 0) return <div className="company-wizard-fields">
    <label className={`wizard-input-card ${fieldError("businessName") ? "has-error" : ""}`}><span>Company name</span><input value={values.businessName} onChange={(event) => onChange("businessName", event.target.value)} autoComplete="organization" placeholder="Your company name" {...errorProps("businessName")} autoFocus/>{errorText("businessName")}</label>
    <label className={`wizard-input-card ${fieldError("description") ? "has-error" : ""}`}><span>Company profile</span><textarea value={values.description} onChange={(event) => onChange("description", event.target.value)} placeholder="What data do you provide, and how is it collected?" {...errorProps("description")}/>{errorText("description")}</label>
    <div><span className="wizard-section-label">Primary focus</span><div className="wizard-choice-grid">{companyFocusCards.map((card) => <button type="button" key={card.value} className={values.focus === card.value ? "selected" : ""} onClick={() => onChange("focus", card.value)}><Building2/><strong>{card.title}</strong><small>{card.detail}</small>{values.focus === card.value && <Check/>}</button>)}</div></div>
  </div>;

  if (step === 0) return <div className="company-wizard-fields company-evidence-fields">
    {savedMedia ?? <>
      <CompanyLogoPicker logo={evidence.logo} onChange={(logo) => onEvidence({ ...evidence, logo })} onError={onError} error={fieldError("logo")}/>
      <OfficeImagePicker images={evidence.officeImages} onChange={(officeImages) => onEvidence({ ...evidence, officeImages })} onError={onError}/>
    </>}
    {savedMedia && fieldError("logo") && <p id="logo-error" className="wizard-section-error" role="alert">{fieldError("logo")}</p>}
    <OfficialDocumentPicker documents={evidence.documents} onChange={(documents) => onEvidence({ ...evidence, documents })} onError={onError} showTypeErrors={showTypeErrors}/>
    {fieldError("documents") && <p className="wizard-section-error">{fieldError("documents")}</p>}
  </div>;

  if (step === 1) return <div><span className="wizard-section-label">Select all that apply</span><div className={`wizard-capability-grid ${fieldError("modalities") ? "has-error" : ""}`}>{companyCapabilities.map(({ value, icon: Icon, detail }) => <button type="button" key={value} className={values.modalities.includes(value) ? "selected" : ""} onClick={() => toggleModality(value)}><Icon/><span><strong>{value}</strong><small>{detail}</small></span>{values.modalities.includes(value) && <i><Check/></i>}</button>)}</div>{fieldError("modalities") && <p className="wizard-section-error">{fieldError("modalities")}</p>}</div>;

  return <div className="company-wizard-fields">
    <label className={`wizard-input-card ${fieldError("websiteUrl") ? "has-error" : ""}`}><span>Company website</span><input type="url" value={values.websiteUrl} onChange={(event) => onChange("websiteUrl", event.target.value)} placeholder="https://company.com" {...errorProps("websiteUrl")}/>{errorText("websiteUrl")}</label>
    <div className={`wizard-location-picker ${fieldError("location") ? "has-error" : ""}`}><span className="wizard-section-label">Find or pinpoint your company</span><FacilityLocationPicker longitude={values.longitude} latitude={values.latitude} onChange={onLocation}/>{fieldError("location") && <p className="wizard-section-error">{fieldError("location")}</p>}</div>
    <div className="wizard-field-grid">
      <label className={`wizard-input-card ${fieldError("physicalAddress") ? "has-error" : ""}`}><span>Physical address</span><input value={values.physicalAddress} onChange={(event) => onChange("physicalAddress", event.target.value)} placeholder="Street address" {...errorProps("physicalAddress")}/>{errorText("physicalAddress")}</label>
      <label className={`wizard-input-card ${fieldError("mapsUrl") ? "has-error" : ""}`}><span>Google Maps location</span><input type="url" value={values.mapsUrl} onChange={(event) => onChange("mapsUrl", event.target.value)} placeholder="Added when you search or pin a location" {...errorProps("mapsUrl")}/>{errorText("mapsUrl")}</label>
    </div>
    <div className="wizard-field-grid">
      {(["city", "country"] as const).map((field) => <label className={`wizard-input-card ${fieldError(field) ? "has-error" : ""}`} key={field}><span>{field === "city" ? "City" : "Country"}</span><input value={values[field]} onChange={(event) => onChange(field, event.target.value)} placeholder={field === "city" ? "Kathmandu" : "Nepal"} {...errorProps(field)}/>{errorText(field)}</label>)}
      {(["longitude", "latitude"] as const).map((field) => <label className="wizard-input-card" key={field}><span>{field === "longitude" ? "Longitude" : "Latitude"}</span><input readOnly value={values[field]} placeholder={field === "longitude" ? "85.3240" : "27.7172"}/></label>)}
    </div>
    <p className="wizard-location-note"><MapPinned/> We use the exact pin only to verify your company location before it appears on the map.</p>
  </div>;
}
