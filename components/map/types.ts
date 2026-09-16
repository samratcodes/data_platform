export type MapProjection = "globe" | "mercator";

/** Imperative controls `WorldMap` hands to its parent once the map has loaded. */
export type MapHandle = {
  flyTo: (coordinates: [number, number], zoom?: number, padding?: { top: number; right?: number; bottom?: number; left?: number }) => void;
  reset: () => void;
  zoom: (amount: number) => void;
  setProjection: (projection: MapProjection) => void;
  stop: () => void;
};
