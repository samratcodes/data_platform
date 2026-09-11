import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AccountSettings from "@/components/explorer/AccountSettings";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Account settings", robots: { index: false, follow: false } };

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/settings");
  return <AccountSettings user={user}/>;
}
