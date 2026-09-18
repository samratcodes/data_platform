"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText, Images, Inbox, LoaderCircle, Search } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ApplicationName from "./ApplicationName";
import { api } from "@/lib/api-client";
import { formatDate, formatRelative } from "@/lib/format";
import type { ApplicationKind, ApplicationStatus, ApplicationSummary } from "@/types/admin";

type Filter = ApplicationStatus | "all";
type Sort = "newest" | "oldest" | "name";

const filters: Array<{ value: Filter; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];
const copy: Record<ApplicationKind, { title: string; description: string; noun: string }> = {
  company: { title: "Data companies", description: "Verify company identity, location, public footprint, documents, and capabilities before a company can list facilities.", noun: "company applications" },
  facility: { title: "Facilities", description: "Review each facility's location and photo evidence. A facility can only be approved after its data company.", noun: "facility submissions" },
};

export default function ApplicationsTable({ kind }: { kind: ApplicationKind }) {
  const router = useRouter();
  const [items, setItems] = useState<ApplicationSummary[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("pending");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("newest");

  useEffect(() => {
    const controller = new AbortController();
    api<{ applications: ApplicationSummary[] }>(`/api/admin/applications?kind=${kind}`, { signal: controller.signal })
      .then((data) => setItems(data.applications))
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [kind]);

  const counts = useMemo(() => {
    const result: Record<Filter, number> = { pending: 0, approved: 0, rejected: 0, all: items?.length ?? 0 };
    items?.forEach((item) => { result[item.status] += 1; });
    return result;
  }, [items]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = (items ?? []).filter((item) => (filter === "all" || item.status === filter)
      && (!term || [item.business_name, item.applicant_name, item.applicant_email, item.city, item.country, item.company_name].some((value) => value?.toLowerCase().includes(term))));
    return filtered.sort((a, b) => sort === "name" ? a.business_name.localeCompare(b.business_name)
      : sort === "oldest" ? a.submitted_at.localeCompare(b.submitted_at) : b.submitted_at.localeCompare(a.submitted_at));
  }, [items, filter, search, sort]);

  const reviewHref = (id: string) => `/admin/applications/${id}`;

  return <section className="admin-page-body">
    <PageHeader eyebrow="VERIFICATION QUEUE" title={copy[kind].title} description={copy[kind].description}/>

    <div className="table-card">
      <div className="table-toolbar">
        <div className="segmented" role="tablist" aria-label="Filter by status">
          {filters.map(({ value, label }) => <button key={value} type="button" role="tab" aria-selected={filter === value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}<b>{counts[value]}</b></button>)}
        </div>
        <div className="table-toolbar-controls">
          <label className="search-field"><Search size={15} aria-hidden/><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, applicant, or location" aria-label="Search applications"/></label>
          <label className="select-field"><span className="visually-hidden">Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label="Sort applications"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option></select></label>
        </div>
      </div>

      {error && <p className="form-error table-message" role="alert">{error}</p>}
      {!items && !error && <p className="table-loading"><LoaderCircle className="spin" size={18}/>Loading {copy[kind].noun}…</p>}
      {items && !rows.length && <EmptyState icon={<Inbox/>} title={search ? "No matches" : `No ${filter === "all" ? "" : `${filter} `}${copy[kind].noun}`} description={search ? "Try a different name, email, or location." : filter === "pending" ? "Everything has been reviewed. New submissions will appear here." : undefined}/>}

      {rows.length > 0 && <div className="table-scroll">
        <table className="data-table">
          <thead><tr>
            <th scope="col">{kind === "company" ? "Company" : "Facility"}</th>
            <th scope="col">Applicant</th>
            <th scope="col">Location</th>
            <th scope="col">Evidence</th>
            <th scope="col">Submitted</th>
            <th scope="col">Status</th>
            <th scope="col"><span className="visually-hidden">Actions</span></th>
          </tr></thead>
          <tbody>{rows.map((item) => <tr key={item.id} className="is-clickable" onClick={(event) => { if (!(event.target as HTMLElement).closest("a")) router.push(reviewHref(item.id)); }}>
            <td data-label={kind === "company" ? "Company" : "Facility"}><Link href={reviewHref(item.id)} className="table-primary-link"><ApplicationName name={item.business_name} kind={item.application_kind} logoKey={item.logo_key} detail={kind === "facility" ? item.company_name && `${item.company_name}${item.company_status && item.company_status !== "approved" ? ` · company ${item.company_status}` : ""}` : null}/></Link></td>
            <td data-label="Applicant"><span className="cell-stack"><strong>{item.applicant_name}</strong><small>{item.applicant_email}</small></span></td>
            <td data-label="Location">{item.city || item.country ? `${item.city ?? "—"}, ${item.country ?? "—"}` : <span className="cell-muted">Not provided</span>}</td>
            <td data-label="Evidence"><span className="cell-evidence"><span title="Images"><Images size={14}/>{item.image_count}</span>{kind === "company" && <span title="Documents"><FileText size={14}/>{item.document_count}</span>}</span></td>
            <td data-label="Submitted"><span className="cell-stack"><strong>{formatDate(item.submitted_at)}</strong><small>{formatRelative(item.submitted_at)}</small></span></td>
            <td data-label="Status"><StatusBadge status={item.status}/></td>
            <td className="cell-action"><Link href={reviewHref(item.id)} className="table-action">{item.status === "pending" ? "Review" : "Open"}<ArrowRight size={14}/></Link></td>
          </tr>)}</tbody>
        </table>
      </div>}
      {items && rows.length > 0 && <p className="table-footnote">Showing {rows.length} of {counts.all} {copy[kind].noun}</p>}
    </div>
  </section>;
}
