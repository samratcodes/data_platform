"use client";

export { default } from "./SupplierVerificationPortal";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, Building2, CheckCircle2, Clock3, Factory, LoaderCircle, Send, ShieldCheck } from "lucide-react";
import BuyerNavigationRail from "./BuyerNavigationRail";
import FacilityLocationPicker from "./FacilityLocationPicker";
import { api, type User } from "./model";

type Application = { id: string; business_name: string; status: string; verification_level: string; submitted_at: string };
const modalityOptions = ["Egocentric video", "Exocentric video", "Speech", "Images"];

function LegacySupplierOnboarding({ user }: { user: User }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [completion, setCompletion] = useState(0);
  const [location, setLocation] = useState({ mapsUrl: "", physicalAddress: "", city: "", country: "", longitude: "", latitude: "" });

  useEffect(() => {
    api<{ applications: Application[] }>("/api/supplier/application").then((data) => setApplications(data.applications)).catch((reason) => setError(reason.message));
  }, []);

  return <main className="sourcing-app onboarding-page">
    <BuyerNavigationRail user={user} active="onboarding"/>
    <section className="onboarding-shell">
      <div className="onboarding-intro"><span>SUPPLIER ONBOARDING</span><h1>Show buyers what is real.</h1><p>Submit your physical location, capabilities, and public footprint. map.filemarket reviews every listing before it appears on the map.</p><ol className="onboarding-checklist" aria-label="Verification process"><li><strong>1</strong><span>Company and location</span></li><li><strong>2</strong><span>Evidence and capabilities</span></li><li><strong>3</strong><span>map.filemarket review</span></li></ol></div>
      {applications.length > 0 && <div className="application-status"><CheckCircle2 size={18}/><div><strong>{applications[0].business_name}</strong><span>{applications[0].status} · {applications[0].verification_level} verification</span></div></div>}
      {sent ? <div className="onboarding-success"><CheckCircle2 size={34}/><span className="eyebrow">APPLICATION RECEIVED</span><h2>Your verification is underway.</h2><p>Your listing is now in the review queue. The trust team checks your public footprint and evidence before it can appear on the map.</p><div className="success-next-steps"><span><Clock3/><b>Review</b><small>Status appears in your supplier workspace</small></span><span><ShieldCheck/><b>Verification</b><small>Approved profiles receive a trust level</small></span></div><Link className="primary-button" href="/supplier">Open supplier workspace<ArrowRight size={16}/></Link></div> :
      <form className="onboarding-form" onInput={(event) => {
        const data = new FormData(event.currentTarget);
        const required = ["businessName", "providerType", "mapsUrl", "physicalAddress", "city", "country", "longitude", "latitude", "hardwarePictures"];
        const filled = required.filter((field) => String(data.get(field) || "").trim()).length + (data.getAll("modalities").length ? 1 : 0);
        setCompletion(Math.round((filled / 10) * 100));
      }} onSubmit={async (event) => {
        event.preventDefault(); setBusy(true); setError("");
        const data = new FormData(event.currentTarget);
        if (data.getAll("modalities").length === 0) {
          setError("Select at least one data capability."); setBusy(false); return;
        }
        const payload = {
          businessName: data.get("businessName"), providerType: data.get("providerType"),
          mapsUrl: data.get("mapsUrl"), physicalAddress: data.get("physicalAddress"),
          city: data.get("city"), country: data.get("country"), longitude: data.get("longitude"), latitude: data.get("latitude"),
          hardwarePictures: String(data.get("hardwarePictures") || "").split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
          linkedinUrl: data.get("linkedinUrl"), twitterUrl: data.get("twitterUrl"), huggingFaceUrl: data.get("huggingFaceUrl"), websiteUrl: data.get("websiteUrl"),
          modalities: data.getAll("modalities"), roboticsTypes: String(data.get("roboticsTypes") || "").split(",").map((item) => item.trim()).filter(Boolean),
        };
        try { await api("/api/supplier/application", { method: "POST", body: JSON.stringify(payload) }); setSent(true); }
        catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
      }}>
        <div className="onboarding-progress" aria-live="polite"><span><strong>Profile completeness</strong><small>{completion < 100 ? "Complete every required field to submit" : "Ready for verification"}</small></span><b>{completion}%</b><i><em style={{ width: `${completion}%` }}/></i></div>
        <fieldset><legend>Company</legend><p className="fieldset-note">Tell us which organization owns and operates this listing.</p><label>Business name<input name="businessName" required minLength={2} maxLength={120} autoComplete="organization"/></label><div className="provider-type-choice"><label><input type="radio" name="providerType" value="Facility" required/><Factory/>Facility</label><label><input type="radio" name="providerType" value="Data Company"/><Building2/>Data company</label><label><input type="radio" name="providerType" value="Robotics"/><Bot/>Robotics</label></div><label>Website URL <small>Optional</small><input name="websiteUrl" type="url" maxLength={2048} autoComplete="url" placeholder="https://company.com"/></label></fieldset>
        <fieldset><legend>Physical location</legend><p className="fieldset-note">Search your address, then click the map to place the pin precisely. Buyers see city-level coordinates; the exact address stays gated.</p><FacilityLocationPicker longitude={location.longitude} latitude={location.latitude} onChange={(point) => setLocation((current) => ({ ...current, longitude: String(point.longitude), latitude: String(point.latitude), mapsUrl: `https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`, physicalAddress: point.label || current.physicalAddress, city: point.city || current.city, country: point.country || current.country }))}/><label>Google Maps URL<input name="mapsUrl" type="url" maxLength={2048} required value={location.mapsUrl} onChange={(event) => setLocation((current) => ({ ...current, mapsUrl: event.target.value }))} placeholder="https://maps.google.com/..."/></label><label>Physical address<input name="physicalAddress" required minLength={5} maxLength={240} autoComplete="street-address" value={location.physicalAddress} onChange={(event) => setLocation((current) => ({ ...current, physicalAddress: event.target.value }))}/></label><div className="form-grid"><label>City<input name="city" required maxLength={100} autoComplete="address-level2" value={location.city} onChange={(event) => setLocation((current) => ({ ...current, city: event.target.value }))}/></label><label>Country<input name="country" required maxLength={100} autoComplete="country-name" value={location.country} onChange={(event) => setLocation((current) => ({ ...current, country: event.target.value }))}/></label><label>Longitude<input name="longitude" type="number" inputMode="decimal" step="any" min="-180" max="180" required value={location.longitude} onChange={(event) => setLocation((current) => ({ ...current, longitude: event.target.value }))}/></label><label>Latitude<input name="latitude" type="number" inputMode="decimal" step="any" min="-90" max="90" required value={location.latitude} onChange={(event) => setLocation((current) => ({ ...current, latitude: event.target.value }))}/></label></div></fieldset>
        <fieldset><legend>Evidence and capabilities</legend><p className="fieldset-note">Use public HTTPS image links that reviewers can open without an account.</p><label>Facility or hardware picture URLs<textarea name="hardwarePictures" required maxLength={16000} placeholder="One public HTTPS image URL per line"/></label><div className="modality-choice" aria-label="Data capabilities">{modalityOptions.map((option) => <label key={option}><input type="checkbox" name="modalities" value={option}/>{option}</label>)}</div><label>Robotics types <small>Optional</small><input name="roboticsTypes" maxLength={1000} placeholder="Humanoid, mobile manipulator, industrial arm"/></label></fieldset>
        <fieldset><legend>Public footprint</legend><p className="fieldset-note">Add the profiles that help the trust team verify your organization.</p><div className="form-grid"><label>LinkedIn <small>Optional</small><input name="linkedinUrl" type="url" maxLength={2048} placeholder="https://linkedin.com/company/..."/></label><label>X / Twitter <small>Optional</small><input name="twitterUrl" type="url" maxLength={2048} placeholder="https://x.com/..."/></label><label>Hugging Face <small>Optional</small><input name="huggingFaceUrl" type="url" maxLength={2048} placeholder="https://huggingface.co/..."/></label></div></fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin"/> : <><Send size={16}/>Submit for verification</>}</button>
      </form>}
    </section>
  </main>;
}

void LegacySupplierOnboarding;
