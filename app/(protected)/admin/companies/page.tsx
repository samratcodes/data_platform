import type { Metadata } from "next";
import ApplicationsTable from "@/components/admin/ApplicationsTable";
import { requireAccess } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Data company reviews" };

export default async function CompanyReviewsPage() {
  await requireAccess("/admin/companies");
  return <ApplicationsTable kind="company"/>;
}
