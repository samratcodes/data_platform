import type { Metadata } from "next";
import AuthForm from "@/components/auth/AuthForm";
import { redirectSignedInUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Create buyer account", robots: { index: false, follow: false } };

export default async function DataBuyerSignupPage() {
  await redirectSignedInUser();
  return <AuthForm signup defaultRole="buyer" lockRole/>;
}
