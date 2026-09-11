import type { NodeData } from "../Landing/types";

export type PublicOperator = Pick<NodeData, "id" | "slug" | "name" | "city" | "country" | "coordinates" | "type" | "modalities" | "profile" | "media" | "verificationLevel" | "company">;
export type User = { id: string; name: string; email: string; role: "buyer" | "supplier" | "admin"; emailVerifiedAt?: string | null };
export type AccessRequest = { id: string; operator_slug: string; purpose: string; status: string; created_at: string };
export type Workspace = { saved: string[]; requests: AccessRequest[] };
export type MapProjection = "globe" | "mercator";
export type MapHandle = { flyTo: (coordinates: [number, number], zoom?: number, padding?: { top: number; right?: number; bottom?: number; left?: number }) => void; reset: () => void; zoom: (amount: number) => void; setProjection: (projection: MapProjection) => void; stop: () => void };

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", "X-FileMarket-Request": "1", ...options?.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error((body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "The service is temporarily unavailable. Please try again."));
  if (!body) throw new Error("The service returned an invalid response. Please try again.");
  return body as T;
}
