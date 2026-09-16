"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Check, ChevronUp } from "lucide-react";
import { api } from "@/lib/api-client";

export default function ConciergeForm({ onError }: { onError: (message: string) => void }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  return <div className="concierge-block">
    <button type="button" className="concierge-trigger" aria-expanded={open} onClick={() => setOpen((value) => !value)}><span><Image src="/brand-logo.png" alt="" width={25} height={25}/></span><span><strong>Hire the FileMarket team</strong><small>Verified data sourcing with no FileMarket commission</small></span>{open ? <ChevronUp size={16}/> : <ArrowUpRight size={16}/>}</button>
    {sent ? <span className="concierge-success"><Check size={14}/> Brief sent. We&apos;ll contact you at your registered email as soon as possible.</span> : open && <>
      <p>We make sourcing easy: share what you need and we handle the provider search, diligence, and coordination.</p>
      <form className="concierge-form" onSubmit={async (event) => {
        event.preventDefault(); setBusy(true); onError("");
        const values = Object.fromEntries(new FormData(event.currentTarget));
        try { await api("/api/concierge", { method: "POST", body: JSON.stringify(values) }); setSent(true); }
        catch (reason) { onError((reason as Error).message); } finally { setBusy(false); }
      }}>
        <label>Project brief<textarea name="brief" required minLength={20} maxLength={4000} placeholder="Describe the data, geography, scale, quality bar, and intended use…"/></label>
        <div><label>Budget range <small>Optional</small><input name="budget" maxLength={120} placeholder="e.g. $25k–$50k"/></label><label>Target timeline <small>Optional</small><input name="timeline" maxLength={120} placeholder="e.g. Start within 30 days"/></label></div>
        <button className="primary-button" disabled={busy}>Send brief <ArrowUpRight size={15}/></button>
      </form></>}
  </div>;
}
