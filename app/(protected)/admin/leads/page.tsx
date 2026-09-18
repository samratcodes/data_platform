import type { Metadata } from "next";
import LeadsTable from "@/components/admin/LeadsTable";
import { requireAccess } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Concierge leads" };

export default async function LeadsPage() {
  await requireAccess("/admin/leads");
  return <LeadsTable/>;
}
