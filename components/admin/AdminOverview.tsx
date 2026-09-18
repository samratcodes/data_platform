"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Building2, CheckCircle2, Factory, History, Inbox, LoaderCircle, MapPinned, Sheet } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ApplicationName from "./ApplicationName";
import { describeAction } from "./ActivityLog";
import { api } from "@/lib/api-client";
import { formatRelative } from "@/lib/format";
import type { AdminOverview as Overview } from "@/types/admin";

export default function AdminOverview({ name }: { name: string }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Overview>("/api/admin/overview").then(setData).catch((reason) => setError(reason.message));
  }, []);

  const activeLeads = data ? data.leads.new + data.leads.contacted + data.leads.qualified : 0;
  const stats = data ? [
    { href: "/admin/companies", label: "Companies awaiting review", value: data.applications.company.pending, detail: `${data.applications.company.approved} approved · ${data.applications.company.rejected} rejected`, icon: Building2 },
    { href: "/admin/facilities", label: "Facilities awaiting review", value: data.applications.facility.pending, detail: `${data.applications.facility.approved} approved · ${data.applications.facility.rejected} rejected`, icon: Factory },
    { href: "/admin/leads", label: "Active concierge leads", value: activeLeads, detail: `${data.leads.new} new · ${data.leads.closed} closed`, icon: BriefcaseBusiness },
    { href: "/map", label: "Live listings on the map", value: data.liveListings, detail: "Approved companies and facilities", icon: MapPinned },
  ] : [];

  return <section className="admin-page-body">
    <PageHeader eyebrow="ADMIN CONSOLE" title={`Welcome back, ${name.split(" ")[0]}`} description="Review supplier applications, follow up on concierge leads, and keep an eye on platform activity."/>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!data && !error && <p className="table-loading"><LoaderCircle className="spin" size={18}/>Loading overview…</p>}
    {data && <>
      <div className="stat-grid">{stats.map(({ href, label, value, detail, icon: Icon }) => <Link key={label} href={href} className="stat-card">
        <span className="stat-card-icon"><Icon size={18}/></span>
        <strong>{value}</strong>
        <span>{label}</span>
        <small>{detail}</small>
      </Link>)}</div>

      <div className="overview-grid">
        <div className="table-card">
          <div className="card-heading"><h2><Inbox size={17}/>Awaiting review</h2><Link className="text-link" href="/admin/companies">View queues<ArrowRight size={14}/></Link></div>
          {data.pending.length ? <ul className="queue-list">{data.pending.map((item) => <li key={item.id}>
            <Link href={`/admin/applications/${item.id}`}>
              <ApplicationName name={item.business_name} kind={item.application_kind} logoKey={item.logo_key} detail={`${item.application_kind === "company" ? "Data company" : "Facility"} · ${item.applicant_name}`}/>
              <small>{formatRelative(item.submitted_at)}</small>
              <span className="table-action">Review<ArrowRight size={14}/></span>
            </Link>
          </li>)}</ul> : <EmptyState icon={<CheckCircle2/>} title="All caught up" description="There are no applications waiting for review."/>}
        </div>

        <div className="overview-side">
          <div className="table-card">
            <div className="card-heading"><h2><History size={17}/>Recent activity</h2><Link className="text-link" href="/admin/activity">View all<ArrowRight size={14}/></Link></div>
            {data.activity.length ? <ul className="activity-list">{data.activity.map((entry) => <li key={entry.id}>
              <StatusBadge status={entry.action.split(".")[1] ?? entry.action}/>
              <span><strong>{entry.admin_name}</strong> {describeAction(entry)}<small>{formatRelative(entry.created_at)}</small></span>
            </li>)}</ul> : <p className="cell-muted card-body">No admin actions yet.</p>}
          </div>
          <div className="table-card">
            <div className="card-heading"><h2><Sheet size={17}/>Google Sheets sync</h2><StatusBadge status={data.sheetSync.configured ? "approved" : "unverified"} label={data.sheetSync.configured ? "Connected" : "Not configured"}/></div>
            <dl className="sync-counts">{["pending", "processing", "completed", "failed"].map((status) => <div key={status}><dt>{status}</dt><dd>{data.sheetSync.counts[status] ?? 0}</dd></div>)}</dl>
          </div>
        </div>
      </div>
    </>}
  </section>;
}
