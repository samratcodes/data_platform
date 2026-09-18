"use client";

import { useEffect, useRef, useState } from "react";
import type { ExpressionSpecification, Map as GLMap, GeoJSONSource, StyleSpecification } from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import { Globe2, RotateCw } from "lucide-react";
import type { MapHandle, MapProjection } from "./types";
import type { PublicOperator } from "@/types/app";
import { providerInitials, providerTypeClass } from "@/components/ui/ProviderLogo";
import { analyzeLogo } from "@/lib/logo-fit";
import { resizedImage } from "@/lib/image";

type Props = {
  operators: PublicOperator[];
  onReady: (map: MapHandle) => void;
  onSelect: (operators: PublicOperator[]) => void;
  onInteract: () => void;
  reducedMotion: boolean;
  theme?: "dark" | "light";
  allowSelection?: boolean;
  showPreviews?: boolean;
  initialProjection?: MapProjection;
  onProjectionChange?: (projection: MapProjection) => void;
};

const darkStyle: StyleSpecification = {
  version: 8,
  glyphs: "/fonts/{fontstack}/{range}.pbf",
  sources: {
    world: { type: "geojson", data: "/world.geojson", attribution: '<a href="https://www.naturalearthdata.com/">Natural Earth</a>' },
    names: { type: "geojson", data: "/country-labels.geojson" },
  },
  layers: [
    { id: "ocean", type: "background", paint: { "background-color": "#091723" } },
    { id: "land", type: "fill", source: "world", paint: { "fill-color": "#19333d", "fill-opacity": .97 } },
    { id: "borders", type: "line", source: "world", paint: { "line-color": "#3c6169", "line-width": .65, "line-opacity": .55 } },
    { id: "country-labels", type: "symbol", source: "names", minzoom: 1.8, layout: { "text-field": ["get", "NAME"], "text-font": ["Open Sans Semibold"], "text-size": 10, "text-max-width": 7 }, paint: { "text-color": "#7899a5", "text-halo-color": "#132d37", "text-halo-width": 1 } },
  ],
};

const lightStyle: StyleSpecification = {
  ...darkStyle,
  layers: [
    { id: "ocean", type: "background", paint: { "background-color": "#f7faf9" } },
    { id: "land", type: "fill", source: "world", paint: { "fill-color": "#ffffff", "fill-opacity": 1 } },
    { id: "borders", type: "line", source: "world", paint: { "line-color": "#b9c8c6", "line-width": .8, "line-opacity": .9 } },
    { id: "country-labels", type: "symbol", source: "names", minzoom: 1.4, layout: { "text-field": ["get", "NAME"], "text-font": ["Open Sans Semibold"], "text-size": 10, "text-max-width": 7 }, paint: { "text-color": "#73827f", "text-halo-color": "#ffffff", "text-halo-width": 1.5 } },
  ],
};

// Keep the globe prominent without crowding the landing-page controls.
const landingGlobeZoom = 2.45;

