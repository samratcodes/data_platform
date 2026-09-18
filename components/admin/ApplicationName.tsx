import Image from "next/image";
import { Building2, Factory } from "lucide-react";
import { assetUrl } from "@/lib/format";
import type { ApplicationKind } from "@/types/admin";

/** Logo (or kind icon) plus name, used in admin tables and headers. */
export default function ApplicationName({ name, kind, logoKey, detail, size = "md" }: { name: string; kind: ApplicationKind; logoKey: string | null; detail?: string | null; size?: "md" | "lg" }) {
  const Icon = kind === "company" ? Building2 : Factory;
  return <span className={`application-name size-${size}`}>
    <span className="application-name-mark" data-kind={kind}>{logoKey ? <Image src={assetUrl(logoKey)} alt="" fill unoptimized sizes="48px"/> : <Icon aria-hidden/>}</span>
    <span className="application-name-copy"><strong>{name}</strong>{detail && <small>{detail}</small>}</span>
  </span>;
}
