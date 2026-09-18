import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";
import { requireAccess } from "@/lib/auth/guards";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAccess("/admin");
  return <AdminShell user={user}>{children}</AdminShell>;
}
