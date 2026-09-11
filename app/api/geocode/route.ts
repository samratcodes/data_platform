import { getUser, rateLimited } from "@/lib/auth";
import { isGoogleMapsUrl, resolveGoogleMapsPlace } from "@/lib/google-maps-place";
import { cleanSingleLine } from "@/lib/security";

type NominatimResult = {
  display_name?: unknown;
  lat?: unknown;
  lon?: unknown;
  address?: { city?: unknown; town?: unknown; village?: unknown; municipality?: unknown; country?: unknown };
};

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Please log in." }, { status: 401 });
  if (user.role !== "supplier" && user.role !== "admin") return Response.json({ error: "Supplier access required." }, { status: 403 });
  if (await rateLimited(`geocode:${user.id}`, 60, 60 * 60_000)) return Response.json({ error: "Location search limit reached. Try again later." }, { status: 429 });

  const search = cleanSingleLine(new URL(request.url).searchParams.get("q"), 2_048);
  if (search.length < 3) return Response.json({ error: "Enter at least three characters." }, { status: 400 });

  if (isGoogleMapsUrl(search)) {
    try {
      const place = await resolveGoogleMapsPlace(search);
      return Response.json({ results: [place], source: "google_maps" }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (reason) {
      return Response.json({ error: reason instanceof Error ? reason.message : "Unable to import this Google Maps place." }, { status: 422 });
    }
  }

  const geocodeSearch = cleanSingleLine(search, 160);

  const endpoint = new URL("https://nominatim.openstreetmap.org/search");
  endpoint.searchParams.set("q", geocodeSearch);
  endpoint.searchParams.set("format", "jsonv2");
  endpoint.searchParams.set("addressdetails", "1");
  endpoint.searchParams.set("limit", "5");

  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent": `FileMarket/1.0 (${process.env.GEOCODING_CONTACT || "https://filemarket.ai"})`,
      },
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error("Geocoder unavailable");
    const body: unknown = await response.json();
    const results = Array.isArray(body) ? body.slice(0, 5).flatMap((item: NominatimResult) => {
      const latitude = Number(item.lat);
      const longitude = Number(item.lon);
      const label = cleanSingleLine(item.display_name, 240);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !label) return [];
      const address = item.address || {};
      return [{
        label,
        latitude,
        longitude,
        city: cleanSingleLine(address.city || address.town || address.village || address.municipality, 100),
        country: cleanSingleLine(address.country, 100),
      }];
    }) : [];
    return Response.json({ results }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch {
    return Response.json({ error: "Location search is temporarily unavailable. You can still place the pin manually." }, { status: 502 });
  }
}
