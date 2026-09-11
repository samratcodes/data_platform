"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  Compass,
  Crosshair,
  Minus,
  Plus,
  Radio,
  Warehouse,
  Grid2X2,
  Home,
  UserRound,
} from "lucide-react";
import CityOperatorsPanel from "./CityOperatorsPanel";
import FloatingNav from "./FloatingNav";
import FloatingSearch from "./FloatingSearch";
import MapMediaPreview from "./MapMediaPreview";
import { cities, countries as catalogueCountries, nodes } from "./realNodes";
import type {
  CityData,
  DataModality,
  NodeData,
  OrganizationType,
} from "./types";

const MapComponent = dynamic(() => import("./MapComponent"), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      className="grid h-full place-items-center bg-slate-950 text-sm text-slate-400"
    >
      Loading the sourcing map...
    </div>
  ),
});

interface MapControls {
  zoomIn: () => void;
  zoomOut: () => void;
  flyTo: (
    center: [number, number],
    zoom: number,
    options: { duration: number },
  ) => void;
}

export default function NetworkExplorer() {
  const [selectedOperator, setSelectedOperator] = useState<NodeData | null>(
    nodes.find((node) => node.type === "Facility") ?? null,
  );
  const [hoveredCity, setHoveredCity] = useState<CityData | null>(null);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [organizationTypes, setOrganizationTypes] = useState<
    OrganizationType[]
  >([]);
  const [modalities, setModalities] = useState<DataModality[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(true);
  const [countryOptions, setCountryOptions] = useState(catalogueCountries);
  const [map, setMap] = useState<MapControls | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/locations/countries", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Countries unavailable");
        return response.json();
      })
      .then((options: string[]) =>
        setCountryOptions(
          [...new Set([...options, ...catalogueCountries])].sort((a, b) =>
            a.localeCompare(b),
          ),
        ),
      )
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const visibleOperators = useMemo(() => {
    const search = query.trim().toLowerCase();
    return nodes.filter((node) => {
      const searchable = [
        node.name,
        node.city,
        node.country,
        node.area,
        node.type,
        ...node.modalities,
        ...node.profile.dataStreams,
        ...node.profile.captureEnvironments,
      ]
        .join(" ")
        .toLowerCase();
      return (
        (!country || node.country === country) &&
        (!organizationTypes.length || organizationTypes.includes(node.type)) &&
        (!modalities.length ||
          modalities.every((modality) => node.modalities.includes(modality))) &&
        (!search || searchable.includes(search))
      );
    });
  }, [country, modalities, organizationTypes, query]);
  const visibleCities = useMemo(
    () =>
      Object.values(
        visibleOperators.reduce<Record<string, CityData>>(
          (collection, operator) => {
            const key = `${operator.country}/${operator.city}`;
            const baseCity = cities.find(
              (item) =>
                item.city === operator.city &&
                item.country === operator.country,
            );
            if (!baseCity) return collection;
            const city = collection[key] ?? {
              ...baseCity,
              operatorCount: 0,
              facilityCount: 0,
              dataCompanyCount: 0,
            };
            city.operatorCount += 1;
            if (operator.type === "Facility") city.facilityCount += 1;
            else city.dataCompanyCount += 1;
            collection[key] = city;
            return collection;
          },
          {},
        ),
      ),
    [visibleOperators],
  );
  const panelOperators = visibleOperators;
  const totalFacilities = visibleOperators.filter(
    (operator) => operator.type === "Facility",
  ).length;
  const totalDataCompanies = visibleOperators.filter(
    (operator) => operator.type === "Data Company",
  ).length;
  const handleCountryChange = (nextCountry: string) => {
    setCountryOptions((current) =>
      nextCountry && !current.includes(nextCountry)
        ? [...current, nextCountry].sort()
        : current,
    );
    setCountry(nextCountry);
    setSelectedOperator(null);
    setHoveredCity(null);
    setIsSearchOpen(false);
  };
  const previewOperator = (operator: NodeData) => {
    setSelectedOperator(operator);
    setIsSearchOpen(false);
  };
  const clearFilters = () => {
    setQuery("");
    setCountry("");
    setOrganizationTypes([]);
    setModalities([]);
    setSelectedOperator(null);
    setHoveredCity(null);
  };

  return (
    <main className="fm-explorer bg-slate-950 text-white">
      <section className="fm-map-section relative h-[550px] min-h-[550px] overflow-hidden bg-slate-950">
      <div className="absolute inset-0 animate-map-reveal">
        <MapComponent
          cities={visibleCities}
          selectedCity={null}
          hoveredCity={hoveredCity}
          selectedCountry={country}
          onCityHover={setHoveredCity}
          onCountrySelect={handleCountryChange}
          onMapReady={setMap}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_42%,transparent_30%,rgba(226,244,240,0.08)_68%,rgba(219,239,236,0.32)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-44 bg-gradient-to-t from-slate-950/70 to-transparent" />
      <FloatingNav />
      <aside className="absolute bottom-24 left-2 top-24 z-40 hidden w-11 flex-col items-center gap-2 rounded-xl border border-cyan-200/15 bg-slate-950/65 py-3 shadow-2xl shadow-black/30 backdrop-blur-xl sm:flex">
        <button type="button" aria-label="Map overview" className="grid size-8 place-items-center rounded-lg bg-cyan-400/20 text-cyan-200"><Home size={16} /></button>
        <button type="button" onClick={() => document.getElementById("data-directory")?.scrollIntoView({ behavior: "smooth" })} aria-label="Directory view" className="grid size-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"><Grid2X2 size={16} /></button>
        <Link href="/login" aria-label="Profiles" className="grid size-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"><UserRound size={16} /></Link>
        <span className="mt-auto h-px w-6 bg-white/10" />
        <span className="text-[9px] font-bold text-slate-500">?</span>
      </aside>
      <FloatingSearch
        isOpen={isSearchOpen}
        query={query}
        country={country}
        organizationTypes={organizationTypes}
        modalities={modalities}
        countries={countryOptions}
        onOpen={() => setIsSearchOpen(true)}
        onClose={() => setIsSearchOpen(false)}
        onQueryChange={setQuery}
        onCountryChange={handleCountryChange}
        onOrganizationTypesChange={setOrganizationTypes}
        onModalitiesChange={setModalities}
        onClear={clearFilters}
      />
      {country ? (
        <CityOperatorsPanel
          country={country}
          operators={panelOperators}
          onOperatorPreview={previewOperator}
          onClose={() => handleCountryChange("")}
        />
      ) : null}
      {selectedOperator && visibleOperators.some((operator) => operator.id === selectedOperator.id) && (
        <MapMediaPreview
          key={selectedOperator.id}
          operator={selectedOperator}
          onClose={() => setSelectedOperator(null)}
        />
      )}
      <aside className="absolute bottom-4 left-4 z-20 hidden sm:bottom-7 sm:left-6 sm:block">
        <div className="grid grid-cols-3 divide-x divide-cyan-100/15 overflow-hidden rounded-lg border border-cyan-200/20 bg-slate-950/75 shadow-xl shadow-black/30 backdrop-blur-xl">
          <div className="px-3 py-2 sm:px-4 sm:py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-200/70">Global network snapshot</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-white">
              <Radio size={13} className="text-cyan-300" />
              {country || "All countries"}
            </p>
          </div>
          <div className="px-3 py-2 sm:px-4 sm:py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-200/70">
              Total companies
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-slate-800">
              <Building2 size={14} className="text-cyan-300" />
              {totalDataCompanies}
            </p>
          </div>
          <div className="px-3 py-2 sm:px-4 sm:py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-200/70">
              Total facilities
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-slate-800">
              <Warehouse size={14} className="text-teal-300" />
              {totalFacilities}
            </p>
          </div>
        </div>
      </aside>
      <div className="absolute bottom-5 right-4 z-20 flex flex-col gap-2 sm:bottom-7 sm:right-6">
        <div className="flex flex-col overflow-hidden rounded-2xl border border-white/80 bg-white/90 shadow-xl shadow-slate-700/15 backdrop-blur-xl">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => map?.zoomIn()}
            className="grid size-11 place-items-center border-b border-slate-200 text-blue-600 transition-colors hover:bg-blue-50"
          >
            <Plus size={19} />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => map?.zoomOut()}
            className="grid size-11 place-items-center text-blue-600 transition-colors hover:bg-blue-50"
          >
            <Minus size={19} />
          </button>
        </div>
        <button
          type="button"
          aria-label="Return to default map view"
          onClick={() => map?.flyTo([28, 24], 3, { duration: 1.1 })}
          className="grid size-11 place-items-center rounded-2xl border border-white/80 bg-white/90 text-emerald-600 shadow-xl shadow-slate-700/15 backdrop-blur-xl transition-colors hover:bg-emerald-50"
        >
          <Crosshair size={18} />
        </button>
      </div>
      <div className="pointer-events-none absolute inset-x-4 bottom-6 z-10 mx-auto hidden max-w-xl text-center sm:block">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-xs text-slate-300 shadow-lg shadow-black/20 backdrop-blur-xl">
          <Compass size={14} className="text-blue-500" />
          Red previews · Blue stays selected · Select a country to browse operators
        </p>
      </div>
      </section>
      <section id="data-directory" className="border-t border-white/10 bg-slate-950 px-4 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-300">Data directory</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Explore the data directory</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Browse the teams building datasets across real-world environments, from robotics floors to urban capture networks.</p>
            </div>
            <p className="text-sm text-slate-500">{visibleOperators.filter((node) => node.type === "Data Company").length} companies listed</p>
          </div>
          {visibleOperators.every((operator) => operator.type !== "Data Company") && <p className="mt-6 text-center text-sm text-cyan-100">No companies match your filters. <button onClick={clearFilters} className="underline">Clear filters</button></p>}
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleOperators.filter((node) => node.type === "Data Company").map((operator) => (
              <article key={operator.id} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition-colors hover:border-blue-400/50 hover:bg-white/[0.07]">
                <div className="relative h-32 overflow-hidden">
                  <Image src={operator.media.src} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover opacity-55 transition duration-500 group-hover:scale-105 group-hover:opacity-75" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-transparent" />
                  <span className="absolute bottom-3 left-4 grid size-9 place-items-center rounded-xl border border-white/15 bg-slate-950/70 text-blue-300 backdrop-blur"><Building2 size={17} /></span>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-white">{operator.name}</h3>
                      <p className="mt-1 text-xs text-slate-400">{operator.city}, {operator.country}</p>
                    </div>
                    <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-2 py-1 text-[10px] font-semibold text-blue-300">Data company</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {operator.modalities.map((modality) => <span key={modality} className="rounded-md bg-white/10 px-2 py-1 text-[11px] text-slate-300">{modality}</span>)}
                  </div>
                  <Link href={`/operators/${operator.slug}`} className="mt-5 inline-flex items-center text-xs font-semibold text-teal-300 transition-colors hover:text-white">View full profile <ArrowUpRight size={14} className="ml-1" /></Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
