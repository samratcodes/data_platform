import type { PublicFacilityDetails } from "@/lib/facility";

export type OrganizationType = "Facility" | "Data Company" | "Robotics";

export type DataModality =
  "Egocentric video" | "Exocentric video" | "Speech" | "Images";

export interface NodeData {
  verificationLevel?: "online" | "physical";
  id: number;
  slug: string;
  name: string;
  /** City-center longitude, latitude. Individual facility addresses are not shown. */
  coordinates: [number, number];
  country: string;
  city: string;
  area: string;
  isFacility: boolean;
  type: OrganizationType;
  company?: {
    name: string;
    slug: string;
  };
  modalities: DataModality[];
  media: {
    src: string;
    alt: string;
    kind: "image" | "video";
    label: string;
  };
  profile: {
    description: string;
    dataStreams: string[];
    established: string;
    capacity: string;
    captureEnvironments: string[];
    photos?: string[];
    /** Company logo uploaded during verification; only served once the company is approved. */
    logo?: string | null;
    /** True when `logo` is a facility profile photo, which always fills its round badge. */
    logoIsPhoto?: boolean;
    publicExactLocation?: boolean;
    /** Factory category and workforce, present on approved facilities. */
    facility?: PublicFacilityDetails;
    links?: {
      linkedin?: string | null;
      twitter?: string | null;
      huggingFace?: string | null;
      website?: string | null;
      maps?: string | null;
    };
  };
}
