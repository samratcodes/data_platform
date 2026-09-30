import type { Metadata } from "next";
import CompanyListingForm from "@/components/admin/CompanyListingForm";
import { requireAccess } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Edit incomplete listing" };

export default async function EditListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireAccess(`/admin/companies/listings/${slug}`);
  return <CompanyListingForm slug={slug}/>;
}
