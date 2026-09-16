import type { Metadata } from "next";
import AdminApplications from "@/components/admin/AdminApplications";
import { requireAccess } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Facility approvals", robots: { index: false, follow: false } };

export default async function FacilityApprovalsPage() {
  const user = await requireAccess("/admin/facilities");
  return <AdminApplications user={user} kind="facility"/>;
}
