import type { Metadata } from "next";
import AuthForm from "@/components/explorer/AuthForm";

export const metadata: Metadata = { title: "Create account", robots: { index: false, follow: false } };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const role = (await searchParams).role === "data-company" ? "supplier" : "buyer";
  return <AuthForm signup defaultRole={role}/>;
}
