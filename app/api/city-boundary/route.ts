import { NextRequest } from "next/server";
export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city")?.trim();
  const country = request.nextUrl.searchParams.get("country")?.trim();
  if (
    !city ||
    !country ||
    city.length > 100 ||
    country.length > 80 ||
    !/^[\p{L}\p{M}\s.'()-]+$/u.test(city) ||
    !/^[\p{L}\p{M}\s.'()-]+$/u.test(country)
  ) {
    return Response.json({ error: "Invalid location" }, { status: 400 });
  }

  const endpoint = new URL("https://nominatim.openstreetmap.org/search");
  endpoint.searchParams.set("format", "geojson");
  endpoint.searchParams.set("polygon_geojson", "1");
  endpoint.searchParams.set("limit", "5");
  endpoint.searchParams.set("city", city);
  endpoint.searchParams.set("country", country);

  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/geo+json, application/json",
        "User-Agent": "FileMarketDataPlatform/0.1 (city boundary viewer)",
      },
      next: { revalidate: 604800 },
    });
    if (!response.ok)
      throw new Error(`Boundary request failed: ${response.status}`);
    const collection = await response.json();
    const feature = collection.features?.find(
      (candidate: { geometry?: { type?: string } }) =>
        ["Polygon", "MultiPolygon"].includes(candidate.geometry?.type ?? ""),
    );
    if (!feature?.geometry) throw new Error("Area boundary geometry missing");
    return Response.json(
      {
        type: "Feature",
        properties: {
          city,
          country,
        },
        geometry: feature.geometry,
      },
      {
        headers: {
          "Cache-Control":
            "public, max-age=86400, stale-while-revalidate=604800",
        },
      },
    );
  } catch {
    return Response.json({ error: "Boundary unavailable" }, { status: 502 });
  }
}
