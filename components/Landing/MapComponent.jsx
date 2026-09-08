"use client";

import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import {
  GeoJSON,
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";

const mapCenter = [22, 12];
const worldCopies = [-360, 0, 360];
const countryAliases = {
  "United States of America": "United States",
  "Dem. Rep. Congo": "Democratic Republic of the Congo",
  "Dominican Rep.": "Dominican Republic",
  "Central African Rep.": "Central African Republic",
  "Eq. Guinea": "Equatorial Guinea",
  "S. Sudan": "South Sudan",
  "Bosnia and Herz.": "Bosnia and Herzegovina",
};
function MapViewport({ selectedCity, onMapReady }) {
  const map = useMap();
  useEffect(() => {
    onMapReady(map);
  }, [map, onMapReady]);
  useEffect(() => {
    if (
      selectedCity &&
      (selectedCity.coordinates[0] !== 0 || selectedCity.coordinates[1] !== 0)
    )
      map.flyTo([selectedCity.coordinates[1], selectedCity.coordinates[0]], 9, {
        duration: 1.05,
      });
  }, [map, selectedCity]);
  return null;
}

function BoundaryViewport({ selectedCity, boundary }) {
  const map = useMap();

  useEffect(() => {
    if (!selectedCity || !boundary) return;
    const bounds = L.geoJSON(boundary).getBounds();
    if (!bounds.isValid()) return;
    map.flyToBounds(bounds, {
      padding: [72, 72],
      maxZoom: 10,
      duration: 1.05,
    });
  }, [boundary, map, selectedCity]);

  return null;
}

function MapZoomObserver({ onZoomChange }) {
  const map = useMapEvents({
    zoomend: () => onZoomChange(map.getZoom()),
  });

  useEffect(() => {
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);

  return null;
}

function createCityIcon(city, isSelected) {
  const hasFacilities = city.facilityCount > 0;
  const hasDataCompanies = city.dataCompanyCount > 0;
  const cityType =
    hasFacilities && hasDataCompanies
      ? "mixed"
      : hasFacilities
        ? "facility"
        : "company";
  const iconMarkup = `<span class="city-count">${city.operatorCount}</span>`;
  return L.divIcon({
    className: "city-signal-shell",
    html: `<span class="city-signal ${cityType} ${isSelected ? "selected" : ""}"><span class="city-signal-icons">${iconMarkup}</span></span>`,
    iconSize: [60, 44],
    iconAnchor: [30, 22],
  });
}

function sameCity(first, second) {
  return first?.city === second?.city && first?.country === second?.country;
}

function shiftCoordinates(coordinates, longitudeOffset) {
  if (typeof coordinates?.[0] === "number")
    return [coordinates[0] + longitudeOffset, coordinates[1]];
  return coordinates.map((coordinate) =>
    shiftCoordinates(coordinate, longitudeOffset),
  );
}

function shiftFeature(feature, longitudeOffset) {
  if (!feature?.geometry?.coordinates) return feature;
  return {
    ...feature,
    geometry: {
      ...feature.geometry,
      coordinates: shiftCoordinates(
        feature.geometry.coordinates,
        longitudeOffset,
      ),
    },
  };
}

function shiftCollection(collection, longitudeOffset) {
  return {
    ...collection,
    features: collection.features.map((feature) =>
      shiftFeature(feature, longitudeOffset),
    ),
  };
}

function getCountryName(feature) {
  const name = feature?.properties?.ADMIN ?? feature?.properties?.NAME;
  return countryAliases[name] ?? name;
}

export default function MapComponent({
  cities,
  selectedCity,
  hoveredCity,
  selectedCountry,
  onCityHover,
  onCountrySelect,
  onMapReady,
}) {
  const [boundaries, setBoundaries] = useState({});
  const [unavailableBoundaries, setUnavailableBoundaries] = useState({});
  const [worldBoundaries, setWorldBoundaries] = useState(null);
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [zoom, setZoom] = useState(3);
  const activeCity = hoveredCity ?? selectedCity;
  const activeKey = activeCity
    ? `${activeCity.country}/${activeCity.city}`
    : "";
  const selectedKey = selectedCity
    ? `${selectedCity.country}/${selectedCity.city}`
    : "";

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/world-boundaries", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("World boundaries unavailable");
        return response.json();
      })
      .then(setWorldBoundaries)
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (
      !activeCity ||
      boundaries[activeKey] ||
      unavailableBoundaries[activeKey]
    )
      return;
    const controller = new AbortController();
    const query = new URLSearchParams({
      city: activeCity.city,
      country: activeCity.country,
    });
    fetch(`/api/city-boundary?${query}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Boundary unavailable");
        return response.json();
      })
      .then((feature) =>
        setBoundaries((current) => ({ ...current, [activeKey]: feature })),
      )
      .catch(() => {
        if (!controller.signal.aborted)
          setUnavailableBoundaries((current) => ({
            ...current,
            [activeKey]: true,
          }));
      });
    return () => controller.abort();
  }, [activeCity, activeKey, boundaries, unavailableBoundaries]);

  const cityMarkers = useMemo(
    () =>
      cities.flatMap((city) =>
        worldCopies.map((copy) => ({
          city,
          copy,
          icon: createCityIcon(city, sameCity(city, selectedCity)),
        })),
      ),
    [cities, selectedCity],
  );
  const activeBoundary = boundaries[activeKey];
  const selectedBoundary = boundaries[selectedKey];
  const zoomDetail = Math.min(1, Math.max(0, (zoom - 3) / 7));
  const showCityBoundary = zoom >= 5.5;
  const cityIsHovered = sameCity(activeCity, hoveredCity);

  return (
    <MapContainer
      center={mapCenter}
      zoom={2.5}
      minZoom={2}
      maxZoom={11}
      zoomSnap={0.5}
      zoomDelta={0.5}
      worldCopyJump={false}
      zoomControl={false}
      scrollWheelZoom
      className="h-full w-full"
      aria-label="Interactive world map of country-level data operators"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        subdomains={["a", "b", "c"]}
        maxZoom={19}
        noWrap={false}
      />
      <MapViewport selectedCity={selectedCity} onMapReady={onMapReady} />
      <MapZoomObserver onZoomChange={setZoom} />
      <BoundaryViewport
        selectedCity={selectedCity}
        boundary={selectedBoundary}
      />
      {worldBoundaries
        ? worldCopies.map((copy) => (
            <GeoJSON
              key={`world-${copy}-${hoveredCountry ?? "none"}-${selectedCountry ?? "none"}-${Math.round(zoom * 2)}`}
              data={shiftCollection(worldBoundaries, copy)}
              style={(feature) => {
                const country = getCountryName(feature);
                const isHovered = country === hoveredCountry;
                const isSelected = country === selectedCountry;
                return {
                  color: isHovered || isSelected ? "#ffffff" : "#f8fafc",
                  weight: isHovered || isSelected ? 2.5 : zoom < 6 ? 0.9 : 0.5,
                  opacity: isHovered || isSelected ? 1 : 0.7,
                  fillColor: isHovered
                    ? "#ef4444"
                    : isSelected
                      ? "#168fd2"
                      : "#dff7f1",
                  fillOpacity: isHovered
                    ? 0.46 - zoomDetail * 0.2
                    : isSelected
                      ? 0.32 - zoomDetail * 0.18
                      : zoom < 6
                        ? 0.06
                        : 0.015,
                  className: isHovered
                    ? "country-boundary-highlight"
                    : isSelected
                      ? "country-boundary-selected"
                      : "",
                };
              }}
              onEachFeature={(feature, layer) => {
                const country = getCountryName(feature);
                if (!country) return;
                layer.on({
                  mouseover: () => setHoveredCountry(country),
                  mouseout: () => setHoveredCountry(null),
                  click: () => onCountrySelect(country),
                });
              }}
            />
          ))
        : null}
      {showCityBoundary && activeCity && activeBoundary
        ? worldCopies.map((copy) => (
            <GeoJSON
              key={`${activeKey}-${copy}-${cityIsHovered ? "hovered" : "selected"}-${Math.round(zoom * 2)}`}
              data={shiftFeature(activeBoundary, copy)}
              style={{
                color: "#ffffff",
                weight: cityIsHovered ? 2.5 : 3,
                opacity: 1,
                fillColor: cityIsHovered ? "#ef4444" : "#168fd2",
                fillOpacity: cityIsHovered
                  ? Math.min(0.58, 0.34 + zoomDetail * 0.22)
                  : Math.min(0.64, 0.4 + zoomDetail * 0.22),
                className: cityIsHovered
                  ? "city-boundary-highlight"
                  : "city-boundary-selected",
              }}
              eventHandlers={{
                click: () => onCountrySelect(activeCity.country),
                mouseover: () => onCityHover(activeCity),
                mouseout: () => onCityHover(null),
              }}
            />
          ))
        : null}
      {cityMarkers.map(({ city, copy, icon }) => (
        <Marker
          key={`${city.country}-${city.city}-${copy}`}
          position={[city.coordinates[1], city.coordinates[0] + copy]}
          icon={icon}
          eventHandlers={{
            click: () => onCountrySelect(city.country),
            mouseover: () => onCityHover(city),
            mouseout: () => onCityHover(null),
          }}
        >
          <Tooltip
            direction="top"
            offset={[0, -25]}
            opacity={1}
            className="network-tooltip"
          >
            <strong>
              {city.city}, {city.country}
            </strong>
            <span>
              {city.facilityCount > 0 ? "Facilities" : ""}
              {city.facilityCount > 0 && city.dataCompanyCount > 0
                ? " and "
                : ""}
              {city.dataCompanyCount > 0 ? "data companies" : ""} available
            </span>
            <em>Click to view this country</em>
          </Tooltip>
          <Tooltip
            permanent
            direction="bottom"
            offset={[0, 18]}
            opacity={0.95}
            className="city-name-tooltip"
          >
            {city.city}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