type MarkerKind = PublicOperator["type"];
const markerStyles: Record<MarkerKind, { light: string; deep: string; glyph: string }> = {
  "Facility": { light: "#34d399", deep: "#047857", glyph: '<path d="M3 21h18V10l-6 4v-4l-6 4V5H5a2 2 0 0 0-2 2Z"/><path d="M8 18h1M13 18h1M18 18h1"/>' },
  "Data Company": { light: "#60a5fa", deep: "#1d4ed8", glyph: '<ellipse cx="12" cy="5" rx="8.5" ry="3"/><path d="M3.5 5v7c0 1.65 3.8 3 8.5 3s8.5-1.35 8.5-3V5M3.5 12v7c0 1.65 3.8 3 8.5 3s8.5-1.35 8.5-3v-7"/>' },
  "Robotics": { light: "#a78bfa", deep: "#6d28d9", glyph: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="3"/><path d="M2 14h2M20 14h2M15.5 13.5v1M8.5 13.5v1"/>' },
};
const styleFor = (kind: MarkerKind) => markerStyles[kind] ?? markerStyles["Data Company"];
const pulseColor: ExpressionSpecification = ["match", ["get", "kind"], "Facility", "#10b981", "Robotics", "#8b5cf6", "#3b82f6"];
const logoIconId = (operator: PublicOperator) => operator.profile?.logo ? `logo:${operator.type}:${operator.profile.logo}` : "";

const loadImage = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

const previewMediaSrc = (operator: PublicOperator) => operator.media.kind === "image" ? resizedImage(operator.media.src, 640) : operator.media.src;
// Logos and profile photos can be multi-megabyte originals; badges only need a small copy.
const badgeSrc = (logo: string) => resizedImage(logo, 128);

// Warmed preview assets, shared across map instances so a remount never refetches.
const previewAssets = new Map<string, Promise<void>>();

/** Fetches and decodes an asset once; always resolves so a broken asset never blocks the tour. */
function warmAsset(src: string, kind: "image" | "video") {
  let pending = previewAssets.get(src);
  if (pending) return pending;
  pending = new Promise<void>((resolve) => {
    if (kind === "video") {
      const video = document.createElement("video");
      video.muted = true;
      video.preload = "auto";
      video.onloadeddata = video.onerror = () => {
        video.onloadeddata = video.onerror = null;
        resolve();
      };
      video.src = src;
      return;
    }
    const image = new Image();
    image.decoding = "async";
    image.onload = () => { void image.decode().catch(() => undefined).then(() => resolve()); };
    image.onerror = () => resolve();
    image.src = src;
  });
  previewAssets.set(src, pending);
  return pending;
}

const warmPreview = (operator: PublicOperator) => Promise.all([
  warmAsset(previewMediaSrc(operator), operator.media.kind === "video" ? "video" : "image"),
  operator.profile?.logo ? warmAsset(badgeSrc(operator.profile.logo), "image") : undefined,
]).then(() => undefined);

/** Loads previews one after another in tour order, so the next stop is ready before the globe reaches it. */
const queuePreviews = (operators: PublicOperator[]) => operators.reduce(
  (queue, operator) => queue.then(() => warmPreview(operator)),
  Promise.resolve()
);

const settleWithin = (promise: Promise<void>, ms: number) => new Promise<void>((resolve) => {
  const timer = window.setTimeout(resolve, ms);
  void promise.then(() => { window.clearTimeout(timer); resolve(); });
});

// Marker geometry in logical pixels; drawn at 2x for crisp edges.
const MARKER = { width: 48, height: 62, scale: 2, centerX: 24, centerY: 23, ring: 19, face: 15.5, tip: 56 };

/**
 * Draws a floating badge marker: a glossy ring in the category color holding the company logo
 * (or a category glyph), a stem down to the exact location, and a soft ground shadow for depth.
 */
async function drawMarker(kind: MarkerKind, logo?: string, photo = false) {
  const style = styleFor(kind);
  const { width, height, scale, centerX, centerY, ring, face, tip } = MARKER;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");
  context.scale(scale, scale);

  // Ground shadow.
  const ground = context.createRadialGradient(centerX, tip, 0, centerX, tip, 9);
  ground.addColorStop(0, "rgb(10 30 25 / 35%)");
  ground.addColorStop(1, "rgb(10 30 25 / 0%)");
  context.fillStyle = ground;
  context.beginPath(); context.ellipse(centerX, tip, 9, 3.4, 0, 0, Math.PI * 2); context.fill();

  // Stem down to an anchor dot on the exact location.
  const stem = context.createLinearGradient(0, centerY + ring, 0, tip);
  stem.addColorStop(0, style.deep);
  stem.addColorStop(1, style.light);
  context.strokeStyle = stem;
  context.lineWidth = 2.4;
  context.lineCap = "round";
  context.beginPath(); context.moveTo(centerX, centerY + ring - 1); context.lineTo(centerX, tip - 1.5); context.stroke();
  context.fillStyle = "#ffffff";
  context.beginPath(); context.arc(centerX, tip, 2.6, 0, Math.PI * 2); context.fill();
  context.fillStyle = style.deep;
  context.beginPath(); context.arc(centerX, tip, 1.6, 0, Math.PI * 2); context.fill();

  // Outer ring with drop shadow, then a white inner rim.
  context.save();
  context.shadowColor = "rgb(10 30 25 / 32%)";
  context.shadowBlur = 6;
  context.shadowOffsetY = 2.5;
  const rim = context.createLinearGradient(0, centerY - ring, 0, centerY + ring);
  rim.addColorStop(0, style.light);
  rim.addColorStop(1, style.deep);
  context.fillStyle = rim;
  context.beginPath(); context.arc(centerX, centerY, ring, 0, Math.PI * 2); context.fill();
  context.restore();
  context.fillStyle = "#ffffff";
  context.beginPath(); context.arc(centerX, centerY, face + 1.6, 0, Math.PI * 2); context.fill();

  // Face: the logo when available, otherwise the category glyph on a gradient.
  context.save();
  context.beginPath(); context.arc(centerX, centerY, face, 0, Math.PI * 2); context.clip();
  let drewLogo = false;
  if (logo) {
    try {
      const image = await loadImage(badgeSrc(logo));
      // Photos always fill the face; logos follow their own shape.
      const fit = photo ? { ...analyzeLogo(image), cover: true } : analyzeLogo(image);
      context.fillStyle = fit.background;
      context.fillRect(centerX - face, centerY - face, face * 2, face * 2);
      const box = fit.cover ? face * 2 : face * 1.45;
      const ratio = image.naturalWidth / image.naturalHeight;
      // Cover fills the circle; contain keeps wide wordmarks whole.
      const drawWidth = fit.cover ? Math.max(box, box * ratio) : Math.min(box, box * ratio);
      const drawHeight = drawWidth / ratio;
      context.drawImage(image, centerX - drawWidth / 2, centerY - drawHeight / 2, drawWidth, drawHeight);
      drewLogo = true;
    } catch { /* Fall through to the glyph. */ }
  }
  if (!drewLogo) {
    const background = context.createLinearGradient(0, centerY - face, 0, centerY + face);
    background.addColorStop(0, style.light);
    background.addColorStop(1, style.deep);
    context.fillStyle = background;
    context.fillRect(centerX - face, centerY - face, face * 2, face * 2);
    const glyph = await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${style.glyph}</svg>`));
    context.drawImage(glyph, centerX - 9, centerY - 9, 18, 18);
  }
  // Glossy highlight across the top of the face.
  const gloss = context.createLinearGradient(0, centerY - face, 0, centerY);
  gloss.addColorStop(0, "rgb(255 255 255 / 30%)");
  gloss.addColorStop(1, "rgb(255 255 255 / 0%)");
  context.fillStyle = gloss;
  context.beginPath(); context.ellipse(centerX, centerY - face * .45, face * .85, face * .55, 0, 0, Math.PI * 2); context.fill();
  context.restore();

  context.strokeStyle = "rgb(0 0 0 / 8%)";
  context.lineWidth = .8;
  context.beginPath(); context.arc(centerX, centerY, face, 0, Math.PI * 2); context.stroke();
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

/** Registers a branded marker for every operator with a logo, then re-renders the markers. */
async function addLogoPins(map: GLMap, operators: PublicOperator[]) {
  const pending = new Map<string, PublicOperator>();
  operators.forEach((operator) => {
    const id = logoIconId(operator);
    if (id && !map.hasImage(id)) pending.set(id, operator);
  });
  if (!pending.size) return;
  const results = await Promise.allSettled([...pending].map(async ([id, operator]) => {
    const image = await drawMarker(operator.type, operator.profile.logo!, Boolean(operator.profile.logoIsPhoto));
    if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio: MARKER.scale });
  }));
  // Markers without a loadable logo keep their category glyph.
  if (results.some((result) => result.status === "fulfilled")) {
    (map.getSource("operators") as GeoJSONSource | undefined)?.setData(features(operators));
  }
}

/** DOM twin of the `ProviderLogo` component for the imperatively built globe preview. */
function createLogoDisc(operator: PublicOperator) {
  // A div, so the ".globe-video-details > span" action styles never apply to it.
  const disc = document.createElement("div");
  disc.className = `provider-logo-disc globe-video-logo-disc ${providerTypeClass(operator.type)}`;
  disc.setAttribute("aria-hidden", "true");
  const fallback = () => {
    disc.classList.add("is-fallback");
    disc.replaceChildren(providerInitials(operator.name));
  };
  if (!operator.profile?.logo) { fallback(); return disc; }
  const inner = document.createElement("span");
  inner.className = "provider-logo-disc-inner";
  const logo = document.createElement("img");
  logo.src = badgeSrc(operator.profile.logo);
  logo.alt = "";
  logo.onerror = fallback;
  logo.onload = () => {
    const fit = analyzeLogo(logo);
    disc.classList.add(fit.cover || operator.profile.logoIsPhoto ? "is-cover" : "is-contain");
    disc.style.background = fit.background;
  };
  inner.append(logo);
  disc.append(inner);
  return disc;
}

function createGlobeVideoPreview(
  operator: PublicOperator,
  onOpen: () => void
) {
  const card = document.createElement("div");
  card.className = `globe-video-preview ${operator.type === "Facility" ? "is-facility" : operator.type === "Robotics" ? "is-robotics" : "is-company"}`;
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.setAttribute("aria-hidden", "true");
  card.setAttribute("aria-label", `Open ${operator.name} profile`);

  const panel = document.createElement("div");
  panel.className = "globe-video-panel";
  const heading = document.createElement("div");
  heading.className = "globe-video-heading";
  const category = document.createElement("span");
  category.textContent = operator.profile?.facility ? `FACILITY · ${operator.profile.facility.categoryLabel.toUpperCase()}` : operator.type === "Facility" ? "DATA FACILITY" : operator.type === "Robotics" ? "ROBOTICS PROVIDER" : "DATA COMPANY";
  const verified = document.createElement("span");
  verified.textContent = "VERIFIED";
  heading.append(category, verified);

  const media = document.createElement("div");
  media.className = "globe-video-media";
  const video = operator.media.kind === "video" ? document.createElement("video") : undefined;
  if (video) {
    video.src = operator.media.src;
    video.title = `${operator.name} video preview`;
    video.muted = true;
    video.defaultMuted = true;
    video.autoplay = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.tabIndex = -1;
    media.appendChild(video);
  } else {
    const image = document.createElement("img");
    image.alt = operator.media.alt;
    image.loading = "eager";
    image.decoding = "async";
    // Fades in if the image arrives after the card; preloaded images are complete immediately.
    const markLoaded = () => image.classList.add("is-loaded");
    image.onload = markLoaded;
    image.onerror = markLoaded;
    image.src = previewMediaSrc(operator);
    if (image.complete) markLoaded();
    media.appendChild(image);
  }

  const details = document.createElement("div");
  details.className = "globe-video-details";
  const copy = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = operator.name;
  const place = document.createElement("small");
  place.textContent = `${operator.city}, ${operator.country}`;
  copy.append(name, place);
  if (operator.company) {
    const owner = document.createElement("small");
    owner.className = "globe-video-company";
    owner.textContent = `by ${operator.company.name}`;
    copy.append(owner);
  }
  const action = document.createElement("span");
  action.setAttribute("aria-hidden", "true");
  action.textContent = "View profile ↗";
  details.append(createLogoDisc(operator), copy, action);

  const progress = document.createElement("i");
  progress.className = "globe-video-progress";
  panel.append(heading, media, details, progress);
  card.append(panel);

  const open = (event: Event) => { event.stopPropagation(); onOpen(); };
  card.addEventListener("click", open);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open(event);
    }
  });

  return {
    card,
    reveal: (reducedMotion: boolean) => {
      if (!reducedMotion) void video?.play().catch(() => undefined);
      card.setAttribute("aria-hidden", "false");
      card.classList.add("is-visible");
      if (reducedMotion) card.classList.add("is-static");
    },
    conceal: () => {
      video?.pause();
      card.setAttribute("aria-hidden", "true");
      card.classList.remove("is-visible");
    },
    dispose: () => {
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    },
  };
}

type GlobePreview = ReturnType<typeof createGlobeVideoPreview> & { remove: () => void; operator: PublicOperator };

function countryUniquePreviewOperators(operators: PublicOperator[]) {
  const countries = new Map<string, PublicOperator>();
  operators.forEach((operator) => {
    const key = operator.country.trim().toLocaleLowerCase();
    if (!key) return;
    const current = countries.get(key);
    if (!current || (operator.type === "Data Company" && current.type !== "Data Company")) countries.set(key, operator);
  });
  return [...countries.values()];
}

function tourOperators(operators: PublicOperator[]) {
  const uniqueCountries = countryUniquePreviewOperators(operators);
  if (uniqueCountries.length <= 5) return uniqueCountries;

  const sampleSize = Math.min(8, uniqueCountries.length);
  const orderedByLongitude = [...uniqueCountries].sort((a, b) => a.coordinates[0] - b.coordinates[0]);
  return Array.from({ length: sampleSize }, (_, index) => orderedByLongitude[Math.floor(index * orderedByLongitude.length / sampleSize)]);
}

function mountGlobePreview(map: GLMap, operator: PublicOperator, onOpen: () => void) {
  const preview = createGlobeVideoPreview(operator, onOpen);
  preview.card.classList.add("globe-floating-preview");
  document.body.appendChild(preview.card);

  const position = () => {
    const point = map.project(operator.coordinates);
    const bounds = map.getContainer().getBoundingClientRect();
    preview.card.style.left = `${bounds.left + point.x}px`;
    preview.card.style.top = `${bounds.top + point.y}px`;
    preview.card.classList.toggle("is-below", bounds.top + point.y < 260);
  };
  position();
  map.on("move", position);
  map.on("resize", position);

  return {
    ...preview,
    operator,
    remove: () => {
      map.off("move", position);
      map.off("resize", position);
      preview.card.remove();
    },
  };
}

function compactMarkerOffset(index: number, count: number): [number, number] {
  if (count === 1) return [0, 0];

  const row = Math.floor(index / 3);
  const firstIndexInRow = row * 3;
  const itemsInRow = Math.min(3, count - firstIndexInRow);
  const indexInRow = index - firstIndexInRow;
  const horizontalGap = 42;

  return [(indexInRow - (itemsInRow - 1) / 2) * horizontalGap, -row * 52];
}

function features(operators: PublicOperator[]): FeatureCollection<Point> {
  const totals = new Map<string, number>();
  const seen = new Map<string, number>();

  operators.forEach((operator) => {
    const key = operator.coordinates.join(",");
    totals.set(key, (totals.get(key) ?? 0) + 1);
  });

  return {
    type: "FeatureCollection",
    features: operators.map((operator) => {
      const key = operator.coordinates.join(",");
      const samePlaceIndex = seen.get(key) ?? 0;
      seen.set(key, samePlaceIndex + 1);
      const count = totals.get(key) ?? 1;
      const coordinates = operator.coordinates;

      return {
        type: "Feature",
        properties: { slug: operator.slug, name: operator.name, city: operator.city, kind: operator.type, logoIcon: logoIconId(operator), offset: compactMarkerOffset(samePlaceIndex, count) },
        geometry: { type: "Point", coordinates }
      };
    })
  };
}

export default function WorldMap(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GLMap | null>(null);
  const tourUpdateRef = useRef<(() => void) | null>(null);
  const latest = useRef(props);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const initialProjection = props.initialProjection ?? "globe";

  useEffect(() => { latest.current = props; });

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    let rotationFrame: number | undefined;
    let pulseFrame: number | undefined;
    let projectionFrame: number | undefined;
    let projectionClassTimer: number | undefined;
    let stopGlobePreview: (() => void) | undefined;
    let hasFlattened = initialProjection === "mercator";
    let flattenComplete = initialProjection === "mercator";
    let hasIntroduced = false;
    const landingZoom = () => latest.current.theme === "light" ? (window.innerWidth < 640 ? 1.5 : landingGlobeZoom) : 1.7;
    const emptyPadding = { top: 0, right: 0, bottom: 0, left: 0 };
    const globePadding = () => ({ ...emptyPadding, top: latest.current.theme === "light" && window.innerWidth > 760 ? 48 : 0 });
    const openingOperator = latest.current.theme === "light" && initialProjection === "globe" ? tourOperators(latest.current.operators)[0] : undefined;
    const openingCenter: [number, number] = openingOperator
      ? [openingOperator.coordinates[0] + 70, openingOperator.coordinates[1]]
      : [12, 25];
    // Start fetching tour media now, in parallel with the map bundle and style, not when the first popup mounts.
    if (openingOperator && latest.current.showPreviews !== false) void queuePreviews(tourOperators(latest.current.operators));

    async function initialize() {
      try {
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        let map: GLMap;

        if (token) {
          const mapbox = (await import("mapbox-gl")).default;
          if (cancelled || !container.current) return;
          map = new mapbox.Map({ container: container.current, accessToken: token, style: latest.current.theme === "light" ? "mapbox://styles/mapbox/light-v11" : "mapbox://styles/mapbox/dark-v11", center: openingCenter, zoom: landingZoom(), projection: initialProjection, attributionControl: true }) as unknown as GLMap;
        } else {
          const maplibre = await import("maplibre-gl");
          if (cancelled || !container.current) return;
          maplibre.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");
          map = new maplibre.Map({ container: container.current, style: latest.current.theme === "light" ? lightStyle : darkStyle, center: openingCenter, zoom: landingZoom(), minZoom: 1.1, maxZoom: 16, attributionControl: { compact: true } });
        }

        if (initialProjection === "globe") map.setPadding(globePadding());
        mapRef.current = map;
        const observer = new ResizeObserver(() => {
          map.resize();
          if (!hasFlattened) map.setPadding(globePadding());
        });
        observer.observe(container.current!);
        cleanup = () => { observer.disconnect(); map.remove(); mapRef.current = null; };

        map.on("error", (event) => {
          if (!map.getSource("operators")) setError("The map could not finish loading. Please retry or browse the directory.");
          if (!map.isStyleLoaded() && event.error?.message?.includes("Unauthorized")) setError("The configured map token could not be authorized.");
        });

        map.on("load", async () => {
          if (cancelled) return;
          if (token) (map as unknown as { setProjection: (projection: string) => void }).setProjection(initialProjection);
          else map.setProjection({ type: initialProjection });

          // Category markers, used until (or unless) a company logo loads.
          try {
            await Promise.all((Object.keys(markerStyles) as MarkerKind[]).map(async (kind) => {
              const id = `marker-${kind}`;
              const image = await drawMarker(kind);
              if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio: MARKER.scale });
            }));
          } catch (e) {
            console.error("Failed to load map icons", e);
          }

          map.addSource("operators", { type: "geojson", data: features(latest.current.operators) });
          // Ripples lie flat on the map surface, so on the globe they wrap around the Earth.
          map.addLayer({
            id: "location-pulse",
            type: "circle",
            source: "operators",
            paint: {
              "circle-radius": 6,
              "circle-color": pulseColor,
              "circle-opacity": .22,
              "circle-stroke-color": pulseColor,
              "circle-stroke-width": 1.2,
              "circle-stroke-opacity": .5,
              "circle-pitch-alignment": "map",
              "circle-blur": .25
            }
          });
          if (!latest.current.reducedMotion) {
            const pulseDuration = 2_400;
            let lastPulse = 0;
            const pulse = (time: number) => {
              if (cancelled || mapRef.current !== map) return;
              pulseFrame = window.requestAnimationFrame(pulse);
              if (time - lastPulse < 33 || !map.getLayer("location-pulse")) return;
              lastPulse = time;
              const progress = (time % pulseDuration) / pulseDuration;
              const eased = 1 - Math.pow(1 - progress, 3);
              map.setPaintProperty("location-pulse", "circle-radius", 4 + eased * 20);
              map.setPaintProperty("location-pulse", "circle-opacity", .28 * (1 - progress));
              map.setPaintProperty("location-pulse", "circle-stroke-opacity", .7 * (1 - progress));
            };
            pulseFrame = window.requestAnimationFrame(pulse);
          }
          // Transparent hit targets keep the colored line icons easy to select.
          map.addLayer({
            id: "marker-hit-area",
            type: "circle",
            source: "operators",
            paint: {
              "circle-radius": 18,
              "circle-color": "#000000",
              "circle-opacity": 0
            }
          });

          map.addLayer({
            id: "marker-icons",
            type: "symbol",
            source: "operators",
            layout: {
              // Branded logo pins take priority; the category icon shows until (or unless) the logo loads.
              "icon-image": [
                "coalesce",
                ["image", ["get", "logoIcon"]],
                ["image", ["concat", "marker-", ["get", "kind"]]],
                ["image", "marker-Data Company"]
              ],
              "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 0.9, 5, 0.96, 10, 1.05],
              "icon-anchor": "bottom",
              "icon-offset": ["get", "offset"],
              "icon-allow-overlap": true
            }
          });

          void addLogoPins(map, latest.current.operators);

          tourUpdateRef.current = () => {
            stopGlobePreview?.();
            if (cancelled || hasFlattened || initialProjection !== "globe" || latest.current.theme !== "light" || latest.current.showPreviews === false) return;

            const previewOperators = tourOperators(latest.current.operators);
            if (!previewOperators.length) return;
            void queuePreviews(previewOperators);
            let previewIndex = 0;
            let currentPreview: GlobePreview | undefined;
            let dwellTimer: number | undefined;
            let stopped = false;
            const dwellDuration = 5_000;
            const fullTurnDuration = 12_000;

            const destroyPreview = () => {
              if (!currentPreview) return;
              currentPreview.conceal();
              currentPreview.dispose();
              currentPreview.remove();
              currentPreview = undefined;
            };

            const showPreview = (operator: PublicOperator) => {
              if (stopped || cancelled || hasFlattened) return;
              map.jumpTo({ center: operator.coordinates, zoom: landingZoom() });
              const preview = mountGlobePreview(map, operator, () => {
                latest.current.onInteract();
                flattenMap();
                if (latest.current.allowSelection !== false) latest.current.onSelect([operator]);
              });
              currentPreview = preview;
              // Reveal once the media is decoded (usually instant thanks to the queue), capped so a slow asset never stalls the tour.
              void settleWithin(warmPreview(operator), 1_200).then(() => {
                if (stopped || cancelled || hasFlattened || currentPreview !== preview) return;
                preview.reveal(latest.current.reducedMotion);
                if (!latest.current.reducedMotion || previewOperators.length > 1) dwellTimer = window.setTimeout(advance, dwellDuration);
              });
            };

            const advance = () => {
              if (stopped || cancelled || hasFlattened) return;
              previewIndex = (previewIndex + 1) % previewOperators.length;
              const to = previewOperators[previewIndex];
              destroyPreview();
              if (latest.current.reducedMotion) {
                showPreview(to);
                return;
              }

              const startingLongitude = map.getCenter().lng;
              const longitudeDistance = ((startingLongitude - to.coordinates[0]) % 360 + 360) % 360 || 360;
              const startingLatitude = map.getCenter().lat;
              const duration = previewOperators.length === 1 ? fullTurnDuration : Math.max(3_200, Math.min(6_000, longitudeDistance * 17));
              let startedAt = 0;
              const rotate = (time: number) => {
                if (stopped || cancelled || hasFlattened) return;
                if (!startedAt) startedAt = time;
                const progress = Math.min(1, (time - startedAt) / duration);
                const eased = progress < .5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                map.setCenter([startingLongitude - longitudeDistance * eased, startingLatitude + (to.coordinates[1] - startingLatitude) * eased]);
                if (progress < 1) rotationFrame = window.requestAnimationFrame(rotate);
                else showPreview(to);
              };
              rotationFrame = window.requestAnimationFrame(rotate);
            };

            stopGlobePreview = () => {
              stopped = true;
              if (dwellTimer) window.clearTimeout(dwellTimer);
              if (rotationFrame) window.cancelAnimationFrame(rotationFrame);
              destroyPreview();
            };
            const firstOperator = previewOperators[0];
            if (hasIntroduced || latest.current.reducedMotion) {
              showPreview(firstOperator);
              return;
            }

            hasIntroduced = true;
            const [longitude, latitude] = firstOperator.coordinates;
            const startingLongitude = map.getCenter().lng;
            const startedAt = performance.now();
            const introDuration = 2_400;
            const introduce = (time: number) => {
              if (stopped || cancelled || hasFlattened) return;
              const progress = Math.min(1, (time - startedAt) / introDuration);
              const eased = progress * progress * (3 - 2 * progress);
              map.setCenter([startingLongitude + (longitude - startingLongitude) * eased, latitude]);
              if (progress < 1) rotationFrame = window.requestAnimationFrame(introduce);
              else showPreview(firstOperator);
            };
            rotationFrame = window.requestAnimationFrame(introduce);
          };

          setReady(true);
          setError("");
          latest.current.onProjectionChange?.(initialProjection);
          latest.current.onReady({
            flyTo: (coordinates, zoom = 4.2, padding) => {
              if (!flattenComplete) flattenMap({ center: coordinates, zoom, ...(padding ? { padding } : {}) });
              else map.flyTo({ center: coordinates, zoom, ...(padding ? { padding } : {}), pitch: 0, duration: latest.current.reducedMotion ? 0 : 1_350, easing: smoothStep, essential: false });
            },
            reset: () => map.flyTo({ center: [12, 25], zoom: landingZoom(), pitch: 0, bearing: 0, duration: latest.current.reducedMotion ? 0 : 1400 }),
            zoom: (amount) => {
              const zoom = map.getZoom() + amount;
              if (!flattenComplete) flattenMap({ center: [map.getCenter().lng, map.getCenter().lat], zoom });
              else map.zoomTo(zoom, { duration: 420, easing: smoothStep });
            },
            setProjection: (projection) => {
              if (projection === "mercator") flattenMap();
              else restoreGlobe();
            },
            stop: () => { map.stop(); },
          });
        });

        const smoothStep = (time: number) => time < .5 ? 4 * time * time * time : 1 - Math.pow(-2 * time + 2, 3) / 2;
        const flattenMap = (camera?: { center: [number, number]; zoom: number; padding?: { top: number; right?: number; bottom?: number; left?: number } }) => {
          if (flattenComplete) {
            if (camera) map.flyTo({ center: camera.center, zoom: camera.zoom, ...(camera.padding ? { padding: camera.padding } : {}), pitch: 0, bearing: 0, duration: latest.current.reducedMotion ? 0 : 220, easing: smoothStep, essential: false });
            return;
          }
          if (hasFlattened) return;
          hasFlattened = true;
          if (rotationFrame) window.cancelAnimationFrame(rotationFrame);
          stopGlobePreview?.();
          const finish = () => {
            if (cancelled) return;
            if (token) (map as unknown as { setProjection: (projection: string) => void }).setProjection("mercator");
            else map.setProjection({ type: "mercator" });
            flattenComplete = true;
            latest.current.onProjectionChange?.("mercator");
            if (container.current) {
              container.current.dataset.projection = "mercator";
              container.current.classList.remove("is-flattening");
              container.current.classList.add("is-settling");
              projectionClassTimer = window.setTimeout(() => container.current?.classList.remove("is-settling"), 120);
            }
          };
          if (latest.current.reducedMotion) {
            map.jumpTo({ ...camera, padding: { ...emptyPadding, ...camera?.padding }, pitch: 0, bearing: 0 });
            finish();
            return;
          }
          container.current?.classList.add("is-flattening");
          if (container.current) container.current.dataset.projection = "transitioning";
          map.stop();
          map.easeTo({ ...(camera ? { center: camera.center, zoom: camera.zoom } : {}), padding: { ...emptyPadding, ...camera?.padding }, pitch: 0, bearing: 0, duration: 180, easing: smoothStep, essential: false });
          const startedAt = performance.now();
          const animateProjection = (time: number) => {
            if (cancelled) return;
            const progress = Math.min(1, (time - startedAt) / 180);
            const eased = smoothStep(progress);
            if (!token) map.setProjection({ type: ["vertical-perspective", "mercator", eased] });
            if (progress < 1) projectionFrame = window.requestAnimationFrame(animateProjection);
            else finish();
          };
          projectionFrame = window.requestAnimationFrame(animateProjection);
        };
        const restoreGlobe = () => {
          map.stop();
          if (projectionFrame) window.cancelAnimationFrame(projectionFrame);
          if (projectionClassTimer) window.clearTimeout(projectionClassTimer);
          hasFlattened = false;
          flattenComplete = false;
          if (token) (map as unknown as { setProjection: (projection: string) => void }).setProjection("globe");
          else map.setProjection({ type: "globe" });
          if (container.current) {
            container.current.dataset.projection = "globe";
            container.current.classList.remove("is-flattening", "is-settling");
          }
          latest.current.onProjectionChange?.("globe");
          map.easeTo({ center: [12, 25], zoom: landingZoom(), padding: globePadding(), pitch: 0, bearing: 0, duration: latest.current.reducedMotion ? 0 : 1_100, easing: smoothStep, essential: false });
        };
        const interact = () => { if (map.isStyleLoaded()) flattenMap(); latest.current.onInteract(); };
        map.getCanvas().addEventListener("pointerdown", interact);
        const previousCleanup = cleanup;
        cleanup = () => { map.getCanvas().removeEventListener("pointerdown", interact); previousCleanup?.(); };

        map.on("click", async (event) => {
          latest.current.onInteract();
          flattenMap();
          if (!map.getLayer("marker-icons")) return;
          const hit = map.queryRenderedFeatures(event.point, { layers: ["marker-icons"] })[0];
          if (!hit) return;
          const operator = latest.current.operators.find((item) => item.slug === hit.properties?.slug);
          if (operator && latest.current.allowSelection !== false) latest.current.onSelect([operator]);
        });

        for (const event of ["dragstart", "zoomstart", "rotatestart", "pitchstart"] as const) {
          map.on(event, (e) => {
            if (e.originalEvent) {
              flattenMap();
              latest.current.onInteract();
            }
          });
        }

        map.on("mouseenter", "marker-icons", () => { if (latest.current.allowSelection !== false) map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "marker-icons", () => { map.getCanvas().style.cursor = ""; });

      } catch {
        if (!cancelled) setError("Your browser could not start the map. Enable hardware acceleration or browse the directory.");
      }
    }

    initialize();

    return () => {
      cancelled = true;
      tourUpdateRef.current = null;
      if (rotationFrame) window.cancelAnimationFrame(rotationFrame);
      if (pulseFrame) window.cancelAnimationFrame(pulseFrame);
      if (projectionFrame) window.cancelAnimationFrame(projectionFrame);
      if (projectionClassTimer) window.clearTimeout(projectionClassTimer);
      stopGlobePreview?.();
      cleanup?.();
    };
  }, [attempt, initialProjection]);

  useEffect(() => {
    const source = mapRef.current?.getSource("operators") as GeoJSONSource | undefined;
    source?.setData(features(props.operators));
    if (ready && mapRef.current) void addLogoPins(mapRef.current, props.operators);
    if (ready) tourUpdateRef.current?.();
  }, [props.operators, ready]);

  return (
    <div className="world-map-wrap">
      <div ref={container} className="world-map" data-projection={initialProjection} aria-label={`Interactive ${initialProjection === "mercator" ? "2D map" : "3D globe"} of data providers and facilities`}/>
      {!ready && !error && (
        <div className="map-loading">
          <Globe2 className="spin" size={36} strokeWidth={1}/>
          <span>Connecting the world…</span>
        </div>
      )}
      {error && (
        <div className="map-error" role="alert">
          <p>{error}</p>
          <button onClick={() => { setError(""); setReady(false); setAttempt((value) => value + 1); }}>
            <RotateCw size={14}/> Retry map
          </button>
        </div>
      )}
    </div>
  );
}
