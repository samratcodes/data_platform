"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Building2, CheckCircle2, Clock3, FileUp, LoaderCircle, LockKeyhole, MapPinned, Send, ShieldCheck } from "lucide-react";
import BuyerNavigationRail from "./BuyerNavigationRail";
import FacilityLocationPicker, { type PickedLocation } from "./FacilityLocationPicker";
import { api, type User } from "./model";

type Application = {
  id: string;
  application_kind: "company" | "facility";
  business_name: string;
  maps_url: string | null;
  physical_address: string | null;
  city: string | null;
  country: string | null;
  longitude: number | null;
  latitude: number | null;
  hardware_pictures: string[];
  linkedin_url: string | null;
  twitter_url: string | null;
  huggingface_url: string | null;
  website_url: string | null;
  modalities: string[];
  profile_description: string;
  capacity: string;
  capture_environments: string[];
  sample_file_name: string | null;
  sample_size_bytes: number | null;
  has_sample: boolean;
  status: "pending" | "approved" | "rejected";
  verification_level: string;
  admin_notes: string | null;
};

const modalityOptions = ["Egocentric video", "Exocentric video", "Speech", "Images"];
const emptyLocation = { mapsUrl: "", physicalAddress: "", city: "", country: "", longitude: "", latitude: "", photos: [] as string[] };

function mergePickedLocation(current: typeof emptyLocation, point: PickedLocation) {
  const coordinateUrl = `https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`;
  const choseSearchResult = Boolean(point.label);
  return {
    ...current,
    longitude: String(point.longitude),
    latitude: String(point.latitude),
    mapsUrl: point.mapsUrl || (choseSearchResult ? coordinateUrl : current.mapsUrl || coordinateUrl),
    physicalAddress: point.label || current.physicalAddress,
    city: point.city || current.city,
    country: point.country || current.country,
    photos: point.photos || (choseSearchResult ? [] : current.photos),
  };
}

