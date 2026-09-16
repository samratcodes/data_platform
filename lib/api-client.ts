/** Browser-side JSON client for the app's own `/api` routes. Throws the server's error message. */
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", "X-FileMarket-Request": "1", ...options?.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error((body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "The service is temporarily unavailable. Please try again."));
  if (!body) throw new Error("The service returned an invalid response. Please try again.");
  return body as T;
}
