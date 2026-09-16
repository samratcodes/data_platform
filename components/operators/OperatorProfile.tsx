"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { animate, motion, useInView, useMotionTemplate, useMotionValue, useScroll, useSpring, useTransform, type Variants } from "framer-motion";
import { ArrowLeft, ArrowUpRight, BadgeCheck, Bookmark, Bot, Check, ChevronDown, ChevronRight, Compass, Database, ExternalLink, Factory, Layers, Link2, LoaderCircle, MapPin, MessageSquare, Radio, ShieldCheck, Sparkles, X } from "lucide-react";
import BuyerNavigationRail from "@/components/navigation/BuyerNavigationRail";
import ChatModal from "@/components/messaging/ChatModal";
import ConciergeForm from "@/components/workspace/ConciergeForm";
import Modal from "@/components/ui/Modal";
import OperatorGallery from "./OperatorGallery";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import { api } from "@/lib/api-client";
import type { PublicOperator, User, Workspace } from "@/types/app";
import type { NodeData } from "@/types/provider";

const emptyWorkspace: Workspace = { saved: [], requests: [] };
const ease = [0.22, 1, 0.36, 1] as const;

const verificationLabel = (level: NodeData["verificationLevel"]) =>
  level === "physical" ? "Physically verified" : level === "online" ? "Online verified" : "Demonstration listing";

const typeIcon = (type: NodeData["type"], size = 14) =>
  type === "Facility" ? <Factory size={size}/> : type === "Robotics" ? <Bot size={size}/> : <Database size={size}/>;

const linkLabel = (name: string) => (name === "huggingFace" ? "Hugging Face" : name[0].toUpperCase() + name.slice(1));
const remote = (source: string) => !source.startsWith("/");

const lede = (text: string) => {
  const sentence = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return sentence.length > 190 ? `${sentence.slice(0, 187).trimEnd()}…` : sentence;
};

const rise: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } },
};
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };

function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduced = useMotionPreference();
  return <motion.div className={className} initial={reduced ? false : { opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.75, ease, delay }}>
    {children}
  </motion.div>;
}

function SectionHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <Reveal className="opx-section-head">
    <span className="opx-eyebrow"><i/>{eyebrow}</span>
    <h2>{title}</h2>
    {children && <p>{children}</p>}
  </Reveal>;
}

function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useMotionPreference();
  useEffect(() => {
    const node = ref.current;
    if (!node || !inView) return;
    if (reduced) { node.textContent = String(value); return; }
    const controls = animate(0, value, { duration: 1.4, ease, onUpdate: (latest) => { node.textContent = String(Math.round(latest)); } });
    return () => controls.stop();
  }, [inView, reduced, value]);
  return <span ref={ref}>0</span>;
}

/** Card that tilts toward the pointer and carries a soft spotlight. */
function TiltCard({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useMotionPreference();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(py, [0, 1], [6, -6]), { stiffness: 180, damping: 18 });
  const rotateY = useSpring(useTransform(px, [0, 1], [-6, 6]), { stiffness: 180, damping: 18 });
  const spotX = useTransform(px, (v) => `${v * 100}%`);
  const spotY = useTransform(py, (v) => `${v * 100}%`);
  const spotlight = useMotionTemplate`radial-gradient(420px circle at ${spotX} ${spotY}, rgb(32 185 151 / 14%), transparent 60%)`;
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    px.set((event.clientX - rect.left) / rect.width);
    py.set((event.clientY - rect.top) / rect.height);
  };
  const leave = () => { px.set(0.5); py.set(0.5); };
  return <motion.div variants={rise} className={`opx-tilt ${className ?? ""}`} onPointerMove={reduced ? undefined : move} onPointerLeave={leave} style={reduced ? undefined : { rotateX, rotateY, transformPerspective: 900 }}>
    {!reduced && <motion.span className="opx-spotlight" style={{ background: spotlight }} aria-hidden/>}
    {children}
  </motion.div>;
}

/** Button wrapper that is gently pulled toward the pointer. */
function Magnetic({ children }: { children: ReactNode }) {
  const reduced = useMotionPreference();
  const x = useSpring(0, { stiffness: 220, damping: 16 });
  const y = useSpring(0, { stiffness: 220, damping: 16 });
  if (reduced) return <>{children}</>;
  return <motion.span className="opx-magnetic" style={{ x, y }}
    onPointerMove={(event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      x.set((event.clientX - rect.left - rect.width / 2) * 0.22);
      y.set((event.clientY - rect.top - rect.height / 2) * 0.3);
    }}
    onPointerLeave={() => { x.set(0); y.set(0); }}>
    {children}
  </motion.span>;
}

