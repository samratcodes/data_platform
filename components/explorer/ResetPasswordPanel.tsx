"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, LoaderCircle } from "lucide-react";
import PublicNavigationRail from "./PublicNavigationRail";
import { api } from "./model";

export default function ResetPasswordPanel() {
  const token = useSearchParams().get("token") || "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const router = useRouter();
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (redirectTimer.current) clearTimeout(redirectTimer.current);
  }, []);

  return <main className="sourcing-app auth-page">
    <PublicNavigationRail active="login"/>
    <section className="auth-layout compact-auth">
      <form className="glass auth-card recovery-card" onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        const values = Object.fromEntries(new FormData(event.currentTarget));
        try {
          const result = await api<{ user?: { role: string; emailVerifiedAt?: string | null } | null }>("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ ...values, token }) });
          setDone(true);
          const href = result.user?.role === "admin" ? "/admin" : result.user?.emailVerifiedAt ? result.user.role === "supplier" ? "/supplier" : "/map" : "/verify-email";
          redirectTimer.current = setTimeout(() => router.replace(href), 900);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "Unable to reset password.");
        } finally {
          setBusy(false);
        }
      }}>
        <span className="eyebrow">NEW PASSWORD</span>
        <h2>{done ? "Password updated." : "Choose a new password."}</h2>
        <p>{done ? "You are signed in with your new password." : "Use a strong password that you have not used here before."}</p>
        {!done && <>
          <label>New password<input name="password" required type="password" minLength={12} maxLength={128} autoComplete="new-password" placeholder="12+ characters"/></label>
          <label>Confirm password<input name="confirmation" required type="password" minLength={12} maxLength={128} autoComplete="new-password" placeholder="Type it again"/></label>
        </>}
        {done && <p className="form-success"><CheckCircle2 size={15}/> Password changed.</p>}
        {error && <p role="alert" className="form-error">{error}</p>}
        {!done && <button className="primary-button" disabled={busy || !token}>{busy ? <LoaderCircle className="spin"/> : "Update password"}</button>}
        {!token && <p role="alert" className="form-error">This reset link is missing its token.</p>}
        <Link className="auth-back-link" href="/login"><ArrowLeft size={15}/> Back to login</Link>
      </form>
    </section>
  </main>;
}
