/**
 * A company's primary focus decides its whole workspace: data-collection companies run
 * facilities, device companies run a product store. Keep this file free of server-only imports.
 */

export const companyFocusCards = [
  { value: "collection", title: "Data collection", detail: "Capture data with your own teams and facilities" },
  { value: "devices", title: "Devices for data collection", detail: "Sell cameras, wearables, and capture hardware" },
] as const;

export type CompanyFocus = (typeof companyFocusCards)[number]["value"];

export const isCompanyFocus = (value: unknown): value is CompanyFocus => companyFocusCards.some((card) => card.value === value);

export const companyFocusLabel = (value: string | null | undefined) => companyFocusCards.find((card) => card.value === value)?.title ?? "Data collection";
