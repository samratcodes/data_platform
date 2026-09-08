import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const country = request.nextUrl.searchParams.get("country")?.trim();
  if (!country || country.length > 80) {
    return Response.json({ error: "Country is required" }, { status: 400 });
  }

  try {
    const response = await fetch(
      "https://countriesnow.space/api/v0.1/countries/cities",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country }),
        next: { revalidate: 604800 },
      },
    );
    if (!response.ok) throw new Error("City request failed");
    const payload = await response.json();
    const cities = (payload.data ?? [])
      .filter((name: unknown): name is string => typeof name === "string")
      .sort((a: string, b: string) => a.localeCompare(b));
    return Response.json(cities, {
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return Response.json({ error: "Cities unavailable" }, { status: 502 });
  }
}
