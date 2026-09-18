"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BriefcaseBusiness, LoaderCircle, Mail, Search } from "lucide-react";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import { api } from "@/lib/api-client";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import type { Lead, LeadStatus } from "@/types/admin";

type Filter = LeadStatus | "open" | "all";

const leadStatuses: Array<{ value: LeadStatus; label: string; hint: string }> = [
  { value: "new", label: "New", hint: "Not contacted yet" },
  { value: "contacted", label: "Contacted", hint: "Conversation started" },
  { value: "qualified", label: "Qualified", hint: "Real sourcing opportunity" },
  { value: "closed", label: "Closed", hint: "No further action" },
];
const filters: Array<{ value: Filter; label: string }> = [{ value: "open", label: "Open" }, ...leadStatuses.map(({ value, label }) => ({ value, label })), { value: "all", label: "All" }];
const matchesFilter = (lead: Lead, filter: Filter) => filter === "all" || (filter === "open" ? lead.status !== "closed" : lead.status === filter);

export default function LeadsTable() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("open");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = () => api<{ leads: Lead[] }>("/api/admin/leads").then((data) => setLeads(data.leads));
  useEffect(() => { load().catch((reason) => setError(reason.message)); }, []);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (leads ?? []).filter((lead) => matchesFilter(lead, filter) && (!term || [lead.name, lead.email, lead.brief].some((value) => value.toLowerCase().includes(term))));
  }, [leads, filter, search]);
  const open = leads?.find((lead) => lead.id === openId) ?? null;

  const update = async (lead: Lead, status: LeadStatus) => {
    if (lead.status === status) return;
    setBusy(lead.id); setError("");
    try {
      await api(`/api/admin/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await load();
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(""); }
  };

  return <section className="admin-page-body">
    <PageHeader eyebrow="CONCIERGE" title="Procurement leads" description="Briefs submitted by buyers who asked the FileMarket team to source data for them."/>
    <div className="table-card">
      <div className="table-toolbar">
        <div className="segmented" role="tablist" aria-label="Filter leads">
          {filters.map(({ value, label }) => <button key={value} type="button" role="tab" aria-selected={filter === value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}<b>{(leads ?? []).filter((lead) => matchesFilter(lead, value)).length}</b></button>)}
        </div>
        <label className="search-field"><Search size={15} aria-hidden/><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search buyer or brief" aria-label="Search leads"/></label>
      </div>
      {error && <p className="form-error table-message" role="alert">{error}</p>}
      {!leads && !error && <p className="table-loading"><LoaderCircle className="spin" size={18}/>Loading leads…</p>}
      {leads && !rows.length && <EmptyState icon={<BriefcaseBusiness/>} title="No leads found" description={leads.length ? "Try another filter or search." : "Buyer concierge requests will appear here."}/>}
      {rows.length > 0 && <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th scope="col">Buyer</th><th scope="col">Brief</th><th scope="col">Budget</th><th scope="col">Timeline</th><th scope="col">Received</th><th scope="col">Status</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
          <tbody>{rows.map((lead) => <tr key={lead.id}>
            <td data-label="Buyer"><span className="cell-stack"><strong>{lead.name}</strong><small>{lead.email}</small></span></td>
            <td data-label="Brief" className="cell-notes"><span className="cell-clamp">{lead.brief}</span></td>
            <td data-label="Budget">{lead.budget || <span className="cell-muted">To discuss</span>}</td>
            <td data-label="Timeline">{lead.timeline || <span className="cell-muted">To discuss</span>}</td>
            <td data-label="Received"><span className="cell-stack"><strong>{formatDate(lead.created_at)}</strong><small>{formatRelative(lead.created_at)}</small></span></td>
            <td data-label="Status">
              <label className="select-field compact"><span className="visually-hidden">Status for {lead.name}</span>
                <select value={lead.status} disabled={busy === lead.id} onChange={(event) => void update(lead, event.target.value as LeadStatus)}>{leadStatuses.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select>
              </label>
            </td>
            <td className="cell-action"><button type="button" className="table-action" onClick={() => setOpenId(lead.id)}>Open<ArrowRight size={14}/></button></td>
          </tr>)}</tbody>
        </table>
      </div>}
    </div>

    {open && <Modal title={`Brief from ${open.name}`} onClose={() => setOpenId(null)} wide>
      <div className="lead-detail">
        <div className="lead-detail-meta">
          <StatusBadge status={open.status}/>
          <span>Received {formatDateTime(open.created_at)}</span>
          {open.updated_at !== open.created_at && <span>Updated {formatRelative(open.updated_at)}</span>}
        </div>
        <p className="lead-detail-brief">{open.brief}</p>
        <dl className="review-fields">
          <div className="review-field"><dt>Budget</dt><dd>{open.budget || "To discuss"}</dd></div>
          <div className="review-field"><dt>Timeline</dt><dd>{open.timeline || "To discuss"}</dd></div>
          <div className="review-field"><dt>Buyer</dt><dd>{open.name} · <a href={`mailto:${open.email}`}>{open.email}</a></dd></div>
        </dl>
        <fieldset className="lead-status-options" disabled={busy === open.id}>
          <legend>Update status</legend>
          {leadStatuses.map(({ value, label, hint }) => <button key={value} type="button" className={open.status === value ? "selected" : ""} aria-pressed={open.status === value} onClick={() => void update(open, value)}><strong>{label}</strong><small>{hint}</small></button>)}
        </fieldset>
        <a className="primary-button" href={`mailto:${open.email}?subject=${encodeURIComponent("Your FileMarket sourcing brief")}`}><Mail size={16}/>Email {open.name.split(" ")[0]}</a>
      </div>
    </Modal>}
  </section>;
}
