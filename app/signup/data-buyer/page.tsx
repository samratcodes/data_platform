import type { Metadata } from "next";
import AuthForm from "@/components/explorer/AuthForm";

export const metadata: Metadata = { title: "Create buyer account", robots: { index: false, follow: false } };

export default function DataBuyerSignupPage() {
  return <AuthForm signup defaultRole="buyer" lockRole/>;
}