function Marquee({ items }: { items: string[] }) {
  const row = (hidden: boolean) => <div className="opx-marquee-row" aria-hidden={hidden || undefined}>
    {items.map((item, index) => <span key={`${item}-${index}`}><Sparkles size={13}/>{item}</span>)}
  </div>;
  return <div className="opx-marquee" aria-label="Capabilities">{row(false)}{row(true)}</div>;
}

function ProcessTimeline({ name }: { name: string }) {
  const ref = useRef<HTMLOListElement>(null);
  const reduced = useMotionPreference();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 55%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 26 });
  const steps = [
    ["Send a brief", "Describe the modality, volume and environment your model needs."],
    ["Provider review", `${name} reviews the request in their workspace and accepts or follows up.`],
    ["Agree the scope", "Settle samples, consent terms and delivery format over workspace chat."],
    ["Capture & deliver", "Collection runs against the agreed spec, with updates in your inbox."],
  ];
  return <ol className="opx-timeline" ref={ref}>
    <span className="opx-timeline-track" aria-hidden><motion.span style={{ scaleY: reduced ? 1 : progress }}/></span>
    {steps.map(([title, body], index) => <motion.li key={title} initial={reduced ? false : { opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.6 }} transition={{ duration: 0.6, ease, delay: 0.05 * index }}>
      <b>{String(index + 1).padStart(2, "0")}</b>
      <div><strong>{title}</strong><p>{body}</p></div>
    </motion.li>)}
  </ol>;
}

