"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { BadgeCheck, Crosshair, ImageIcon, Link, LoaderCircle, MapPin, Search } from "lucide-react";
import type { Map as GLMap, Marker as GLMarker, StyleSpecification } from "maplibre-gl";
import type { PickedLocation } from "./FacilityLocationPicker";

type SearchResult = PickedLocation & { label: string };

const looksLikeGoogleMapsUrl = (value: string) => /^https:\/\/(?:maps\.app\.goo\.gl|goo\.gl|(?:www\.|maps\.)?google\.[a-z.]+\/maps)(?:\/|$)/i.test(value.trim());

const streetMapStyle: StyleSpecification = {
  version: 8,
  sources: {
    streets: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    },
  },
  layers: [{ id: "streets", type: "raster", source: "streets" }],
};

export default function FacilityLocationPickerV2({ longitude, latitude, onChange }: {
  longitude: string;
  latitude: string;
  onChange: (location: PickedLocation) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GLMap | null>(null);
  const markerRef = useRef<GLMarker | null>(null);
  const onChangeRef = useRef(onChange);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"google" | "search">("google");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Paste a Google Maps link, or search for a place and position the pin.");

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
      const map = new maplibre.Map({
        container: container.current,
        style: streetMapStyle,
        center: hasCoordinates ? [parsedLongitude, parsedLatitude] : [12, 22],
        zoom: hasCoordinates ? 16 : 1.25,
        minZoom: 1,
        maxZoom: 19,
        attributionControl: { compact: true },
      });
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "bottom-right");
      mapRef.current = map;
      map.on("click", (event) => {
        const point = { longitude: Number(event.lngLat.lng.toFixed(6)), latitude: Number(event.lngLat.lat.toFixed(6)) };
        onChangeRef.current(point);
        setStatus(`Pin placed at ${point.latitude}, ${point.longitude}.`);
      });
      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(container.current);
    })();
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      markerRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Initial coordinates determine the starting camera; later changes are synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const parsedLongitude = Number(longitude);
    const parsedLatitude = Number(latitude);
    if (!mapRef.current || longitude === "" || latitude === "" || !Number.isFinite(parsedLongitude) || !Number.isFinite(parsedLatitude)) return;
    let cancelled = false;
    (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !mapRef.current) return;
      if (!markerRef.current) {
        const element = document.createElement("div");
        element.className = "facility-picker-pin";
        element.setAttribute("aria-label", "Selected facility location; drag to adjust");
        markerRef.current = new maplibre.Marker({ element, anchor: "bottom", draggable: true })
          .setLngLat([parsedLongitude, parsedLatitude])
          .addTo(mapRef.current);
        markerRef.current.on("dragend", () => {
          const point = markerRef.current?.getLngLat();
          if (!point) return;
          const picked = { longitude: Number(point.lng.toFixed(6)), latitude: Number(point.lat.toFixed(6)) };
          onChangeRef.current(picked);
          setStatus(`Pin moved to ${picked.latitude}, ${picked.longitude}.`);
        });
      } else {
        markerRef.current.setLngLat([parsedLongitude, parsedLatitude]);
      }
    })();
    return () => { cancelled = true; };
  }, [longitude, latitude]);

  const choose = (result: SearchResult, imported = false) => {
    onChange(result);
    setSelected(result);
    mapRef.current?.flyTo({ center: [result.longitude, result.latitude], zoom: 16, duration: 900 });
    setResults([]);
    setQuery(imported && result.mapsUrl ? result.mapsUrl : result.label);
    setStatus(imported
      ? `Imported ${result.name || result.label}. Review the location and photos below.`
      : `Selected ${result.label}. Drag the pin or click the map to fine-tune it.`);
  };

  const searchLocation = async (override?: string) => {
    const value = (override ?? query).trim();
    if (value.length < 3) {
      setStatus("Enter at least three characters to search.");
      return;
    }
    setBusy(true);
    const importing = mode === "google" || looksLikeGoogleMapsUrl(value);
    if (mode === "google" && !looksLikeGoogleMapsUrl(value)) { setStatus("Paste a full Google Maps link to import this location."); return; }
    setStatus(importing ? "Importing place details and photos from Google Maps..." : "Finding matching places...");
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(value)}`, { headers: { "X-FileMarket-Request": "1" } });
      const body = await response.json() as { error?: string; source?: string; results?: SearchResult[] };
      if (!response.ok) throw new Error(body.error || "Location search failed.");
      const matches = body.results || [];
      if (body.source === "google_maps" && matches.length === 1) {
        choose(matches[0], true);
      } else {
        setResults(matches);
        setStatus(matches.length ? "Choose the best match below." : "No matching locations found. Try a nearby city or fuller address.");
      }
    } catch (reason) {
      setResults([]);
      setStatus((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return <div className="facility-picker">
    <div className="facility-picker-modes" role="tablist" aria-label="Location entry method">
      <button type="button" role="tab" aria-selected={mode === "google"} className={mode === "google" ? "active" : ""} onClick={() => { setMode("google"); setQuery(""); setResults([]); setStatus("Paste a Google Maps location link. The map stays available to review the imported pin."); }}><Link size={15}/><span>Google Maps link</span></button>
      <button type="button" role="tab" aria-selected={mode === "search"} className={mode === "search" ? "active" : ""} onClick={() => { setMode("search"); setQuery(""); setResults([]); setStatus("Search for a place, then choose the result and fine-tune its pin on the map."); }}><Search size={15}/><span>Search on map</span></button>
    </div>
    <div className="facility-picker-search">
      <Search size={16}/>
      <input value={query} maxLength={2048} aria-label={mode === "google" ? "Google Maps location link" : "Search for a facility address"} placeholder={mode === "google" ? "Paste a Google Maps link" : "Search address, city, or landmark"} onChange={(event) => setQuery(event.target.value)} onPaste={(event) => { const value = event.clipboardData.getData("text").trim(); if (mode === "google" && looksLikeGoogleMapsUrl(value)) { event.preventDefault(); setQuery(value); void searchLocation(value); } }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchLocation(); } }}/>
      <button type="button" disabled={busy} onClick={() => void searchLocation()}>{busy ? <LoaderCircle className="spin" size={15}/> : mode === "google" ? "Import" : "Find places"}</button>
    </div>
    {results.length > 0 && <div className="facility-picker-results" role="listbox" aria-label="Suggested matching places">
      {results.map((result) => <button type="button" role="option" aria-selected="false" key={`${result.longitude}/${result.latitude}`} onClick={() => choose(result)}><MapPin size={14}/><span>{result.label}</span></button>)}
    </div>}
    {selected?.mapsUrl && <section className="facility-import-preview" aria-label="Imported Google Maps place preview">
      <div className="facility-import-heading"><span><BadgeCheck size={15}/>Imported from Google Maps</span><strong>{selected.name || selected.label}</strong><small>{selected.label}</small></div>
      {selected.photos?.length ? <div className="facility-import-photos">{selected.photos.map((photo, index) => <Image key={photo} src={photo} alt={`${selected.name || "Facility"} Google Maps photo ${index + 1}`} width={360} height={220} sizes="(max-width: 640px) 75vw, 280px"/>)}</div> : <div className="facility-import-no-photo"><ImageIcon size={17}/><span>This listing did not expose a public place photo. You can add one below.</span></div>}
    </section>}
    <div ref={container} className="facility-picker-map" aria-label="Detailed street map for placing the facility pin"/>
    <div className="facility-picker-status" aria-live="polite"><Crosshair size={13}/><span>{status}</span>{longitude && latitude && <strong>{Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}</strong>}</div>
  </div>;
}
