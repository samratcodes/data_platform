"use client";

import { Check, Clock3, Mail, UserRound, X } from "lucide-react";

export type SupplierAccessRequest = {
  id: string;
  operator_slug: string;
  provider_name: string;
  purpose: string;
  status: string;
  buyer_name: string;
  buyer_email: string;
  created_at: string;
};

type Props = {
  requests: SupplierAccessRequest[];
  busy: string;
  onStatus: (id: string, status: "reviewing" | "accepted" | "declined") => void;
};

export default function SupplierRequests({ requests, busy, onStatus }: Props) {
  return <section className="supplier-requests" aria-labelledby="buyer-requests-title">
    <div className="supplier-heading">
      <div><span className="section-kicker">BUYER PIPELINE</span><h2 id="buyer-requests-title">Data access requests</h2></div>
      <span className="request-count">{requests.length} total</span>
    </div>
    {requests.length === 0 ? <div className="workspace-empty"><Clock3/><div><strong>No access requests yet</strong><p>New buyer requests for your approved listings will appear here.</p></div></div> : <div className="request-list">
      {requests.map((request) => <article key={request.id}>
        <div className="request-person"><span><UserRound/></span><div><strong>{request.buyer_name}</strong><a href={`mailto:${request.buyer_email}`}><Mail/>{request.buyer_email}</a></div><em data-status={request.status.toLowerCase()}>{request.status}</em></div>
        <p className="request-listing">Request for <strong>{request.provider_name}</strong></p>
        <blockquote>{request.purpose}</blockquote>
        <div className="request-footer"><time dateTime={request.created_at}>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(request.created_at))}</time><div className="request-actions"><button disabled={busy === request.id} onClick={() => onStatus(request.id, "reviewing")}><Clock3/>Reviewing</button><button disabled={busy === request.id} onClick={() => onStatus(request.id, "accepted")} className="accept"><Check/>Accept</button><button disabled={busy === request.id} onClick={() => onStatus(request.id, "declined")} className="decline"><X/>Decline</button></div></div>
      </article>)}
    </div>}
  </section>;
}
