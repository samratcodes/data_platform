import type { Metadata } from "next";
import ResetPasswordPanel from "@/components/auth/ResetPasswordPanel";

export const metadata: Metadata = { title: "Reset password", robots: { index: false, follow: false } };

export default function ResetPasswordPage() {
  return <ResetPasswordPanel/>;
}
