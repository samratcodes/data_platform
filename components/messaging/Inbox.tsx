"use client";
import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { api } from "@/lib/api-client";
import ChatModal from "./ChatModal";

type Thread = { id: string; operator_slug: string; product_name: string | null; buyer_name: string; supplier_name: string; latest_message: string | null };
const threadTitle = (thread: Thread) => thread.product_name ? `${thread.product_name} · ${thread.operator_slug.replaceAll("-", " ")}` : thread.operator_slug.replaceAll("-", " ");
export default function Inbox() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState<Thread | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => api<{ conversations: Thread[] }>("/api/conversations", { signal: controller.signal }).then((result) => setThreads(result.conversations)).catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    void refresh();
    const timer = window.setInterval(refresh, 10000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, []);
  return <section className="inbox"><h3><MessageSquare size={18}/> Conversations</h3>{error && <p role="alert">{error}</p>}{!threads.length && !error && <p>No conversations yet. Request data from a provider to start one.</p>}{threads.map((thread) => <button key={thread.id} onClick={() => setSelected(thread)}><strong>{thread.buyer_name} · {thread.supplier_name}</strong><span>{threadTitle(thread)}</span><p>{thread.latest_message || "Start a conversation"}</p></button>)}{selected && <ChatModal existingId={selected.id} title={threadTitle(selected)} onClose={() => setSelected(null)}/>}</section>;
}
