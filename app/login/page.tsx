import type { Metadata } from "next";
import AuthForm from "@/components/explorer/AuthForm";

export const metadata: Metadata = { title: "Log in", robots: { index: false, follow: false } };

export default function LoginPage() { return <AuthForm/>; }
