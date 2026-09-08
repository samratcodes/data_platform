"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Eye, EyeOff, Globe2, LoaderCircle, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { useMotionPreference } from "./useMotionPreference";
import PublicNav from "./PublicNav";
import { api } from "./model";

export default function AuthForm({ signup = false }: { signup?: boolean }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const reducedMotion = useMotionPreference();
  return <main className="sourcing-app auth-page">
    <PublicNav/>
    <div className="auth-layout">
      <section className="auth-story"><span className="eyebrow"><span className="live-dot"/> A WORLD OF POSSIBILITIES</span><h1>Your next breakthrough<br/>starts with <em>better data.</em></h1><p>Connect your AI to the real world. Discover capture facilities, explore data samples, and find the right partners, anywhere on Earth.</p><div className="auth-orbit"><Globe2 size={180} strokeWidth={.45}/><span/><span/><span/></div><p className="auth-footnote">Built for the teams building what comes next.</p></section>
      <motion.section initial={reducedMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="glass auth-card">
        <span className="eyebrow">YOUR SOURCING WORKSPACE</span><h2>{signup ? "Let’s make connections." : "Welcome back."}</h2><p>{signup ? "Create your account to explore the full network." : "Log in to pick up where you left off."}</p>
        <form onSubmit={async (event) => {
          event.preventDefault(); setError(""); setBusy(true);
          const values = Object.fromEntries(new FormData(event.currentTarget));
          try {
            await api(`/api/auth/${signup ? "signup" : "login"}`, { method: "POST", body: JSON.stringify(values) });
            const next = new URLSearchParams(window.location.search).get("next");
            router.push(next && /^\/(map|dashboard|operators\/[-a-z0-9]+)(\?|$)/.test(next) ? next : "/map");
            router.refresh();
          } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to sign in."); setBusy(false); }
        }}>
          {signup && <label>Full name<input name="name" required minLength={2} maxLength={80} autoComplete="name" placeholder="Alex Morgan"/></label>}
          <label>Work email<input name="email" required type="email" maxLength={254} autoComplete="email" placeholder="you@company.com"/></label>
          <label>Password<span className="password-field"><input name="password" required type={showPassword ? "text" : "password"} minLength={10} maxLength={128} autoComplete={signup ? "new-password" : "current-password"} placeholder={signup ? "Create a password (10+ characters)" : "Enter your password"}/><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>
          {error && <p role="alert" className="form-error">{error}</p>}
          <button className="primary-button" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin"/> : <>{signup ? "Create account" : "Log in to your workspace"}<ArrowUpRight size={17}/></>}</button>
        </form>
        <p className="auth-switch">{signup ? "Already part of the network?" : "New to FileMarket?"} <Link href={signup ? "/login" : "/signup"}>{signup ? "Log in" : "Create an account"}</Link></p>
        <div className="auth-security"><ShieldCheck size={15}/> Your workspace. Your connections.</div>
      </motion.section>
    </div>
  </main>;
}
