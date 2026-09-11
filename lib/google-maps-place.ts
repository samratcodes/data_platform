import { cleanSingleLine } from "./security";

export type GoogleMapsPlace = {
  name: string;
  label: string;
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  mapsUrl: string;
  photos: string[];
};

type ReverseResult = {
  display_name?: unknown;
  address?: {
    city?: unknown;
    town?: unknown;
    village?: unknown;
    municipality?: unknown;
    county?: unknown;
    country?: unknown;
  };
};

function allowedGoogleMapsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "maps.app.goo.gl" || host === "goo.gl") return true;
    const googleHost = host === "google.com" || host === "www.google.com" || host === "maps.google.com" || /^(?:www\.|maps\.)google\.(?:[a-z]{2,3}|com\.[a-z]{2}|co\.[a-z]{2})$/.test(host);
    return googleHost && url.pathname.startsWith("/maps");
  } catch {
    return false;
  }
}

export function isGoogleMapsUrl(value: string) {
  return allowedGoogleMapsUrl(value.trim());
}

function decoded(value: string) {
  let current = value;
  for (let index = 0; index < 3; index += 1) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) break;
      current = next;
    } catch {
      break;
    }
  }
  return current;
}

function normalizedPhoto(value: string) {
  return value.replace(/=w\d+-h\d+(?:-k-no)?(?:-[a-z0-9-]+)?$/i, "=w1200-h800-k-no");
}

function photosFromGoogleMapsHtml(html: string) {
  const decodedHtml = html
    .replaceAll("\\u003d", "=")
    .replaceAll("\\u0026", "&")
    .replaceAll("\\/", "/");
  const hostedPhotos = [...decodedHtml.matchAll(/https:\/\/(?:lh\d+|geo\d+)\.googleusercontent\.com\/[^"'\\\s<>]+/g)].map((match) => match[0]);
  const openGraphPhoto = [...decodedHtml.matchAll(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/gi)].map((match) => match[1]);
  return [...new Set([...hostedPhotos, ...openGraphPhoto]
    .map((photo) => normalizedPhoto(photo.replaceAll("&amp;", "&")))
    .filter((photo) => /^https:\/\//.test(photo) && photo.length <= 2_048))].slice(0, 8);
}

async function extractGoogleMapsPhotos(mapsUrl: string) {
  try {
    const response = await fetch(mapsUrl, {
      redirect: "follow",
      headers: { "User-Agent": "map.filemarket/1.0 (https://filemarket.ai)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok || !allowedGoogleMapsUrl(response.url)) return [];
    const html = (await response.text()).slice(0, 2_000_000);
    return photosFromGoogleMapsHtml(html);
  } catch {
    return [];
  }
}

export function parseGoogleMapsUrl(value: string): Omit<GoogleMapsPlace, "label" | "city" | "country"> | null {
  if (!allowedGoogleMapsUrl(value)) return null;
  const expanded = decoded(value);
  const exactCoordinates = [...expanded.matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g)].at(-1);
  const cameraCoordinates = expanded.match(/\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const latitude = Number(exactCoordinates?.[1] ?? cameraCoordinates?.[1]);
  const longitude = Number(exactCoordinates?.[2] ?? cameraCoordinates?.[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  const placeMatch = expanded.match(/\/maps\/place\/([^/@!?]+)/);
  const name = cleanSingleLine(placeMatch ? placeMatch[1].replace(/\+/g, " ") : "Google Maps place", 120);
  const photos = [...new Set(
    [...expanded.matchAll(/https:\/\/lh\d+\.googleusercontent\.com\/[^!&\s]+/g)]
      .map((match) => normalizedPhoto(match[0]))
      .filter((photo) => photo.length <= 2_048),
  )].slice(0, 8);

  return { name, latitude, longitude, mapsUrl: value, photos };
}

async function expandGoogleMapsUrl(value: string) {
  let current = value;
  for (let redirects = 0; redirects < 5; redirects += 1) {
    if (!allowedGoogleMapsUrl(current)) throw new Error("Only Google Maps links are supported.");
    const url = new URL(current);
    if (redirects > 0 && url.pathname.startsWith("/maps/place/")) return current;
    const response = await fetch(current, {
      redirect: "manual",
      headers: { "User-Agent": "map.filemarket/1.0 (https://filemarket.ai)" },
      signal: AbortSignal.timeout(8_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The Google Maps link did not provide a location.");
      current = new URL(location, current).toString();
      continue;
    }
    return current;
  }
  throw new Error("The Google Maps link redirected too many times.");
}

async function reverseGeocode(latitude: number, longitude: number) {
  const endpoint = new URL("https://nominatim.openstreetmap.org/reverse");
  endpoint.searchParams.set("lat", String(latitude));
  endpoint.searchParams.set("lon", String(longitude));
  endpoint.searchParams.set("format", "jsonv2");
  endpoint.searchParams.set("addressdetails", "1");
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en",
      "User-Agent": `map.filemarket/1.0 (${process.env.GEOCODING_CONTACT || "https://filemarket.ai"})`,
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return {};
  const body = await response.json() as ReverseResult;
  const address = body.address || {};
  return {
    label: cleanSingleLine(body.display_name, 240),
    city: cleanSingleLine(address.city || address.town || address.village || address.municipality || address.county, 100),
    country: cleanSingleLine(address.country, 100),
  };
}

export async function resolveGoogleMapsPlace(value: string): Promise<GoogleMapsPlace> {
  const input = value.trim();
  if (!allowedGoogleMapsUrl(input)) throw new Error("Paste a valid Google Maps link.");
  const directPlace = parseGoogleMapsUrl(input);
  const mapsUrl = directPlace ? input : await expandGoogleMapsUrl(input);
  const parsed = directPlace || parseGoogleMapsUrl(mapsUrl);
  if (!parsed) throw new Error("We could not find coordinates in this Google Maps link.");
  const extractedPhotos = await extractGoogleMapsPhotos(mapsUrl);
  let location: Awaited<ReturnType<typeof reverseGeocode>> = {};
  try {
    location = await reverseGeocode(parsed.latitude, parsed.longitude);
  } catch {
    // Coordinates and Google place data still provide a useful preview if reverse geocoding is unavailable.
  }
  return {
    ...parsed,
    photos: extractedPhotos.length ? extractedPhotos : parsed.photos,
    mapsUrl,
    label: location.label || parsed.name,
    city: location.city || "",
    country: location.country || "",
  };
}
