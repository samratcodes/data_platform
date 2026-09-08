import type { NodeData } from "../Landing/types";

export type PublicOperator = Pick<NodeData, "id" | "slug" | "name" | "city" | "country" | "coordinates" | "type" | "modalities" | "capacity" | "media">;
export type User = { id: string; name: string; email: string };
export type AccessRequest = { id: string; operator_slug: string; purpose: string; status: string; created_at: string };
export type Workspace = { saved: string[]; requests: AccessRequest[] };
export type MapHandle = { flyTo: (coordinates: [number, number], zoom?: number) => void; reset: () => void; zoom: (amount: number) => void; stop: () => void };

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Something went wrong. Please try again.");
  return body;
}
