"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, Clock3, Inbox, LoaderCircle, LogIn, MailCheck, MapPinned, RefreshCw, ShieldCheck, UserRoundCog } from "lucide-react";
import PublicNavigationRail from "@/components/navigation/PublicNavigationRail";
import { api } from "@/lib/api-client";
import { homePathFor } from "@/lib/auth/roles";
import type { User } from "@/types/app";

const RESEND_COOLDOWN_SECONDS = 60;
const POLL_INTERVAL_MS = 6_000;

const destinationFor = (user: User) => user.role === "supplier" ? "/onboarding" : homePathFor(user.role);

export default function VerifyEmailPanel() {
  const router = useRouter();
  const invalid = useSearchParams().get("status") === "invalid";
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const [switching, setSwitching] = useState(false);

  const refresh = useCallback(async () => {
    const data = await api<{ user: User | null }>("/api/auth/session");
    setUser(data.user);
    if (data.user?.emailVerifiedAt) setVerified(true);
    return data.user;
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh().catch(() => setUser(null)); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  // The link is usually opened in another tab; notice when that tab verifies the shared session.
  useEffect(() => {
    if (!user || verified) return;
    const poll = window.setInterval(() => { if (document.visibilityState === "visible") void refresh().catch(() => undefined); }, POLL_INTERVAL_MS);
    return () => window.clearInterval(poll);
  }, [user, verified, refresh]);

  useEffect(() => {
    if (!verified || !user) return;
    const redirect = window.setTimeout(() => { router.push(destinationFor(user)); router.refresh(); }, 2_200);
    return () => window.clearTimeout(redirect);
  }, [verified, user, router]);

  useEffect(() => {
    if (!cooldown) return;
    const tick = window.setTimeout(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1_000);
    return () => window.clearTimeout(tick);
  }, [cooldown]);

  const resend = async () => {
    setError(""); setBusy(true);
    try {
      const result = await api<{ ok: boolean; verified?: boolean }>("/api/auth/resend-verification", { method: "POST", body: "{}" });
      if (result.verified) { setVerified(true); return; }
      setSent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to resend the verification email.");
    } finally { setBusy(false); }
  };

  const switchAccount = async () => {
    setSwitching(true);
    try { await api("/api/auth/logout", { method: "POST", body: "{}" }); } catch { /* Still leave this account. */ }
    router.push("/login");
    router.refresh();
  };

  const isCompany = user?.role === "supplier";
  const steps = isCompany
    ? [
      { icon: MailCheck, title: "Verify your email", detail: "Confirms you control this business address." },
      { icon: ShieldCheck, title: "Admin review", detail: "We check your company profile, logo, and documents." },
      { icon: MapPinned, title: "Go live and add facilities", detail: "Your company appears on the map and facilities unlock." },
    ]
    : [
      { icon: MailCheck, title: "Verify your email", detail: "Confirms you control this address." },
      { icon: MapPinned, title: "Explore verified providers", detail: "Save providers, send requests, and chat with partners." },
    ];

  return <main className="sourcing-app auth-page verify-page">
    <PublicNavigationRail/>
    <section className="verify-shell">
      <div className="verify-card" aria-live="polite">
        {user === undefined ? <p className="verify-loading"><LoaderCircle className="spin" size={18}/>Checking your account…</p>

          : verified ? <div className="verify-state verify-state-success">
            <span className="verify-icon is-success"><CheckCircle2/></span>
            <p className="verify-eyebrow">EMAIL VERIFIED</p>
            <h1>You&rsquo;re verified.</h1>
            <p className="verify-lede">{isCompany ? "Taking you to your company profile, where you can track the review." : "Taking you to the map."}</p>
            <Link className="verify-primary" href={user ? destinationFor(user) : "/"}>Continue now<ArrowRight size={17}/></Link>
          </div>

          : !user ? <div className="verify-state">
            <span className="verify-icon"><LogIn/></span>
            <p className="verify-eyebrow">EMAIL VERIFICATION</p>
            <h1>{invalid ? "This link has expired." : "Log in to verify your email."}</h1>
            <p className="verify-lede">{invalid ? "Verification links can only be used once and expire for security. Log in and we’ll send you a fresh one." : "Log in to the account you registered, then request a new verification link if you need one."}</p>
            <Link className="verify-primary" href="/login">Log in<ArrowRight size={17}/></Link>
          </div>

          : <div className="verify-state">
            {invalid && <div className="verify-alert" role="alert"><AlertTriangle size={18}/><span><strong>That link didn&rsquo;t work</strong><small>It may have expired or already been used. Send a fresh link below.</small></span></div>}
            <span className="verify-icon"><Inbox/><i aria-hidden/></span>
            <p className="verify-eyebrow">{isCompany ? "DATA COMPANY APPLICATION" : "ONE LAST STEP"}</p>
            <h1>Check your inbox.</h1>
            <p className="verify-lede">We sent a verification link to <strong className="verify-email">{user.email}</strong>. Open it to {isCompany ? "submit your company for review" : "activate your account"}.</p>

            <div className="verify-actions">
              <button type="button" className="verify-primary" onClick={() => void resend()} disabled={busy || cooldown > 0}>
                {busy ? <LoaderCircle className="spin" size={17}/> : cooldown > 0 ? <Clock3 size={17}/> : <RefreshCw size={17}/>}
                {busy ? "Sending…" : cooldown > 0 ? `Resend available in ${cooldown}s` : sent ? "Send another link" : "Resend verification link"}
              </button>
              <button type="button" className="verify-secondary" onClick={() => void switchAccount()} disabled={switching}>{switching ? <LoaderCircle className="spin" size={16}/> : <UserRoundCog size={16}/>}Use another account</button>
            </div>
            {sent && !error && <p className="verify-feedback" role="status"><CheckCircle2 size={16}/>A fresh link is on its way to {user.email}.</p>}
            {error && <p className="verify-feedback is-error" role="alert"><AlertTriangle size={16}/>{error}</p>}
            <p className="verify-waiting"><span aria-hidden/>This page updates automatically once you&rsquo;ve clicked the link.</p>

            <ul className="verify-tips" aria-label="Can't find the email?">
              <li><strong>Can&rsquo;t find it?</strong> Check spam, promotions, or quarantine folders. Company mail filters sometimes hold new senders.</li>
              <li><strong>Link expired?</strong> Links expire for security. Resend and use the newest email.</li>
            </ul>
          </div>}
      </div>

      {user && !verified && <aside className="verify-journey" aria-label="What happens next">
        <p className="verify-eyebrow">{isCompany ? <><Building2 size={13}/>YOUR APPLICATION</> : "WHAT'S NEXT"}</p>
        <ol>{steps.map(({ icon: Icon, title, detail }, index) => <li key={title} className={index === 0 ? "is-current" : ""}>
          <span><Icon size={17}/></span>
          <div><strong>{title}</strong><small>{detail}</small></div>
        </li>)}</ol>
        <p className="verify-journey-note"><ShieldCheck size={15}/>A verified email is required before saves, requests, chats, supplier applications, and concierge briefs.</p>
      </aside>}
    </section>
  </main>;
}
