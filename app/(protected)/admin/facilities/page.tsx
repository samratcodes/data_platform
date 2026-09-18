import type { Metadata } from "next";
import ApplicationsTable from "@/components/admin/ApplicationsTable";
import { requireAccess } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Facility reviews" };

export default async function FacilityReviewsPage() {
  await requireAccess("/admin/facilities");
  return <ApplicationsTable kind="facility"/>;
}
