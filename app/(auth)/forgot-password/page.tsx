import type { Metadata } from "next";
import ForgotPasswordPanel from "@/components/auth/ForgotPasswordPanel";
import { redirectSignedInUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false, follow: false } };

export default async function ForgotPasswordPage() {
  await redirectSignedInUser();
  return <ForgotPasswordPanel/>;
}
