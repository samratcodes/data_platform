"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import {
  Crosshair, Minus, Plus, ArrowRight, BadgeCheck,
  Building2, ChevronDown, Database, Globe2, Landmark,
  CircleDashed, LogIn, MapPin, PanelRightClose, Scale, Search, ShieldCheck, X, ArrowUpRight, Factory, Package, Webcam
} from "lucide-react";
import MapMetricsHud from "./MapMetricsHud";
import MapLocationKey from "./MapLocationKey";
import Modal from "@/components/ui/Modal";
import PublicNavigationRail from "@/components/navigation/PublicNavigationRail";
import type { MapHandle, MapProjection } from "./types";
import type { PublicOperator } from "@/types/app";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import ProviderLogo from "@/components/ui/ProviderLogo";

const WorldMap = dynamic(() => import("./WorldMap"), {
  ssr: false,
  loading: () => <div className="map-loading light"><Globe2 size={34}/><span>Drawing the global network…</span></div>
});

/**
 * The mark beside each company name: a solid blue tick for physically verified companies, a solid grey tick
 * for online-verified ones, and an empty dashed circle labelled "Incomplete" for grey listings with no verification.
 */
function VerificationMark({ level }: { level?: PublicOperator["verificationLevel"] }) {
  if (level === "physical") return <BadgeCheck className="provider-verification is-physical" role="img" aria-label="Physically verified"><title>Physically verified</title></BadgeCheck>;
  if (level === "online") return <BadgeCheck className="provider-verification is-online" role="img" aria-label="Online verified"><title>Online verified</title></BadgeCheck>;
  return <span className="provider-incomplete-mark" title="Incomplete profile, not verified"><CircleDashed className="provider-verification is-incomplete" aria-hidden/><em>Incomplete</em></span>;
}

