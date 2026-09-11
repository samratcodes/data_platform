import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminApplications from "@/components/explorer/AdminApplications";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Facility approvals", robots: { index: false, follow: false } };

export default async function FacilityApprovalsPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/admin/facilities");
  if (user.role !== "admin") redirect("/map");
  return <AdminApplications user={user} kind="facility"/>;
}
