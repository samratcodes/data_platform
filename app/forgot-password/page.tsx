import type { Metadata } from "next";
import ForgotPasswordPanel from "@/components/explorer/ForgotPasswordPanel";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return <ForgotPasswordPanel/>;
}
