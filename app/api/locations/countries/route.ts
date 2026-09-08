export const revalidate = 604800;

export async function GET() {
  try {
    const response = await fetch(
      "https://countriesnow.space/api/v0.1/countries/positions",
      { next: { revalidate: 604800 } },
    );
    if (!response.ok) throw new Error("Country request failed");
    const payload = await response.json();
    const countries = payload.data
      .map((item: { name?: string }) => item.name)
      .filter((name: unknown): name is string => typeof name === "string")
      .sort((a: string, b: string) => a.localeCompare(b));
    return Response.json(countries);
  } catch {
    return Response.json({ error: "Countries unavailable" }, { status: 502 });
  }
}
