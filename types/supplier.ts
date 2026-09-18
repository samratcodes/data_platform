import type { StoredAsset } from "./admin";

export type ReviewStatus = "pending" | "approved" | "rejected";

export type SupplierCompany = { id: string; business_name: string; status: ReviewStatus; admin_notes: string | null; submitted_at: string; reviewed_at: string | null };

/** A factory application as the supplier sees it in the edit form. */
export type FacilityRecord = {
  id: string;
  business_name: string;
  profile_description: string;
  maps_url: string | null;
  physical_address: string | null;
  city: string | null;
  country: string | null;
  longitude: number | null;
  latitude: number | null;
  modalities: string[];
  capture_environments: string[];
  hardware_pictures: string[];
  office_images: StoredAsset[];
  official_documents: StoredAsset[];
  company_logo: StoredAsset | null;
  facility_details: unknown;
  provider_slug: string | null;
  status: ReviewStatus;
  admin_notes: string | null;
};

/** A company or factory row on the supplier dashboard, with its live listing's analytics. */
export type SupplierListing = {
  id: string;
  application_kind: "company" | "facility";
  business_name: string;
  city: string | null;
  country: string | null;
  status: ReviewStatus;
  verification_level: string;
  admin_notes: string | null;
  submitted_at: string;
  facility_details: unknown;
  modalities: string[];
  office_images: StoredAsset[];
  hardware_pictures: string[];
  company_logo: StoredAsset | null;
  provider_slug: string | null;
  listing_status: string | null;
  profile_views: number;
  saves: number;
  access_requests: number;
  conversations: number;
};

/** Analytics of an approved listing; zero until the listing goes live. */
export type ListingStats = { listing_status: string | null; profile_views: number; saves: number; access_requests: number; conversations: number };

export type FacilityDashboardData = FacilityRecord & ListingStats & { verification_level: string; submitted_at: string; reviewed_at: string | null };
