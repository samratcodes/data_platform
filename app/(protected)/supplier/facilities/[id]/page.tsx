import type { Metadata } from "next";
import { notFound } from "next/navigation";
import FacilityDashboard from "@/components/supplier/FacilityDashboard";
import { requireAccess } from "@/lib/auth/guards";
import { supplierFacilityDashboard } from "@/lib/supplier/queries";

export const metadata: Metadata = { title: "Facility dashboard", robots: { index: false, follow: false } };

export default async function FacilityDashboardPage({ params, searchParams }: PageProps<"/supplier/facilities/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await requireAccess(`/supplier/facilities/${id}`);
  const data = await supplierFacilityDashboard(user.id, id);
  if (!data) notFound();
  return <FacilityDashboard user={user} facility={data.facility} requests={data.requests} updated={query.updated === "1"}/>;
}
