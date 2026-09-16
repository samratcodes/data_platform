import type { Metadata } from "next";
import AccountSettings from "@/components/account/AccountSettings";
import { requireAccess } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Account settings", robots: { index: false, follow: false } };

export default async function SettingsPage() {
  const user = await requireAccess("/settings");
  return <AccountSettings user={user}/>;
}
