"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, ClipboardCheck, Factory, LockKeyhole, Package, ShieldCheck } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import SupplierShell, { SideCard, SideSteps } from "@/components/supplier/SupplierShell";
import CompanyProfileEditor, { type CompanyApplication, type ListingPrefill } from "./CompanyProfileEditor";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { User } from "@/types/app";

type Application = CompanyApplication & {
  application_kind: "company" | "facility";
  status: "pending" | "approved" | "rejected";
  admin_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

/** The data-company profile: one place to edit the company, separate from facility applications. */
export default function SupplierVerificationPortal({ user }: { user: User }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [listing, setListing] = useState<ListingPrefill | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const router = useRouter();

  const load = useCallback(async () => {
    const data = await api<{ applications: Application[]; listing: ListingPrefill | null }>("/api/supplier/application");
    setApplications(data.applications);
    setListing(data.listing);
    setLoaded(true);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch((reason) => { setError(reason.message); setLoaded(true); }); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const company = useMemo(() => applications.find((item) => item.application_kind === "company"), [applications]);
  const facilityCount = applications.length - (company ? 1 : 0);
  const companyApproved = company?.status === "approved";
  // Device companies open a product store instead of applying for facilities.
  const devices = (company?.company_focus ?? user.companyFocus) === "devices";
  // Media changes save immediately; refresh the server-rendered user so the sidebar logo updates too.
  const mediaChanged = async (message: string) => { setError(""); await load(); setNotice(message); router.refresh(); };

  return <SupplierShell
    user={user} active="onboarding" eyebrow={devices ? "DEVICE COMPANY" : "DATA COMPANY"} title="Company profile"
    description={devices ? "The company behind your store. Buyers and data companies see this profile after approval; every change is reviewed again before it goes live." : "The company behind your facilities. Buyers see this profile after approval; every change is reviewed again before it goes live."}
    actions={<Link className="secondary-button" href="/supplier">Back to workspace<ArrowRight size={15}/></Link>}
    notice={(notice || error) && <p className={error ? "form-error settings-message" : "settings-message settings-success"} role="status">{error || notice}</p>}
    aside={loaded && <>
      <SideCard title="Verification" icon={<ShieldCheck size={16}/>}>
        {company && <div className="side-company"><span className="provider-logo provider-logo-small"><Building2/></span><div><strong>{company.business_name}</strong><small>Submitted {formatDate(company.submitted_at)}</small></div><StatusBadge status={company.status}/></div>}
        <SideSteps items={[
          { title: "Company profile", detail: company ? "Submitted" : "Fill in the form", done: Boolean(company), current: !company },
          { title: "Admin approval", detail: companyApproved ? (company?.reviewed_at ? `Approved ${formatDate(company.reviewed_at)}` : "Approved") : "Usually within two business days", done: companyApproved, current: Boolean(company) && !companyApproved },
          devices
            ? { title: "Open your store", detail: "Your published products go live with your store", done: companyApproved, current: false }
            : { title: "Apply for facilities", detail: facilityCount ? `${facilityCount} ${facilityCount === 1 ? "facility" : "facilities"} so far` : "Each facility gets its own map pin", done: facilityCount > 0, current: companyApproved && !facilityCount },
        ]}/>
      </SideCard>
      <SideCard title="What reviewers check" icon={<ClipboardCheck size={16}/>}>
        <ul className="side-list">
          <li><ShieldCheck size={14}/>Your logo, company description, and website</li>
          <li><ShieldCheck size={14}/>Official documents such as incorporation papers</li>
          <li><ShieldCheck size={14}/>The company location on Google Maps</li>
        </ul>
      </SideCard>
      {devices
        ? <SideCard title="Your products" icon={<Package size={16}/>} tone="accent">
          <p>{companyApproved ? "Your store is open. Add devices with their specs, uses, and the data they provide." : "You can add products now. They appear in your store once this company profile is approved."}</p>
          <Link className="primary-button" href="/supplier/products"><Package size={15}/>Manage products</Link>
        </SideCard>
        : <SideCard title={companyApproved ? "Facilities" : "Facilities are locked"} icon={companyApproved ? <Factory size={16}/> : <LockKeyhole size={16}/>} tone={companyApproved ? "accent" : "muted"}>
          <p>{companyApproved ? "Apply for each facility with its workforce, documents, and photos. Each one is reviewed and gets its own dashboard." : "Once this company profile is approved, you can apply for facilities."}</p>
          {companyApproved && <Link className="primary-button" href={facilityCount ? "/supplier/facilities" : "/supplier/facilities/new"}><Factory size={15}/>{facilityCount ? "Open facilities" : "Apply for a facility"}</Link>}
        </SideCard>}
    </>}
  >
    <section id="company-profile" className="verification-stage-card">
      <div className="verification-stage-heading"><div><span><Building2/>{devices ? "DEVICE COMPANY PROFILE" : "DATA COMPANY PROFILE"}</span><h2>{company?.business_name || "Company verification"}</h2><p>Details, logo and office images, data capabilities, location, and links. Editing an approved profile sends it back for review.</p></div>{company && <StatusBadge status={company.status}/>}</div>
      {!company && listing && <div className="listing-prefill-note"><ShieldCheck/><span><strong>We started your profile from your map listing</strong>Your name, logo, and location are filled in. Add the rest and submit it for review to get verified.</span></div>}
      {company?.admin_notes && <div className="review-feedback"><ShieldCheck/><span><strong>Admin feedback</strong>{company.admin_notes}</span></div>}
      {!loaded ? <p className="workspace-empty">Loading company profile…</p> : <CompanyProfileEditor key={company ? `${company.id}:${company.submitted_at}` : listing ? "listing-company" : "new-company"} company={company} prefill={listing} approved={companyApproved} onSaved={async (message) => { setError(""); await load(); setNotice(message); router.refresh(); window.scrollTo({ top: 0, behavior: "smooth" }); }} onMediaChanged={mediaChanged}/>}
    </section>
  </SupplierShell>;
}
