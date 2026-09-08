"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMotionPreference } from "./useMotionPreference";
import { ArrowRight, ArrowUpRight, Bookmark, Building2, Check, ChevronDown, ChevronLeft, ChevronRight, Crosshair, Database, Globe2, Grid2X2, Layers3, LogOut, MapPin, Minus, MousePointer2, Pause, Play, Plus, Search, Sparkles, X } from "lucide-react";
import Brand from "./Brand";
import Modal from "./Modal";
import ProfilePanel from "./ProfilePanel";
import LandingExperience from "./LandingExperience";
import { api, type MapHandle, type PublicOperator, type User, type Workspace } from "./model";

const WorldMap = dynamic(() => import("./WorldMap"), { ssr: false, loading: () => <div className="map-loading"><Globe2 size={36}/><span>Opening the global network…</span></div> });
const emptyWorkspace: Workspace = { saved: [], requests: [] };

export default function ExplorerApp({ initialUser, operators, initialDashboard = false }: { initialUser: User | null; operators: PublicOperator[]; initialDashboard?: boolean }) {
  const [user, setUser] = useState(initialUser);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [modalities, setModalities] = useState<string[]>([]);
  const [filter, setFilter] = useState<"type" | "modality" | "country" | null>(null);
  const [map, setMap] = useState<MapHandle | null>(null);
  const reducedMotion = useMotionPreference();
  const [tourEnabled, setTourEnabled] = useState(true);
  const [tourStep, setTourStep] = useState(0);
  const [showTourCard, setShowTourCard] = useState(false);
  const [directory, setDirectory] = useState(false);
  const [selected, setSelected] = useState<PublicOperator | null>(null);
  const [cluster, setCluster] = useState<PublicOperator[] | null>(null);
  const [gate, setGate] = useState<PublicOperator | null>(null);
  const [menu, setMenu] = useState(false);
  const [dashboard, setDashboard] = useState(initialDashboard && !!initialUser);
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [workspaceLoading, setWorkspaceLoading] = useState(!!initialUser);
  const [error, setError] = useState("");
  const [videoError, setVideoError] = useState(false);
  const [expandedSheet, setExpandedSheet] = useState(false);
  const activeTour = !user && tourEnabled && !reducedMotion && !!map && !directory && !gate && !cluster;
  const filtersRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const tourOperators = useMemo(() => {
    const hubs = ["San Francisco", "Tokyo", "Kathmandu", "London", "Nairobi", "Delhi"];
    return hubs.map((city) => operators.find((operator) => operator.city === city)!).filter(Boolean);
  }, [operators]);
  const currentTour = tourOperators[tourStep % tourOperators.length];
  const countries = useMemo(() => [...new Set(operators.map((item) => item.country))].sort(), [operators]);
  const allModalities = useMemo(() => [...new Set(operators.flatMap((item) => item.modalities))], [operators]);
  const filtered = useMemo(() => operators.filter((item) => {
    const searchable = [item.name, item.city, item.country, item.type, ...item.modalities].join(" ").toLowerCase();
    return searchable.includes(query.trim().toLowerCase()) && (!country || item.country === country) && (!types.length || types.includes(item.type)) && (!modalities.length || modalities.every((modality) => item.modalities.some((value) => value === modality)));
  }), [operators, query, country, types, modalities]);
  const filterCount = types.length + modalities.length + Number(!!country);

  const pauseTour = useCallback(() => { setTourEnabled(false); setShowTourCard(false); }, []);
  const stopTour = useCallback(() => { pauseTour(); map?.stop(); }, [map, pauseTour]);
  const clearFilters = () => { setQuery(""); setCountry(""); setTypes([]); setModalities([]); };
  const openOperator = (operator: PublicOperator) => {
    stopTour(); setCluster(null); setDirectory(false); setMenu(false); setDashboard(false);
    if (user) { setSelected(operator); map?.flyTo(operator.coordinates, 5); }
    else setGate(operator);
  };
  const handleMarker = useCallback((items: PublicOperator[]) => {
    pauseTour(); setSelected(null); setDirectory(false);
    if (items.length === 1) { if (user) setSelected(items[0]); else setGate(items[0]); }
    else setCluster(items);
  }, [pauseTour, user]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    api<Workspace>("/api/workspace", { signal: controller.signal }).then(setWorkspace).catch((reason) => { if (!controller.signal.aborted) setError(reason.message); }).finally(() => { if (!controller.signal.aborted) setWorkspaceLoading(false); });
    return () => controller.abort();
  }, [user]);

  useEffect(() => {
    if (!map || !user) return;
    const slug = new URLSearchParams(window.location.search).get("operator");
    const operator = operators.find((item) => item.slug === slug);
    if (operator) { const timer = setTimeout(() => { setSelected(operator); map.flyTo(operator.coordinates, 5); }, 0); return () => clearTimeout(timer); }
  }, [map, user, operators]);

  useEffect(() => {
    if (selected && map) map.flyTo(selected.coordinates, 5);
  }, [selected, map]);

  useEffect(() => {
    if (!activeTour || !currentTour || !map) return;
    map.flyTo(currentTour.coordinates, 3.5);
    const arrive = setTimeout(() => { setShowTourCard(true); setVideoError(false); }, 1800);
    const advance = setTimeout(() => { setShowTourCard(false); setTourStep((step) => step + 1); }, 6800);
    return () => { clearTimeout(arrive); clearTimeout(advance); };
  }, [activeTour, currentTour, map]);

  useEffect(() => {
    const hide = () => { if (document.hidden) { pauseTour(); map?.stop(); } };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, [pauseTour, map]);

  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!filtersRef.current?.contains(event.target as Node)) setFilter(null); if (!menuRef.current?.contains(event.target as Node)) setMenu(false); };
    const escape = (event: KeyboardEvent) => {
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "/" && !["INPUT", "TEXTAREA"].includes((event.target as HTMLElement).tagName)) { event.preventDefault(); document.querySelector<HTMLInputElement>(".unified-search input")?.focus(); }
      if (event.key === "Escape") { setFilter(null); setMenu(false); setSelected(null); setCluster(null); setDirectory(false); }
    };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);

  if (!user) return <LandingExperience operators={operators}/>;

  return <main className={`sourcing-app explorer authenticated ${expandedSheet ? "sheet-expanded" : ""}`}>
    <WorldMap operators={filtered} onReady={setMap} onSelect={handleMarker} onInteract={pauseTour} reducedMotion={!!reducedMotion}/>
    <div className="map-vignette"/>
    <header className="glass explorer-header">
      <Brand/>
      {user ? <label className="unified-search"><Search size={17}/><input aria-label="Search geography, companies, or facilities" placeholder="Search the world’s data, places, and teams…" value={query} onChange={(event) => { setQuery(event.target.value); setDirectory(true); setSelected(null); }}/><kbd>/</kbd>{query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={14}/></button>}</label> : <nav className="header-links"><button onClick={() => { stopTour(); setDirectory(true); map?.reset(); }}>Explore Data <ArrowUpRight size={14}/></button><span/><Link href="/login">Log In</Link><Link href="/signup" className="primary-button">Sign Up <ArrowRight size={14}/></Link></nav>}
      {user && <div className="user-menu" ref={menuRef}><button className="avatar-button" aria-expanded={menu} onClick={() => setMenu(!menu)}><span>{user.name.split(" ").map((word) => word[0]).slice(0,2).join("")}</span><span className="user-name">{user.name.split(" ")[0]}</span><ChevronDown size={14}/></button><AnimatePresence>{menu && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass avatar-dropdown"><p>{user.name}<small>{user.email}</small></p><button onClick={() => { setDashboard(true); setMenu(false); }}><Grid2X2 size={15}/> My workspace</button><button onClick={() => { setDashboard(true); setMenu(false); }}><Bookmark size={15}/> Saved providers <span>{workspace.saved.length}</span></button><button onClick={async () => { try { await api("/api/auth/logout", { method: "POST" }); setUser(null); setWorkspace(emptyWorkspace); setSelected(null); setDashboard(false); setMenu(false); setTourEnabled(false); } catch (reason) { setError((reason as Error).message); } }}><LogOut size={15}/> Log out</button></motion.div>}</AnimatePresence></div>}
    </header>

    <aside className="glass explorer-rail" aria-label="Explorer navigation">
      <button className={!directory && !dashboard ? "active" : ""} aria-label="Explore globe" onClick={() => { stopTour(); setDirectory(false); setSelected(null); setCluster(null); map?.reset(); }}><Globe2 size={19}/></button>
      <button className={directory ? "active" : ""} aria-label="Open data directory" onClick={() => { stopTour(); setDirectory(!directory); setSelected(null); setCluster(null); }}><Grid2X2 size={18}/></button>
      <button aria-label="Saved providers" onClick={() => { if (user) setDashboard(true); else setGate(operators[0]); }}><Bookmark size={18}/></button><span/>
      <button aria-label="About the network" onClick={() => { setError("This is an illustrative sourcing network. Create an account to explore profiles, save providers, and try sample downloads."); }}><Sparkles size={17}/></button>
    </aside>

    {(user || directory) && <div className="explorer-filters" ref={filtersRef}>
      {!user && <label className="glass guest-search"><Search size={15}/><input aria-label="Search directory" placeholder="Search places, companies, data…" value={query} onChange={(event) => setQuery(event.target.value)}/></label>}
      <div className="filter-row">
        {([['country','Location',country ? 1 : 0],['type','Organization type',types.length],['modality','Data modality',modalities.length]] as const).map(([key,label,count]) => <div className="filter-wrap" key={key}><button className={`glass filter-button ${count ? "selected" : ""}`} aria-expanded={filter === key} onClick={() => { stopTour(); setFilter(filter === key ? null : key); }}>{key === "country" ? <MapPin size={14}/> : key === "type" ? <Building2 size={14}/> : <Layers3 size={14}/>} {key === "country" && country ? country : label}{count > 0 && key !== "country" && <span>{count}</span>}<ChevronDown size={13}/></button>
          {filter === key && <div className="glass filter-dropdown"><span className="eyebrow">{label}</span>{(key === "country" ? ["All locations", ...countries] : key === "type" ? ["Data Company", "Facility"] : allModalities).map((value) => {
            const checked = key === "country" ? (country || "All locations") === value : (key === "type" ? types : modalities).includes(value);
            return <button key={value} aria-pressed={checked} onClick={() => { setSelected(null); if (key === "country") { setCountry(value === "All locations" ? "" : value); setFilter(null); } else { const setter = key === "type" ? setTypes : setModalities; setter((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]); } }}><span className={`checkbox ${checked ? "checked" : ""}`}>{checked && <Check size={11}/>}</span>{value}</button>;
          })}</div>}
        </div>)}
        {filterCount > 0 && <button className="clear-filters" onClick={clearFilters}><X size={13}/> Clear {filterCount}</button>}
      </div>
    </div>}

    {!user && !directory && !cluster && <section className="landing-story"><motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }}><span className="eyebrow"><span className="live-dot"/> REAL WORLD. INFINITE POSSIBILITIES.</span><h1>A world of data.<br/><em>Ready for <br/>what’s next.</em></h1><p>The global sourcing network for AI and robotics. Find the places, partners, and data that bring your models to life.</p><button className="primary-button" onClick={() => { stopTour(); setDirectory(true); map?.reset(); }}>Explore the network <ArrowUpRight size={17}/></button><span className="no-account"><Globe2 size={13}/> A global perspective. No account needed.</span><div className="hero-stats"><div><strong>{operators.length}<span>+</span></strong><small>Data partners</small></div><div><strong>{countries.length}</strong><small>Global hubs</small></div><div><strong>4</strong><small>Data modalities</small></div></div></motion.div></section>}

    {user && !directory && !selected && !cluster && <section className="explorer-welcome"><span className="eyebrow"><span className="live-dot"/> EXPLORER WORKSPACE</span><h1>Your next data partner<br/>is out there.</h1><p>Select a map marker or search the network to get started.</p><button className="text-button" onClick={() => setDirectory(true)}>Browse all {filtered.length} partners <ArrowRight size={15}/></button></section>}

    <AnimatePresence mode="wait">{activeTour && showTourCard && currentTour && <motion.article key={currentTour.slug} className="glass tour-card" initial={{ opacity: 0, y: 16, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: .97 }} transition={{ duration: .32 }}>
      <div className="tour-card-top"><span><span className="live-dot"/> NETWORK SPOTLIGHT</span><span>{String(tourStep % tourOperators.length + 1).padStart(2,"0")} / {String(tourOperators.length).padStart(2,"0")}</span></div>
      <div className="tour-video"><video key={currentTour.slug} autoPlay muted loop playsInline preload="auto" poster={`/demo/${currentTour.modalities.includes("Egocentric video") ? "robotics" : "perception"}.jpg`} src={`/demo/${currentTour.modalities.includes("Egocentric video") ? "robotics" : "perception"}.mp4`} onError={() => setVideoError(true)}/><span className="video-tag"><Play size={10} fill="currentColor"/> {videoError ? "SAMPLE PREVIEW" : "SYNTHETIC DATA SAMPLE"}</span><span className="video-duration">00:05</span></div>
      <div className="tour-card-body"><span className="eyebrow"><MapPin size={12}/> {currentTour.city}, {currentTour.country}</span><h2>{currentTour.name}</h2><p>{currentTour.type === "Facility" ? "Real-world environments for embodied intelligence." : "A new perspective for your next generation of models."}</p><div className="tag-row">{currentTour.modalities.slice(0,2).map((item) => <span key={item}>{item}</span>)}</div><button onClick={() => openOperator(currentTour)}>Discover this partner <ArrowUpRight size={15}/></button></div>
      <motion.div className="tour-progress" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 5, ease: "linear" }}/>
    </motion.article>}</AnimatePresence>

    <AnimatePresence>{(directory || cluster) && <motion.aside className="glass directory-panel" initial={reducedMotion ? false : { opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <div className="panel-heading"><div><span className="eyebrow">{cluster ? "LOCATION NETWORK" : "THE DATA DIRECTORY"}</span><h2>{cluster ? cluster[0].city : "Find your next partner"}</h2></div><button className="icon-button" aria-label="Close directory" onClick={() => { setDirectory(false); setCluster(null); }}><X size={18}/></button></div>
      <div className="results-summary"><span>{(cluster || filtered).length} partners {cluster ? "at this hub" : "in the network"}</span><span><span className="live-dot"/> {cluster ? cluster[0].country : country || "Worldwide"}</span></div>
      <div className="directory-list">{(cluster || filtered).map((operator, index) => <button className="provider-card" key={operator.slug} onClick={() => openOperator(operator)}><span className={`provider-icon icon-${index % 3}`}>{operator.type === "Facility" ? <Building2 size={21}/> : <Database size={21}/>}</span><div><h3>{operator.name}</h3><p><MapPin size={11}/>{operator.city}, {operator.country}</p><div className="tag-row">{operator.modalities.slice(0,2).map((item) => <span key={item}>{item}</span>)}</div></div><ChevronRight size={16}/></button>)}</div>
      {!(cluster || filtered).length && <div className="empty-state"><Search size={28}/><h3>No matches just yet.</h3><p>Try another city, company, or data modality.</p><button className="secondary-button" onClick={clearFilters}>Clear all filters</button></div>}
      <div className="directory-footer"><Globe2 size={13}/> City-level locations · illustrative catalogue</div>
    </motion.aside>}</AnimatePresence>

    <AnimatePresence>{selected && user && <ProfilePanel key={selected.slug} operator={selected} workspace={workspace} onWorkspace={setWorkspace} onError={setError} onExpand={() => setExpandedSheet(true)} onClose={() => { setSelected(null); setExpandedSheet(false); }}/>}</AnimatePresence>
    {selected && user && <button className="sheet-expand-button" onClick={() => setExpandedSheet(!expandedSheet)}>{expandedSheet ? "Collapse profile" : "Expand profile"}<ChevronDown size={14}/></button>}

    <div className="map-tools"><span className="map-coordinate">{activeTour ? currentTour.city.toUpperCase() : "GLOBAL VIEW"}</span><div className="glass"><button aria-label="Zoom in" onClick={() => { stopTour(); map?.zoom(1); }}><Plus size={18}/></button><button aria-label="Zoom out" onClick={() => { stopTour(); map?.zoom(-1); }}><Minus size={18}/></button></div><button className="glass" aria-label="Reset globe" onClick={() => { stopTour(); map?.reset(); }}><Crosshair size={18}/></button></div>

    <footer className="explorer-footer"><div className="network-status"><span className="live-dot"/><strong>GLOBAL NETWORK</strong><span className="footer-divider"/><span><b>{filtered.filter((item) => item.type === "Data Company").length}</b> providers</span><span><b>{filtered.filter((item) => item.type === "Facility").length}</b> facilities</span><span className="network-demo">Illustrative catalogue</span></div>
      {!user ? <div className="glass tour-controls"><span className={`tour-indicator ${activeTour ? "playing" : ""}`}/><div><strong>{activeTour ? "World tour" : "Explore at your pace"}</strong><small>{activeTour ? `Discovering ${currentTour.city}` : reducedMotion ? "Reduced motion enabled" : "Drag the globe or resume the tour"}</small></div><button aria-label="Previous tour location" onClick={() => { setShowTourCard(false); setTourStep((step) => (step - 1 + tourOperators.length) % tourOperators.length); }}><ChevronLeft size={17}/></button><button className="tour-toggle" aria-label={activeTour ? "Pause tour" : "Resume tour"} disabled={!!reducedMotion} onClick={() => { if (activeTour) stopTour(); else { clearFilters(); setDirectory(false); setCluster(null); setTourEnabled(true); } }}>{activeTour ? <Pause size={15} fill="currentColor"/> : <Play size={15} fill="currentColor"/>}</button><button aria-label="Next tour location" onClick={() => { setShowTourCard(false); setTourStep((step) => step + 1); }}><ChevronRight size={17}/></button></div> : <div className="map-instruction"><MousePointer2 size={13}/> Click a marker to explore a hub</div>}
      <div className="map-legend"><span/><small>Data company</small><span/><small>Facility cluster</small></div>
    </footer>

    {gate && <Modal title="Go beyond the map." onClose={() => setGate(null)}><div className="gate-icon"><Layers3 size={29}/></div><p className="modal-description">Get the full picture of <strong>{gate.name}</strong>. Create a free account to explore profiles, preview datasets, and connect with data partners.</p><ul className="gate-benefits"><li><Check size={15}/> Full company & facility profiles</li><li><Check size={15}/> Data previews and sample downloads</li><li><Check size={15}/> A workspace for your next breakthrough</li></ul><Link className="primary-button" href={`/signup?next=${encodeURIComponent(`/map?operator=${gate.slug}`)}`}>Create your account <ArrowUpRight size={16}/></Link><p className="auth-switch">Already have an account? <Link href={`/login?next=${encodeURIComponent(`/map?operator=${gate.slug}`)}`}>Log in</Link></p></Modal>}
    {dashboard && user && <Modal title="Your sourcing workspace" onClose={() => setDashboard(false)} wide><div className="workspace-intro"><div><span className="eyebrow">GOOD TO SEE YOU, {user.name.split(" ")[0].toUpperCase()}</span><h3>Every connection starts here.</h3></div><div><strong>{workspace.saved.length}</strong><span>Saved providers</span></div><div><strong>{workspace.requests.length}</strong><span>Access requests</span></div></div>{workspaceLoading ? <p className="modal-description">Loading your workspace…</p> : <><h3 className="workspace-section-title"><Bookmark size={17}/> Saved providers</h3><div className="saved-grid">{operators.filter((item) => workspace.saved.includes(item.slug)).map((operator) => <button key={operator.slug} onClick={() => openOperator(operator)}><Building2 size={22}/><div><strong>{operator.name}</strong><span>{operator.city}, {operator.country}</span></div><ArrowUpRight size={15}/></button>)}</div>{!workspace.saved.length && <p className="workspace-empty">Your shortlist starts with a discovery. Save a provider from its profile to find it here.</p>}<h3 className="workspace-section-title"><Database size={17}/> Access requests</h3>{workspace.requests.map((item) => <article className="request-row" key={item.id}><div><strong>{operators.find((operator) => operator.slug === item.operator_slug)?.name || item.operator_slug}</strong><p>{item.purpose}</p><small>{item.created_at.slice(0,10)}</small></div><span>{item.status}</span></article>)}{!workspace.requests.length && <p className="workspace-empty">No requests yet. Find a partner and tell them what you’re building.</p>}<p className="demo-note">Requests are stored in your workspace. Provider delivery is not connected.</p></>}</Modal>}
    {error && <div className="glass app-toast" role="status"><p>{error}</p><button aria-label="Dismiss notification" onClick={() => setError("")}><X size={16}/></button></div>}
  </main>;
}
