import Link from "next/link";
import { ArrowLeft, Building2, Clock3, LockKeyhole } from "lucide-react";
import type { SupplierCompany } from "@/types/supplier";

/** Shown in place of the facility form until the supplier's data company is approved. */
export default function FacilityLocked({ company }: { company: SupplierCompany | null }) {
  const rejected = company?.status === "rejected";
  return <section className="facility-locked" aria-labelledby="facility-locked-title">
    <span className="facility-locked-icon">{company ? <Clock3/> : <LockKeyhole/>}</span>
    <span className="page-header-eyebrow">FACILITY APPLICATION</span>
    <h1 id="facility-locked-title">{!company ? "Add your company profile first" : rejected ? "Your company profile needs an update" : "Facility applications unlock after company approval"}</h1>
    <p>{!company
      ? "Facilities belong to a verified data company. Complete your company profile, and facility applications unlock as soon as it is approved."
      : rejected
        ? company.admin_notes || "Review the feedback on your company profile and submit it again. Facility applications unlock after approval."
        : `${company.business_name} is being reviewed by our team. You can apply for facilities as soon as it is approved, and we will email you when it is.`}</p>
    <div className="facility-locked-actions">
      <Link className="primary-button" href="/onboarding"><Building2 size={16}/>{!company ? "Complete company profile" : rejected ? "Update company profile" : "View company profile"}</Link>
      <Link className="secondary-button" href="/supplier/facilities"><ArrowLeft size={16}/>Back to facilities</Link>
    </div>
  </section>;
}
