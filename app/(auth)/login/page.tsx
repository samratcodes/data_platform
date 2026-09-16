import type { Metadata } from "next";
import AuthForm from "@/components/auth/AuthForm";
import { redirectSignedInUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Log in", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  await redirectSignedInUser((await searchParams).next);
  return <AuthForm/>;
}
