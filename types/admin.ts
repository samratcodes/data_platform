/** Shapes returned by the `/api/admin/*` routes. */

export type ApplicationKind = "company" | "facility";
export type ApplicationStatus = "pending" | "approved" | "rejected";
export type VerificationLevel = "unverified" | "online" | "physical" | "incomplete";
export type LeadStatus = "new" | "contacted" | "qualified" | "closed";

export type StoredAsset = { key: string; name: string; contentType: string; size?: number; type?: string };

/** One row of the company or facility review queue. */
export type ApplicationSummary = {
  id: string;
  application_kind: ApplicationKind;
  business_name: string;
  applicant_name: string;
  applicant_email: string;
  city: string | null;
  country: string | null;
  status: ApplicationStatus;
  verification_level: VerificationLevel;
  /** The company's focus; facilities inherit their company's. */
  company_focus: "collection" | "devices";
  submitted_at: string;
  reviewed_at: string | null;
  logo_key: string | null;
  image_count: number;
  document_count: number;
  company_name: string | null;
  company_status: ApplicationStatus | null;
};

/** Everything an administrator needs to decide on one application. */
export type ApplicationDetail = {
  id: string;
  user_id: string;
  application_kind: ApplicationKind;
  business_name: string;
  provider_type: string;
  provider_slug: string | null;
  profile_description: string;
  company_focus: string | null;
  capacity: string;
  capture_environments: string[];
  /** Raw stored JSON; parse with `parseFacilityDetails`. Empty for companies and older facilities. */
  facility_details: unknown;
  modalities: string[];
  robotics_types: string[];
  maps_url: string | null;
  physical_address: string | null;
  city: string | null;
  country: string | null;
  longitude: number | null;
  latitude: number | null;
  website_url: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  huggingface_url: string | null;
  hardware_pictures: string[];
  office_images: StoredAsset[];
  official_documents: StoredAsset[];
  company_logo: StoredAsset | null;
  /** Storage key of the uploaded image, or URL of the linked photo, the supplier chose as the profile background. */
  cover_image: string | null;
  has_sample: boolean;
  sample_file_name: string | null;
  sample_size_bytes: number | null;
  status: ApplicationStatus;
  verification_level: VerificationLevel;
  admin_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  applicant_name: string;
  applicant_email: string;
  applicant_email_verified_at: string | null;
  applicant_joined_at: string;
  company: { id: string; business_name: string; status: ApplicationStatus } | null;
  facilities: Array<{ id: string; business_name: string; city: string | null; country: string | null; status: ApplicationStatus }>;
};

export type AuditEntry = {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  target_label: string | null;
  metadata: { name?: string; notes?: string; verificationLevel?: string; applicationKind?: string; status?: string };
  created_at: string;
  admin_name: string;
};

export type Lead = {
  id: string;
  name: string;
  email: string;
  brief: string;
  budget: string | null;
  timeline: string | null;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
};

export type AdminOverview = {
  /** `company` counts data-collection companies; device companies are counted under `device`. */
  applications: Record<ApplicationKind | "device", Record<ApplicationStatus, number>>;
  leads: Record<LeadStatus, number>;
  liveListings: number;
  /** Live device stores, their published products, and enquiries sent to them. */
  devices: { stores: number; products: number; enquiries: number };
  pending: ApplicationSummary[];
  activity: AuditEntry[];
  sheetSync: { configured: boolean; counts: Record<string, number> };
};

/** A listing on the map in grey with only a logo, name, and location. */
export type IncompleteListing = {
  slug: string;
  name: string;
  city: string;
  country: string;
  provider_type: "Data Company" | "Device Supplier" | "Facility" | "Robotics";
  logo: string | null;
  /** Who may claim a listing an admin added; null once it has an owner. */
  claim_email: string | null;
  owner_email: string | null;
  /** False while the owner is an account the listing created that the company has not signed in to yet. */
  owner_activated: boolean;
  /** Set when the listing came from a company's own registration. */
  application_id: string | null;
  application_status: ApplicationStatus | null;
  created_at: string;
};

/** An unclaimed listing an admin added, with the fields its edit form shows. */
export type IncompleteListingDetail = Pick<IncompleteListing, "slug" | "name" | "city" | "country" | "provider_type" | "logo" | "claim_email"> & {
  longitude: number; latitude: number; description: string; website: string; maps_url: string;
  /** Once the company has signed in, its email is its login and can no longer be changed by an admin. */
  owner_activated: boolean;
};
