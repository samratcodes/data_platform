"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Minus, Plus, ArrowDown, ArrowRight, BadgeCheck, Building2, ChevronDown, Database, Globe2, Info, Landmark, LogIn, Scale, Search, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import Brand from "./Brand";
import type { MapHandle, PublicOperator } from "./model";
import { useMotionPreference } from "./useMotionPreference";

const WorldMap = dynamic(() => import("./WorldMap"), { ssr: false, loading: () => <div className="map-loading light"><Globe2 size={34}/><span>Drawing the global network…</span></div> });

function StatNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [current, setCurrent] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      const started = performance.now();
      const animate = (time: number) => {
        const progress = Math.min((time - started) / 750, 1);
        setCurrent(Math.round(value * (1 - (1 - progress) ** 3)));
        if (progress < 1) frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
      observer.disconnect();
    }, { threshold: .45 });
    observer.observe(element);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [value]);
  return <span ref={ref}>{current}{suffix}</span>;
}

export default function LandingExperience({ operators }: { operators: PublicOperator[] }) {
  const [country, setCountry] = useState("");
  const [modality, setModality] = useState("");
  const [locationType, setLocationType] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [map, setMap] = useState<MapHandle | null>(null);
  const router = useRouter();
  const mapSection = useRef<HTMLElement>(null);
  const reducedMotion = useMotionPreference();
  const countries = useMemo(() => [...new Set(operators.map((item) => item.country))].sort(), [operators]);
  const modalities = useMemo(() => [...new Set(operators.flatMap((item) => item.modalities))].sort(), [operators]);
  const filtered = useMemo(() => {
    return operators.filter((operator) => {
      return (!country || operator.country === country) && (!modality || operator.modalities.some((item) => item === modality)) && (!locationType || operator.type === locationType);
    });
  }, [operators, country, modality, locationType]);
  const activeFilters = Number(!!country) + Number(!!modality) + Number(!!locationType);
  const facilityCount = operators.filter((operator) => operator.type === "Facility").length;
  const companyCount = operators.filter((operator) => operator.type === "Data Company").length;
  const peakEgocentricDailyHours = Math.ceil(Math.max(...operators.filter((operator) => operator.modalities.includes("Egocentric video")).map((operator) => Number(operator.capacity.match(/^\d+(?:\.\d+)?/)?.[0] || 0) / 7)));
  const clear = () => { setCountry(""); setModality(""); setLocationType(""); map?.reset(); };
  const scrollToTrust = () => document.querySelector<HTMLElement>("#trust-and-transparency")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  const goToSearch = () => mapSection.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });

  return <main className="sourcing-app landing-experience">
    <aside className="map-sidebar" aria-label="FileMarket navigation">
      <Brand/>
      <div className="map-sidebar-name">FileMarket <strong>AI</strong></div>
      <div className="map-sidebar-actions">
        <button aria-label="Open map filters" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal size={19}/><span>Filters</span></button>
        <button aria-label="About FileMarket" onClick={scrollToTrust}><Info size={19}/><span>About</span></button>
        <Link href="/login" aria-label="Log in"><LogIn size={19}/><span>Log in</span></Link>
        <Link href="/signup" className="map-sidebar-join" aria-label="Join FileMarket"><ArrowRight size={19}/><span>Join</span></Link>
      </div>
    </aside>
    <section ref={mapSection} className="landing-map-section" aria-label="Explore the map">
    <div className="landing-map-fixed"><WorldMap theme="light" showMediaPins operators={filtered} onReady={setMap} onSelect={(items) => { if (items.length === 1) router.push(`/operators/${items[0].slug}`); }} onInteract={() => undefined} reducedMotion={reducedMotion}/></div>
    <div className={`landing-filter-bar ${filtersOpen ? "is-open" : ""}`} aria-label="Map filters">
      <label><span>Country</span><Globe2 size={15}/><select aria-label="Country" value={country} onChange={(event) => { setCountry(event.target.value); const target = operators.find((item) => item.country === event.target.value); if (target) map?.flyTo(target.coordinates, 4); else map?.reset(); }}><option value="">All countries</option>{countries.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14}/></label>
      <label><span>Data type</span><Database size={15}/><select aria-label="Data type" value={modality} onChange={(event) => setModality(event.target.value)}><option value="">All data types</option>{modalities.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14}/></label>
      <label><span>Location type</span><Building2 size={15}/><select aria-label="Location type" value={locationType} onChange={(event) => setLocationType(event.target.value)}><option value="">Facilities & companies</option><option value="Facility">Facility</option><option value="Data Company">Data company</option></select><ChevronDown size={14}/></label>
      {activeFilters > 0 && <button className="landing-filter-clear" onClick={() => { clear(); setFiltersOpen(false); }}><X size={13}/> Clear filters</button>}
      <span className="landing-match-count">{filtered.length} locations</span>
    </div>
    <div className="landing-map-controls" aria-label="Map navigation"><button aria-label="Zoom in" disabled={!map} onClick={() => map?.zoom(1)}><Plus size={20}/></button><button aria-label="Zoom out" disabled={!map} onClick={() => map?.zoom(-1)}><Minus size={20}/></button><button aria-label="Reset map" disabled={!map} onClick={() => map?.reset()}><Crosshair size={20}/></button></div>
    <div className="landing-map-help">Drag to explore · Select a verified location to view its profile</div>
    <button className={`landing-scroll-button ${filtersOpen ? "is-hidden" : ""}`} onClick={scrollToTrust} aria-label="Scroll to how FileMarket protects sourcing"><span>How FileMarket protects sourcing</span><ArrowDown size={18}/></button>
    </section>
    <div className="landing-scroll-content">
      <section className="landing-scroll-section landing-intro">
        <div className="landing-copy-card">
          <span className="landing-kicker">TRUSTED DATA SOURCING</span>
          <h1>Source real-world data<br/>with confidence.</h1>
          <p>Every facility and data company is visible, reviewable, and connected to clear commercial protections.</p>
          <div className="network-stats" aria-label="Network capacity statistics">
            <div><strong><StatNumber value={facilityCount}/></strong><span>data facilities</span></div>
            <div><strong><StatNumber value={companyCount}/></strong><span>data companies</span></div>
            <div><strong><StatNumber value={peakEgocentricDailyHours} suffix=" h"/></strong><span>peak egocentric / day</span></div>
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
            <article><span><Building2 size={21}/></span><h3>Facility transparency</h3><p>See city-level capture context, environments, capacity, and the kind of data each facility can collect.</p></article>
            <article><span><BadgeCheck size={21}/></span><h3>Verified companies</h3><p>Provider profiles show the company behind the work before you begin a sourcing conversation.</p></article>
            <article><span><ShieldCheck size={21}/></span><h3>Data exclusivity checks</h3><p>Clarify whether a proposed dataset is exclusive, non-exclusive, or already committed before contracting.</p></article>
          </div>
          {filtered.length === 0 && <div className="landing-no-results"><Search size={24}/><strong>No matches yet</strong><p>Try a different country or clear the filters.</p><button onClick={clear}>Clear filters</button></div>}
        </div>
      </section>
      <section className="landing-scroll-section landing-closing">
        <div className="landing-section-card"><span className="landing-kicker">CLEARER COMMERCIALS</span><h2>Move from discovery to a protected agreement.</h2><div className="commercial-grid"><article><Landmark size={22}/><h3>Escrow payments</h3><p>Set milestones and release payment when the agreed delivery is confirmed.</p></article><article><Scale size={22}/><h3>Legal support</h3><p>Start from practical agreements that cover usage rights, delivery, and privacy obligations.</p></article><article><Database size={22}/><h3>Simple contracts</h3><p>Keep scope, acceptance criteria, and data access terms in one shared workflow.</p></article></div><button onClick={goToSearch}>Return to the map <ArrowRight size={15}/></button></div>
      </section>
    </div>
  </main>;
}
