"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, MailCheck } from "lucide-react";
import PublicNavigationRail from "@/components/navigation/PublicNavigationRail";
import { api } from "@/lib/api-client";

export default function ForgotPasswordPanel() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return <main className="sourcing-app auth-page">
    <PublicNavigationRail active="login"/>
    <section className="auth-layout compact-auth">
      <form className="glass auth-card recovery-card" onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        setMessage("");
        const email = new FormData(event.currentTarget).get("email");
        try {
          const result = await api<{ message: string }>("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
          setMessage(result.message);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "Unable to start password reset.");
        } finally {
          setBusy(false);
        }
      }}>
        <span className="eyebrow">PASSWORD RECOVERY</span>
        <h2>Reset your password.</h2>
        <p>Enter your account email and we will send a secure reset link if the account exists.</p>
        <label>Work email<input name="email" required type="email" maxLength={254} autoComplete="email" placeholder="you@company.com"/></label>
        {message && <p className="form-success"><MailCheck size={15}/>{message}</p>}
        {error && <p role="alert" className="form-error">{error}</p>}
        <button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin"/> : "Send reset link"}</button>
        <Link className="auth-back-link" href="/login"><ArrowLeft size={15}/> Back to login</Link>
      </form>
    </section>
  </main>;
}