async function encodeSample(file: File) {
  if (file.size > 1_500_000) throw new Error("The sample file must be 1.5 MB or smaller.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  return { name: file.name, type: file.type || "application/octet-stream", data: btoa(binary) };
}

function CompanyLocationFields({ company }: { company?: Application }) {
  const [location, setLocation] = useState(() => ({
    mapsUrl: company?.maps_url || "", physicalAddress: company?.physical_address || "", city: company?.city || "", country: company?.country || "",
    longitude: company?.longitude === null || company?.longitude === undefined ? "" : String(company.longitude), latitude: company?.latitude === null || company?.latitude === undefined ? "" : String(company.latitude), photos: company?.hardware_pictures || [],
  }));
  return <fieldset><legend>Company location</legend><p className="fieldset-note">Paste the company&apos;s Google Maps link to import its location, then review the pin and address. Approved companies appear at this location on the map.</p><FacilityLocationPicker longitude={location.longitude} latitude={location.latitude} onChange={(point) => setLocation((current) => mergePickedLocation(current, point))}/><input name="mapsUrl" type="hidden" value={location.mapsUrl}/><input name="physicalAddress" type="hidden" value={location.physicalAddress}/><input name="city" type="hidden" value={location.city}/><input name="country" type="hidden" value={location.country}/><input name="longitude" type="hidden" value={location.longitude}/><input name="latitude" type="hidden" value={location.latitude}/><input name="googlePhotos" type="hidden" value={JSON.stringify(location.photos)}/><label>Physical address<input required minLength={5} maxLength={240} value={location.physicalAddress} onChange={(event) => setLocation((current) => ({ ...current, physicalAddress: event.target.value }))}/></label><div className="form-grid"><label>City<input required maxLength={100} value={location.city} onChange={(event) => setLocation((current) => ({ ...current, city: event.target.value }))}/></label><label>Country<input required maxLength={100} value={location.country} onChange={(event) => setLocation((current) => ({ ...current, country: event.target.value }))}/></label><label>Longitude<input readOnly value={location.longitude}/></label><label>Latitude<input readOnly value={location.latitude}/></label></div></fieldset>;
}

export default function SupplierVerificationPortal({ user }: { user: User }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [companyBusy, setCompanyBusy] = useState(false);
  const [facilityBusy, setFacilityBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [location, setLocation] = useState(emptyLocation);

  const load = useCallback(async () => {
    const data = await api<{ applications: Application[] }>("/api/supplier/application");
    setApplications(data.applications);
    setLoaded(true);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch((reason) => { setError(reason.message); setLoaded(true); }); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const company = useMemo(() => applications.find((item) => item.application_kind === "company"), [applications]);
  const facilities = useMemo(() => applications.filter((item) => item.application_kind === "facility"), [applications]);
  const companyApproved = company?.status === "approved";

  return <main className="sourcing-app onboarding-page supplier-verification-page">
    <BuyerNavigationRail user={user} active="onboarding"/>
    <section className="onboarding-shell">
      <div className="onboarding-intro"><span>SUPPLIER VERIFICATION</span><h1>Verify the company first.</h1><p>Your data company profile is reviewed before facility submissions are unlocked. Every facility and every later edit receives its own admin review.</p><ol className="onboarding-checklist" aria-label="Supplier verification process"><li className={company ? "complete" : ""}><strong>1</strong><span>Company profile</span></li><li className={companyApproved ? "complete" : ""}><strong>2</strong><span>Admin approval</span></li><li><strong>3</strong><span>Verified facilities</span></li></ol></div>

      {(notice || error) && <p className={error ? "form-error settings-message" : "settings-message settings-success"} role="status">{error || notice}</p>}

      <section id="company-profile" className="verification-stage-card">
        <div className="verification-stage-heading"><div><span><Building2/>DATA COMPANY PROFILE</span><h2>Company verification</h2><p>This form always remains available. Changes to an approved profile are submitted for review again.</p></div>{company && <em data-status={company.status}>{company.status}</em>}</div>
        {company?.admin_notes && <div className="review-feedback"><ShieldCheck/><span><strong>Admin feedback</strong>{company.admin_notes}</span></div>}
        {!loaded ? <p className="workspace-empty">Loading company profile…</p> : <form key={company?.id || "new-company"} className="onboarding-form embedded-verification-form" onSubmit={async (event) => {
          event.preventDefault(); setCompanyBusy(true); setError(""); setNotice("");
          try {
            const data = new FormData(event.currentTarget);
            const file = data.get("sample");
            const sample = file instanceof File && file.size ? await encodeSample(file) : undefined;
            await api("/api/supplier/application", { method: "POST", body: JSON.stringify({
              kind: "company", businessName: data.get("businessName"), description: data.get("description"),
              websiteUrl: data.get("websiteUrl"), linkedinUrl: data.get("linkedinUrl"), twitterUrl: data.get("twitterUrl"), huggingFaceUrl: data.get("huggingFaceUrl"),
              mapsUrl: data.get("mapsUrl"), physicalAddress: data.get("physicalAddress"), city: data.get("city"), country: data.get("country"),
              longitude: data.get("longitude"), latitude: data.get("latitude"), hardwarePictures: JSON.parse(String(data.get("googlePhotos") || "[]")), modalities: data.getAll("modalities"), sample,
            }) });
            await load();
            setNotice(companyApproved ? "Company changes were sent for admin review. Facility submission is locked until approval." : "Company profile sent for admin review.");
          } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to submit company profile."); }
          finally { setCompanyBusy(false); }
        }}>
          <fieldset><legend>Company details</legend><p className="fieldset-note">Only data companies can complete this verification stage.</p><label>Legal or trading name<input name="businessName" required minLength={2} maxLength={120} autoComplete="organization" defaultValue={company?.business_name}/></label><label>Company profile<textarea name="description" required minLength={20} maxLength={3000} defaultValue={company?.profile_description} placeholder="Describe your company, the datasets you provide, and how the data is collected."/></label><label>Company website<input name="websiteUrl" type="url" required maxLength={2048} defaultValue={company?.website_url || ""} placeholder="https://company.com"/></label></fieldset>
          <CompanyLocationFields company={company}/>
          <fieldset><legend>Data capabilities</legend><p className="fieldset-note">Select the data types your company can supply.</p><div className="modality-choice">{modalityOptions.map((option) => <label key={option}><input type="checkbox" name="modalities" value={option} defaultChecked={company?.modalities.includes(option)}/>{option}</label>)}</div></fieldset>
          <fieldset><legend>Optional sample</legend><p className="fieldset-note">You may upload a non-sensitive sample for the admin to review. Maximum size: 1.5 MB.</p><label className="sample-upload"><FileUp/><span><strong>{company?.has_sample ? `Current sample: ${company.sample_file_name}` : "Upload a sample file (optional)"}</strong><small>JSON, CSV, TXT, ZIP, PDF, image, audio, or MP4</small></span><input name="sample" type="file" accept=".json,.csv,.txt,.zip,.pdf,.jpg,.jpeg,.png,.webp,.mp3,.wav,.mp4,application/octet-stream"/></label></fieldset>
          <fieldset><legend>Public footprint</legend><div className="form-grid"><label>LinkedIn <small>Optional</small><input name="linkedinUrl" type="url" maxLength={2048} defaultValue={company?.linkedin_url || ""}/></label><label>X / Twitter <small>Optional</small><input name="twitterUrl" type="url" maxLength={2048} defaultValue={company?.twitter_url || ""}/></label><label>Hugging Face <small>Optional</small><input name="huggingFaceUrl" type="url" maxLength={2048} defaultValue={company?.huggingface_url || ""}/></label></div></fieldset>
          {companyApproved && <p className="verification-warning"><Clock3/>Editing this verified profile sends it back to admin review.</p>}
          <button className="primary-button" disabled={companyBusy}>{companyBusy ? <LoaderCircle className="spin"/> : <><Send size={16}/>{company ? "Submit profile changes" : "Request company verification"}</>}</button>
        </form>}
      </section>

      <section id="facility" className={`verification-stage-card ${companyApproved ? "" : "is-locked"}`}>
        <div className="verification-stage-heading"><div><span><MapPinned/>FACILITIES</span><h2>Add a facility</h2><p>Each physical collection location is reviewed separately before it appears on the map.</p></div>{!companyApproved && <LockKeyhole/>}</div>
        {!companyApproved ? <div className="verification-lock"><LockKeyhole/><div><strong>Company approval required</strong><p>Complete the company profile above and wait for admin approval. Facility fields unlock automatically after approval.</p></div></div> : <form className="onboarding-form embedded-verification-form" onSubmit={async (event) => {
          event.preventDefault(); setFacilityBusy(true); setError(""); setNotice("");
          try {
            const data = new FormData(event.currentTarget);
            const enteredPictures = String(data.get("hardwarePictures") || "").split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
            await api("/api/supplier/application", { method: "POST", body: JSON.stringify({
              kind: "facility", businessName: data.get("businessName"), description: data.get("description"), capacity: data.get("capacity"),
              mapsUrl: location.mapsUrl, physicalAddress: location.physicalAddress, city: location.city, country: location.country, longitude: location.longitude, latitude: location.latitude,
              hardwarePictures: [...new Set([...location.photos, ...enteredPictures])],
              modalities: data.getAll("modalities"), captureEnvironments: String(data.get("captureEnvironments") || "").split(",").map((item) => item.trim()).filter(Boolean),
            }) });
            event.currentTarget.reset(); setLocation(emptyLocation); await load(); setNotice("Facility submitted for admin verification.");
          } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to submit facility."); }
          finally { setFacilityBusy(false); }
        }}>
          <fieldset><legend>Facility details</legend><label>Facility name<input name="businessName" required minLength={2} maxLength={120} placeholder={`${company?.business_name || "Company"} — City facility`}/></label><label>Description<textarea name="description" required minLength={20} maxLength={3000} placeholder="Describe the site, collection setup, staffing, and operating environment."/></label><label>Collection capacity<input name="capacity" required maxLength={120} placeholder="For example: 400 capture hours per week"/></label><label>Capture environments<input name="captureEnvironments" maxLength={2000} placeholder="Indoor, outdoor, warehouse, residential"/></label><div className="modality-choice">{modalityOptions.map((option) => <label key={option}><input type="checkbox" name="modalities" value={option}/>{option}</label>)}</div></fieldset>
          <fieldset><legend>Exact facility location</legend><p className="fieldset-note">Paste the facility&apos;s Google Maps link to import its location and public photos automatically. You can review the result and fine-tune the pin before submitting.</p><FacilityLocationPicker longitude={location.longitude} latitude={location.latitude} onChange={(point) => setLocation((current) => mergePickedLocation(current, point))}/><label>Physical address<input required minLength={5} maxLength={240} value={location.physicalAddress} onChange={(event) => setLocation((current) => ({ ...current, physicalAddress: event.target.value }))}/></label><div className="form-grid"><label>City<input required maxLength={100} value={location.city} onChange={(event) => setLocation((current) => ({ ...current, city: event.target.value }))}/></label><label>Country<input required maxLength={100} value={location.country} onChange={(event) => setLocation((current) => ({ ...current, country: event.target.value }))}/></label><label>Longitude<input readOnly value={location.longitude}/></label><label>Latitude<input readOnly value={location.latitude}/></label></div></fieldset>
          <fieldset><legend>Facility evidence</legend>{location.photos.length > 0 && <p className="fieldset-note"><BadgeCheck/> {location.photos.length} public {location.photos.length === 1 ? "photo was" : "photos were"} imported from Google Maps and will be included with this submission.</p>}<label>Additional public facility photo URLs <small>{location.photos.length ? "Optional" : "Required"}</small><textarea name="hardwarePictures" required={location.photos.length === 0} maxLength={16000} placeholder="One public HTTPS image URL per line"/></label></fieldset>
          <button className="primary-button" disabled={facilityBusy}>{facilityBusy ? <LoaderCircle className="spin"/> : <><Send size={16}/>Submit facility for verification</>}</button>
        </form>}
      </section>

      {facilities.length > 0 && <section className="verification-stage-card"><div className="verification-stage-heading"><div><span><BadgeCheck/>REVIEW HISTORY</span><h2>Facility submissions</h2></div></div><div className="facility-review-list">{facilities.map((facility) => <article key={facility.id}><CheckCircle2/><div><strong>{facility.business_name}</strong><span>{facility.city}, {facility.country}</span>{facility.admin_notes && <small>{facility.admin_notes}</small>}</div><em data-status={facility.status}>{facility.status}</em></article>)}</div></section>}
    </section>
  </main>;
}
