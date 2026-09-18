import type { ListingStats, ReviewStatus } from "@/types/supplier";

export type FacilityState = "live" | "changes" | "review" | "rejected";

type Listing = Pick<ListingStats, "listing_status"> & { status: ReviewStatus; provider_slug: string | null };

export const isLive = (listing: Listing) => listing.listing_status === "approved" && Boolean(listing.provider_slug);

/** A facility's state from the supplier's point of view, combining the application and its live listing. */
export function facilityState(listing: Listing): FacilityState {
  if (listing.status === "rejected") return "rejected";
  if (isLive(listing)) return listing.status === "approved" ? "live" : "changes";
  return "review";
}

export const facilityStateLabels: Record<FacilityState, string> = {
  live: "Live on the map",
  changes: "Live · changes in review",
  review: "In review",
  rejected: "Needs update",
};

/** StatusBadge status to use for each state, so badges share colors everywhere. */
export const facilityStateBadge: Record<FacilityState, string> = { live: "approved", changes: "pending", review: "pending", rejected: "rejected" };
