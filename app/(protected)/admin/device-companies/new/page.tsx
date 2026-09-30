import type { Metadata } from "next";
import CompanyListingForm from "@/components/admin/CompanyListingForm";
import { requireAccess } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Add device company" };

export default async function AddDeviceCompanyPage() {
  await requireAccess("/admin/device-companies/new");
  return <CompanyListingForm focus="devices"/>;
}
