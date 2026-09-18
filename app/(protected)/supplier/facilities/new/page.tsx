import type { Metadata } from "next";
import AppNavigationRail from "@/components/navigation/AppNavigationRail";
import FacilityRegistrationForm from "@/components/onboarding/FacilityRegistrationForm";
import FacilityLocked from "@/components/supplier/FacilityLocked";
import { requireAccess } from "@/lib/auth/guards";
import { supplierCompany } from "@/lib/supplier/queries";

export const metadata: Metadata = { title: "Apply for a new facility", robots: { index: false, follow: false } };

export default async function NewFacilityPage() {
  const user = await requireAccess("/supplier/facilities/new");
  const company = await supplierCompany(user.id);
  return <main className="sourcing-app company-signup-page facility-wizard-page">
    <AppNavigationRail user={user} active="facility"/>
    {company?.status === "approved"
      ? <FacilityRegistrationForm companyName={company.business_name}/>
      : <FacilityLocked company={company}/>}
  </main>;
}
