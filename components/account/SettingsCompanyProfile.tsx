"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, LoaderCircle, ShieldCheck } from "lucide-react";
import CompanyProfileEditor, { type CompanyApplication, type ListingPrefill } from "@/components/onboarding/CompanyProfileEditor";
import StatusBadge from "@/components/ui/StatusBadge";
import { api } from "@/lib/api-client";
import type { User } from "@/types/app";

type Application = CompanyApplication & { application_kind: "company" | "facility"; status: "pending" | "approved" | "rejected"; admin_notes: string | null; submitted_at: string };

/**
 * The company registration form inside Profile & settings: the same steps a company fills in when it
 * registers, prefilled from its saved profile (or from the grey listing an admin added). Saving sends it
 * for review again, so an incomplete or rejected company can resubmit from here.
 */
export default function SettingsCompanyProfile({ user, onMessage }: { user: User; onMessage: (message: string, isError?: boolean) => void }) {
  const router = useRouter();
  const [company, setCompany] = useState<Application | undefined>();
  const [listing, setListing] = useState<ListingPrefill | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const data = await api<{ applications: Application[]; listing: ListingPrefill | null }>("/api/supplier/application");
    setCompany(data.applications.find((item) => item.application_kind === "company"));
    setListing(data.listing);
    setLoaded(true);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch((reason) => { onMessage((reason as Error).message, true); setLoaded(true); }); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, onMessage]);

  const devices = (company?.company_focus ?? user.companyFocus) === "devices";
  const refreshed = async (message: string) => { await load(); onMessage(message); router.refresh(); };

  return <section className="settings-company" id="company-profile" aria-labelledby="settings-company-title">
    <div className="settings-card-heading">
      <span><Building2/></span>
      <div><h2 id="settings-company-title">Company profile</h2><p>{devices ? "The company behind your store." : "The company behind your facilities."} Edit any step and save to send it for review again.</p></div>
      {company && <StatusBadge status={company.status}/>}
    </div>
    {company?.status === "rejected" && company.admin_notes && <div className="review-feedback"><ShieldCheck/><span><strong>Reviewer feedback</strong>{company.admin_notes}</span></div>}
    {!company && listing && <div className="listing-prefill-note"><ShieldCheck/><span><strong>We started your profile from your map listing</strong>Your name, logo, and location are filled in. Add the rest and submit it for review to get verified.</span></div>}
    {!loaded ? <p className="table-loading"><LoaderCircle className="spin" size={18}/>Loading company profile…</p>
      : <CompanyProfileEditor key={company ? `${company.id}:${company.submitted_at}` : listing ? "listing-company" : "new-company"} company={company} prefill={listing} approved={company?.status === "approved"}
        onSaved={async (message) => { await refreshed(message); window.scrollTo({ top: 0, behavior: "smooth" }); }} onMediaChanged={refreshed}/>}
  </section>;
}
