"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, MessageSquare, Send } from "lucide-react";
import { api } from "@/lib/api-client";
import { enquiryTimelines, type StoreProduct } from "@/lib/devices";

type Message = { id: string; body: string; created_at: string; sender_id: string; sender_name: string };
type Thread = { id: string; product_id: string | null };

/**
 * The viewer's enquiry about one product. Before anything is sent it is a short enquiry form
 * (quantity, timeline, message) that lands in the store's enquiry pipeline; afterwards it is
 * the chat thread with the store.
 */
export default function ProductChat({ product }: { product: StoreProduct }) {
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [me, setMe] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const thread = useRef<HTMLDivElement>(null);

  const load = useCallback(async (id: string, signal?: AbortSignal) => {
    const result = await api<{ messages: Message[]; me: string }>(`/api/conversations?id=${encodeURIComponent(id)}`, { signal });
    setMessages(result.messages); setMe(result.me);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    api<{ conversations: Thread[] }>("/api/conversations", { signal: controller.signal })
      .then(async (result) => {
        const existing = result.conversations.find((item) => item.product_id === product.id);
        if (!existing) return;
        setConversationId(existing.id);
        await load(existing.id, controller.signal);
      })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [product.id, load]);

  // Links to "#enquire" (the card's Enquire button) land straight in the message box.
  useEffect(() => { if (!loading && window.location.hash === "#enquire") input.current?.focus({ preventScroll: true }); }, [loading]);

  useEffect(() => {
    if (!conversationId) return;
    const timer = window.setInterval(() => { if (!document.hidden) load(conversationId).catch(() => undefined); }, 5000);
    return () => window.clearInterval(timer);
  }, [conversationId, load]);

  useEffect(() => { thread.current?.scrollTo({ top: thread.current.scrollHeight }); }, [messages.length]);

  return <section className="product-chat" id="enquire" aria-labelledby="product-chat-title">
    <div className="product-chat-head">
      <span><MessageSquare size={16}/></span>
      <div><h2 id="product-chat-title">{messages.length ? `Your enquiry with ${product.store.name}` : "Send an enquiry"}</h2><p>{messages.length ? "Follow up here. You can also find this thread on your dashboard." : `Pricing, lead time, bulk orders, or rental: ask ${product.store.name} directly.`}</p></div>
    </div>
    {(loading || messages.length > 0) && <div className="product-chat-thread" ref={thread} aria-live="polite">
      {loading ? <p className="loading-inline"><LoaderCircle className="spin" size={16}/>Loading your conversation…</p>
        : messages.map((message) => <article key={message.id} className={message.sender_id === me ? "is-mine" : ""}>
            <strong>{message.sender_id === me ? "You" : message.sender_name}</strong>
            <p>{message.body}</p>
            <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time>
          </article>)}
    </div>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {!loading && !messages.length
      ? <form className="product-enquiry-form" onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setBusy(true); setError("");
        try {
          const result = await api<{ conversationId: string }>("/api/enquiries", { method: "POST", body: JSON.stringify({ productId: product.id, quantity: String(data.get("quantity") || ""), timeline: data.get("timeline"), message: String(data.get("message") || "").trim() }) });
          setConversationId(result.conversationId);
          await load(result.conversationId);
        } catch (reason) { setError((reason as Error).message); }
        finally { setBusy(false); }
      }}>
        <div className="product-enquiry-fields">
          <label><span>Quantity</span><input name="quantity" type="number" min={1} max={100000} inputMode="numeric" placeholder="e.g. 25"/></label>
          <label><span>Needed</span><select name="timeline" defaultValue=""><option value="">No fixed date</option>{enquiryTimelines.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
        <label><span>Message</span><textarea ref={input} name="message" required minLength={10} maxLength={4000} rows={4} placeholder={`What are you capturing, where, and for how long? Ask about pricing, lead time, bulk orders, or rental of the ${product.name}.`}/></label>
        <div className="product-enquiry-submit"><small>{product.store.name} gets your enquiry by email and replies here.</small><button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16}/> : <><Send size={15}/>Send enquiry</>}</button></div>
      </form>
      : <form className="product-chat-compose" onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const message = String(new FormData(form).get("message") || "").trim();
        if (!message || !conversationId) return;
        setBusy(true); setError("");
        try {
          await api("/api/conversations", { method: "POST", body: JSON.stringify({ action: "send", conversationId, message }) });
          form.reset();
          await load(conversationId);
        } catch (reason) { setError((reason as Error).message); }
        finally { setBusy(false); }
      }}>
        <label><span className="visually-hidden">Message</span><textarea ref={input} name="message" required maxLength={4000} rows={2} placeholder={`Reply to ${product.store.name}…`}/></label>
        <button className="primary-button" disabled={busy || loading}>{busy ? <LoaderCircle className="spin" size={16}/> : <><Send size={15}/>Send</>}</button>
      </form>}
  </section>;
}
