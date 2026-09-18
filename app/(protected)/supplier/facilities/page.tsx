import type { Metadata } from "next";
import FacilitiesOverview from "@/components/supplier/FacilitiesOverview";
import { requireAccess } from "@/lib/auth/guards";
import { supplierCompany, supplierListings } from "@/lib/supplier/queries";

export const metadata: Metadata = { title: "Facilities", robots: { index: false, follow: false } };

export default async function FacilitiesPage({ searchParams }: PageProps<"/supplier/facilities">) {
  const [user, params] = await Promise.all([requireAccess("/supplier/facilities"), searchParams]);
  const [company, listings] = await Promise.all([supplierCompany(user.id), supplierListings(user.id)]);
  return <FacilitiesOverview user={user} company={company} facilities={listings.filter((listing) => listing.application_kind === "facility")} notice={typeof params.facility === "string" ? params.facility : undefined}/>;
}
