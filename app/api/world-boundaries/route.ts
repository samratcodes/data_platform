export const revalidate = 604800;

export async function GET() {
  try {
    const response = await fetch(
      "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson",
      { next: { revalidate: 604800 } },
    );
    if (!response.ok) throw new Error("World boundary request failed");
    const collection = await response.json();
    return Response.json(collection, {
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return Response.json(
      { error: "World boundaries unavailable" },
      { status: 502 },
    );
  }
}
