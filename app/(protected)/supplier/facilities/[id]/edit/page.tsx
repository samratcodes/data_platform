import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AppNavigationRail from "@/components/navigation/AppNavigationRail";
import FacilityRegistrationForm from "@/components/onboarding/FacilityRegistrationForm";
import FacilityLocked from "@/components/supplier/FacilityLocked";
import { requireAccess } from "@/lib/auth/guards";
import { supplierCompany, supplierFacility } from "@/lib/supplier/queries";

export const metadata: Metadata = { title: "Edit facility", robots: { index: false, follow: false } };

export default async function EditFacilityPage({ params }: PageProps<"/supplier/facilities/[id]/edit">) {
  const { id } = await params;
  const user = await requireAccess(`/supplier/facilities/${id}/edit`);
  const [company, facility] = await Promise.all([supplierCompany(user.id), supplierFacility(user.id, id)]);
  if (!facility) notFound();
  return <main className="sourcing-app company-signup-page facility-wizard-page">
    <AppNavigationRail user={user} active="facility"/>
    {company?.status === "approved"
      ? <FacilityRegistrationForm companyName={company.business_name} facility={facility}/>
      : <FacilityLocked company={company}/>}
  </main>;
}
