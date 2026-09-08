export type OrganizationType = "Facility" | "Data Company";

export type DataModality =
  "Egocentric video" | "Exocentric video" | "Speech" | "Images";

export interface NodeData {
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
  };
}

export interface CityData {
  city: string;
  country: string;
  coordinates: [number, number];
  operatorCount: number;
  facilityCount: number;
  dataCompanyCount: number;
}