/** The signed-out map. Facilities are never sent here: visitors see each company's facility count and log in to reveal them. */
export default function LandingExperience({ operators, facilityTotal }: { operators: PublicOperator[]; facilityTotal: number }) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [modality, setModality] = useState("");
  const [locationType, setLocationType] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [directoryMinimized, setDirectoryMinimized] = useState(false);
  const [gatedOperator, setGatedOperator] = useState<PublicOperator | null>(null);
  const [map, setMap] = useState<MapHandle | null>(null);
  const [projection, setProjection] = useState<MapProjection>("globe");
  const mapSection = useRef<HTMLElement>(null);
  const reducedMotion = useMotionPreference();

  const countries = useMemo(() => [...new Set(operators.map((item) => item.country))].sort(), [operators]);
  const modalities = useMemo(() => [...new Set(operators.flatMap((item) => item.modalities))].sort(), [operators]);

  const filtered = useMemo(() => {
    return operators.filter((operator) => {
      const searchable = [operator.name, operator.city, operator.country, operator.type, ...operator.modalities].join(" ").toLowerCase();
      return searchable.includes(query.trim().toLowerCase()) &&
             (!country || operator.country === country) &&
             (!modality || operator.modalities.some((item) => item === modality)) &&
             (!locationType || operator.type === locationType);
    });
  }, [operators, query, country, modality, locationType]);

  const activeFilters = Number(!!query.trim()) + Number(!!country) + Number(!!modality) + Number(!!locationType);
  const facilityCount = facilityTotal;
  const companyCount = operators.filter((operator) => operator.verificationLevel !== "incomplete" && (operator.type === "Data Company" || operator.type === "Robotics")).length;
  const deviceCompanyCount = operators.filter((operator) => operator.verificationLevel !== "incomplete" && operator.type === "Device Supplier").length;

  const clear = () => { setQuery(""); setCountry(""); setModality(""); setLocationType(""); if (projection === "mercator") map?.reset(); };
  const goToSearch = () => mapSection.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });

  return (
    <main className={`sourcing-app landing-experience ${directoryMinimized ? "directory-collapsed" : ""}`}>
      <PublicNavigationRail active="map" searchActive={filtersOpen} onSearch={() => setFiltersOpen((open) => !open)}/>

      <section ref={mapSection} className="landing-map-section" aria-label="Explore the map">
        <div className="landing-map-fixed">
          <WorldMap theme="light" operators={filtered} onReady={setMap} onSelect={(items) => { if (items.length === 1) setGatedOperator(items[0]); }} onInteract={() => undefined} onProjectionChange={setProjection} reducedMotion={reducedMotion}/>
        </div>

        <MapMetricsHud companies={companyCount} facilities={facilityCount} deviceCompanies={deviceCompanyCount}/>

        <div className={`landing-filter-bar ${filtersOpen ? "is-open" : ""}`} aria-label="Map filters">
          <label className="landing-filter-search"><span>Search network</span><Search size={15}/><input aria-label="Search companies, cities, or data types" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); }} placeholder="Company, city, or data type"/>{query && <button aria-label="Clear network search" onClick={() => setQuery("")}><X size={13}/></button>}</label>
          <label><span>Country</span><Globe2 size={15}/><select aria-label="Country" value={country} onChange={(event) => { const selected = event.target.value; setCountry(selected); if (projection === "mercator") { const target = operators.find((item) => item.country === selected); if (target) map?.flyTo(target.coordinates, 4); else map?.reset(); } }}><option value="">All countries</option>{countries.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14}/></label>
          <label><span>Data type</span><Database size={15}/><select aria-label="Data type" value={modality} onChange={(event) => setModality(event.target.value)}><option value="">All data types</option>{modalities.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14}/></label>
          <label><span>Location type</span><Building2 size={15}/><select aria-label="Location type" value={locationType} onChange={(event) => setLocationType(event.target.value)}><option value="">All provider types</option><option value="Data Company">Data company</option><option value="Device Supplier">Device company</option><option value="Robotics">Robotics</option></select><ChevronDown size={14}/></label>
          {activeFilters > 0 && <button className="landing-filter-clear" onClick={() => { clear(); setFiltersOpen(false); }}><X size={13}/> Clear filters</button>}
          <span className="landing-match-count" aria-live="polite" aria-label={`${filtered.length} verified ${filtered.length === 1 ? "location" : "locations"}`}>{filtered.length} {filtered.length === 1 ? "location" : "locations"}</span>
        </div>
        {query.trim() && <div className="landing-quick-results" aria-label="Search results"><div><span>Verified network</span><strong>{filtered.length} {filtered.length === 1 ? "match" : "matches"}</strong></div>{filtered.slice(0, 4).map((operator) => <button key={operator.slug} onClick={() => { setGatedOperator(operator); map?.flyTo(operator.coordinates, 8); }}><ProviderLogo cover={Boolean(operator.profile?.logoIsPhoto)} name={operator.name} logo={operator.profile?.logo} type={operator.type} size={38} incomplete={operator.verificationLevel === "incomplete"}/><span><strong>{operator.name}</strong><small>{operator.city}, {operator.country}{operator.company ? ` · by ${operator.company.name}` : ""} · {operator.modalities.slice(0, 2).join(" + ")}</small></span><VerificationMark level={operator.verificationLevel}/><ArrowUpRight size={15}/></button>)}{filtered.length === 0 && <div className="landing-quick-empty"><Search size={18}/><span><strong>No network match</strong><small>Try a city, company, or modality.</small></span></div>}</div>}
        <div className="landing-map-controls" aria-label="Map navigation"><button aria-label="Zoom in" disabled={!map} onClick={() => map?.zoom(1)}><Plus size={20}/></button><button aria-label="Zoom out" disabled={!map} onClick={() => map?.zoom(-1)}><Minus size={20}/></button><button aria-label="Reset map" disabled={!map} onClick={() => map?.reset()}><Crosshair size={20}/></button></div>
        <MapLocationKey showIncomplete={operators.some((item) => item.verificationLevel === "incomplete")}/>
        <div className="landing-map-help">{projection === "globe" ? "Verified provider spotlight · Drag to explore" : "Drag to explore · Select a location to view its profile"}</div>
        <button className={`directory-toggle-button public-directory-toggle ${directoryMinimized ? "is-collapsed" : ""}`} onClick={() => setDirectoryMinimized((minimized) => !minimized)} aria-label={directoryMinimized ? `Open provider directory, ${filtered.length} providers` : "Minimize provider directory"} aria-expanded={!directoryMinimized} aria-controls="public-provider-directory"><PanelRightClose size={15}/><span className="directory-toggle-count" aria-hidden="true">{filtered.length}</span></button>
        <AnimatePresence initial={false}>{!directoryMinimized && <motion.aside id="public-provider-directory" className="map-company-list" aria-label="Verified provider directory" initial={reducedMotion ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 12 }} transition={{ duration: reducedMotion ? 0 : .22, ease: [.22, 1, .36, 1] }}>
          <div className="map-company-list-heading"><div><span>DATA DIRECTORY</span><strong>Providers on the map</strong><small>{filtered.length} matching locations</small></div></div>
          <div className="map-company-list-scroll">{filtered.map((operator) => <button key={operator.slug} className={`has-logo ${operator.verificationLevel === "incomplete" ? "is-incomplete" : ""}`} onClick={() => { setGatedOperator(operator); map?.flyTo(operator.coordinates, 7); }}><ProviderLogo cover={Boolean(operator.profile?.logoIsPhoto)} name={operator.name} logo={operator.profile?.logo} type={operator.type} size={38} incomplete={operator.verificationLevel === "incomplete"}/><strong><span className="provider-name-text">{operator.name}</span><VerificationMark level={operator.verificationLevel}/></strong><small>{operator.city}, {operator.country}{operator.company && <> · by {operator.company.name}</>}</small><em>{operator.facilityCount ? `${operator.facilityCount} ${operator.facilityCount === 1 ? "facility" : "facilities"} · ` : operator.type === "Device Supplier" ? `Device company · ${operator.productCount ?? 0} products · ` : ""}{operator.modalities.slice(0, 2).join(" · ")}</em></button>)}</div>
        </motion.aside>}</AnimatePresence>
      </section>

      <div className="landing-scroll-content">
        <section className="landing-scroll-section landing-intro">
          <div className="landing-copy-card">
            <span className="landing-kicker">TRUSTED DATA SOURCING</span>
            <h1>Source real-world data<br/>with confidence.</h1>
            <p>Every facility and data company is visible, reviewable, and connected to clear sourcing context before a buyer starts a conversation.</p>

            <div className="network-stats" aria-label="Verified network summary">
              <div><span><Building2/>Verified companies</span><strong>{companyCount}</strong><small>Public provider profiles</small></div>
              <div><span><Database/>Data facilities</span><strong>{facilityCount}</strong><small>Reviewable capture locations</small></div>
              <div><span><Webcam/>Device companies</span><strong>{deviceCompanyCount}</strong><small>Verified collection hardware sellers</small></div>
            </div>

            <button onClick={goToSearch}>Explore the map <Globe2 size={16}/></button>
          </div>
        </section>

        <section id="trust-and-transparency" className="landing-scroll-section landing-discovery">
          <div className="landing-section-card">
            <span className="landing-kicker">TRANSPARENT BY DESIGN</span>
            <h2>Know who is behind every dataset.</h2>
            <p>Use the map to inspect sourcing context, then open a provider profile for its operating details, available modalities, and review status.</p>
            <div className="trust-grid">
              <article><span><Building2 size={21}/></span><h3>Facility transparency</h3><p>Open a verified company to reveal its facilities, with city-level capture context, workforce, and the kind of data each one can collect.</p></article>
              <article><span><BadgeCheck size={21}/></span><h3>Verified companies</h3><p>Provider profiles show the company behind the work before you begin a sourcing conversation.</p></article>
              <article><span><ShieldCheck size={21}/></span><h3>Data exclusivity checks</h3><p>Clarify whether a proposed dataset is exclusive, non-exclusive, or already committed before contracting.</p></article>
            </div>
            {filtered.length === 0 && <div className="landing-no-results"><Search size={24}/><strong>No matches yet</strong><p>Try a different country or clear the filters.</p><button onClick={clear}>Clear filters</button></div>}
          </div>
        </section>
        <section className="landing-scroll-section landing-closing">
          <div className="landing-section-card"><span className="landing-kicker">CLEARER COMMERCIALS</span><h2>Move from discovery to a qualified sourcing conversation.</h2><div className="commercial-grid"><article><Landmark size={22}/><h3>Escrow-ready milestones</h3><p>Define delivery milestones and acceptance criteria before moving to your preferred payment provider.</p></article><article><Scale size={22}/><h3>Rights readiness</h3><p>Surface the usage, privacy, and exclusivity questions your legal team needs to resolve.</p></article><article><Database size={22}/><h3>Clear requirements</h3><p>Share scope, geography, modalities, and timeline directly with a verified data partner.</p></article></div><button onClick={goToSearch}>Return to the map <ArrowRight size={15}/></button></div>
        </section>
      </div>
      {gatedOperator && <Modal title="Provider preview" onClose={() => setGatedOperator(null)}><div className="public-provider-preview"><div className="public-provider-photo"><Image src={gatedOperator.media.src} alt={gatedOperator.media.alt} fill sizes="(max-width: 640px) 90vw, 520px"/></div><span className="verified-status"><BadgeCheck size={13}/>{gatedOperator.verificationLevel === "physical" ? "Physically verified" : "Online verified"}</span><h3>{gatedOperator.name}</h3><p className="public-provider-location"><MapPin size={15}/>{gatedOperator.city}, {gatedOperator.country}</p>{gatedOperator.company && <p className="provider-company-line">Facility of <strong>{gatedOperator.company.name}</strong></p>}{gatedOperator.facilityCount ? <p className="public-provider-hint"><Factory size={15}/>{gatedOperator.facilityCount} verified {gatedOperator.facilityCount === 1 ? "facility" : "facilities"} · log in to see {gatedOperator.facilityCount === 1 ? "it" : "them"} on the map</p> : null}{gatedOperator.type === "Device Supplier" ? <><p className="public-provider-hint is-store"><Package size={15}/>{gatedOperator.productCount ?? 0} data-collection {gatedOperator.productCount === 1 ? "device" : "devices"} in this store</p><p>Log in to browse the store, compare spec sheets, and send enquiries.</p></> : <p>Log in to view capabilities, samples, operating details, and contact options.</p>}<div className="public-provider-actions"><Link className="primary-button" href={`/login?next=${encodeURIComponent(gatedOperator.type === "Device Supplier" ? `/operators/${gatedOperator.slug}` : `/map?operator=${gatedOperator.slug}`)}`}><LogIn size={16}/>{gatedOperator.type === "Device Supplier" ? "Log in to visit the store" : "Log in to view"}</Link></div></div></Modal>}
    </main>
  );
}
