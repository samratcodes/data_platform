"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LoaderCircle, MailCheck, RefreshCw } from "lucide-react";
import PublicNavigationRail from "@/components/navigation/PublicNavigationRail";
import { api } from "@/lib/api-client";

export default function VerifyEmailPanel() {
  const searchParams = useSearchParams();
  const invalid = searchParams.get("status") === "invalid";
  const [status, setStatus] = useState(invalid ? "This verification link is invalid or expired." : "Check your email for the verification link.");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return <main className="sourcing-app auth-page">
    <PublicNavigationRail/>
    <section className="auth-layout compact-auth">
      <div className="glass auth-card recovery-card">
        <span className="eyebrow">EMAIL VERIFICATION</span>
        <h2>Verify your email.</h2>
        <p>{status}</p>
        {busy && <p className="loading-inline"><LoaderCircle className="spin"/> Sending a fresh link...</p>}
        {error && <p role="alert" className="form-error">{error}</p>}
        <button className="primary-button" onClick={async () => {
          setError("");
          setBusy(true);
          try {
            await api("/api/auth/resend-verification", { method: "POST", body: JSON.stringify({}) });
            setStatus("A fresh verification link has been sent to your email.");
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Unable to resend verification.");
          } finally {
            setBusy(false);
          }
        }} disabled={busy}>{busy ? <LoaderCircle className="spin"/> : <RefreshCw size={17}/>} Resend link</button>
        <Link className="auth-back-link" href="/login">Use another account</Link>
        <div className="auth-security-grid"><span><MailCheck size={15}/><b>Why this matters</b><small>Verified email is required before saves, requests, chats, supplier applications, and concierge briefs.</small></span></div>
      </div>
    </section>
  </main>;
}
