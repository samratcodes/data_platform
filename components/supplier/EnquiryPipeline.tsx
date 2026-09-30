"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Inbox as InboxIcon, Mail, MessageSquare, RotateCcw, X } from "lucide-react";
import ChatModal from "@/components/messaging/ChatModal";
import StatusBadge from "@/components/ui/StatusBadge";
import { api } from "@/lib/api-client";
import { formatRelative } from "@/lib/format";
import type { ReceivedEnquiry } from "@/lib/data/products";
import { DeskEmpty } from "./Desk";

const filters = [{ key: "open", label: "Open" }, { key: "new", label: "New" }, { key: "replied", label: "Replied" }, { key: "closed", label: "Closed" }] as const;
type Filter = (typeof filters)[number]["key"];

const initials = (name: string) => name.split(" ").map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
const matches = (enquiry: ReceivedEnquiry, filter: Filter) => filter === "open" ? enquiry.status !== "closed" : enquiry.status === filter;

/** The device company's enquiries from data companies and buyers, as compact rows it can reply to and close. */
export default function EnquiryPipeline({ enquiries, limit }: { enquiries: ReceivedEnquiry[]; limit?: number }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("open");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [chat, setChat] = useState<ReceivedEnquiry | null>(null);
  const shown = enquiries.filter((enquiry) => matches(enquiry, filter));
  const visible = limit ? shown.slice(0, limit) : shown;

  const setStatus = async (id: string, status: "new" | "replied" | "closed") => {
    setBusy(id); setError("");
    try { await api("/api/enquiries", { method: "PATCH", body: JSON.stringify({ id, status }) }); router.refresh(); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(""); }
  };

  if (!enquiries.length) return <DeskEmpty icon={<InboxIcon size={18}/>} title="No enquiries yet" text="When data companies and buyers ask about a product, their enquiry lands here and in your email."/>;

  return <div className="enquiry-pipeline">
    <div className="desk-tabs" role="tablist" aria-label="Filter enquiries">{filters.map((item) => <button key={item.key} type="button" role="tab" aria-selected={filter === item.key} className={filter === item.key ? "selected" : ""} onClick={() => setFilter(item.key)}>
      {item.label}<small>{enquiries.filter((enquiry) => matches(enquiry, item.key)).length}</small>
    </button>)}</div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!visible.length ? <p className="desk-quiet">No {filters.find((item) => item.key === filter)?.label.toLowerCase()} enquiries.</p>
      : <ul className="desk-rows enquiry-rows">{visible.map((enquiry) => {
        const email = `mailto:${enquiry.sender_email}?subject=${encodeURIComponent(`Your enquiry about ${enquiry.product_name}`)}`;
        return <li key={enquiry.id} data-status={enquiry.status}>
          <span className="desk-avatar" aria-hidden="true">{initials(enquiry.sender_company || enquiry.sender_name)}</span>
          <div className="enquiry-body">
            <div className="enquiry-line">
              <strong>{enquiry.sender_company || enquiry.sender_name}</strong>
              <small>{enquiry.sender_company ? `${enquiry.sender_name} · ` : ""}{enquiry.sender_role === "supplier" ? "Data company" : "Buyer"}</small>
              <time dateTime={enquiry.created_at}>{formatRelative(enquiry.created_at)}</time>
            </div>
            <p className="enquiry-about"><b>{enquiry.product_name}</b>{enquiry.quantity ? <span>{enquiry.quantity.toLocaleString("en-US")} units</span> : null}{enquiry.timeline ? <span>{enquiry.timeline}</span> : null}</p>
            <p className="enquiry-message">{enquiry.message}</p>
            <div className="enquiry-actions">
              {enquiry.conversation_id
                ? <button type="button" className="is-primary" onClick={() => setChat(enquiry)}><MessageSquare size={14}/>Reply</button>
                : <a className="is-primary" href={email} onClick={() => { if (enquiry.status === "new") void setStatus(enquiry.id, "replied"); }}><Mail size={14}/>Reply by email</a>}
              {enquiry.conversation_id && <a href={email}><Mail size={14}/>Email</a>}
              {enquiry.status !== "closed"
                ? <button type="button" disabled={busy === enquiry.id} onClick={() => setStatus(enquiry.id, "closed")}><X size={14}/>Close</button>
                : <button type="button" disabled={busy === enquiry.id} onClick={() => setStatus(enquiry.id, "new")}><RotateCcw size={14}/>Reopen</button>}
            </div>
          </div>
          <StatusBadge status={enquiry.status}/>
        </li>;
      })}</ul>}
    {limit && shown.length > limit && <p className="desk-quiet"><Clock3 size={13}/>{shown.length - limit} older {filter === "open" ? "open" : filter} enquiries not shown.</p>}
    {chat?.conversation_id && <ChatModal existingId={chat.conversation_id} title={`${chat.sender_company || chat.sender_name} · ${chat.product_name}`} onClose={() => { setChat(null); router.refresh(); }}/>}
  </div>;
}
