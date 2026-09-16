import type { Metadata } from "next";
import DataCompanySignupForm from "@/components/onboarding/DataCompanySignupForm";
import { redirectSignedInUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Register data company", robots: { index: false, follow: false } };

export default async function DataCompanySignupPage() {
  await redirectSignedInUser();
  return <DataCompanySignupForm/>;
}
