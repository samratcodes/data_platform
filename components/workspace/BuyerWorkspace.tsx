"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Bookmark, Clock3, Database, MessageSquare, Search } from "lucide-react";
import BuyerNavigationRail from "@/components/navigation/BuyerNavigationRail";
import ConciergeForm from "./ConciergeForm";
import Inbox from "@/components/messaging/Inbox";
import { api } from "@/lib/api-client";
import type { PublicOperator, User, Workspace } from "@/types/app";

const emptyWorkspace: Workspace = { saved: [], requests: [] };

export default function BuyerWorkspace({ user, operators }: { user: User; operators: PublicOperator[] }) {
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    api<Workspace>("/api/workspace", { signal: controller.signal })
      .then(setWorkspace)
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const savedOperators = useMemo(() => operators.filter((operator) => workspace.saved.includes(operator.slug)), [operators, workspace.saved]);

  return <main className="sourcing-app buyer-workspace-page">
    <BuyerNavigationRail user={user} active="workspace"/>
    <div className="buyer-workspace-shell">
      <header className="buyer-workspace-header">
        <div><span className="eyebrow">MY WORKSPACE</span><h1>Good to see you, {user.name.split(" ")[0]}.</h1><p>Keep track of providers, requests, and conversations in one place.</p></div>
        <Link className="primary-button" href="/map?search=1"><Search size={16}/>Find providers</Link>
      </header>

      <section className="buyer-workspace-stats" aria-label="Workspace summary">
        <article><Bookmark/><span><strong>{workspace.saved.length}</strong><small>Saved providers</small></span></article>
        <article><Database/><span><strong>{workspace.requests.length}</strong><small>Access requests</small></span></article>
        <article><MessageSquare/><span><strong>Messages</strong><small>Open conversations below</small></span></article>
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="buyer-workspace-grid">
        <section className="buyer-workspace-card saved-providers-card">
          <div className="workspace-card-heading"><div><span><Bookmark size={17}/>SHORTLIST</span><h2>Saved providers</h2></div><Link href="/map">Explore map <ArrowUpRight size={14}/></Link></div>
          {loading ? <p className="workspace-empty">Loading your shortlist…</p> : savedOperators.length ? <div className="saved-grid">{savedOperators.map((operator) => <Link key={operator.slug} href={`/map?operator=${operator.slug}`}><Database size={21}/><div><strong>{operator.name}</strong><span>{operator.city}, {operator.country}</span></div><ArrowUpRight size={15}/></Link>)}</div> : <div className="workspace-empty-state"><Bookmark size={22}/><div><strong>No saved providers yet</strong><p>Open a provider profile from the map and add it to your shortlist.</p></div></div>}
        </section>

        <section className="buyer-workspace-card access-requests-card">
          <div className="workspace-card-heading"><div><span><Clock3 size={17}/>REQUESTS</span><h2>Data access</h2></div></div>
          {loading ? <p className="workspace-empty">Loading requests…</p> : workspace.requests.length ? <div className="workspace-request-list">{workspace.requests.map((item) => <article className="request-row" key={item.id}><div><strong>{operators.find((operator) => operator.slug === item.operator_slug)?.name || item.operator_slug.replaceAll("-", " ")}</strong><p>{item.purpose}</p><small>{new Date(item.created_at).toLocaleDateString()}</small></div><span data-status={item.status}>{item.status}</span></article>)}</div> : <div className="workspace-empty-state"><Database size={22}/><div><strong>No access requests</strong><p>Choose a provider and share what your team needs.</p></div></div>}
        </section>

        <section id="messages" className="buyer-workspace-card messages-card">
          <Inbox/>
        </section>

        <section className="buyer-workspace-card concierge-card">
          <ConciergeForm onError={setError}/>
        </section>
      </div>
    </div>
  </main>;
}
