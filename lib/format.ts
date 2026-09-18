/** Display helpers shared by client and server components. */

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const relativeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [["year", 31_536_000], ["month", 2_592_000], ["week", 604_800], ["day", 86_400], ["hour", 3_600], ["minute", 60]];

export const formatDate = (value: string | Date) => dateFormat.format(new Date(value));
export const formatDateTime = (value: string | Date) => dateTimeFormat.format(new Date(value));

export function formatRelative(value: string | Date, now = Date.now()) {
  const seconds = Math.round((new Date(value).getTime() - now) / 1000);
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return relativeFormat.format(Math.round(seconds / size), unit);
  return "just now";
}

export const formatBytes = (bytes: number) => bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1_000))} KB`;

export const assetUrl = (key: string) => `/api/company-assets?key=${encodeURIComponent(key)}`;
