"use client";

import { useState } from "react";
import Image from "next/image";
import { isPublicAsset } from "@/lib/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, KeyRound, LoaderCircle, LogOut, ShieldCheck, UserRound } from "lucide-react";
import AppNavigationRail from "@/components/navigation/AppNavigationRail";
import PageHeader from "@/components/ui/PageHeader";
import { api } from "@/lib/api-client";
import type { User } from "@/types/app";

export default function AccountSettings({ user }: { user: User }) {
  const router = useRouter();
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const resetMessages = () => { setNotice(""); setError(""); };

  return <main className="sourcing-app settings-page">
    <AppNavigationRail user={user} active="settings"/>
    <section className="settings-shell">
      <PageHeader eyebrow="ACCOUNT" title="Settings" description="Keep your profile current and control access to your map.filemarket account."/>
      {(notice || error) && <p className={error ? "form-error settings-message" : "settings-message settings-success"} role="status">{error || notice}</p>}
      <div className="settings-grid">
        <form className="settings-card" onSubmit={async (event) => { event.preventDefault(); resetMessages(); setProfileBusy(true); const name = new FormData(event.currentTarget).get("name"); try { await api("/api/account", { method: "PATCH", body: JSON.stringify({ action: "profile", name }) }); setNotice("Profile name updated."); router.refresh(); } catch (reason) { setError((reason as Error).message); } finally { setProfileBusy(false); } }}>
          <div className="settings-card-heading"><span className={user.companyLogo ? "settings-logo" : undefined}>{user.companyLogo ? <Image src={user.companyLogo} alt="Company logo" fill unoptimized={!isPublicAsset(user.companyLogo)} sizes="44px"/> : <UserRound/>}</span><div><h2>Profile</h2><p>Your account identity and role.</p></div></div>
          {user.role === "supplier" && <p className="fieldset-note">{user.companyLogo ? "Your company logo is shown on your profile." : "Add a company logo to show it on your profile."} <Link href="/onboarding#company-profile">Manage logo and images</Link></p>}
          <label>Full name<input name="name" defaultValue={user.name} required minLength={2} maxLength={80} autoComplete="name"/></label>
          <label>Work email<input value={user.email} readOnly aria-describedby="email-change-note"/></label>
          <p id="email-change-note" className="fieldset-note">Email changes will be available with email verification.</p>
          <div className="account-role"><ShieldCheck/><span><small>Account role</small><strong>{user.role}</strong></span></div>
          <button className="primary-button" disabled={profileBusy}>{profileBusy ? <LoaderCircle className="spin"/> : <><Check/>Save profile</>}</button>
        </form>

        <form className="settings-card" onSubmit={async (event) => { event.preventDefault(); resetMessages(); setPasswordBusy(true); const values = Object.fromEntries(new FormData(event.currentTarget)); try { await api("/api/account", { method: "PATCH", body: JSON.stringify({ action: "password", ...values }) }); event.currentTarget.reset(); setNotice("Password changed. Other sessions have been signed out."); } catch (reason) { setError((reason as Error).message); } finally { setPasswordBusy(false); } }}>
          <div className="settings-card-heading"><span><KeyRound/></span><div><h2>Change password</h2><p>This keeps your current device signed in and revokes every other session.</p></div></div>
          <label>Current password<input name="currentPassword" type="password" required maxLength={128} autoComplete="current-password"/></label>
          <label>New password<input name="newPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label>
          <label>Confirm new password<input name="confirmation" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label>
          <button className="primary-button" disabled={passwordBusy}>{passwordBusy ? <LoaderCircle className="spin"/> : <><KeyRound/>Update password</>}</button>
        </form>
      </div>
      <section className="settings-danger"><div><LogOut/><span><strong>Sign out on every device</strong><small>All browser sessions, including this one, will be revoked.</small></span></div><button disabled={logoutBusy} onClick={async () => { resetMessages(); setLogoutBusy(true); try { await api("/api/account", { method: "PATCH", body: JSON.stringify({ action: "logout-all" }) }); router.push("/login"); router.refresh(); } catch (reason) { setError((reason as Error).message); setLogoutBusy(false); } }}>{logoutBusy ? <LoaderCircle className="spin"/> : "Log out everywhere"}</button></section>
    </section>
  </main>;
}
