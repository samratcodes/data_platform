"use client";

import { useEffect, useState } from "react";
import { BriefcaseBusiness, Check, CircleDot, Mail, PhoneCall, Sparkles } from "lucide-react";
import { api } from "@/lib/api-client";

type Lead = {
  id: string;
  name: string;
  email: string;
  brief: string;
  budget: string;
  timeline: string;
  status: "new" | "contacted" | "qualified" | "closed";
  created_at: string;
};

export default function AdminLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const load = () => api<{ leads: Lead[] }>("/api/concierge").then((result) => setLeads(result.leads));

  useEffect(() => { load().catch((reason) => setError(reason.message)); }, []);

  const update = async (id: string, status: Lead["status"]) => {
    setBusy(id); setError("");
    try {
      await api("/api/concierge", { method: "PATCH", body: JSON.stringify({ id, status }) });
      await load();
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(""); }
  };

  return <section className="admin-queue admin-leads">
    <div className="supplier-heading"><div><span className="section-kicker">CONCIERGE</span><h2>Procurement briefs</h2></div><span className="request-count">{leads.filter((lead) => lead.status !== "closed").length} active</span></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!leads.length && <div className="workspace-empty"><BriefcaseBusiness/><div><strong>No procurement briefs yet</strong><p>Buyer concierge requests will appear here.</p></div></div>}
    {leads.map((lead) => <article key={lead.id}>
      <div className="lead-header"><div><strong>{lead.name}</strong><a href={`mailto:${lead.email}`}><Mail/>{lead.email}</a></div><em data-status={lead.status}>{lead.status}</em></div>
      <p className="lead-brief">{lead.brief}</p>
      <div className="lead-details"><span><b>Budget</b>{lead.budget || "To discuss"}</span><span><b>Timeline</b>{lead.timeline || "To discuss"}</span></div>
      <div className="admin-actions lead-actions"><button disabled={busy === lead.id} onClick={() => update(lead.id, "new")}><CircleDot/>New</button><button disabled={busy === lead.id} onClick={() => update(lead.id, "contacted")}><PhoneCall/>Contacted</button><button disabled={busy === lead.id} onClick={() => update(lead.id, "qualified")}><Sparkles/>Qualified</button><button disabled={busy === lead.id} onClick={() => update(lead.id, "closed")}><Check/>Closed</button></div>
    </article>)}
  </section>;
}
