import type { Metadata } from "next";
import DataCompanySignupForm from "@/components/explorer/DataCompanySignupForm";

export const metadata: Metadata = { title: "Register data company", robots: { index: false, follow: false } };

export default function DataCompanySignupPage() {
  return <DataCompanySignupForm/>;
}
