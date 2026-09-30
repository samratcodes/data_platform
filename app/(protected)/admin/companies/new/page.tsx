import type { Metadata } from "next";
import CompanyListingForm from "@/components/admin/CompanyListingForm";
import { requireAccess } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Add data company" };

export default async function AddCompanyPage() {
  await requireAccess("/admin/companies/new");
  return <CompanyListingForm focus="collection"/>;
}
