import type { Metadata } from "next";
import CompanyListingForm from "@/components/admin/CompanyListingForm";
import { requireAccess } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Edit device company listing" };

export default async function EditDeviceListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireAccess(`/admin/device-companies/listings/${slug}`);
  return <CompanyListingForm slug={slug}/>;
}
