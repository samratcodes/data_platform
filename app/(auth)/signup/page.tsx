import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Create account", robots: { index: false, follow: false } };

// Preserve the original entry point while giving every account type its own URL.
export default function SignupPage() {
  redirect("/signup/data-buyer");
}
