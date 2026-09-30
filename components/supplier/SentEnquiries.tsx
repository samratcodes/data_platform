"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, MessageSquare, Webcam } from "lucide-react";
import ChatModal from "@/components/messaging/ChatModal";
import StatusBadge from "@/components/ui/StatusBadge";
import { ProductPhoto } from "@/components/devices/ProductCard";
import { formatRelative } from "@/lib/format";
import { productPageUrl, type SentEnquiry } from "@/lib/devices";
import { DeskEmpty } from "./Desk";

const statusLabels: Record<string, string> = { new: "Sent", replied: "Replied", closed: "Closed" };

/** The enquiries a data company sent to device companies, with the store's reply status and the chat thread. */
export default function SentEnquiries({ enquiries }: { enquiries: SentEnquiry[] }) {
  const router = useRouter();
  const [chat, setChat] = useState<SentEnquiry | null>(null);

  if (!enquiries.length) return <DeskEmpty icon={<Webcam size={18}/>} title="Equip your capture teams" text="Find cameras, wearables, and capture hardware from verified device companies, and send an enquiry straight to the store." action={<Link className="secondary-button" href="/devices">Browse devices<ArrowUpRight size={14}/></Link>}/>;

  return <>
    <ul className="desk-rows sent-rows">{enquiries.map((enquiry) => <li key={enquiry.id} data-status={enquiry.status}>
      <Link className="product-row-photo" href={productPageUrl(enquiry.product_id)} aria-label={`View ${enquiry.product_name}`}>
        <ProductPhoto product={{ name: enquiry.product_name, images: enquiry.product_image ? [{ key: enquiry.product_image, name: "", contentType: "" }] : [] }} sizes="56px"/>
      </Link>
      <div className="product-row-copy">
        <Link href={productPageUrl(enquiry.product_id)}><strong>{enquiry.product_name}</strong></Link>
        <small>{enquiry.store_name}{enquiry.quantity ? ` · ${enquiry.quantity.toLocaleString("en-US")} units` : ""}{enquiry.timeline ? ` · ${enquiry.timeline}` : ""}</small>
      </div>
      <time dateTime={enquiry.updated_at}>{formatRelative(enquiry.updated_at)}</time>
      <StatusBadge status={enquiry.status} label={statusLabels[enquiry.status]}/>
      <div className="product-row-actions">
        {enquiry.conversation_id
          ? <button type="button" className="icon-button" onClick={() => setChat(enquiry)} aria-label={`Open the conversation about ${enquiry.product_name}`} title="Open conversation"><MessageSquare size={15}/></button>
          : <Link className="icon-button" href={`${productPageUrl(enquiry.product_id)}#enquire`} aria-label={`Follow up on ${enquiry.product_name}`} title="Follow up"><MessageSquare size={15}/></Link>}
      </div>
    </li>)}</ul>
    {chat?.conversation_id && <ChatModal existingId={chat.conversation_id} title={`${chat.store_name} · ${chat.product_name}`} onClose={() => { setChat(null); router.refresh(); }}/>}
  </>;
}