export default function OperatorProfile({ user, operator, related }: { user: User; operator: NodeData; related: PublicOperator[] }) {
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [request, setRequest] = useState(false);
  const [chat, setChat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [requestError, setRequestError] = useState("");
  const reduced = useMotionPreference();

  const hero = useRef<HTMLElement>(null);
  const { scrollYProgress: heroProgress } = useScroll({ target: hero, offset: ["start start", "end start"] });
  const heroMediaY = useTransform(heroProgress, [0, 1], ["0%", "22%"]);
  const heroContentY = useTransform(heroProgress, [0, 1], ["0%", "35%"]);
  const heroFade = useTransform(heroProgress, [0, 0.75], [1, 0]);
  const { scrollYProgress: pageProgress, scrollY } = useScroll();
  const pageBar = useSpring(pageProgress, { stiffness: 140, damping: 30 });
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => scrollY.on("change", (value) => setScrolled(value > 24)), [scrollY]);

  const saved = workspace.saved.includes(operator.slug);
  const requested = workspace.requests.some((item) => item.operator_slug === operator.slug);
  const photos = [...new Set([...(operator.profile.photos || []), operator.media.src].filter(Boolean))];
  const links = Object.entries(operator.profile.links || {}).filter((entry): entry is [string, string] => !!entry[1]);
  const description = operator.profile.description.replace("vetted ", "");
  const { dataStreams, captureEnvironments } = operator.profile;
  const marqueeItems = [...new Set([...operator.modalities, ...dataStreams, ...captureEnvironments])];
  const place = `${operator.area}${operator.area === operator.city ? "" : `, ${operator.city}`}, ${operator.country}`;
  const typeClass = `type-${operator.type.toLowerCase().replace(" ", "-")}`;

  useEffect(() => {
    const controller = new AbortController();
    api<Workspace>("/api/workspace", { signal: controller.signal })
      .then(setWorkspace)
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const toggleSave = async () => {
    setBusy(true);
    try { setWorkspace(await api("/api/workspace", { method: "POST", body: JSON.stringify({ action: saved ? "unsave" : "save", slug: operator.slug }) })); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); }
    catch { setError("Your browser blocked the clipboard. Copy the link from the address bar instead."); }
  };

  const requestButton = (label: string) => <button type="button" className="primary-button opx-shine" disabled={requested} onClick={() => setRequest(true)}>
    {requested ? <><Check size={16}/>Request sent</> : <>{label}<ArrowUpRight size={16}/></>}
  </button>;

  const stats = [
    { label: "Data modalities", value: operator.modalities.length },
    { label: "Data streams", value: dataStreams.length },
    { label: "Capture environments", value: captureEnvironments.length },
    { label: "Facility photos", value: photos.length },
  ];

  return <main className="sourcing-app operator-profile-page">
    {!reduced && <motion.div className="opx-progress" style={{ scaleX: pageBar }} aria-hidden/>}
    <BuyerNavigationRail user={user} active="map"/>
    <div className="op-shell">
      <nav className={`op-topbar ${scrolled ? "is-scrolled" : ""}`} aria-label="Breadcrumb">
        <Link className="op-back" href={`/map?operator=${operator.slug}`}><ArrowLeft size={15}/>Back to map</Link>
        <span className="op-trail"><Link href="/map">Network</Link><ChevronRight size={12}/><span>{operator.country}</span><ChevronRight size={12}/><b>{operator.name}</b></span>
        <div className="op-topbar-actions">
          <button type="button" className="op-ghost-button" onClick={copyLink}>{copied ? <Check size={14}/> : <Link2 size={14}/>}<span>{copied ? "Link copied" : "Copy link"}</span></button>
          <button type="button" className={`op-ghost-button ${saved ? "is-saved" : ""}`} onClick={toggleSave} disabled={busy} aria-pressed={saved}><Bookmark size={14} fill={saved ? "currentColor" : "none"}/><span>{saved ? "Saved" : "Save"}</span></button>
        </div>
      </nav>

      {/* Hero */}
      <section className="opx-hero" ref={hero}>
        <motion.div className="opx-hero-media" style={reduced ? undefined : { y: heroMediaY }}>
          <Image src={photos[0]} alt={`${operator.name} — ${operator.media.label}`} fill priority sizes="(max-width: 760px) 100vw, 1180px" className="object-cover" unoptimized={remote(photos[0])}/>
        </motion.div>
        <span className="opx-hero-veil" aria-hidden/>
        <span className="opx-hero-grid" aria-hidden/>
        <span className="opx-aurora opx-aurora-a" aria-hidden/>
        <span className="opx-aurora opx-aurora-b" aria-hidden/>
        <span className="opx-scanline" aria-hidden/>

        <motion.div className="opx-hero-body" style={reduced ? undefined : { y: heroContentY, opacity: heroFade }}>
          <motion.div className="opx-hero-copy" variants={stagger} initial={reduced ? false : "hidden"} animate="show">
            <motion.div className="op-chips" variants={rise}>
              <span className={`op-chip ${typeClass}`}>{typeIcon(operator.type)}{operator.type}</span>
              <span className="op-chip op-chip-verified"><BadgeCheck size={14}/>{verificationLabel(operator.verificationLevel)}</span>
              <span className="op-chip opx-chip-live"><i/>Accepting requests</span>
            </motion.div>
            <h1 aria-label={operator.name}>
              {operator.name.split(" ").map((word, index) => <span className="opx-word" key={`${word}-${index}`} aria-hidden>
                <motion.span variants={{ hidden: { y: "110%", rotate: 4 }, show: { y: "0%", rotate: 0, transition: { duration: 0.85, ease } } }}>{word}</motion.span>
              </span>)}
            </h1>
            <motion.p className="opx-hero-lede" variants={rise}>{lede(description)}</motion.p>
            <motion.p className="opx-hero-place" variants={rise}><MapPin size={14}/>{place}{operator.company && <> · Operated by <strong>{operator.company.name}</strong></>}</motion.p>
            <motion.div className="opx-hero-actions" variants={rise}>
              <Magnetic>{requestButton("Request data")}</Magnetic>
              <button type="button" className="opx-glass-button" onClick={() => setChat(true)}><MessageSquare size={15}/>Message provider</button>
            </motion.div>
          </motion.div>

          <motion.aside className="opx-signal" initial={reduced ? false : { opacity: 0, x: 40, rotate: 3 }} animate={{ opacity: 1, x: 0, rotate: 0 }} transition={{ duration: 0.9, ease, delay: 0.45 }}>
            <header><span className="opx-pulse"/>Live capability</header>
            <ul>
              {operator.modalities.map((item, index) => <motion.li key={item} initial={reduced ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 + index * 0.1, duration: 0.5, ease }}>
                <span>{item}</span>
                <span className="opx-bars" aria-hidden>{[0, 1, 2, 3, 4].map((bar) => <i key={bar} style={{ animationDelay: `${(index + bar) * 0.13}s` }}/>)}</span>
              </motion.li>)}
            </ul>
            <footer><ShieldCheck size={13}/>{verificationLabel(operator.verificationLevel)}</footer>
          </motion.aside>
        </motion.div>

        {!reduced && <motion.a href="#overview" className="opx-scroll-cue" aria-label="Scroll to overview" animate={{ y: [0, 8, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}><ChevronDown size={18}/></motion.a>}
      </section>

      {marqueeItems.length > 0 && <Marquee items={marqueeItems}/>}

      {/* Stats */}
      <motion.section className="opx-stats" id="overview" variants={stagger} initial={reduced ? false : "hidden"} whileInView="show" viewport={{ once: true, amount: 0.4 }}>
        {stats.map((stat) => <motion.article key={stat.label} variants={rise}>
          <strong><CountUp value={stat.value}/></strong>
          <span>{stat.label}</span>
        </motion.article>)}
        <motion.article variants={rise} className="opx-stat-text"><strong>{operator.profile.established || "—"}</strong><span>Operating since</span></motion.article>
        <motion.article variants={rise} className="opx-stat-text"><strong>{operator.profile.capacity || "On request"}</strong><span>Capture capacity</span></motion.article>
      </motion.section>

      {/* About */}
      <section className="opx-section opx-about">
        <div>
          <SectionHead eyebrow="ABOUT" title={`Real-world data, captured by ${operator.name}`}/>
          <Reveal delay={0.1}><p className="opx-about-copy">{description}</p></Reveal>
          <Reveal delay={0.2} className="op-modalities">{operator.modalities.map((item) => <span key={item}>{item}</span>)}</Reveal>
        </div>
        <motion.div className="opx-pillars" variants={stagger} initial={reduced ? false : "hidden"} whileInView="show" viewport={{ once: true, amount: 0.25 }}>
          <TiltCard><span className={`opx-icon ${typeClass}`}>{typeIcon(operator.type, 18)}</span><strong>{operator.type}</strong><p>Listed on the network as a {operator.type.toLowerCase()} partner.</p></TiltCard>
          <TiltCard><span className="opx-icon"><BadgeCheck size={18}/></span><strong>{verificationLabel(operator.verificationLevel)}</strong><p>Capabilities and evidence come from the approved facility review.</p></TiltCard>
          <TiltCard><span className="opx-icon"><Layers size={18}/></span><strong>{operator.modalities.length} modalities</strong><p>{operator.modalities.join(", ") || "Modalities shared on request."}</p></TiltCard>
          <TiltCard><span className="opx-icon"><MapPin size={18}/></span><strong>{operator.city}</strong><p>{operator.country} · {operator.profile.publicExactLocation ? "Exact location published" : "City-level location"}</p></TiltCard>
        </motion.div>
      </section>

      {/* Data streams & environments */}
      {(dataStreams.length > 0 || captureEnvironments.length > 0) && <section className="opx-section">
        <SectionHead eyebrow="CAPABILITIES" title="What they capture, and where">Every stream below was reviewed during verification.</SectionHead>
        {dataStreams.length > 0 && <motion.ul className="opx-streams" variants={stagger} initial={reduced ? false : "hidden"} whileInView="show" viewport={{ once: true, amount: 0.15 }}>
          {dataStreams.map((item, index) => <motion.li key={item} variants={rise} whileHover={reduced ? undefined : { y: -4 }}>
            <span className="opx-stream-icon"><Radio size={16}/></span>
            <strong>{item}</strong>
            <span className="opx-wave" aria-hidden>{Array.from({ length: 14 }, (_, bar) => <i key={bar} style={{ animationDelay: `${((bar * 7 + index * 3) % 10) * 0.09}s` }}/>)}</span>
          </motion.li>)}
        </motion.ul>}
        {captureEnvironments.length > 0 && <Reveal className="opx-envs">
          <h3><Compass size={15}/>Capture environments</h3>
          <motion.div variants={stagger} initial={reduced ? false : "hidden"} whileInView="show" viewport={{ once: true }}>
            {captureEnvironments.map((item) => <motion.span key={item} variants={{ hidden: { opacity: 0, scale: 0.8 }, show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 260, damping: 18 } } }}><Check size={12}/>{item}</motion.span>)}
          </motion.div>
        </Reveal>}
      </section>}

      {/* Gallery */}
      <section className="opx-section">
        <SectionHead eyebrow="INSIDE THE FACILITY" title="See where the data comes from"/>
        <Reveal><OperatorGallery photos={photos} name={operator.name} label={operator.media.label}/></Reveal>
      </section>

      {/* Geography + process */}
      <section className="opx-section opx-split">
        <Reveal className="opx-geo">
          <div className="opx-radar" aria-hidden>
            <span className="opx-radar-sweep"/>
            <i/><i/><i/>
            <b/>
          </div>
          <div className="opx-geo-copy">
            <span className="opx-eyebrow"><i/>GEOGRAPHY</span>
            <h3>{operator.area === operator.city ? operator.city : `${operator.area}, ${operator.city}`}</h3>
            <span>{operator.country}</span>
            <small>{operator.coordinates[1].toFixed(4)}° lat · {operator.coordinates[0].toFixed(4)}° lng</small>
            <p>{operator.profile.publicExactLocation ? "This provider publishes its exact public location." : "City-level location. Exact addresses are shared during sourcing review."}</p>
            <Link className="op-location-link" href={`/map?operator=${operator.slug}`}>Open on the map<ArrowUpRight size={14}/></Link>
          </div>
        </Reveal>
        <div>
          <SectionHead eyebrow="HOW IT WORKS" title="From brief to dataset"/>
          <ProcessTimeline name={operator.name}/>
        </div>
      </section>

      {links.length > 0 && <section className="opx-section">
        <SectionHead eyebrow="ELSEWHERE" title="Verified links"/>
        <motion.div className="op-links" variants={stagger} initial={reduced ? false : "hidden"} whileInView="show" viewport={{ once: true }}>
          {links.map(([name, url]) => <motion.a key={name} variants={rise} href={url} target="_blank" rel="noreferrer"><ExternalLink size={13}/>{linkLabel(name)}<ArrowUpRight size={13}/></motion.a>)}
        </motion.div>
      </section>}

      {/* CTA band */}
      <Reveal className="opx-cta">
        <span className="opx-cta-orb opx-cta-orb-a" aria-hidden/>
        <span className="opx-cta-orb opx-cta-orb-b" aria-hidden/>
        <div className="opx-cta-copy">
          <span className="opx-eyebrow"><i/>SOURCING</span>
          <h2>Build your next dataset with {operator.name}</h2>
          <p>Send a brief and the provider replies in your workspace inbox.</p>
          <div className="opx-hero-actions">
            <Magnetic>{requestButton("Request data")}</Magnetic>
            <button type="button" className="opx-glass-button" onClick={() => setChat(true)}><MessageSquare size={15}/>Chat with provider</button>
            <button type="button" className={`opx-glass-button ${saved ? "is-saved" : ""}`} onClick={toggleSave} disabled={busy} aria-pressed={saved}><Bookmark size={15} fill={saved ? "currentColor" : "none"}/>{saved ? "Saved to workspace" : "Save provider"}</button>
          </div>
        </div>
        <div className="op-concierge-card"><ConciergeForm onError={setError}/></div>
      </Reveal>

      {related.length > 0 && <section className="opx-section op-related">
        <div className="op-related-head"><SectionHead eyebrow="KEEP EXPLORING" title="More verified providers"/><Link href="/map?search=1">Browse the network<ArrowUpRight size={14}/></Link></div>
        <motion.div className="op-related-grid" variants={stagger} initial={reduced ? false : "hidden"} whileInView="show" viewport={{ once: true, amount: 0.2 }}>
          {related.map((item) => <motion.div key={item.slug} variants={rise}>
            <Link className="op-related-card" href={`/operators/${item.slug}`}>
              <span className="op-related-media"><Image src={item.media.src} alt="" fill sizes="(max-width: 760px) 100vw, 360px" className="object-cover" unoptimized={remote(item.media.src)}/></span>
              <strong>{item.name}</strong>
              <small><MapPin size={11}/>{item.city}, {item.country}</small>
              <em>{item.type}<ArrowUpRight size={12}/></em>
            </Link>
          </motion.div>)}
        </motion.div>
      </section>}
    </div>

    {request && <Modal title="Request data access" onClose={() => setRequest(false)}>
      <p className="modal-description">Tell us what you&rsquo;re building with <strong>{operator.name}</strong>.</p>
      <form className="request-form" onSubmit={async (event) => {
        event.preventDefault(); setBusy(true); setRequestError("");
        const purpose = new FormData(event.currentTarget).get("purpose");
        try { setWorkspace(await api("/api/workspace", { method: "POST", body: JSON.stringify({ action: "request", slug: operator.slug, purpose }) })); setRequest(false); }
        catch (reason) { setRequestError((reason as Error).message); } finally { setBusy(false); }
      }}>
        <label>Your use case<textarea name="purpose" minLength={10} maxLength={2000} required rows={5} placeholder="We are training a manipulation model and need multi-view recordings of assembly tasks…"/></label>
        <p className="demo-note">The supplier will receive this request in their workspace and can accept it or contact you through map.filemarket chat.</p>
        {requestError && <p role="alert" className="form-error">{requestError}</p>}
        <button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <>Submit request <ArrowUpRight size={17}/></>}</button>
      </form>
    </Modal>}
    {chat && <ChatModal operator={operator} onClose={() => setChat(false)}/>}
    {error && <div className="op-toast" role="status"><p>{error}</p><button type="button" onClick={() => setError("")} aria-label="Dismiss notification"><X size={15}/></button></div>}
  </main>;
}
