"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, MessageSquare, Send } from "lucide-react";
import Modal from "./Modal";
import { api, type PublicOperator } from "./model";

type Message = { id: string; body: string; created_at: string; sender_name: string };

export default function ChatModal({ operator, existingId, title, onClose }: { operator?: PublicOperator; existingId?: string; title?: string; onClose: () => void }) {
  const [conversationId, setConversationId] = useState("");
  const activeConversationId = existingId || conversationId;
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const fetchMessages = useCallback((id: string) =>
    api<{ messages: Message[] }>(`/api/conversations?id=${encodeURIComponent(id)}`), []);

  useEffect(() => {
    const controller = new AbortController();
    if (existingId) {
      fetchMessages(existingId)
        .then((result) => { if (!controller.signal.aborted) setMessages(result.messages); })
        .catch((reason) => { if (!controller.signal.aborted) setError(reason.message); })
        .finally(() => { if (!controller.signal.aborted) setBusy(false); });
      return () => controller.abort();
    }
    if (!operator) return;
    api<{ id: string }>("/api/conversations", { method: "POST", body: JSON.stringify({ action: "start", slug: operator.slug }), signal: controller.signal })
      .then(async ({ id }) => {
        const result = await fetchMessages(id);
        if (!controller.signal.aborted) { setConversationId(id); setMessages(result.messages); }
      })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [operator, existingId, fetchMessages]);

  useEffect(() => {
    if (!activeConversationId) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) fetchMessages(activeConversationId)
        .then((result) => setMessages(result.messages))
        .catch((reason) => setError(reason.message));
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeConversationId, fetchMessages]);

  return <Modal title={title || `Message ${operator?.name || "provider"}`} onClose={onClose}>
    <div className="chat-thread">{busy && <p className="loading-inline"><LoaderCircle className="spin"/>Opening a secure conversation…</p>}{error && <div className="chat-unavailable"><MessageSquare/><p>{error}</p></div>}{messages.map((message) => <article key={message.id}><strong>{message.sender_name}</strong><p>{message.body}</p><time>{new Date(message.created_at).toLocaleString()}</time></article>)}{!busy && !error && messages.length === 0 && <p className="workspace-empty">Start the conversation with a clear description of the data you need.</p>}</div>
    {activeConversationId && <form className="chat-compose" onSubmit={async (event) => {
      event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const message = data.get("message"); setBusy(true); setError("");
      try {
        await api("/api/conversations", { method: "POST", body: JSON.stringify({ action: "send", conversationId: activeConversationId, message }) });
        form.reset();
        const result = await fetchMessages(activeConversationId);
        setMessages(result.messages);
      }
      catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
    }}><label><span>Message</span><textarea name="message" required maxLength={4000} placeholder="Share scope, geography, modality, or a clear next step…"/></label><button className="primary-button" disabled={busy}><Send size={15}/>Send</button></form>}
  </Modal>;
}
