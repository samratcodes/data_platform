import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  Link2,
  MapPin,
  Warehouse,
  X,
} from "lucide-react";
import type { NodeData } from "./types";

interface CityOperatorsPanelProps {
  country: string;
  operators: NodeData[];
  onOperatorPreview: (operator: NodeData) => void;
  onClose: () => void;
}

export default function CityOperatorsPanel({
  country,
  operators,
  onOperatorPreview,
  onClose,
}: CityOperatorsPanelProps) {
  return (
    <aside className="absolute bottom-4 left-4 top-24 z-20 w-[min(22rem,calc(100vw-2rem))] animate-panel-in sm:bottom-8 sm:left-6 sm:top-28">
      <div className="flex h-full max-h-[calc(100dvh-8rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/90 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="border-b border-white/10 bg-slate-900/80 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold text-teal-300"><MapPin size={15} /> {country}</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">Country network</h2>
              <p className="mt-0.5 text-xs text-slate-400">Select a company to inspect its profile</p>
            </div>
            <button type="button" aria-label="Close country panel" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {operators.length ? (
            operators.map((operator) => (
              <article
                key={operator.id}
                className="group flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.045] p-2 transition-all hover:-translate-y-0.5 hover:border-blue-400/60 hover:bg-white/[0.08]"
              >
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-lg ${operator.type === "Facility" ? "bg-emerald-400/15 text-emerald-300" : "bg-blue-400/15 text-blue-300"}`}
                >
                  {operator.type === "Facility" ? (
                    <Warehouse size={18} />
                  ) : (
                    <Building2 size={18} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => onOperatorPreview(operator)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                        {operator.type}
                      </span>
                      <h3 className="mt-0.5 truncate text-sm font-semibold text-white group-hover:text-blue-300">
                        {operator.name}
                      </h3>
                    </button>
                    <Link
                      href={`/operators/${operator.slug}`}
                      aria-label={`View ${operator.name} profile`}
                      className="rounded-lg p-1.5 text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
                    >
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">
                    {operator.area} · {operator.modalities.slice(0, 2).join(", ")}
                  </p>
                  {operator.company ? (
                    <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-emerald-400/10 px-2 py-1 text-[11px] text-slate-300">
                      <Link2 size={12} className="shrink-0 text-emerald-600" />
                      <span className="shrink-0">Operated by</span>
                      <Link
                        href={`/operators/${operator.company.slug}`}
                        className="truncate font-semibold text-emerald-300 hover:underline"
                      >
                        {operator.company.name}
                      </Link>
                    </div>
                  ) : (
                    <Link
                      href={`/operators/${operator.slug}`}
                      className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-300 hover:underline"
                    >
                      <Building2 size={12} /> Company profile
                    </Link>
                  )}
                </div>
              </article>
            ))
          ) : (
            <div className="p-6 text-center text-sm text-slate-400">
              No operators match the selected data filters.
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
