import type { Metadata } from "next";
import ResetPasswordPanel from "@/components/explorer/ResetPasswordPanel";

export const metadata: Metadata = { title: "Reset password", robots: { index: false, follow: false } };

export default function ResetPasswordPage() {
  return <ResetPasswordPanel/>;
}
