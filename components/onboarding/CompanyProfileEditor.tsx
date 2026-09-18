"use client";

import { useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Clock3, FileUp, LoaderCircle, Send } from "lucide-react";
import { api } from "@/lib/api-client";
import ProviderMediaManager from "@/components/media/ProviderMediaManager";
import CompanyProfileStep, { companyStepDescriptions, companyStepTitles, emptyCompanyProfile, mergeCompanyLocation, uploadCompanyEvidence, validateCompanyStep, type CompanyEvidence, type CompanyFieldErrors, type CompanyProfileValues } from "./CompanyProfileSteps";

type SavedAsset = { key: string; name: string; contentType: string; size?: number; type?: string };

export type CompanyApplication = {
  id: string;
  business_name: string;
  profile_description: string;
  website_url: string | null;
  maps_url: string | null;
  physical_address: string | null;
  city: string | null;
  country: string | null;
  longitude: number | null;
  latitude: number | null;
  hardware_pictures: string[];
  modalities: string[];
  company_focus?: string | null;
  company_logo?: SavedAsset | null;
  office_images?: SavedAsset[];
  official_documents?: SavedAsset[];
  linkedin_url: string | null;
  twitter_url: string | null;
  huggingface_url: string | null;
  sample_file_name: string | null;
  has_sample: boolean;
};

const steps = ["Company profile & evidence", "Data capabilities", "Company location", "Links & sample"];
const assetUrl = (key: string) => `/api/company-assets?key=${encodeURIComponent(key)}`;
const optional = (value: number | null | undefined) => value === null || value === undefined ? "" : String(value);

function initialValues(company?: CompanyApplication): CompanyProfileValues {
  if (!company) return emptyCompanyProfile;
  return {
    businessName: company.business_name, description: company.profile_description, websiteUrl: company.website_url || "",
    mapsUrl: company.maps_url || "", physicalAddress: company.physical_address || "", city: company.city || "", country: company.country || "",
    longitude: optional(company.longitude), latitude: optional(company.latitude), focus: company.company_focus || "collection",
    modalities: company.modalities, photos: company.hardware_pictures,
  };
}

// Saved logo and images are edited live by ProviderMediaManager; only documents are staged in the wizard.
function initialEvidence(company?: CompanyApplication): CompanyEvidence {
  return {
    logo: null,
    officeImages: [],
    documents: (company?.official_documents || []).map((asset) => ({ key: asset.key, url: assetUrl(asset.key), name: asset.name, contentType: asset.contentType, size: asset.size || 0, type: asset.type || "Official company document" })),
  };
}

