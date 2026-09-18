"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Eye, EyeOff, LoaderCircle, MapPinned, ShieldCheck } from "lucide-react";
import PublicNavigationRail from "@/components/navigation/PublicNavigationRail";
import { api } from "@/lib/api-client";
import { validatePassword } from "@/lib/validation/password";
import CompanyProfileStep, { companyStepDescriptions, companyStepTitles, emptyCompanyProfile, mergeCompanyLocation, uploadCompanyEvidence, validateCompanyStep, type CompanyEvidence, type CompanyFieldKey } from "./CompanyProfileSteps";

const initialValues = { ...emptyCompanyProfile, name: "", email: "", password: "", confirmation: "" };
type FieldKey = CompanyFieldKey | "name" | "email" | "password" | "confirmation";
type FieldErrors = Partial<Record<FieldKey, string>>;

export default function DataCompanySignupForm() {
  const [step, setStep] = useState(0); const [profileStage, setProfileStage] = useState<0 | 1>(0); const [values, setValues] = useState(initialValues);
  const [evidence, setEvidence] = useState<CompanyEvidence>({ logo: null, officeImages: [], documents: [] });
  const [showPasswords, setShowPasswords] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [attempted, setAttempted] = useState(false); const [serverFieldError, setServerFieldError] = useState<{ field: "email" | "password"; message: string } | null>(null);
  const router = useRouter();
  const update = (field: Exclude<keyof typeof initialValues, "photos">, value: string | string[]) => { setValues((current) => ({ ...current, [field]: value })); if (serverFieldError?.field === field) { setServerFieldError(null); setError(""); } };
  const validateStep = (): FieldErrors => {
    const issues: FieldErrors = validateCompanyStep(step, profileStage, values, evidence.documents, Boolean(evidence.logo));
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
  const submit = async () => { if (Object.keys(validateStep()).length) { setAttempted(true); setError(""); focusFirstError(); return; } setAttempted(false); setServerFieldError(null); setBusy(true); setError(""); try { await api("/api/auth/signup", { method: "POST", body: JSON.stringify({ ...values, photos: undefined, role: "supplier", companyApplication: true }) }); await uploadCompanyEvidence(evidence); router.push("/verify-email"); router.refresh(); } catch (reason) { const message = reason instanceof Error ? reason.message : "Unable to submit your company application."; setError(message); if (/another work email|business email address/i.test(message)) setServerFieldError({ field: "email", message }); else if (/password/i.test(message)) setServerFieldError({ field: "password", message }); window.setTimeout(() => document.querySelector<HTMLElement>(".company-wizard-alert")?.scrollIntoView({ block: "center" }), 0); } finally { setBusy(false); } };
  // The rail shows the two company-profile stages as separate steps.
  const railSteps = [
    { title: "Company details", detail: "Name, profile, and focus" },
    { title: "Logo & documents", detail: "Brand and verification evidence" },
    { title: "Data capabilities", detail: "What you can supply" },
    { title: "Location", detail: "Where you are based" },
    { title: "Account", detail: "Your secure login" },
  ];
  const railIndex = step === 0 ? profileStage : step + 1;
  const goToRailStep = (index: number) => { if (index >= railIndex) return; setAttempted(false); setServerFieldError(null); setError(""); setStep(index <= 1 ? 0 : index - 1); setProfileStage(index === 1 ? 1 : 0); };
  const titles = [...companyStepTitles(profileStage), "Create your secure account"];
  const descriptions = [...companyStepDescriptions(profileStage), "Use a business email to receive your verification link and review updates."];
  return <main className="sourcing-app company-signup-page"><PublicNavigationRail active="supplier-signup"/><section className="company-wizard company-wizard-full" aria-labelledby="company-wizard-title"><aside className="company-wizard-banner wizard-rail">
    <div className="wizard-rail-head"><span className="company-wizard-mark"><MapPinned/></span><div><p>MAP.FILEMARKET</p><h1 id="company-wizard-title">Register your data company</h1></div></div>
    <p className="wizard-rail-intro">Get verified once, then list your company and its facilities on the global sourcing map.</p>
    <ol className="wizard-stepper" aria-label="Application steps">{railSteps.map((item, index) => { const state = index < railIndex ? "is-done" : index === railIndex ? "is-current" : ""; return <li key={item.title} className={state} aria-current={index === railIndex ? "step" : undefined}>
      <button type="button" disabled={index >= railIndex || busy} onClick={() => goToRailStep(index)}><span className="wizard-step-dot">{index < railIndex ? <Check size={16}/> : index + 1}</span><span><strong>{item.title}</strong><small>{item.detail}</small></span></button>
    </li>; })}</ol>
    <div className="wizard-rail-footer">
      <div className="wizard-rail-trust"><ShieldCheck/><span><strong>Reviewed by our team</strong>Documents stay private to reviewers. Your public profile goes live only after approval.</span></div>
      <p className="wizard-rail-login">Already registered? <Link href="/login">Log in</Link></p>
    </div>
  </aside><form className="company-wizard-form" noValidate onSubmit={(event) => { event.preventDefault(); if (step === 3) void submit(); else next(); }}><header><span>STEP {railIndex + 1} OF {railSteps.length}</span><h2>{titles[step]}</h2><p>{descriptions[step]}</p></header><div className="company-wizard-content">
    {(error || (attempted && Object.keys(fieldErrors).length > 0)) && <div className="company-wizard-alert" role="alert"><AlertTriangle size={19}/><span><strong>{error ? "Something needs attention" : "Check the highlighted fields"}</strong><small>{error || "Correct each highlighted field to continue."}</small></span></div>}
    {step < 3 && <CompanyProfileStep step={step} profileStage={profileStage} values={values} onChange={update} onLocation={(location) => setValues((current) => ({ ...current, ...mergeCompanyLocation(current, location) }))} evidence={evidence} onEvidence={setEvidence} fieldErrors={fieldErrors} showTypeErrors={attempted} onError={setError}/>}
    {step === 3 && <div className="company-wizard-fields">
      <div className="wizard-field-grid">{([["name", "Your name", "Alex Morgan", "text"], ["email", "Business email", "you@company.com", "email"], ["password", "Password", "12+ characters", "password"], ["confirmation", "Confirm password", "Type it again", "password"]] as const).map(([field, label, placeholder, type]) => <label className={`wizard-input-card ${fieldError(field) ? "has-error" : ""}`} key={field}><span>{label}</span><div className="wizard-password-input"><input type={type === "password" && showPasswords ? "text" : type} value={values[field]} onChange={(event) => update(field, event.target.value)} autoComplete={field === "email" ? "email" : field === "name" ? "name" : "new-password"} placeholder={placeholder} aria-invalid={Boolean(fieldError(field))} aria-describedby={fieldError(field) ? `${field}-error` : undefined} autoFocus={field === "name"}/>{type === "password" && <button type="button" aria-label={showPasswords ? "Hide password" : "Show password"} onClick={() => setShowPasswords((current) => !current)}>{showPasswords ? <EyeOff/> : <Eye/>}</button>}</div>{fieldError(field) && <small id={`${field}-error`} className="wizard-field-error">{fieldError(field)}</small>}</label>)}</div>
      <div className="wizard-password-strength" aria-live="polite"><span><b>Password strength</b><small>{values.password ? (passwordScore < 3 ? "Needs strengthening" : passwordScore < 5 ? "Good password" : "Strong password") : "Use 12+ characters with a mix of letters, numbers, and symbols."}</small></span><div>{[1, 2, 3, 4, 5].map((level) => <i key={level} className={level <= passwordScore ? `active score-${passwordScore}` : ""}/>)}</div></div>
      <div className="wizard-trust-card"><ShieldCheck/><span><strong>What happens next</strong><small>We email a verification link, then your company application is marked pending for review.</small></span></div>
    </div>}
  </div><footer><div className="company-wizard-progress" aria-label={`Step ${railIndex + 1} of ${railSteps.length}`}><span>Application progress</span><div>{railSteps.map((item, index) => <i key={item.title} className={index <= railIndex ? "active" : ""} title={item.title}/>)}</div><small>Step {railIndex + 1} of {railSteps.length} · {railSteps[railIndex].title}</small></div><div className="company-wizard-actions">{(step > 0 || profileStage > 0) && <button type="button" className="wizard-back" onClick={back}><ArrowLeft/>Back</button>}<button type="submit" className="wizard-next" disabled={busy}>{busy ? <LoaderCircle className="spin"/> : step === 3 ? <><ShieldCheck/>Submit application</> : <>Continue<ArrowRight/></>}</button></div></footer><p className="company-wizard-login">Already registered? <Link href="/login">Log in</Link></p></form></section>
  </main>;
}
