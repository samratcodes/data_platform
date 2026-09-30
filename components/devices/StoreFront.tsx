"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowLeft, ArrowUpRight, BadgeCheck, Bookmark, Check, ChevronDown, ChevronRight, Cpu, Database, ExternalLink, Factory, Link2, MapPin, MessageSquare, Package, PackageCheck, Pencil, Send, Target, X } from "lucide-react";
import AppNavigationRail from "@/components/navigation/AppNavigationRail";
import ChatModal from "@/components/messaging/ChatModal";
import OperatorGallery from "@/components/operators/OperatorGallery";
import { CountUp, Magnetic, Marquee, ProcessTimeline, Reveal, SectionHead, TiltCard, ease, rise, stagger } from "@/components/operators/OperatorProfile";
import ProviderLogo from "@/components/ui/ProviderLogo";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import { api } from "@/lib/api-client";
import { availabilityLabel, deviceCategoryLabel, priceLabel, productPageUrl, specRows, type StoreProduct } from "@/lib/devices";
import type { User, Workspace } from "@/types/app";
import type { NodeData } from "@/types/provider";
import { ProductPhoto } from "./ProductCard";
import ProductBrowser from "./ProductBrowser";

const linkLabel = (name: string) => (name === "huggingFace" ? "Hugging Face" : name[0].toUpperCase() + name.slice(1));
const remote = (source: string) => !source.startsWith("/");
const lede = (text: string) => {
  const sentence = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return sentence.length > 190 ? `${sentence.slice(0, 187).trimEnd()}…` : sentence;
};
const orderSteps = (name: string) => [
  ["Send an enquiry", "Pick a device and say how many units you need, for which capture project, and when."],
  ["Get a quote", `${name} replies in your inbox with pricing, lead time, and bulk or rental options.`],
  ["Test a sample", "Agree on a sample unit or a pilot batch to check the data it records."],
  ["Equip your teams", "Units ship from the factory, ready for your capture teams in the field."],
];

