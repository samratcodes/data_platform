"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CircleDashed, Database, Globe, LoaderCircle, Mail, MapPin, MapPinned, Webcam } from "lucide-react";
import CompanyLogoPicker, { type CompanyLogo } from "@/components/onboarding/CompanyLogoPicker";
import FacilityLocationPicker, { type PickedLocation } from "@/components/onboarding/FacilityLocationPicker";
import { validHttpsUrl } from "@/components/onboarding/CompanyProfileSteps";
import PageHeader from "@/components/ui/PageHeader";
import ProviderLogo from "@/components/ui/ProviderLogo";
import { api } from "@/lib/api-client";
import { companyFocusCards } from "@/lib/company-focus";
import { businessEmailMessage, emailDomain, isBusinessEmail } from "@/lib/validation/email";
import type { IncompleteListingDetail } from "@/types/admin";

const focusIcons = { collection: Database, devices: Webcam } as const;
type Values = { email: string; name: string; focus: string; description: string; websiteUrl: string; city: string; country: string; longitude: string; latitude: string; mapsUrl: string };
const empty: Values = { email: "", name: "", focus: "collection", description: "", websiteUrl: "", city: "", country: "", longitude: "", latitude: "", mapsUrl: "" };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** "ops@acme-robotics.com" → "Acme Robotics", skipping mail-server prefixes like "mail." or "www.". */
function nameFromEmail(email: string) {
  const labels = emailDomain(email).split(".");
  if (labels.length < 2) return "";
  const root = labels.length > 2 && ["www", "mail", "email", "info", "team", "hq"].includes(labels[0]) ? labels[1] : labels[0];
  return root.split(/[-_]+/).filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

/**
 * Adds or edits an incomplete (grey) company listing. The logo, the company's email, and a place on
 * the map are enough to publish it; everything else is optional and the company completes it after
 * claiming the listing by registering with that email.
 */
export default function CompanyListingForm({ slug, focus = "collection" }: { slug?: string; focus?: "collection" | "devices" }) {
  const router = useRouter();
  const editing = Boolean(slug);
  const [values, setValues] = useState({ ...empty, focus });
  const [logo, setLogo] = useState<CompanyLogo | null>(null);
  // The name and website follow the email's domain until the admin types their own.
  const [touched, setTouched] = useState({ name: false, websiteUrl: false });
  const [loaded, setLoaded] = useState(!editing);
  // Once the company signs in, its email is its login and stays as it is.
  const [emailLocked, setEmailLocked] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    api<{ listing: IncompleteListingDetail }>(`/api/admin/listings?slug=${encodeURIComponent(slug)}`).then(({ listing }) => {
      setValues({ email: listing.claim_email ?? "", name: listing.name, focus: listing.provider_type === "Device Supplier" ? "devices" : "collection", description: listing.description, websiteUrl: listing.website, city: listing.city, country: listing.country, longitude: String(listing.longitude), latitude: String(listing.latitude), mapsUrl: listing.maps_url });
      if (listing.logo) setLogo({ url: listing.logo, name: "Current logo", contentType: "image/*", size: 0, key: "current" });
      setTouched({ name: true, websiteUrl: true });
      setEmailLocked(listing.owner_activated);
      setLoaded(true);
    }).catch((reason) => { setError((reason as Error).message); setLoaded(true); });
  }, [slug]);

  // Back to the section for the company's type, which follows the focus chosen here.
  const devices = values.focus === "devices";
  const backHref = `${devices ? "/admin/device-companies" : "/admin/companies"}?view=incomplete`;
  const set = (field: keyof Values, value: string) => setValues((current) => ({ ...current, [field]: value }));
  const setEmail = (email: string) => setValues((current) => {
    const domain = emailDomain(email);
    const business = emailPattern.test(email.trim()) && isBusinessEmail(email);
    return {
      ...current, email,
      name: touched.name ? current.name : business ? nameFromEmail(email) : "",
      websiteUrl: touched.websiteUrl ? current.websiteUrl : business ? `https://${domain.replace(/^(mail|email)\./, "")}` : "",
    };
  });

  const issues: Partial<Record<keyof Values | "logo" | "location", string>> = {};
  if (!logo) issues.logo = "Upload the company logo. It is shown, in grey, on the map pin.";
  if (!emailPattern.test(values.email.trim())) issues.email = "Enter the company's email. The company claims the listing by registering with it.";
  else if (!isBusinessEmail(values.email)) issues.email = businessEmailMessage;
  if (values.name.trim().length < 2) issues.name = "Enter a company name with at least 2 characters.";
  if (!values.longitude || !values.latitude) issues.location = "Search for the company or place the pin on the map.";
  if (values.city.trim().length < 2) issues.city = "Enter the city.";
  if (values.country.trim().length < 2) issues.country = "Enter the country.";
  if (values.websiteUrl.trim() && !validHttpsUrl(values.websiteUrl.trim())) issues.websiteUrl = "Use a public https:// address, or leave it empty.";
  const shown = (field: keyof typeof issues) => attempted ? issues[field] : undefined;
  const fieldError = (field: keyof typeof issues) => shown(field) && <small className="wizard-field-error">{shown(field)}</small>;
  const essentials = [
    { label: "Logo", done: Boolean(logo) },
    { label: "Email", done: !issues.email },
    { label: "Location", done: !issues.location && !issues.city && !issues.country },
  ];

  const submit = async () => {
    setAttempted(true); setError("");
    if (Object.keys(issues).length) return;
    setBusy(true);
    try {
      const body = new FormData();
      Object.entries(values).forEach(([key, value]) => body.set(key, value.trim()));
      if (slug) body.set("slug", slug);
      if (logo?.file) body.set("logo", logo.file);
      const response = await fetch("/api/admin/listings", { method: editing ? "PATCH" : "POST", body });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "The company could not be saved.");
      router.push(backHref);
      router.refresh();
    } catch (reason) { setError((reason as Error).message); setBusy(false); }
  };

  if (!loaded) return <section className="admin-page-body"><p className="table-loading"><LoaderCircle className="spin" size={18}/>Loading listing…</p></section>;

  const place = [values.city.trim(), values.country.trim()].filter(Boolean).join(", ");
  return <section className="admin-page-body listing-editor">
    <Link className="supplier-back" href={backHref}><ArrowLeft size={15}/>{devices ? "Device companies" : "Data companies"}</Link>
    <PageHeader eyebrow={editing ? "EDIT INCOMPLETE LISTING" : devices ? "ADD DEVICE COMPANY" : "ADD DATA COMPANY"} title={editing ? `Edit ${values.name || "listing"}` : devices ? "Put a device company on the map" : "Put a company on the map"}
      description="A logo, the company's email, and its location are enough. It shows as a grey pin without a verification badge. The company signs in with that email through Forgot password and completes its profile to get verified."/>

    <form className="listing-editor-layout" noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <div className="listing-editor-form">
        <fieldset>
          <legend><span>1</span>Company<small>Required</small></legend>
          <CompanyLogoPicker logo={logo} onChange={setLogo} onError={setError} error={shown("logo")} hint="Shown in grey on the map pin until the company is verified."/>
          <label className={`wizard-input-card ${shown("email") ? "has-error" : ""}`}><span>Company email</span><input type="email" value={values.email} onChange={(event) => setEmail(event.target.value)} placeholder="founder@company.com" autoFocus={!editing} autoComplete="off" readOnly={emailLocked}/>
            {fieldError("email") || <small className="listing-hint"><Mail size={12}/>{emailLocked ? "The company signs in with this email, so it can no longer be changed." : "An account is created for this email. The company sets its password with Forgot password, then completes its profile."}</small>}</label>
          <label className={`wizard-input-card ${shown("name") ? "has-error" : ""}`}><span>Company name</span><input value={values.name} onChange={(event) => { setTouched((current) => ({ ...current, name: true })); set("name", event.target.value); }} placeholder="Filled in from the email's domain"/>{fieldError("name")}</label>
          <div><span className="wizard-section-label">Primary focus</span><div className="wizard-choice-grid is-two">{companyFocusCards.map((card) => { const Icon = focusIcons[card.value]; return <button type="button" key={card.value} className={values.focus === card.value ? "selected" : ""} aria-pressed={values.focus === card.value} onClick={() => set("focus", card.value)}><Icon/><strong>{card.title}</strong><small>{card.detail}</small>{values.focus === card.value && <Check/>}</button>; })}</div></div>
        </fieldset>

        <fieldset>
          <legend><span>2</span>Location<small>Required</small></legend>
          <div className={`wizard-location-picker ${shown("location") ? "has-error" : ""}`}><span className="wizard-section-label">Find the company or place the pin</span>
            <FacilityLocationPicker longitude={values.longitude} latitude={values.latitude} onChange={(location: PickedLocation) => setValues((current) => ({ ...current, longitude: String(location.longitude), latitude: String(location.latitude), city: location.city || current.city, country: location.country || current.country, mapsUrl: location.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}` }))}/>
            {shown("location") && <p className="wizard-section-error">{shown("location")}</p>}
          </div>
          <div className="wizard-field-grid">
            <label className={`wizard-input-card ${shown("city") ? "has-error" : ""}`}><span>City</span><input value={values.city} onChange={(event) => set("city", event.target.value)} placeholder="Kathmandu"/>{fieldError("city")}</label>
            <label className={`wizard-input-card ${shown("country") ? "has-error" : ""}`}><span>Country</span><input value={values.country} onChange={(event) => set("country", event.target.value)} placeholder="Nepal"/>{fieldError("country")}</label>
          </div>
        </fieldset>

        <fieldset>
          <legend><span>3</span>More details<small>Optional</small></legend>
          <label className="wizard-input-card"><span>Short description</span><textarea value={values.description} onChange={(event) => set("description", event.target.value)} maxLength={3000} rows={3} placeholder="One or two lines about the company. It can rewrite this when it completes its profile."/></label>
          <label className={`wizard-input-card ${shown("websiteUrl") ? "has-error" : ""}`}><span>Website</span><input type="url" value={values.websiteUrl} onChange={(event) => { setTouched((current) => ({ ...current, websiteUrl: true })); set("websiteUrl", event.target.value); }} placeholder="https://company.com"/>{fieldError("websiteUrl")}</label>
        </fieldset>
      </div>

      <aside className="listing-editor-side" aria-label="Preview">
        <div className="listing-preview">
          <span className="listing-preview-kicker"><CircleDashed size={13}/>How it appears on the map</span>
          <div className="listing-preview-card">
            <ProviderLogo name={values.name.trim() || "Company"} logo={logo?.url} type={values.focus === "devices" ? "Device Supplier" : "Data Company"} size={48} incomplete/>
            <div>
              <strong>{values.name.trim() || "Company name"}</strong>
              <small><MapPin size={11}/>{place || "City, Country"}</small>
              <span className="listing-preview-tags"><em>Incomplete profile</em><em>{values.focus === "devices" ? "Device company" : "Data company"}</em></span>
            </div>
          </div>
          {values.websiteUrl.trim() && <small className="listing-preview-link"><Globe size={12}/>{values.websiteUrl.trim().replace(/^https:\/\//, "")}</small>}
        </div>
        <ul className="listing-checklist" aria-label="Required to publish">{essentials.map((item) => <li key={item.label} className={item.done ? "is-done" : ""}><span>{item.done ? <Check size={12}/> : null}</span>{item.label}</li>)}</ul>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button listing-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16}/> : <MapPinned size={15}/>}{editing ? "Save changes" : "Add to map as incomplete"}</button>
        <Link className="secondary-button listing-cancel" href={backHref}>Cancel</Link>
      </aside>
    </form>
  </section>;
}
