"use client";

export { default } from "./FacilityLocationPickerV2";

import { useEffect, useRef, useState } from "react";
import { Crosshair, LoaderCircle, MapPin, Search } from "lucide-react";
import type { Map as GLMap, Marker as GLMarker, StyleSpecification } from "maplibre-gl";

export type PickedLocation = {
  longitude: number;
  latitude: number;
  label?: string;
  city?: string;
  country?: string;
  name?: string;
  mapsUrl?: string;
  photos?: string[];
};

type SearchResult = PickedLocation & { label: string };

const pickerStyle: StyleSpecification = {
  version: 8,
  glyphs: "/fonts/{fontstack}/{range}.pbf",
  sources: {
    world: { type: "geojson", data: "/world.geojson", attribution: '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap search</a> · <a href="https://www.naturalearthdata.com/">Natural Earth</a>' },
    names: { type: "geojson", data: "/country-labels.geojson" },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#edf5f2" } },
    { id: "land", type: "fill", source: "world", paint: { "fill-color": "#ffffff", "fill-opacity": 1 } },
    { id: "borders", type: "line", source: "world", paint: { "line-color": "#b8cdc7", "line-width": .8 } },
    { id: "labels", type: "symbol", source: "names", minzoom: 1.2, layout: { "text-field": ["get", "NAME"], "text-font": ["Open Sans Semibold"], "text-size": 10 }, paint: { "text-color": "#6a817a", "text-halo-color": "#ffffff", "text-halo-width": 1.5 } },
  ],
};

function LegacyFacilityLocationPicker({ longitude, latitude, onChange }: { longitude: string; latitude: string; onChange: (location: PickedLocation) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GLMap | null>(null);
  const markerRef = useRef<GLMarker | null>(null);
  const onChangeRef = useRef(onChange);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Click the map to place the facility pin.");

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | undefined;
    (async () => {
      const maplibre = await import("maplibre-gl");
      if (disposed || !container.current) return;
      maplibre.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");
      const parsedLongitude = Number(longitude);
      const parsedLatitude = Number(latitude);
      const hasCoordinates = Number.isFinite(parsedLongitude) && Number.isFinite(parsedLatitude) && longitude !== "" && latitude !== "";
      const map = new maplibre.Map({ container: container.current, style: pickerStyle, center: hasCoordinates ? [parsedLongitude, parsedLatitude] : [12, 22], zoom: hasCoordinates ? 10 : 1.25, minZoom: 1, maxZoom: 17, attributionControl: { compact: true } });
      mapRef.current = map;
      map.on("click", (event) => {
        const point = { longitude: Number(event.lngLat.lng.toFixed(6)), latitude: Number(event.lngLat.lat.toFixed(6)) };
        onChangeRef.current(point);
        setStatus(`Pin placed at ${point.latitude}, ${point.longitude}.`);
      });
      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(container.current);
    })();
    return () => { disposed = true; resizeObserver?.disconnect(); markerRef.current?.remove(); mapRef.current?.remove(); mapRef.current = null; };
    // Initial coordinates determine the starting camera; later changes are synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const parsedLongitude = Number(longitude);
    const parsedLatitude = Number(latitude);
    if (!map || longitude === "" || latitude === "" || !Number.isFinite(parsedLongitude) || !Number.isFinite(parsedLatitude)) return;
    let cancelled = false;
    (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !mapRef.current) return;
      if (!markerRef.current) {
        const element = document.createElement("div");
        element.className = "facility-picker-pin";
        element.setAttribute("aria-label", "Selected facility location");
        markerRef.current = new maplibre.Marker({ element, anchor: "bottom" }).setLngLat([parsedLongitude, parsedLatitude]).addTo(mapRef.current);
      } else markerRef.current.setLngLat([parsedLongitude, parsedLatitude]);
    })();
    return () => { cancelled = true; };
  }, [longitude, latitude]);

  const searchLocation = async () => {
    const value = query.trim();
    if (value.length < 3) { setStatus("Enter at least three characters to search."); return; }
    setBusy(true); setStatus("Searching locations…");
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(value)}`, { headers: { "X-FileMarket-Request": "1" } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Location search failed.");
      setResults(body.results);
      setStatus(body.results.length ? `${body.results.length} locations found.` : "No matching locations found. Try a nearby city or address.");
    } catch (reason) { setResults([]); setStatus((reason as Error).message); }
    finally { setBusy(false); }
  };

  const choose = (result: SearchResult) => {
    onChange(result);
    mapRef.current?.flyTo({ center: [result.longitude, result.latitude], zoom: 11, duration: 900 });
    setResults([]);
    setQuery(result.label);
    setStatus(`Selected ${result.label}. Fine-tune the pin by clicking the map.`);
  };

  return <div className="facility-picker">
    <div className="facility-picker-search"><Search size={16}/><input value={query} maxLength={160} aria-label="Search for facility address" placeholder="Search address, city, or landmark" onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchLocation(); } }}/><button type="button" disabled={busy} onClick={() => void searchLocation()}>{busy ? <LoaderCircle className="spin" size={15}/> : "Search"}</button></div>
    {results.length > 0 && <div className="facility-picker-results">{results.map((result) => <button type="button" key={`${result.longitude}/${result.latitude}`} onClick={() => choose(result)}><MapPin size={14}/><span>{result.label}</span></button>)}</div>}
    <div ref={container} className="facility-picker-map" aria-label="Map for placing the facility pin"/>
    <div className="facility-picker-status" aria-live="polite"><Crosshair size={13}/><span>{status}</span>{longitude && latitude && <strong>{Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}</strong>}</div>
  </div>;
}

void LegacyFacilityLocationPicker;