/** A featured product in the hero: the store's lead device, one click from its page. */
function HeroSpotlight({ product, reduced }: { product: StoreProduct; reduced: boolean }) {
  const specs = specRows(product.specs).slice(0, 3);
  return <motion.aside className="stx-spotlight" initial={reduced ? false : { opacity: 0, x: 40, rotate: 3 }} animate={{ opacity: 1, x: 0, rotate: 0 }} transition={{ duration: 0.9, ease, delay: 0.45 }}>
    <header><span className="opx-pulse"/>Featured device</header>
    <Link className="stx-spotlight-photo" href={productPageUrl(product.id)} aria-label={`View ${product.name}`}><ProductPhoto product={product} sizes="280px"/></Link>
    <div className="stx-spotlight-copy">
      <small>{deviceCategoryLabel(product)}</small>
      <strong>{product.name}</strong>
      {specs.length > 0 && <dl>{specs.map((row) => <div key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>}
    </div>
    <footer><span>{priceLabel(product.price)}</span><Link href={`${productPageUrl(product.id)}#enquire`}>Enquire<ArrowUpRight size={13}/></Link></footer>
  </motion.aside>;
}

/**
 * A device manufacturer's store, told like a landing page: the factory in the hero with its lead
 * device, what it makes, a featured lineup, the full catalogue, the factory floor, and how ordering works.
 */
export default function StoreFront({ user, operator, products, isOwner }: { user: User; operator: NodeData; products: StoreProduct[]; isOwner: boolean }) {
  const [workspace, setWorkspace] = useState<Workspace>({ saved: [], requests: [] });
  const [chat, setChat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const reduced = Boolean(useMotionPreference());

  const hero = useRef<HTMLElement>(null);
  const { scrollYProgress: heroProgress } = useScroll({ target: hero, offset: ["start start", "end start"] });
  const heroMediaY = useTransform(heroProgress, [0, 1], ["0%", "22%"]);
  const heroContentY = useTransform(heroProgress, [0, 1], ["0%", "30%"]);
  const heroFade = useTransform(heroProgress, [0, 0.75], [1, 0]);
  const { scrollYProgress: pageProgress, scrollY } = useScroll();
  const pageBar = useSpring(pageProgress, { stiffness: 140, damping: 30 });
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => scrollY.on("change", (value) => setScrolled(value > 24)), [scrollY]);

  const incomplete = operator.verificationLevel === "incomplete";
  const saved = workspace.saved.includes(operator.slug);
  // A listing with only its logo never stretches the logo into a hero photo.
  const photos = incomplete && !operator.profile.photos?.length ? [] : [...new Set([...(operator.profile.photos || []), operator.media.src].filter(Boolean))];
  const links = Object.entries(operator.profile.links || {}).filter((entry): entry is [string, string] => !!entry[1] && entry[0] !== "maps");
  const description = operator.profile.description?.trim() ?? "";
  const categories = useMemo(() => [...new Set(products.map(deviceCategoryLabel))], [products]);
  const outputs = useMemo(() => [...new Set(products.flatMap((product) => product.dataOutputs))], [products]);
  const useCases = useMemo(() => [...new Set(products.flatMap((product) => product.useCases))], [products]);
  const inStock = products.filter((product) => product.availability === "in-stock").length;
  // Products with photos lead the lineup.
  const lineup = useMemo(() => [...products].sort((a, b) => Number(!a.images.length) - Number(!b.images.length)).slice(0, 3), [products]);
  const lead = lineup[0];
  const marqueeItems = [...new Set([...categories, ...outputs])];

  useEffect(() => {
    const controller = new AbortController();
    api<Workspace>("/api/workspace", { signal: controller.signal }).then(setWorkspace).catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
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

  const primary = isOwner
    ? <Link className="primary-button opx-shine" href="/supplier/products"><Pencil size={15}/>Manage products</Link>
    : <a className="primary-button opx-shine" href="#catalogue">Browse devices<ArrowUpRight size={16}/></a>;
  const secondary = isOwner
    ? <Link className="opx-glass-button" href="/supplier"><Send size={15}/>Open enquiries</Link>
    : <button type="button" className="opx-glass-button" onClick={() => setChat(true)}><MessageSquare size={15}/>Message the factory</button>;

  const stats = [
    { label: "Devices", value: products.length },
    { label: "Device types", value: categories.length },
    { label: "Data types captured", value: outputs.length },
    { label: "In stock now", value: inStock },
  ];

  return <main className="sourcing-app operator-profile-page store-landing">
    {!reduced && <motion.div className="opx-progress" style={{ scaleX: pageBar }} aria-hidden/>}
    <AppNavigationRail user={user} active={isOwner ? "supplier" : "devices"}/>
    <div className="op-shell">
      <nav className={`op-topbar ${scrolled ? "is-scrolled" : ""}`} aria-label="Breadcrumb">
        <Link className="op-back" href={isOwner ? "/supplier" : `/map?operator=${operator.slug}`}><ArrowLeft size={15}/>{isOwner ? "Back to workspace" : "Back to map"}</Link>
        <span className="op-trail"><Link href="/devices">Device marketplace</Link><ChevronRight size={12}/><b>{operator.name}</b></span>
        <div className="op-topbar-actions">
          <button type="button" className="op-ghost-button" onClick={copyLink}>{copied ? <Check size={14}/> : <Link2 size={14}/>}<span>{copied ? "Link copied" : "Copy link"}</span></button>
          {!isOwner && <button type="button" className={`op-ghost-button ${saved ? "is-saved" : ""}`} onClick={toggleSave} disabled={busy} aria-pressed={saved}><Bookmark size={14} fill={saved ? "currentColor" : "none"}/><span>{saved ? "Saved" : "Save"}</span></button>}
        </div>
      </nav>

      {isOwner && <p className="stx-owner-bar"><BadgeCheck size={15}/>This is your store as buyers and data companies see it. Enquiries arrive in your workspace.</p>}

      {/* Hero: the factory, and its lead device */}
      <section className={`opx-hero stx-hero ${photos.length ? "" : "is-plain"} ${incomplete ? "is-incomplete" : ""}`} ref={hero}>
        {photos[0] && <motion.div className="opx-hero-media" style={reduced ? undefined : { y: heroMediaY }}>
          <Image src={photos[0]} alt={`${operator.name} factory`} fill priority sizes="(max-width: 760px) 100vw, 1180px" className="object-cover" unoptimized={remote(photos[0])}/>
        </motion.div>}
        <span className="opx-hero-veil" aria-hidden/>
        <span className="opx-hero-grid" aria-hidden/>
        {!incomplete && <><span className="opx-aurora opx-aurora-a" aria-hidden/><span className="opx-aurora opx-aurora-b" aria-hidden/></>}

        <motion.div className="opx-hero-body" style={reduced ? undefined : { y: heroContentY, opacity: heroFade }}>
          <motion.div className="opx-hero-copy" variants={stagger} initial={reduced ? false : "hidden"} animate="show">
            <motion.div className="op-chips" variants={rise}>
              <span className="op-chip type-device"><Factory size={14}/>Device manufacturer</span>
              {incomplete ? <span className="op-chip op-chip-incomplete">Incomplete profile</span>
                : <span className="op-chip op-chip-verified"><BadgeCheck size={14}/>{operator.verificationLevel === "physical" ? "Physically verified" : "Online verified"}</span>}
              {products.length > 0 && <span className="op-chip opx-chip-live"><i/>Taking enquiries</span>}
            </motion.div>
            <motion.span className="opx-hero-logo" variants={rise}><ProviderLogo className="opx-hero-logo-disc" name={operator.name} logo={operator.profile.logo} type={operator.type} size={84} incomplete={incomplete}/></motion.span>
            <h1 aria-label={operator.name}>
              {operator.name.split(" ").map((word, index) => <span className="opx-word" key={`${word}-${index}`} aria-hidden>
                <motion.span variants={{ hidden: { y: "110%", rotate: 4 }, show: { y: "0%", rotate: 0, transition: { duration: 0.85, ease } } }}>{word}</motion.span>
              </span>)}
            </h1>
            <motion.p className="opx-hero-lede" variants={rise}>{description ? lede(description) : incomplete ? "This manufacturer is on the map with basic details. Its store opens once its profile is complete." : "Capture hardware, built for real-world data collection."}</motion.p>
            <motion.p className="opx-hero-place" variants={rise}><Factory size={14}/>Factory in <strong>{operator.city}, {operator.country}</strong></motion.p>
            <motion.div className="opx-hero-actions" variants={rise}>
              {products.length > 0 || isOwner ? <Magnetic>{primary}</Magnetic> : null}
              {secondary}
            </motion.div>
          </motion.div>
          {lead && <HeroSpotlight product={lead} reduced={reduced}/>}
        </motion.div>
        {!reduced && products.length > 0 && <motion.a href="#overview" className="opx-scroll-cue" aria-label="Scroll to the store" animate={{ y: [0, 8, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}><ChevronDown size={18}/></motion.a>}
      </section>

      {marqueeItems.length > 0 && <Marquee items={marqueeItems}/>}

      {products.length > 0 && <motion.section className="opx-stats stx-stats" id="overview" variants={stagger} initial={reduced ? false : "hidden"} whileInView="show" viewport={{ once: true, amount: 0.4 }}>
        {stats.map((stat) => <motion.article key={stat.label} variants={rise}><strong><CountUp value={stat.value}/></strong><span>{stat.label}</span></motion.article>)}
        <motion.article variants={rise} className="opx-stat-text"><strong>{operator.country}</strong><span>Made in</span></motion.article>
        <motion.article variants={rise} className="opx-stat-text"><strong>{useCases[0] ?? "On request"}</strong><span>Built for</span></motion.article>
      </motion.section>}

      {/* Story */}
      {(description || products.length > 0) && <section className="opx-section opx-about">
        <div>
          <SectionHead eyebrow="THE FACTORY" title={`Built on the factory floor in ${operator.city}`}/>
          {description && <Reveal delay={0.1}><p className="opx-about-copy">{description}</p></Reveal>}
          {useCases.length > 0 && <Reveal delay={0.2} className="op-modalities">{useCases.map((item) => <span key={item}>{item}</span>)}</Reveal>}
        </div>
        <motion.div className="opx-pillars" variants={stagger} initial={reduced ? false : "hidden"} whileInView="show" viewport={{ once: true, amount: 0.25 }}>
          <TiltCard><span className="opx-icon type-device"><Factory size={18}/></span><strong>Own manufacturing</strong><p>{operator.name} makes and ships its devices from {operator.city}.</p></TiltCard>
          <TiltCard><span className="opx-icon"><BadgeCheck size={18}/></span><strong>{incomplete ? "Profile in progress" : operator.verificationLevel === "physical" ? "Physically verified" : "Online verified"}</strong><p>{incomplete ? "Details are still being added by the company." : "Company identity and registration were reviewed by map.filemarket."}</p></TiltCard>
          <TiltCard><span className="opx-icon"><Database size={18}/></span><strong>{outputs.length} data {outputs.length === 1 ? "type" : "types"}</strong><p>{outputs.slice(0, 4).join(", ") || "Data types shared on request."}</p></TiltCard>
          <TiltCard><span className="opx-icon"><PackageCheck size={18}/></span><strong>{inStock} in stock</strong><p>{products.length - inStock > 0 ? `${products.length - inStock} more made to order, pre-order, or for rent.` : "Ready to ship from the factory."}</p></TiltCard>
        </motion.div>
      </section>}

      {/* Lineup */}
      {lineup.length > 1 && <section className="opx-section">
        <SectionHead eyebrow="THE LINEUP" title="Devices built for capture">The devices data companies ask about most, with the data each one records.</SectionHead>
        <motion.div className={`stx-lineup is-${lineup.length}`} variants={stagger} initial={reduced ? false : "hidden"} whileInView="show" viewport={{ once: true, amount: 0.2 }}>
          {lineup.map((product, index) => <motion.div key={product.id} variants={rise}>
            <Link className={`stx-lineup-card ${index === 0 ? "is-lead" : ""}`} href={productPageUrl(product.id)}>
              <span className="stx-lineup-photo"><ProductPhoto product={product} sizes={index === 0 ? "(max-width: 760px) 100vw, 640px" : "(max-width: 760px) 100vw, 360px"}/></span>
              <span className="stx-lineup-copy">
                <small>{deviceCategoryLabel(product)} · {availabilityLabel(product.availability)}</small>
                <strong>{product.name}</strong>
                <span className="stx-lineup-data">{product.dataOutputs.slice(0, 3).map((item) => <em key={item}>{item}</em>)}</span>
                <b>{priceLabel(product.price)}<ArrowUpRight size={14}/></b>
              </span>
            </Link>
          </motion.div>)}
        </motion.div>
      </section>}

      {/* Catalogue */}
      <section className="opx-section stx-catalogue" id="catalogue">
        <SectionHead eyebrow="CATALOGUE" title={products.length ? `All ${products.length} ${products.length === 1 ? "device" : "devices"}` : "Catalogue"}>{products.length ? "Filter by device type or the data you need, then send an enquiry straight to the factory." : undefined}</SectionHead>
        <Reveal><ProductBrowser products={products} canEnquire={!isOwner} emptyTitle={incomplete ? "Store not open yet" : "No devices listed yet"} emptyText={isOwner ? "Add and publish products from your workspace to fill this catalogue." : incomplete ? "This manufacturer has not completed its profile. You can still message them." : "Check back soon, or message the factory about what it can provide."}/></Reveal>
      </section>

      {photos.length > 0 && <section className="opx-section">
        <SectionHead eyebrow="INSIDE THE FACTORY" title="Where the devices are made"/>
        <Reveal><OperatorGallery photos={photos} name={operator.name} label={operator.media.label}/></Reveal>
      </section>}

      {/* Geography + ordering */}
      <section className="opx-section opx-split">
        <Reveal className="opx-geo">
          <div className="opx-radar" aria-hidden><span className="opx-radar-sweep"/><i/><i/><i/><b/></div>
          <div className="opx-geo-copy">
            <span className="opx-eyebrow"><i/>SHIPS FROM</span>
            <h3>{operator.city}</h3>
            <span>{operator.country}</span>
            <small>{operator.coordinates[1].toFixed(4)}° lat · {operator.coordinates[0].toFixed(4)}° lng</small>
            <Link className="op-location-link" href={`/map?operator=${operator.slug}`}>Open on the map<ArrowUpRight size={14}/></Link>
          </div>
        </Reveal>
        <div>
          <SectionHead eyebrow="HOW ORDERING WORKS" title="From enquiry to your capture teams"/>
          <ProcessTimeline name={operator.name} steps={orderSteps(operator.name)}/>
        </div>
      </section>

      {links.length > 0 && <section className="opx-section">
        <SectionHead eyebrow="ELSEWHERE" title="Links"/>
        <motion.div className="op-links" variants={stagger} initial={reduced ? false : "hidden"} whileInView="show" viewport={{ once: true }}>
          {links.map(([name, url]) => <motion.a key={name} variants={rise} href={url} target="_blank" rel="noreferrer"><ExternalLink size={13}/>{linkLabel(name)}<ArrowUpRight size={13}/></motion.a>)}
        </motion.div>
      </section>}

      <Reveal className="opx-cta stx-cta">
        <span className="opx-cta-orb opx-cta-orb-a" aria-hidden/>
        <span className="opx-cta-orb opx-cta-orb-b" aria-hidden/>
        <div className="opx-cta-copy">
          <span className="opx-eyebrow"><i/>EQUIP YOUR TEAMS</span>
          <h2>Capture better data with {operator.name}</h2>
          <p>{isOwner ? "Keep your catalogue fresh: every published device appears here and in the device marketplace." : "Tell the factory what you are capturing and how many units you need. It replies in your inbox."}</p>
          <div className="opx-hero-actions">
            {primary}
            {secondary}
            {!isOwner && <button type="button" className={`opx-glass-button ${saved ? "is-saved" : ""}`} onClick={toggleSave} disabled={busy} aria-pressed={saved}><Bookmark size={15} fill={saved ? "currentColor" : "none"}/>{saved ? "Saved" : "Save store"}</button>}
          </div>
        </div>
        <ul className="stx-cta-facts">
          <li><Package size={16}/><strong>{products.length}</strong><span>devices listed</span></li>
          <li><Target size={16}/><strong>{useCases.length}</strong><span>use cases</span></li>
          <li><Cpu size={16}/><strong>{categories.length}</strong><span>device types</span></li>
          <li><MapPin size={16}/><strong>{operator.country}</strong><span>made in</span></li>
        </ul>
      </Reveal>
    </div>
    {chat && <ChatModal operator={operator} onClose={() => setChat(false)}/>}
    {error && <div className="op-toast" role="status"><p>{error}</p><button type="button" onClick={() => setError("")} aria-label="Dismiss notification"><X size={15}/></button></div>}
  </main>;
}
