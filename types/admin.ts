/** Shapes returned by the `/api/admin/*` routes. */

export type ApplicationKind = "company" | "facility";
export type ApplicationStatus = "pending" | "approved" | "rejected";
export type VerificationLevel = "unverified" | "online" | "physical";
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
  metadata: { notes?: string; verificationLevel?: string; applicationKind?: string; status?: string };
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
  applications: Record<ApplicationKind, Record<ApplicationStatus, number>>;
  leads: Record<LeadStatus, number>;
  liveListings: number;
  pending: ApplicationSummary[];
  activity: AuditEntry[];
  sheetSync: { configured: boolean; counts: Record<string, number> };
};
