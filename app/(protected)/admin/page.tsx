import type { Metadata } from "next";
import AdminOverview from "@/components/admin/AdminOverview";
import { requireAccess } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Admin overview" };

export default async function AdminPage() {
  const user = await requireAccess("/admin");
  return <AdminOverview name={user.name}/>;
}
