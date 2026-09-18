import type { Metadata } from "next";
import ActivityLog from "@/components/admin/ActivityLog";
import { requireAccess } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Admin activity" };

export default async function ActivityPage() {
  await requireAccess("/admin/activity");
  return <ActivityLog/>;
}
