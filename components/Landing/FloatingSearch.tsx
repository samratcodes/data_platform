import { Search, SlidersHorizontal, X } from "lucide-react";
import type { DataModality, OrganizationType } from "./types";

interface FloatingSearchProps {
  isOpen: boolean;
  query: string;
  country: string;
  organizationTypes: OrganizationType[];
  modalities: DataModality[];
  countries: string[];
  onOpen: () => void;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onCountryChange: (country: string) => void;
  onOrganizationTypesChange: (types: OrganizationType[]) => void;
  onModalitiesChange: (modalities: DataModality[]) => void;
  onClear: () => void;
}

const organizationTypes: OrganizationType[] = ["Facility", "Data Company"];
const modalities: DataModality[] = [
  "Egocentric video",
  "Exocentric video",
  "Speech",
  "Images",
];

function toggleValue<T>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export default function FloatingSearch({
  isOpen,
  query,
  country,
  organizationTypes: selectedOrganizationTypes,
  modalities: selectedModalities,
  countries,
  onOpen,
  onClose,
  onQueryChange,
  onCountryChange,
  onOrganizationTypesChange,
  onModalitiesChange,
  onClear,
}: FloatingSearchProps) {
  const selectedFilters =
    Number(country !== "") +
    selectedOrganizationTypes.length +
    selectedModalities.length;

  return (
    <section className="fm-search absolute left-4 right-4 top-[4.25rem] z-50 mx-auto max-w-[29rem] sm:left-1/2 sm:right-auto sm:w-[29rem] sm:-translate-x-1/2">
      <div
        className={`overflow-hidden rounded-xl border border-cyan-200/20 bg-cyan-950/65 shadow-xl shadow-black/30 backdrop-blur-xl transition-[box-shadow,transform] duration-300 ${isOpen ? "shadow-2xl shadow-black/40" : "hover:-translate-y-0.5"}`}
      >
        <div className="relative flex items-center">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 text-slate-500"
          />
          <label htmlFor="network-search" className="sr-only">
            Search companies or countries
          </label>
          <input
            id="network-search"
            type="search"
            value={query}
            onFocus={onOpen}
            onClick={onOpen}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Unified Search and Filter"
            className="h-10 w-full bg-transparent py-2 pl-10 pr-20 text-sm text-white outline-none placeholder:text-slate-300"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onQueryChange("")}
              className="absolute right-10 rounded-lg p-1.5 text-slate-400 hover:bg-white/10"
            >
              <X size={16} />
            </button>
          ) : null}
          <button
            type="button"
            aria-label={isOpen ? "Close filters" : "Open filters"}
            onClick={isOpen ? onClose : onOpen}
            className="absolute right-1.5 grid size-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-blue-500 text-white shadow-lg shadow-cyan-500/20 transition-transform hover:scale-105"
          >
            <SlidersHorizontal size={16} />
            <span className="sr-only">filters</span>
            {selectedFilters > 0 && (
              <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-blue-500 text-[9px] font-bold">
                {selectedFilters}
              </span>
            )}
          </button>
        </div>
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="border-t border-white/10 p-4">
              <div className="mb-5 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Source filters
                </p>
                <button
                  type="button"
                  onClick={onClear}
                  className="text-xs font-semibold text-blue-300 hover:text-blue-200"
                >
                  Clear all
                </button>
              </div>
              <label className="block text-xs font-semibold text-slate-300">
                Country
                <select
                  value={country}
                  onChange={(event) => onCountryChange(event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-white/5 px-2 text-sm font-normal text-white outline-none focus:border-blue-500"
                >
                  <option value="">Everywhere</option>
                  {countries.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
              <fieldset className="mt-5">
                <legend className="mb-2 text-xs font-semibold text-slate-300">
                  Operator type
                </legend>
                <div className="flex flex-wrap gap-2">
                  {organizationTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={selectedOrganizationTypes.includes(type)}
                      onClick={() =>
                        onOrganizationTypesChange(
                          toggleValue(selectedOrganizationTypes, type),
                        )
                      }
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${selectedOrganizationTypes.includes(type) ? "bg-violet-600 text-white shadow-md shadow-violet-500/20" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="mt-5">
                <legend className="mb-2 text-xs font-semibold text-slate-300">
                  Data modality
                </legend>
                <div className="flex flex-wrap gap-2">
                  {modalities.map((modality) => (
                    <button
                      key={modality}
                      type="button"
                      aria-pressed={selectedModalities.includes(modality)}
                      onClick={() =>
                        onModalitiesChange(
                          toggleValue(selectedModalities, modality),
                        )
                      }
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${selectedModalities.includes(modality) ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                    >
                      {modality}
                    </button>
                  ))}
                </div>
              </fieldset>
              <p className="mt-5 rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-blue-50 px-3 py-2.5 text-xs text-slate-600">
                Country borders stay visible. Hover previews red; your selection stays blue.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
