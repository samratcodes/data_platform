"use client";

import { useState, type ReactNode } from "react";
import { ImagePlus, Info, LoaderCircle, MapPin, Pencil, Save, X } from "lucide-react";
import ProviderMediaManager from "@/components/media/ProviderMediaManager";
import FacilityLocationPicker from "@/components/onboarding/FacilityLocationPicker";
import { companyCapabilities, companyFocusCards, mergeCompanyLocation } from "@/components/onboarding/CompanyProfileSteps";
import { api } from "@/lib/api-client";
import { emptyFacilityDetails, factoryAreas, factoryCategories, factoryTasks, parseFacilityDetails, recordingConsentOptions, type FacilityDetails } from "@/lib/facility";
import type { ApplicationDetail } from "@/types/admin";

type Values = {
  businessName: string; description: string; modalities: string[]; focus: string;
  websiteUrl: string; linkedinUrl: string; twitterUrl: string; huggingFaceUrl: string;
  mapsUrl: string; physicalAddress: string; city: string; country: string; longitude: string; latitude: string; photos: string[];
  facility: FacilityDetails; captureEnvironments: string[];
};

const optional = (value: number | null) => value === null ? "" : String(value);

function initialValues(application: ApplicationDetail): Values {
  return {
    businessName: application.business_name, description: application.profile_description, modalities: application.modalities, focus: application.company_focus || "collection",
    websiteUrl: application.website_url || "", linkedinUrl: application.linkedin_url || "", twitterUrl: application.twitter_url || "", huggingFaceUrl: application.huggingface_url || "",
    mapsUrl: application.maps_url || "", physicalAddress: application.physical_address || "", city: application.city || "", country: application.country || "",
    longitude: optional(application.longitude), latitude: optional(application.latitude), photos: application.hardware_pictures,
    facility: parseFacilityDetails(application.facility_details) ?? emptyFacilityDetails, captureEnvironments: application.capture_environments,
  };
}

function Group({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="review-section admin-edit-group"><header><h2>{icon}{title}</h2></header>{children}</section>;
}

const toggle = (list: string[], item: string) => list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];

/**
 * Lets an administrator correct a company or facility in place: details, location, logo and images.
 * Edits keep the current review decision, and an approved listing updates on the map right away.
 */