async function encodeSample(file: File) {
  if (file.size > 1_500_000) throw new Error("The sample file must be 1.5 MB or smaller.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  return { name: file.name, type: file.type || "application/octet-stream", data: btoa(binary) };
}

/** Company profile editor that mirrors the data-company signup wizard step for step. */
export default function CompanyProfileEditor({ company, approved, onSaved, onMediaChanged }: { company?: CompanyApplication; approved: boolean; onSaved: (message: string) => Promise<void>; onMediaChanged: (message: string) => Promise<void> }) {
  const [step, setStep] = useState(0);
  const [profileStage, setProfileStage] = useState<0 | 1>(0);
  const [values, setValues] = useState(() => initialValues(company));
  const [evidence, setEvidence] = useState(() => initialEvidence(company));
  const [links, setLinks] = useState({ linkedinUrl: company?.linkedin_url || "", twitterUrl: company?.twitter_url || "", huggingFaceUrl: company?.huggingface_url || "" });
  const [sample, setSample] = useState<File | null>(null);
  // Linked photos can also be deleted live by the media manager, so only resend them when a new location was picked here.
  const [pickedLocation, setPickedLocation] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const hasLogo = Boolean(evidence.logo || company?.company_logo);
  const validateStep = (): CompanyFieldErrors => step < 3 ? validateCompanyStep(step, profileStage, values, evidence.documents, hasLogo) : {};
  const fieldErrors = attempted ? validateStep() : {};
  const scrollToProblem = () => window.setTimeout(() => {
    const input = document.querySelector<HTMLElement>('.company-profile-editor [aria-invalid="true"]');
    if (input) input.focus();
    else document.querySelector<HTMLElement>(".company-profile-editor .company-wizard-alert")?.scrollIntoView({ block: "center" });
  }, 0);
  const showStep = () => window.setTimeout(() => document.querySelector(".company-profile-editor")?.scrollIntoView({ block: "start", behavior: "smooth" }), 0);
  const next = () => {
    if (Object.keys(validateStep()).length) { setAttempted(true); setError(""); scrollToProblem(); return; }
    setAttempted(false); setError("");
    if (step === 0 && profileStage === 0) setProfileStage(1); else setStep((current) => Math.min(current + 1, 3));
    showStep();
  };
  const back = () => {
    setAttempted(false); setError("");
    if (step === 0 && profileStage === 1) setProfileStage(0); else setStep((current) => Math.max(current - 1, 0));
    showStep();
  };

  const submit = async () => {
    // Every earlier step must still be valid, since the supplier can reach the last step and then edit nothing else.
    for (const [checkStep, checkStage] of [[0, 0], [0, 1], [1, 0], [2, 0]] as const) {
      if (Object.keys(validateCompanyStep(checkStep, checkStage, values, evidence.documents, hasLogo)).length) { setStep(checkStep); setProfileStage(checkStage); setAttempted(true); scrollToProblem(); return; }
    }
    setBusy(true); setError("");
    try {
      await api("/api/supplier/application", { method: "POST", body: JSON.stringify({
        kind: "company", ...values, photos: undefined, hardwarePictures: pickedLocation || !company ? values.photos : company.hardware_pictures, ...links,
        sample: sample ? await encodeSample(sample) : undefined,
      }) });
      const kept = new Set(evidence.documents.flatMap((document) => document.key ? [document.key] : []));
      for (const document of company?.official_documents || []) if (!kept.has(document.key)) await api(`/api/company-assets?key=${encodeURIComponent(document.key)}`, { method: "DELETE" });
      await uploadCompanyEvidence(evidence);
      await onSaved(approved ? "Company changes were sent for admin review. Facility submission is locked until approval." : company ? "Company profile changes sent for admin review." : "Company profile sent for admin review.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to submit company profile.");
      scrollToProblem();
    } finally { setBusy(false); }
  };

  const titles = [...companyStepTitles(profileStage), "Add public links and an optional sample"];
  const descriptions = [...companyStepDescriptions(profileStage), "Links help reviewers and buyers verify your public footprint. A non-sensitive sample is only visible to reviewers."];

  return <div className="company-profile-editor">
    <form className="company-wizard-form" noValidate onSubmit={(event) => { event.preventDefault(); if (step === 3) void submit(); else next(); }}>
      <header><span>STEP {step + 1} OF 4{step === 0 ? ` · ${profileStage + 1} OF 2` : ""}</span><h2>{titles[step]}</h2><p>{descriptions[step]}</p></header>
      <div className="company-wizard-content">
        {(error || (attempted && Object.keys(fieldErrors).length > 0)) && <div className="company-wizard-alert" role="alert"><AlertTriangle size={19}/><span><strong>{error ? "Something needs attention" : "Check the highlighted fields"}</strong><small>{error || "Correct each highlighted field to continue."}</small></span></div>}
        {step < 3 && <CompanyProfileStep step={step} profileStage={profileStage} values={values} onChange={(field, value) => setValues((current) => ({ ...current, [field]: value }))} onLocation={(location) => { setPickedLocation(true); setValues((current) => mergeCompanyLocation(current, location)); }} evidence={evidence} onEvidence={setEvidence} fieldErrors={fieldErrors} showTypeErrors={attempted} onError={setError} savedMedia={company && <ProviderMediaManager title="Logo and office images" description="Your logo appears on your public profile. Add, replace, or delete images at any time." showLogo logo={company.company_logo} images={company.office_images || []} linkedPhotos={company.hardware_pictures} onChanged={onMediaChanged}/>}/>}
        {step === 3 && <div className="company-wizard-fields">
          <div className="wizard-field-grid">{([["linkedinUrl", "LinkedIn", "https://linkedin.com/company/…"], ["twitterUrl", "X / Twitter", "https://x.com/…"], ["huggingFaceUrl", "Hugging Face", "https://huggingface.co/…"]] as const).map(([field, label, placeholder]) => <label className="wizard-input-card" key={field}><span>{label} <small>Optional</small></span><input type="url" maxLength={2048} value={links[field]} onChange={(event) => setLinks((current) => ({ ...current, [field]: event.target.value }))} placeholder={placeholder}/></label>)}</div>
          <label className="wizard-input-card company-sample-card"><span className="wizard-upload-icon"><FileUp/></span><span><strong>{sample ? `Selected sample: ${sample.name}` : company?.has_sample ? `Current sample: ${company.sample_file_name}` : "Upload a sample file"} <em>Optional</em></strong><small>{sample || company?.has_sample ? "Choose a file to replace it. " : ""}JSON, CSV, TXT, ZIP, PDF, image, audio, or MP4 · 1.5 MB maximum</small></span><input type="file" accept=".json,.csv,.txt,.zip,.pdf,.jpg,.jpeg,.png,.webp,.mp3,.wav,.mp4,application/octet-stream" onChange={(event) => setSample(event.target.files?.[0] || null)}/></label>
          {approved && <p className="verification-warning"><Clock3/>Editing this verified profile sends it back to admin review.</p>}
        </div>}
      </div>
      <footer>
        <div className="company-wizard-progress" aria-label={`Step ${step + 1} of 4`}><span>Profile progress</span><div>{steps.map((label, index) => <i key={label} className={index <= step ? "active" : ""} title={label}/>)}</div><small>{steps[step]}{step === 0 ? ` · ${profileStage + 1} of 2` : ""}</small></div>
        <div className="company-wizard-actions">{(step > 0 || profileStage > 0) && <button type="button" className="wizard-back" onClick={back}><ArrowLeft/>Back</button>}<button type="submit" className="wizard-next" disabled={busy}>{busy ? <LoaderCircle className="spin"/> : step === 3 ? <><Send/>{company ? "Submit profile changes" : "Request company verification"}</> : <>Continue<ArrowRight/></>}</button></div>
      </footer>
    </form>
  </div>;
}
