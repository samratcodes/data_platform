"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { History, LoaderCircle, Search } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import { api } from "@/lib/api-client";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { AuditEntry } from "@/types/admin";

type Scope = "all" | "supplier_application" | "concierge_request";

const scopes: Array<{ value: Scope; label: string }> = [
  { value: "all", label: "All activity" },
  { value: "supplier_application", label: "Applications" },
  { value: "concierge_request", label: "Leads" },
];

/** A short sentence describing an audit entry, e.g. "approved Acme Data". */
export function describeAction(entry: AuditEntry) {
  const [, verb = entry.action] = entry.action.split(".");
  const target = entry.target_label ?? "a deleted record";
  if (entry.target_type === "concierge_request") return `marked ${target}'s brief as ${verb}`;
  if (verb === "approved") return `approved ${target}${entry.metadata.verificationLevel ? ` (${entry.metadata.verificationLevel})` : ""}`;
  if (verb === "rejected") return `rejected ${target}`;
  return `set ${target} to ${verb}`;
}

const targetHref = (entry: AuditEntry) => entry.target_type === "supplier_application" ? `/admin/applications/${entry.target_id}` : "/admin/leads";

export default function ActivityLog() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    api<{ activity: AuditEntry[] }>("/api/admin/activity").then((data) => setEntries(data.activity)).catch((reason) => setError(reason.message));
  }, []);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (entries ?? []).filter((entry) => (scope === "all" || entry.target_type === scope)
      && (!term || [entry.admin_name, entry.target_label, entry.action, entry.metadata.notes].some((value) => value?.toLowerCase().includes(term))));
  }, [entries, scope, search]);

  return <section className="admin-page-body">
    <PageHeader eyebrow="AUDIT TRAIL" title="Activity log" description="Every review decision and lead update made by an administrator, newest first."/>
    <div className="table-card">
      <div className="table-toolbar">
        <div className="segmented" role="tablist" aria-label="Filter activity">
          {scopes.map(({ value, label }) => <button key={value} type="button" role="tab" aria-selected={scope === value} className={scope === value ? "active" : ""} onClick={() => setScope(value)}>{label}</button>)}
        </div>
        <label className="search-field"><Search size={15} aria-hidden/><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search admin, record, or note" aria-label="Search activity"/></label>
      </div>
      {error && <p className="form-error table-message" role="alert">{error}</p>}
      {!entries && !error && <p className="table-loading"><LoaderCircle className="spin" size={18}/>Loading activity…</p>}
      {entries && !rows.length && <EmptyState icon={<History/>} title="No activity found" description={entries.length ? "Try another filter or search." : "Admin decisions will be recorded here."}/>}
      {rows.length > 0 && <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th scope="col">When</th><th scope="col">Admin</th><th scope="col">Action</th><th scope="col">Record</th><th scope="col">Notes</th></tr></thead>
          <tbody>{rows.map((entry) => <tr key={entry.id}>
            <td data-label="When"><span className="cell-stack"><strong>{formatRelative(entry.created_at)}</strong><small>{formatDateTime(entry.created_at)}</small></span></td>
            <td data-label="Admin">{entry.admin_name}</td>
            <td data-label="Action"><StatusBadge status={entry.action.split(".")[1] ?? entry.action}/></td>
            <td data-label="Record"><span className="cell-stack"><Link className="table-primary-link" href={targetHref(entry)}>{entry.target_label ?? "Deleted record"}</Link><small>{entry.target_type === "concierge_request" ? "Concierge lead" : entry.metadata.applicationKind === "facility" ? "Facility" : "Data company"}</small></span></td>
            <td data-label="Notes" className="cell-notes">{entry.metadata.notes || <span className="cell-muted">—</span>}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </div>
  </section>;
}
