import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  Building2,
  Image as ImageIcon,
  Link2,
  Pause,
  Play,
  Warehouse,
  X,
} from "lucide-react";
import type { NodeData } from "./types";

interface MapMediaPreviewProps {
  operator: NodeData;
  onClose: () => void;
}

export default function MapMediaPreview({
  operator,
  onClose,
}: MapMediaPreviewProps) {
  const isFacility = operator.type === "Facility";
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const isVideo = operator.media.kind === "video";

  return (
    <aside className="fm-preview absolute bottom-24 left-4 z-20 w-[min(23rem,calc(100vw-2rem))] animate-preview-in sm:bottom-7 sm:left-6">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/92 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="relative h-44 overflow-hidden">
          <Image
            src={operator.media.src}
            alt={operator.media.alt}
            fill
            sizes="368px"
            className={`object-cover opacity-85 ${isPreviewPlaying ? "animate-media-pan" : ""}`}
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/5 to-transparent" />
          <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-slate-950/75 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur">
            <span className="grid size-5 place-items-center rounded-full bg-blue-500">
              {isVideo ? (
                <Play size={11} fill="currentColor" />
              ) : (
                <ImageIcon size={11} />
              )}
            </span>
            {operator.media.label}
          </span>
          {isVideo ? (
            <button
              type="button"
              aria-pressed={isPreviewPlaying}
              aria-label={
                isPreviewPlaying
                  ? "Pause motion preview"
                  : "Play motion preview"
              }
              onClick={() => setIsPreviewPlaying((value) => !value)}
              className="absolute bottom-3 left-4 grid size-9 place-items-center rounded-full bg-white text-slate-950 shadow-lg transition-transform hover:scale-105"
            >
              {isPreviewPlaying ? (
                <Pause size={16} fill="currentColor" />
              ) : (
                <Play size={16} fill="currentColor" />
              )}
            </button>
          ) : null}
          {isPreviewPlaying ? (
            <span className="absolute bottom-4 left-16 right-4 h-1 overflow-hidden rounded-full bg-white/30">
              <span className="block h-full w-full origin-left animate-media-progress rounded-full bg-blue-300" />
            </span>
          ) : null}
          <button
            type="button"
            aria-label="Close preview"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full bg-slate-950/70 p-2 text-white backdrop-blur hover:bg-slate-950"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4">
          <div className="flex items-start gap-3">
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-xl ${isFacility ? "bg-emerald-400/15 text-emerald-300" : "bg-blue-400/15 text-blue-300"}`}
            >
              {isFacility ? <Warehouse size={18} /> : <Building2 size={18} />}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-slate-400">
                {operator.city}, {operator.country}
              </p>
              <h2 className="mt-0.5 truncate text-base font-semibold text-white">
                {operator.name}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                {operator.type} · {operator.modalities.join(" · ")}
              </p>
            </div>
          </div>
          <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-300">
            {operator.profile.description}
          </p>
          <div className="fm-capacity">
            <div><p>Capacity</p><strong>{operator.profile.capacity}</strong><p>Capture availability</p></div>
            <div className="fm-stream-ring"><strong>{operator.modalities.length}</strong><span>streams</span></div>
          </div>
          {operator.company ? (
            <Link
              href={`/operators/${operator.company.slug}`}
              className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2.5 text-xs text-slate-300 transition-colors hover:border-emerald-300"
            >
              <Link2 size={14} className="text-emerald-600" />
              <span>Operated by</span>
              <strong className="ml-auto text-emerald-300">
                {operator.company.name}
              </strong>
              <ArrowUpRight size={14} className="text-emerald-300" />
            </Link>
          ) : null}
          <Link
            href={`/operators/${operator.slug}`}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-blue-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-transform hover:scale-[1.01]"
          >
            View operator profile <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </aside>
  );
}