export default function ApplicationEditor({ application, onClose, onSaved }: { application: ApplicationDetail; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [values, setValues] = useState(() => initialValues(application));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mediaNotice, setMediaNotice] = useState("");
  const isCompany = application.application_kind === "company";
  const set = <K extends keyof Values>(field: K, value: Values[K]) => setValues((current) => ({ ...current, [field]: value }));
  const setFacility = <K extends keyof FacilityDetails>(field: K, value: FacilityDetails[K]) => setValues((current) => ({ ...current, facility: { ...current.facility, [field]: value } }));
  const workers = (field: "totalWorkers" | "seatedWorkers" | "mobileWorkers") => <input type="number" min={0} step={1} value={Number.isFinite(values.facility[field]) ? values.facility[field] : ""} onChange={(event) => setFacility(field, event.target.value === "" ? NaN : Number(event.target.value))}/>;

  const save = async () => {
    setBusy(true); setError("");
    try {
      await api(`/api/admin/applications/${application.id}/profile`, { method: "PATCH", body: JSON.stringify({ ...values, photos: undefined }) });
      await onSaved(application.status === "approved" ? "Changes saved. The live listing on the map was updated." : "Changes saved.");
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  };

  return <form className="admin-edit" noValidate onSubmit={(event) => { event.preventDefault(); void save(); }}>
    <div className="admin-edit-banner" role="note"><Info size={16}/><span>You are editing this {isCompany ? "data company" : "facility"} as an admin. Changes keep its current status{application.status === "approved" ? " and go live on the map immediately" : ""}; the supplier is not asked to resubmit.</span></div>

    <Group title="Details" icon={<Pencil size={17}/>}>
      <div className="admin-edit-grid">
        <label className="wizard-input-card admin-edit-wide"><span>{isCompany ? "Company name" : "Facility name"}</span><input value={values.businessName} maxLength={120} onChange={(event) => set("businessName", event.target.value)}/></label>
        <label className="wizard-input-card admin-edit-wide"><span>Description</span><textarea value={values.description} maxLength={3000} rows={5} onChange={(event) => set("description", event.target.value)}/></label>
      </div>
      <span className="wizard-section-label">Data capabilities</span>
      <div className="admin-edit-chips">{companyCapabilities.map((item) => <label key={item.value} className={values.modalities.includes(item.value) ? "selected" : ""}><input type="checkbox" checked={values.modalities.includes(item.value)} onChange={() => set("modalities", toggle(values.modalities, item.value))}/>{item.value}</label>)}</div>
      {isCompany && <>
        <span className="wizard-section-label">Primary focus</span>
        <div className="admin-edit-chips">{companyFocusCards.map((card) => <label key={card.value} className={values.focus === card.value ? "selected" : ""}><input type="radio" name="focus" checked={values.focus === card.value} onChange={() => set("focus", card.value)}/>{card.title}</label>)}</div>
      </>}
      <div className="admin-edit-grid">
        {([["websiteUrl", isCompany ? "Website" : "Website (optional)"], ["linkedinUrl", "LinkedIn (optional)"], ["twitterUrl", "X / Twitter (optional)"], ["huggingFaceUrl", "Hugging Face (optional)"]] as const).map(([field, label]) =>
          <label className="wizard-input-card" key={field}><span>{label}</span><input type="url" maxLength={2048} value={values[field]} placeholder="https://…" onChange={(event) => set(field, event.target.value)}/></label>)}
      </div>
    </Group>

    {!isCompany && <Group title="Facility and workforce" icon={<Pencil size={17}/>}>
      <div className="admin-edit-grid">
        <label className="wizard-input-card"><span>Category</span><select value={values.facility.category} onChange={(event) => setFacility("category", event.target.value as FacilityDetails["category"])}>{factoryCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        {values.facility.category === "other" ? <label className="wizard-input-card"><span>Describe the facility type</span><input value={values.facility.categoryOther} maxLength={80} onChange={(event) => setFacility("categoryOther", event.target.value)}/></label> : <span/>}
        <label className="wizard-input-card"><span>Total workers</span>{workers("totalWorkers")}</label>
        <label className="wizard-input-card"><span>Shifts per day</span><select value={values.facility.shiftsPerDay} onChange={(event) => setFacility("shiftsPerDay", Number(event.target.value))}>{[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
        <label className="wizard-input-card"><span>Seated, hand-movement tasks</span>{workers("seatedWorkers")}</label>
        <label className="wizard-input-card"><span>Tasks with movement</span>{workers("mobileWorkers")}</label>
        <label className="wizard-input-card admin-edit-wide"><span>Recording consent</span><select value={values.facility.recordingConsent} onChange={(event) => setFacility("recordingConsent", event.target.value as FacilityDetails["recordingConsent"])}>{recordingConsentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </div>
      <span className="wizard-section-label">Typical tasks</span>
      <div className="admin-edit-chips">{factoryTasks.map((task) => <label key={task} className={values.facility.tasks.includes(task) ? "selected" : ""}><input type="checkbox" checked={values.facility.tasks.includes(task)} onChange={() => setFacility("tasks", toggle(values.facility.tasks, task))}/>{task}</label>)}</div>
      <span className="wizard-section-label">Facility areas</span>
      <div className="admin-edit-chips">{[...new Set([...factoryAreas, ...values.captureEnvironments])].map((area) => <label key={area} className={values.captureEnvironments.includes(area) ? "selected" : ""}><input type="checkbox" checked={values.captureEnvironments.includes(area)} onChange={() => set("captureEnvironments", toggle(values.captureEnvironments, area))}/>{area}</label>)}</div>
    </Group>}

    <Group title={isCompany ? "Legal address and location" : "Location"} icon={<MapPin size={17}/>}>
      <div className="wizard-location-picker"><FacilityLocationPicker longitude={values.longitude} latitude={values.latitude} onChange={(location) => setValues((current) => mergeCompanyLocation(current, location))}/></div>
      <div className="admin-edit-grid">
        <label className="wizard-input-card admin-edit-wide"><span>Google Maps link</span><input type="url" value={values.mapsUrl} onChange={(event) => set("mapsUrl", event.target.value)}/></label>
        <label className="wizard-input-card admin-edit-wide"><span>{isCompany ? "Legal address" : "Address"}</span><input value={values.physicalAddress} maxLength={240} onChange={(event) => set("physicalAddress", event.target.value)}/></label>
        <label className="wizard-input-card"><span>City</span><input value={values.city} maxLength={100} onChange={(event) => set("city", event.target.value)}/></label>
        <label className="wizard-input-card"><span>Country</span><input value={values.country} maxLength={100} onChange={(event) => set("country", event.target.value)}/></label>
        <label className="wizard-input-card"><span>Latitude</span><input inputMode="decimal" value={values.latitude} onChange={(event) => set("latitude", event.target.value)}/></label>
        <label className="wizard-input-card"><span>Longitude</span><input inputMode="decimal" value={values.longitude} onChange={(event) => set("longitude", event.target.value)}/></label>
      </div>
    </Group>

    <Group title="Logo and images" icon={<ImagePlus size={17}/>}>
      {mediaNotice && <p className="settings-message settings-success" role="status">{mediaNotice}</p>}
      <ProviderMediaManager adminEdit applicationId={application.id}
        title={isCompany ? "Logo and office images" : "Profile photo and site photos"}
        description="Image changes save immediately, separately from the details above."
        showLogo logo={application.company_logo} images={application.office_images} linkedPhotos={application.hardware_pictures} cover={application.cover_image}
        {...(isCompany ? {} : { logoRequired: false, logoLabel: "Facility profile photo", logoNoun: "profile photo", logoPhoto: true })}
        onChanged={async (message) => { setMediaNotice(message); await onSaved(""); }}/>
    </Group>

    <div className="admin-edit-footer">
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="button" className="secondary-button" onClick={onClose} disabled={busy}><X size={15}/>Close editor</button>
      <button type="submit" className="button-approve" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16}/> : <Save size={16}/>}Save changes</button>
    </div>
  </form>;
}
