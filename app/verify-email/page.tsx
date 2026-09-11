import type { Metadata } from "next";
import VerifyEmailPanel from "@/components/explorer/VerifyEmailPanel";

export const metadata: Metadata = { title: "Verify email", robots: { index: false, follow: false } };

export default function VerifyEmailPage() {
  return <VerifyEmailPanel/>;
}
