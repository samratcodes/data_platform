"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Bot, ChevronDown, ChevronRight, Crosshair, Database, Factory, Globe2, MapPin, Minus, PanelRightClose, PanelRightOpen, Plus, Search, X } from "lucide-react";
import BuyerFilterSidebar from "./BuyerFilterSidebar";
import BuyerNavigationRail from "./BuyerNavigationRail";
import LandingExperience from "./LandingExperience";
import MapLocationKey from "./MapLocationKey";
import ProfilePanel from "./ProfilePanel";
import { useMotionPreference } from "./useMotionPreference";
import { api, type MapHandle, type PublicOperator, type User, type Workspace } from "./model";

const WorldMap = dynamic(() => import("./WorldMap"), {
  ssr: false,
  loading: () => <div className="map-loading"><Globe2 size={36}/><span>Opening the provider map…</span></div>,
});

const emptyWorkspace: Workspace = { saved: [], requests: [] };

export default function ExplorerApp({ initialUser, operators }: { initialUser: User | null; operators: PublicOperator[] }) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [verification, setVerification] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [modalities, setModalities] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [map, setMap] = useState<MapHandle | null>(null);
  const [selected, setSelected] = useState<PublicOperator | null>(null);
  const [cluster, setCluster] = useState<PublicOperator[] | null>(null);
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [error, setError] = useState("");
  const [expandedSheet, setExpandedSheet] = useState(false);
  const [profileMinimized, setProfileMinimized] = useState(false);
  const [directoryMinimized, setDirectoryMinimized] = useState(false);
  const reducedMotion = useMotionPreference();

  const countries = useMemo(() => [...new Set(operators.map((item) => item.country))].sort(), [operators]);
  const allModalities = useMemo(() => [...new Set(operators.flatMap((item) => item.modalities))].sort(), [operators]);
  const filtered = useMemo(() => operators.filter((item) => {
    const searchable = [item.name, item.city, item.country, item.type, ...item.modalities].join(" ").toLowerCase();
    return searchable.includes(query.trim().toLowerCase())
      && (!country || item.country === country)
      && (!types.length || types.includes(item.type))
      && (!modalities.length || modalities.every((modality) => item.modalities.some((value) => value === modality)))
      && (!verification || item.verificationLevel === verification);
  }), [operators, query, country, types, modalities, verification]);

  const clearFilters = () => {
    setQuery("");
    setCountry("");
    setVerification("");
    setTypes([]);
    setModalities([]);
  };

  const openOperator = useCallback((operator: PublicOperator) => {
    setCluster(null);
    setProfileMinimized(false);
    setSelected(operator);
    map?.flyTo(operator.coordinates, 5, window.innerWidth >= 640 ? { top: 0, right: 430 } : undefined);
  }, [map]);

  const handleMarker = useCallback((items: PublicOperator[]) => {
    setSelected(null);
    setProfileMinimized(false);
    if (items.length === 1) openOperator(items[0]);
    else setCluster(items);
  }, [openOperator]);

  useEffect(() => {
    if (!initialUser) return;
    const controller = new AbortController();
    api<Workspace>("/api/workspace", { signal: controller.signal })
      .then(setWorkspace)
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [initialUser]);

  useEffect(() => {
    if (!map || !initialUser) return;
    const parameters = new URLSearchParams(window.location.search);
    const timer = window.setTimeout(() => {
      if (parameters.get("search") === "1") setFiltersOpen(true);
      const operator = operators.find((item) => item.slug === parameters.get("operator"));
      if (operator) openOperator(operator);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [map, initialUser, openOperator, operators]);

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "/" && !["INPUT", "TEXTAREA"].includes((event.target as HTMLElement).tagName)) {
        event.preventDefault();
        setFiltersOpen(true);
        window.setTimeout(() => document.querySelector<HTMLInputElement>(".buyer-filter-search input")?.focus(), 0);
      }
      if (event.key === "Escape") {
        setFiltersOpen(false);
        setSelected(null);
        setProfileMinimized(false);
        setCluster(null);
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => document.removeEventListener("keydown", keyboard);
  }, []);

  if (!initialUser) return <LandingExperience operators={operators}/>;

  const directoryOperators = cluster || filtered;

  return <main className={`sourcing-app explorer authenticated buyer-map ${expandedSheet ? "sheet-expanded" : ""} ${directoryMinimized ? "directory-collapsed" : ""}`}>
    <WorldMap theme="light" operators={filtered} onReady={setMap} onSelect={handleMarker} onInteract={() => undefined} initialProjection="mercator" showPreviews={false} reducedMotion={!!reducedMotion}/>
    <div className="map-vignette"/>
    <BuyerNavigationRail user={initialUser} active="map" searchActive={filtersOpen} onSearch={() => {
      const opening = !filtersOpen;
      setFiltersOpen(opening);
      if (opening) window.setTimeout(() => document.querySelector<HTMLInputElement>(".buyer-filter-search input")?.focus(), 0);
    }}/>
    <BuyerFilterSidebar
      countries={countries}
      modalityOptions={allModalities}
      open={filtersOpen}
      query={query}
      country={country}
      verification={verification}
      types={types}
      modalities={modalities}
      resultCount={filtered.length}
      onOpenChange={setFiltersOpen}
      onQuery={(value) => { setQuery(value); setSelected(null); setProfileMinimized(false); }}
      onCountry={(value) => { setCountry(value); setSelected(null); }}
      onVerification={(value) => { setVerification(value); setSelected(null); }}
      onToggleType={(value) => { setSelected(null); setTypes((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]); }}
      onToggleModality={(value) => { setSelected(null); setModalities((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]); }}
      onClear={clearFilters}
    />
    <MapLocationKey/>

    <button className={`glass directory-toggle-button ${directoryMinimized ? "is-collapsed" : ""}`} onClick={() => setDirectoryMinimized((minimized) => !minimized)} aria-label={directoryMinimized ? "Open provider directory" : "Minimize provider directory"} aria-expanded={!directoryMinimized} aria-controls="buyer-provider-directory"><PanelRightClose size={17}/></button>
    <AnimatePresence initial={false}>{!directoryMinimized && <motion.aside id="buyer-provider-directory" className="glass directory-panel" initial={reducedMotion ? false : { opacity: 0, x: 18, scale: .985 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 18, scale: .985 }} transition={{ duration: reducedMotion ? 0 : .28, ease: [.22, 1, .36, 1] }}>
      <div className="panel-heading">
        <div><span className="eyebrow">{cluster ? "LOCATION NETWORK" : "DATA DIRECTORY"}</span><h2>{cluster ? cluster[0].city : "Verified providers"}</h2></div>
        <div className="directory-heading-actions">{cluster && <button className="directory-all-button" onClick={() => setCluster(null)}>View all</button>}</div>
      </div>
      <div className="results-summary"><span>{directoryOperators.length} partners</span><span><span className="live-dot"/> {cluster ? cluster[0].country : country || "Worldwide"}</span></div>
      <div className="directory-list">
        {directoryOperators.map((operator) => <button className="provider-card" key={operator.slug} onClick={() => openOperator(operator)}>
          <div><h3>{operator.name}</h3><p><MapPin size={11}/>{operator.city}, {operator.country}</p><div className="provider-trust"><span><BadgeCheck size={11}/>{operator.verificationLevel === "physical" ? "Physically verified" : "Online verified"}</span><em>{operator.type}</em></div><div className="tag-row">{operator.modalities.slice(0, 2).map((item) => <span key={item}>{item}</span>)}</div></div>
          <ChevronRight size={16}/>
        </button>)}
      </div>
      {!directoryOperators.length && <div className="empty-state"><Search size={28}/><h3>No matching providers</h3><p>Try another company, place, or data modality.</p><button className="secondary-button" onClick={clearFilters}>Clear all filters</button></div>}
      <div className="directory-footer">Approved listings · precise locations stay protected</div>
    </motion.aside>}</AnimatePresence>

    <AnimatePresence>{selected && !profileMinimized && <ProfilePanel key={selected.slug} operator={selected} workspace={workspace} onWorkspace={setWorkspace} onError={setError} onExpand={() => setExpandedSheet(true)} onMinimize={() => { setProfileMinimized(true); setExpandedSheet(false); }} onClose={() => { setSelected(null); setProfileMinimized(false); setExpandedSheet(false); }}/>}</AnimatePresence>
    {selected && profileMinimized && <button className="glass profile-restore-tab" onClick={() => setProfileMinimized(false)}><span className={`provider-icon type-${selected.type.toLowerCase().replace(" ", "-")}`}>{selected.type === "Facility" ? <Factory size={18}/> : selected.type === "Robotics" ? <Bot size={18}/> : <Database size={18}/>}</span><span><small>SELECTED PARTNER</small><strong>{selected.name}</strong><em>{selected.city}, {selected.country}</em></span><PanelRightOpen size={17}/></button>}
    {selected && !profileMinimized && <button className="sheet-expand-button" onClick={() => setExpandedSheet(!expandedSheet)}>{expandedSheet ? "Collapse profile" : "Expand profile"}<ChevronDown size={14}/></button>}

    <div className="map-tools"><div className="glass"><button aria-label="Zoom in" onClick={() => map?.zoom(1)}><Plus size={18}/></button><button aria-label="Zoom out" onClick={() => map?.zoom(-1)}><Minus size={18}/></button></div><button className="glass" aria-label="Reset map view" onClick={() => map?.reset()}><Crosshair size={18}/></button></div>
    <footer className="explorer-footer"><div className="network-status"><span className="live-dot"/><strong>VERIFIED NETWORK</strong><span className="footer-divider"/><span><b>{filtered.filter((item) => item.type === "Data Company").length}</b> providers</span><span><b>{filtered.filter((item) => item.type === "Facility").length}</b> facilities</span><span><b>{filtered.filter((item) => item.type === "Robotics").length}</b> robotics</span></div></footer>
    {error && <div className="glass app-toast" role="status"><p>{error}</p><button aria-label="Dismiss notification" onClick={() => setError("")}><X size={16}/></button></div>}
  </main>;
}
