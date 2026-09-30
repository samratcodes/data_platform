"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, LoaderCircle, MapPinned, Pencil, Plus, Search, Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import ProviderLogo from "@/components/ui/ProviderLogo";
import { api } from "@/lib/api-client";
import { formatRelative } from "@/lib/format";
import type { IncompleteListing } from "@/types/admin";

/** Where a grey listing stands: waiting for the company to sign in, being completed, or in review. */
function claimState(listing: IncompleteListing) {
  if (listing.application_status === "pending") return { tone: "is-review", label: "Profile in review", detail: listing.owner_email };
  if (listing.application_status === "rejected") return { tone: "is-review", label: "Changes requested", detail: listing.owner_email };
  if (listing.application_id) return { tone: "is-claimed", label: "Profile submitted", detail: listing.owner_email };
  if (listing.owner_email && listing.owner_activated) return { tone: "is-claimed", label: "Signed in · completing profile", detail: listing.owner_email };
  if (listing.owner_email) return { tone: "is-waiting", label: "Not signed in yet", detail: listing.owner_email };
  return { tone: "is-waiting", label: "Email reserved", detail: listing.claim_email };
}

/** Companies on the map as grey pins: added by an admin, or self-registered and published as incomplete. */
export default function IncompleteListings({ segment, onCount }: { segment: "collection" | "devices"; onCount?: (count: number) => void }) {
  const base = segment === "devices" ? "/admin/device-companies" : "/admin/companies";
  const addHref = `${base}/new`;
  const [listings, setListings] = useState<IncompleteListing[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [removing, setRemoving] = useState<IncompleteListing | null>(null);

  const load = () => api<{ listings: IncompleteListing[] }>(`/api/admin/listings?type=${segment}`).then((data) => { setListings(data.listings); onCount?.(data.listings.length); });
  useEffect(() => { load().catch((reason) => setError(reason.message)); }, [segment]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (listings ?? []).filter((listing) => !term || [listing.name, listing.city, listing.country, listing.claim_email ?? "", listing.owner_email ?? ""].some((value) => value.toLowerCase().includes(term)));
  }, [listings, search]);

  const remove = async (listing: IncompleteListing) => {
    setBusy(listing.slug); setError("");
    try { await api(`/api/admin/listings?slug=${encodeURIComponent(listing.slug)}`, { method: "DELETE" }); await load(); setRemoving(null); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(""); }
  };

  return <div className="table-card incomplete-card">
    <div className="table-toolbar">
      <p className="incomplete-intro">Grey pins with a logo, email, and location. Each company signs in with its email through Forgot password, then completes its profile to get verified.</p>
      <div className="table-toolbar-controls">
        <label className="search-field"><Search size={15} aria-hidden/><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, place, or email" aria-label="Search incomplete listings"/></label>
      </div>
    </div>
    {error && <p className="form-error table-message" role="alert">{error}</p>}
    {!listings ? !error && <p className="table-loading"><LoaderCircle className="spin" size={18}/>Loading listings…</p>
      : !listings.length ? <EmptyState icon={<MapPinned/>} title="No incomplete listings yet" description="Add a company with just its logo, email, and location. It appears on the map in grey until the company signs in and gets verified."><Link className="primary-button" href={addHref}><Plus size={15}/>{segment === "devices" ? "Add device company" : "Add company"}</Link></EmptyState>
        : !rows.length ? <EmptyState icon={<Search/>} title="No matches" description="Try a different name, place, or email."/>
          : <ul className="incomplete-list">{rows.map((listing) => {
            const state = claimState(listing);
            const editable = !listing.application_id;
            const removable = editable && !listing.owner_activated;
            return <li key={listing.slug}>
              <ProviderLogo name={listing.name} logo={listing.logo} type={listing.provider_type} size={44} incomplete/>
              <div className="incomplete-copy">
                {editable ? <Link href={`${base}/listings/${listing.slug}`}><strong>{listing.name}</strong></Link> : <strong>{listing.name}</strong>}
                <small>{listing.provider_type === "Device Supplier" ? "Device company" : "Data company"} · {listing.city}, {listing.country} · added {formatRelative(listing.created_at)}</small>
              </div>
              <div className={`incomplete-state ${state.tone}`}><b>{state.label}</b>{state.detail && <small>{state.detail}</small>}</div>
              <div className="incomplete-actions">
                {listing.application_id && <Link className="secondary-button" href={`/admin/applications/${listing.application_id}`}>Review</Link>}
                {editable && <Link className="icon-button" href={`${base}/listings/${listing.slug}`} aria-label={`Edit ${listing.name}`} title="Edit details"><Pencil size={15}/></Link>}
                <Link className="icon-button" href={`/operators/${listing.slug}`} aria-label={`Open ${listing.name}`} title="Open listing"><ExternalLink size={15}/></Link>
                {removable && <button type="button" className="icon-button is-danger" disabled={busy === listing.slug} onClick={() => setRemoving(listing)} aria-label={`Remove ${listing.name}`} title="Remove from map"><Trash2 size={15}/></button>}
              </div>
            </li>;
          })}</ul>}
    {listings && rows.length > 0 && <p className="table-footnote">Showing {rows.length} of {listings.length} incomplete listings</p>}
    {removing && <ConfirmDialog title="Remove listing" message={`Remove ${removing.name} from the map? This deletes the listing and the account created for ${removing.owner_email ?? removing.claim_email ?? "it"}, which has not been used yet.`} busy={busy === removing.slug} onCancel={() => setRemoving(null)} onConfirm={() => void remove(removing)}/>}
  </div>;
}
