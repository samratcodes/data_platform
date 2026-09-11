"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, Circle, Database, Eye, EyeOff, Globe2, LoaderCircle, LockKeyhole, ShieldCheck, Store } from "lucide-react";
import { motion } from "framer-motion";
import { useMotionPreference } from "./useMotionPreference";
import PublicNavigationRail from "./PublicNavigationRail";
import { api } from "./model";

export default function AuthForm({ signup = false, defaultRole = "buyer" }: { signup?: boolean; defaultRole?: "buyer" | "supplier" }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"buyer" | "supplier">(defaultRole);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const router = useRouter();
  const reducedMotion = useMotionPreference();
  const strength = [password.length >= 12, password.length >= 16, /[a-z]/.test(password) && /[A-Z]/.test(password), /\d/.test(password), /[^\p{L}\p{N}]/u.test(password)].filter(Boolean).length;
  const strengthLabel = strength >= 4 ? "Strong" : strength >= 2 ? "Good start" : "Needs work";
  return <main className={`sourcing-app auth-page ${signup ? "signup-page" : "login-page"}`}>
    <PublicNavigationRail active={signup ? "signup" : "login"}/>
    <div className="auth-layout">
      <section className="auth-story"><span className="eyebrow"><span className="live-dot"/> A WORLD OF POSSIBILITIES</span><h1>Your next breakthrough<br/>starts with <em>better data.</em></h1><p>Connect your AI to the real world. Discover capture facilities, explore data samples, and find the right partners, anywhere on Earth.</p><div className="auth-orbit"><Globe2 size={180} strokeWidth={.45}/><span/><span/><span/></div><p className="auth-footnote">Built for the teams building what comes next.</p></section>
      <motion.section initial={reducedMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="glass auth-card">
        <span className="eyebrow">YOUR SOURCING WORKSPACE</span><h2>{signup ? "Let’s make connections." : "Welcome back."}</h2><p>{signup ? "Create your account, choose your path, and enter the verified data network." : "Log in to pick up where you left off."}</p>
        {signup && <div className="auth-progress" aria-label="Account setup progress"><span className="active"><b>1</b>Account</span><i/><span><b>2</b>{role === "supplier" ? "Verify" : "Explore"}</span><i/><span><b>3</b>Connect</span></div>}
        <form onSubmit={async (event) => {
          event.preventDefault(); setError("");
          if (signup && password !== confirmation) { setError("Passwords do not match yet."); return; }
          setBusy(true);
          const values = Object.fromEntries(new FormData(event.currentTarget));
          try {
            const result = await api<{ user: { role: string; emailVerifiedAt?: string | null } }>(`/api/auth/${signup ? "signup" : "login"}`, { method: "POST", body: JSON.stringify(values) });
            const next = new URLSearchParams(window.location.search).get("next");
            if (result.user.role !== "admin" && !result.user.emailVerifiedAt) router.push("/verify-email");
            else router.push(next && /^\/(map|dashboard|onboarding|supplier|admin|operators\/[-a-z0-9]+)(\?|$)/.test(next) ? next : result.user.role === "admin" ? "/admin" : result.user.role === "supplier" ? signup ? "/onboarding" : "/supplier" : "/map");
            router.refresh();
          } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to sign in."); setBusy(false); }
        }}>
          {signup && <><div className="role-choice" aria-label="Choose account type"><button type="button" aria-pressed={role === "buyer"} className={role === "buyer" ? "active" : ""} onClick={() => setRole("buyer")}><Database size={18}/><span><strong>Data buyer</strong><small>Discover and source datasets</small></span>{role === "buyer" && <Check size={16}/>}</button><button type="button" aria-pressed={role === "supplier"} className={role === "supplier" ? "active" : ""} onClick={() => setRole("supplier")}><Store size={18}/><span><strong>Data supplier</strong><small>List and verify capabilities</small></span>{role === "supplier" && <Check size={16}/>}</button></div><input type="hidden" name="role" value={role}/><label>Full name<input name="name" required minLength={2} maxLength={80} autoComplete="name" placeholder="Alex Morgan"/></label></>}
          <label>Work email<input name="email" required type="email" maxLength={254} autoComplete="email" placeholder="you@company.com"/></label>
          <label>Password<span className="password-field"><input name="password" required type={showPassword ? "text" : "password"} minLength={signup ? 12 : 1} maxLength={128} autoComplete={signup ? "new-password" : "current-password"} placeholder={signup ? "Create a password (12+ characters)" : "Enter your password"} value={password} onChange={(event) => setPassword(event.target.value)}/><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>
          {signup && <><div className="password-strength" aria-live="polite"><div>{[0, 1, 2, 3, 4].map((item) => <i key={item} className={item < strength ? "filled" : ""}/>)}</div><span>{strengthLabel}</span></div><ul className="password-rules"><li className={password.length >= 12 ? "met" : ""}>{password.length >= 12 ? <Check/> : <Circle/>}At least 12 characters</li><li className={strength >= 3 ? "met" : ""}>{strength >= 3 ? <Check/> : <Circle/>}A varied, memorable phrase</li></ul><label>Confirm password<span className="password-field"><input name="confirmation" required type={showPassword ? "text" : "password"} minLength={12} maxLength={128} autoComplete="new-password" placeholder="Type it once more" value={confirmation} onChange={(event) => setConfirmation(event.target.value)}/>{confirmation && (confirmation === password ? <Check className="field-status valid" size={17}/> : <Circle className="field-status" size={14}/>)}</span></label></>}
          {error && <p role="alert" className="form-error">{error}</p>}
          <button className="primary-button" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin"/> : <>{signup ? "Create account" : "Log in to your workspace"}<ArrowUpRight size={17}/></>}</button>
        </form>
        <p className="auth-switch">{signup ? "Already part of the network?" : "New to map.filemarket?"} <Link href={signup ? "/login" : "/signup"}>{signup ? "Log in" : "Create an account"}</Link></p>
        {!signup && <p className="auth-switch recovery-link"><Link href="/forgot-password">Forgot password?</Link></p>}
        <div className="auth-security-grid"><span><LockKeyhole size={15}/><b>Protected sign-in</b><small>Encrypted credentials and secure sessions</small></span><span><ShieldCheck size={15}/><b>Verified network</b><small>Supplier listings are reviewed</small></span></div>
      </motion.section>
    </div>
  </main>;
}
