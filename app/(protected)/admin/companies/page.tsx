import type { Metadata } from "next";
import AdminApplications from "@/components/admin/AdminApplications";
import { requireAccess } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Data company approvals", robots: { index: false, follow: false } };

export default async function CompanyApprovalsPage() {
  const user = await requireAccess("/admin/companies");
  return <AdminApplications user={user} kind="company"/>;
}
