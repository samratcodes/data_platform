"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as GLMap, GeoJSONSource, StyleSpecification } from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import { Globe2, RotateCw } from "lucide-react";
import type { MapHandle, MapProjection, PublicOperator } from "./model";

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

const pinShell = (color: string, tint: string, glyph: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
  <defs><filter id="shadow" x="-30%" y="-20%" width="160%" height="160%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.4" flood-color="#16352f" flood-opacity=".2"/></filter></defs>
  <path filter="url(#shadow)" d="M18 1.5C9.35 1.5 2.5 8.1 2.5 16.45 2.5 27.7 18 42 18 42s15.5-14.3 15.5-25.55C33.5 8.1 26.65 1.5 18 1.5Z" fill="#fff" stroke="${color}" stroke-width="1.65"/>
  <circle cx="18" cy="16.5" r="10.4" fill="${tint}"/>
  <g transform="translate(9 7.5) scale(.75)" fill="none" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>
</svg>`;

const iconFactory = pinShell(
  "#059669",
  "#ecfdf5",
  '<path d="M3 21h18V10l-6 4v-4l-6 4V5H5a2 2 0 0 0-2 2Z"/><path d="M8 18h1M13 18h1M18 18h1"/>'
);
const iconCompany = pinShell(
  "#2563eb",
  "#eff6ff",
  '<ellipse cx="12" cy="5" rx="8.5" ry="3"/><path d="M3.5 5v7c0 1.65 3.8 3 8.5 3s8.5-1.35 8.5-3V5M3.5 12v7c0 1.65 3.8 3 8.5 3s8.5-1.35 8.5-3v-7"/>'
);
const iconBot = pinShell(
  "#7c3aed",
  "#f5f3ff",
  '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="3"/><path d="M2 14h2M20 14h2M15.5 13.5v1M8.5 13.5v1"/>'
);

const createMapIcon = (svgString: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image(36, 44);
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
  });
};

type RuntimeMarker = {
  setLngLat: (coordinates: [number, number]) => RuntimeMarker;
  addTo: (map: unknown) => RuntimeMarker;
  remove: () => void;
};

type RuntimeMarkerConstructor = new (options: {
  element: HTMLElement;
  anchor: "bottom";
  offset: [number, number];
}) => RuntimeMarker;

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
    image.src = operator.media.src.startsWith("https://")
      ? `/_next/image?url=${encodeURIComponent(operator.media.src)}&w=640&q=75`
      : operator.media.src;
    image.alt = operator.media.alt;
    image.loading = "eager";
    media.appendChild(image);
  }

  const live = document.createElement("span");
  live.className = "globe-video-live";
  live.textContent = operator.media.label.toUpperCase();
  media.appendChild(live);

  const details = document.createElement("div");
  details.className = "globe-video-details";
  const copy = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = operator.name;
  const place = document.createElement("small");
  place.textContent = `${operator.type} · ${operator.city}, ${operator.country}`;
  copy.append(name, place);
  const action = document.createElement("span");
  action.setAttribute("aria-hidden", "true");
  action.textContent = "↗";
  details.append(copy, action);

  const progress = document.createElement("i");
  progress.className = "globe-video-progress";
  card.append(media, details, progress);

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
    reveal: () => {
      void video?.play().catch(() => undefined);
      card.setAttribute("aria-hidden", "false");
      card.classList.add("is-visible");
    },
    conceal: () => {
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

type GlobePreview = ReturnType<typeof createGlobeVideoPreview> & { marker: RuntimeMarker; operator: PublicOperator };

function countryUniquePreviewOperators(operators: PublicOperator[]) {
  const countries = new Map<string, PublicOperator>();
  operators.forEach((operator) => {
    const key = operator.country.trim().toLocaleLowerCase();
    if (!key) return;
    if (!countries.has(key)) countries.set(key, operator);
  });
  return [...countries.values()];
}

function compactMarkerOffset(index: number, count: number): [number, number] {
  if (count === 1) return [0, 0];

  const row = Math.floor(index / 3);
  const firstIndexInRow = row * 3;
  const itemsInRow = Math.min(3, count - firstIndexInRow);
  const indexInRow = index - firstIndexInRow;
  const horizontalGap = 31;

  return [(indexInRow - (itemsInRow - 1) / 2) * horizontalGap, -row * 36];
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
        properties: { slug: operator.slug, name: operator.name, city: operator.city, kind: operator.type, offset: compactMarkerOffset(samePlaceIndex, count) },
        geometry: { type: "Point", coordinates }
      };
    })
  };
}

export default function WorldMap(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GLMap | null>(null);
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
    let projectionFrame: number | undefined;
    let projectionClassTimer: number | undefined;
    let stopGlobePreview: (() => void) | undefined;
    let previewTourActive = false;
    let hasFlattened = initialProjection === "mercator";
    let flattenComplete = initialProjection === "mercator";
    let lastRotationTime = 0;

    async function initialize() {
      try {
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        let map: GLMap;
        let MarkerClass: RuntimeMarkerConstructor;

        if (token) {
          const mapbox = (await import("mapbox-gl")).default;
          if (cancelled || !container.current) return;
          MarkerClass = mapbox.Marker as unknown as RuntimeMarkerConstructor;
          map = new mapbox.Map({ container: container.current, accessToken: token, style: latest.current.theme === "light" ? "mapbox://styles/mapbox/light-v11" : "mapbox://styles/mapbox/dark-v11", center: [12, 25], zoom: latest.current.theme === "light" ? 2.8 : 1.7, projection: initialProjection, attributionControl: true }) as unknown as GLMap;
        } else {
          const maplibre = await import("maplibre-gl");
          if (cancelled || !container.current) return;
          maplibre.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");
          MarkerClass = maplibre.Marker as unknown as RuntimeMarkerConstructor;
          map = new maplibre.Map({ container: container.current, style: latest.current.theme === "light" ? lightStyle : darkStyle, center: [12, 25], zoom: latest.current.theme === "light" ? 2.8 : 1.7, minZoom: 1.1, maxZoom: 16, attributionControl: { compact: true } });
        }

        mapRef.current = map;
        const observer = new ResizeObserver(() => map.resize());
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

          // Load Custom High-Res Icons
          try {
            const [imgFactory, imgCompany, imgBot] = await Promise.all([
              createMapIcon(iconFactory),
              createMapIcon(iconCompany),
              createMapIcon(iconBot)
            ]);

            if (!map.hasImage("icon-factory")) map.addImage("icon-factory", imgFactory);
            if (!map.hasImage("icon-company")) map.addImage("icon-company", imgCompany);
            if (!map.hasImage("icon-bot")) map.addImage("icon-bot", imgBot);
          } catch (e) {
            console.error("Failed to load map icons", e);
          }

          map.addSource("operators", { type: "geojson", data: features(latest.current.operators) });
          map.addLayer({
            id: "location-halo",
            type: "circle",
            source: "operators",
            paint: {
              "circle-radius": 7,
              "circle-color": "#ffffff",
              "circle-stroke-color": "#c8d9d4",
              "circle-stroke-width": 1
            }
          });
          map.addLayer({
            id: "location-point",
            type: "circle",
            source: "operators",
            paint: {
              "circle-radius": 3.2,
              "circle-color": "#0f766e"
            }
          });
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
              "icon-image": [
                "match", ["get", "kind"],
                "Facility", "icon-factory",
                "Data Company", "icon-company",
                "Robotics", "icon-bot",
                "icon-company"
              ],
              "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 0.72, 5, 0.82, 10, 0.92],
              "icon-anchor": "bottom",
              "icon-offset": ["get", "offset"],
              "icon-allow-overlap": true
            }
          });

          if (latest.current.theme === "light" && latest.current.showPreviews !== false && latest.current.operators.length > 0) {
            let previewIndex = 0;
            let currentPreview: GlobePreview | undefined;
            let queuedPreview: GlobePreview | undefined;
            let revealTimer: number | undefined;
            let cameraTimer: number | undefined;
            let cycleTimer: number | undefined;
            let stopped = false;
            const visibleSampleDuration = 5_000;
            const cameraLeadTime = 1_200;

            const previewOperators = countryUniquePreviewOperators(latest.current.operators);

            const mountPreview = (index: number): GlobePreview | undefined => {
              if (!previewOperators.length) return;
              const operator = previewOperators[index % previewOperators.length];
              const preview = createGlobeVideoPreview(operator, () => {
                latest.current.onInteract();
                flattenMap();
                if (latest.current.allowSelection !== false) latest.current.onSelect([operator]);
              });
              const marker = new MarkerClass({ element: preview.card, anchor: "bottom", offset: [0, -30] })
                .setLngLat(operator.coordinates)
                .addTo(map);
              return { ...preview, marker, operator };
            };

            const destroyPreview = (preview: GlobePreview | undefined) => {
              if (!preview) return;
              preview.conceal();
              preview.dispose();
              preview.marker.remove();
            };

            const clearTimers = () => {
              if (revealTimer) window.clearTimeout(revealTimer);
              if (cameraTimer) window.clearTimeout(cameraTimer);
              if (cycleTimer) window.clearTimeout(cycleTimer);
              revealTimer = undefined;
              cameraTimer = undefined;
              cycleTimer = undefined;
            };

            const scheduleAdvance = () => {
              if (stopped || cancelled || hasFlattened) return;
              cameraTimer = window.setTimeout(() => {
                if (stopped || hasFlattened || !queuedPreview) return;
                map.easeTo({ center: queuedPreview.operator.coordinates, duration: latest.current.reducedMotion ? 0 : cameraLeadTime, easing: (time) => time < .5 ? 4 * time * time * time : 1 - Math.pow(-2 * time + 2, 3) / 2, essential: false });
              }, Math.max(0, visibleSampleDuration - cameraLeadTime));
              cycleTimer = window.setTimeout(() => {
                if (stopped || hasFlattened || !queuedPreview) return;
                const previous = currentPreview;
                currentPreview = queuedPreview;
                currentPreview.reveal();
                previewIndex += 1;
                queuedPreview = mountPreview(previewIndex + 1);
                destroyPreview(previous);
                scheduleAdvance();
              }, visibleSampleDuration);
            };

            stopGlobePreview = () => {
              stopped = true;
              previewTourActive = false;
              clearTimers();
              destroyPreview(currentPreview);
              destroyPreview(queuedPreview);
              currentPreview = undefined;
              queuedPreview = undefined;
            };
            currentPreview = mountPreview(0);
            queuedPreview = mountPreview(1);
            if (currentPreview) {
              previewTourActive = true;
              map.easeTo({ center: currentPreview.operator.coordinates, duration: 0, essential: false });
              currentPreview.reveal();
              scheduleAdvance();
            }
          }

          if (initialProjection === "globe" && latest.current.theme === "light" && !latest.current.reducedMotion) {
            const rotate = (time: number) => {
              if (cancelled || hasFlattened) return;
              if (lastRotationTime && !previewTourActive) {
                const center = map.getCenter();
                center.lng -= (time - lastRotationTime) * 0.0022;
                map.setCenter(center);
              }
              lastRotationTime = time;
              rotationFrame = window.requestAnimationFrame(rotate);
            };
            rotationFrame = window.requestAnimationFrame(rotate);
          }

          setReady(true);
          setError("");
          latest.current.onProjectionChange?.(initialProjection);
          latest.current.onReady({
            flyTo: (coordinates, zoom = 4.2, padding) => {
              if (!flattenComplete) flattenMap({ center: coordinates, zoom, padding });
              else map.flyTo({ center: coordinates, zoom, padding, pitch: 0, duration: latest.current.reducedMotion ? 0 : 1_350, easing: smoothStep, essential: false });
            },
            reset: () => map.flyTo({ center: [12, 25], zoom: latest.current.theme === "light" ? 2.8 : 1.7, pitch: 0, bearing: 0, duration: latest.current.reducedMotion ? 0 : 1400 }),
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
            if (camera) map.flyTo({ ...camera, pitch: 0, bearing: 0, duration: latest.current.reducedMotion ? 0 : 1_350, easing: smoothStep, essential: false });
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
              projectionClassTimer = window.setTimeout(() => container.current?.classList.remove("is-settling"), 420);
            }
          };
          if (latest.current.reducedMotion) {
            if (camera) map.jumpTo({ ...camera, pitch: 0, bearing: 0 });
            finish();
            return;
          }
          container.current?.classList.add("is-flattening");
          if (container.current) container.current.dataset.projection = "transitioning";
          map.stop();
          map.easeTo({ ...(camera || {}), pitch: 0, bearing: 0, duration: 920, easing: smoothStep, essential: false });
          const startedAt = performance.now();
          const animateProjection = (time: number) => {
            if (cancelled) return;
            const progress = Math.min(1, (time - startedAt) / 920);
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
          map.easeTo({ center: [12, 25], zoom: latest.current.theme === "light" ? 2.8 : 1.7, pitch: 0, bearing: 0, duration: latest.current.reducedMotion ? 0 : 1_100, easing: smoothStep, essential: false });
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
      if (rotationFrame) window.cancelAnimationFrame(rotationFrame);
      if (projectionFrame) window.cancelAnimationFrame(projectionFrame);
      if (projectionClassTimer) window.clearTimeout(projectionClassTimer);
      stopGlobePreview?.();
      cleanup?.();
    };
  }, [attempt, initialProjection]);

  useEffect(() => {
    const source = mapRef.current?.getSource("operators") as GeoJSONSource | undefined;
    source?.setData(features(props.operators));
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
