"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Map as GLMap, GeoJSONSource, StyleSpecification } from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import { Globe2, RotateCw } from "lucide-react";
import type { MapHandle, PublicOperator } from "./model";

type Props = { operators: PublicOperator[]; onReady: (map: MapHandle) => void; onSelect: (operators: PublicOperator[]) => void; onInteract: () => void; reducedMotion: boolean; theme?: "dark" | "light"; showMediaPins?: boolean; allowSelection?: boolean };
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

function features(operators: PublicOperator[]): FeatureCollection<Point> {
  return { type: "FeatureCollection", features: operators.map((operator) => ({ type: "Feature", properties: { slug: operator.slug, name: operator.name, city: operator.city }, geometry: { type: "Point", coordinates: operator.coordinates } })) };
}

export default function WorldMap(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GLMap | null>(null);
  const latest = useRef(props);
  const updateMediaRef = useRef<(() => void) | null>(null);
  const router = useRouter();
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [mediaPositions, setMediaPositions] = useState<Array<{ operator: PublicOperator; x: number; y: number }>>([]);
  useEffect(() => { latest.current = props; });

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    async function initialize() {
      try {
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        let map: GLMap;
        if (token) {
          const mapbox = (await import("mapbox-gl")).default;
          if (cancelled || !container.current) return;
          map = new mapbox.Map({ container: container.current, accessToken: token, style: latest.current.theme === "light" ? "mapbox://styles/mapbox/light-v11" : "mapbox://styles/mapbox/dark-v11", center: [12, 25], zoom: latest.current.theme === "light" ? 2.8 : 1.7, projection: "globe", attributionControl: true }) as unknown as GLMap;
        } else {
          const maplibre = await import("maplibre-gl");
          if (cancelled || !container.current) return;
          maplibre.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");
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
        map.on("load", () => {
          if (cancelled) return;
          if (!token) map.setProjection({ type: "globe" });
          map.addSource("operators", { type: "geojson", data: features(latest.current.operators), cluster: true, clusterMaxZoom: 14, clusterRadius: 46 });
          const light = latest.current.theme === "light";
          map.addLayer({ id: "marker-glow", type: "circle", source: "operators", paint: { "circle-radius": ["case", ["has", "point_count"], 28, 17], "circle-color": light ? "#5b84df" : "#28cda6", "circle-opacity": light ? .1 : .12, "circle-blur": .3 } });
          map.addLayer({ id: "clusters", type: "circle", source: "operators", filter: ["has", "point_count"], paint: { "circle-color": light ? "#ffffff" : "#28cda6", "circle-radius": ["step", ["get", "point_count"], 17, 8, 21, 15, 25], "circle-stroke-width": 2, "circle-stroke-color": light ? "#31cbaa" : "#7ce7c8" } });
          map.addLayer({ id: "cluster-count", type: "symbol", source: "operators", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Open Sans Semibold"], "text-size": 12 }, paint: { "text-color": light ? "#34413f" : "#062d30" } });
          map.addLayer({ id: "operator-points", type: "circle", source: "operators", filter: ["!", ["has", "point_count"]], paint: { "circle-color": light ? "#5b84df" : "#6292ec", "circle-radius": 8, "circle-stroke-width": 2, "circle-stroke-color": light ? "#ffffff" : "#b8d2ff" } });
          const updateMedia = () => {
            if (!latest.current.showMediaPins) return setMediaPositions([]);
            const seen = new Set<string>();
            const candidates = latest.current.operators.filter((operator) => !seen.has(operator.city) && seen.add(operator.city));
            const canvas = map.getCanvas();
            setMediaPositions(candidates.map((operator) => {
              const point = map.project(operator.coordinates);
              return { operator, x: point.x, y: point.y };
            }).filter((item) => item.x > 55 && item.x < canvas.clientWidth - 55 && item.y > 70 && item.y < canvas.clientHeight - 75));
          };
          updateMediaRef.current = updateMedia;
          updateMedia();
          map.on("move", updateMedia);
          map.on("resize", updateMedia);
          setReady(true); setError("");
          latest.current.onReady({
            flyTo: (coordinates, zoom = 4.2) => map.flyTo({ center: coordinates, zoom, pitch: 25, duration: latest.current.reducedMotion ? 0 : 1800, essential: false }),
            reset: () => map.flyTo({ center: [12, 25], zoom: latest.current.theme === "light" ? 2.8 : 1.7, pitch: 0, bearing: 0, duration: latest.current.reducedMotion ? 0 : 1400 }),
            zoom: (amount) => map.zoomTo(map.getZoom() + amount, { duration: 350 }),
            stop: () => { map.stop(); },
          });
        });
        map.on("click", async (event) => {
          latest.current.onInteract();
          if (!map.getLayer("clusters")) return;
          const hit = map.queryRenderedFeatures(event.point, { layers: ["clusters", "operator-points"] })[0];
          if (!hit) return;
          if (hit.properties?.cluster_id !== undefined) {
            const source = map.getSource("operators") as GeoJSONSource;
            try {
              // Mapbox uses callbacks, MapLibre returns promises for cluster queries.
              const leaves = token ? await new Promise<GeoJSON.Feature[]>((resolve, reject) => {
                (source.getClusterLeaves as unknown as (id: number, limit: number, offset: number, callback: (error: Error | null, leaves: GeoJSON.Feature[]) => void) => void)(Number(hit.properties.cluster_id), 100, 0, (err, result) => err ? reject(err) : resolve(result));
              }) : await source.getClusterLeaves(Number(hit.properties.cluster_id), 100, 0);
              if (cancelled) return;
              const slugs = new Set(leaves.map((leaf) => leaf.properties?.slug));
              const group = latest.current.operators.filter((operator) => slugs.has(operator.slug));
              if (group.length) { latest.current.onSelect(group); map.easeTo({ center: group[0].coordinates, zoom: Math.min(map.getZoom() + 1.5, 9), duration: 700 }); }
            } catch { setError("Could not open this cluster. Please try again."); }
          } else {
            const operator = latest.current.operators.find((item) => item.slug === hit.properties?.slug);
            if (operator && latest.current.allowSelection !== false) latest.current.onSelect([operator]);
          }
        });
        for (const event of ["dragstart", "zoomstart", "rotatestart", "pitchstart"] as const) map.on(event, (e) => { if (e.originalEvent) latest.current.onInteract(); });
        map.on("mouseenter", "marker-glow", () => { if (latest.current.allowSelection !== false) map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "marker-glow", () => { map.getCanvas().style.cursor = ""; });
      } catch { if (!cancelled) setError("Your browser could not start the 3D map. Enable hardware acceleration or browse the directory."); }
    }
    initialize();
    return () => { cancelled = true; cleanup?.(); };
  }, [attempt]);

  useEffect(() => {
    const source = mapRef.current?.getSource("operators") as GeoJSONSource | undefined;
    source?.setData(features(props.operators));
    updateMediaRef.current?.();
  }, [props.operators, ready]);

  return <div className="world-map-wrap">
    <div ref={container} className="world-map" aria-label="Interactive 3D globe of data providers and facilities"/>
    {!ready && !error && <div className="map-loading"><Globe2 className="spin" size={36} strokeWidth={1}/><span>Connecting the world…</span></div>}
    {error && <div className="map-error" role="alert"><p>{error}</p><button onClick={() => { setError(""); setReady(false); setAttempt((value) => value + 1); }}><RotateCw size={14}/> Retry map</button></div>}
    {props.showMediaPins && <div className="geo-media-layer" aria-label="Sample videos at network locations">{mediaPositions.map(({ operator, x, y }, index) => {
      return <button type="button" key={operator.slug} className={`geo-media-pin geo-media-pin-${index % 3}`} style={{ left: x, top: y }} aria-label={`View ${operator.name} profile`} onClick={() => router.push(`/operators/${operator.slug}`)}>
        <video autoPlay muted loop playsInline preload="metadata" src={`/demo/${operator.modalities.includes("Egocentric video") ? "robotics" : "perception"}.mp4`}/>
        <span>Verified location</span><strong>{operator.city}</strong><small>View provider profile</small>
      </button>;
    })}</div>}
  </div>;
}
