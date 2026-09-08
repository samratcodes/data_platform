import type {
  CityData,
  DataModality,
  NodeData,
  OrganizationType,
} from "./types";

type OperatorSeed = {
  name: string;
  city: string;
  country: string;
  area: string;
  coordinates: [number, number];
  type: OrganizationType;
  modalities: DataModality[];
  capacity: string;
  environments: string[];
};

const cityMedia = {
  Kathmandu: "/samples/egocentric-factory.png",
  "San Francisco": "/samples/egocentric-factory.png",
  Tokyo: "/samples/urban-perception.png",
  London: "/samples/urban-perception.png",
  Nairobi: "/samples/egocentric-factory.png",
  Delhi: "/samples/urban-perception.png",
} as const;

const seeds: OperatorSeed[] = [
  {
    name: "HimaVision Works",
    city: "Kathmandu",
    country: "Nepal",
    area: "Teku Industrial District",
    coordinates: [85.324, 27.693],
    type: "Facility",
    modalities: ["Egocentric video", "Exocentric video", "Images"],
    capacity: "36 h / week",
    environments: ["Assembly line", "Tool room", "Quality bay"],
  },
  {
    name: "Valley Motion Lab",
    city: "Kathmandu",
    country: "Nepal",
    area: "Balaju Industrial Area",
    coordinates: [85.324, 27.693],
    type: "Facility",
    modalities: ["Egocentric video", "Speech", "Images"],
    capacity: "28 h / week",
    environments: ["Repair workshop", "Parts staging", "Training cell"],
  },
  {
    name: "Sanchaar Data Collective",
    city: "Kathmandu",
    country: "Nepal",
    area: "Thamel",
    coordinates: [85.324, 27.693],
    type: "Data Company",
    modalities: ["Speech", "Images"],
    capacity: "14 crews",
    environments: ["Retail", "Hospitality", "Street scenes"],
  },
  {
    name: "Himalaya Scene Labs",
    city: "Kathmandu",
    country: "Nepal",
    area: "Patan",
    coordinates: [85.324, 27.693],
    type: "Data Company",
    modalities: ["Exocentric video", "Images"],
    capacity: "6.2 M frames",
    environments: ["Transit", "Markets", "Public spaces"],
  },
  {
    name: "Koshi Task Capture",
    city: "Kathmandu",
    country: "Nepal",
    area: "Kalimati",
    coordinates: [85.324, 27.693],
    type: "Data Company",
    modalities: ["Egocentric video", "Speech"],
    capacity: "18 h / week",
    environments: ["Food logistics", "Field service", "Workplace tasks"],
  },
  {
    name: "ForgeWorks Mobility",
    city: "San Francisco",
    country: "United States",
    area: "Dogpatch",
    coordinates: [-122.4194, 37.7749],
    type: "Facility",
    modalities: ["Egocentric video", "Exocentric video", "Images"],
    capacity: "42 h / week",
    environments: ["Assembly line", "Repair bay", "Parts staging"],
  },
  {
    name: "Pacific Robotics Floor",
    city: "San Francisco",
    country: "United States",
    area: "SoMa",
    coordinates: [-122.4194, 37.7749],
    type: "Facility",
    modalities: ["Egocentric video", "Speech", "Images"],
    capacity: "31 h / week",
    environments: ["Robot lab", "Warehouse", "Test course"],
  },
  {
    name: "Waypoint Collective",
    city: "San Francisco",
    country: "United States",
    area: "Mission Bay",
    coordinates: [-122.4194, 37.7749],
    type: "Data Company",
    modalities: ["Egocentric video", "Speech", "Images"],
    capacity: "18 crews",
    environments: ["Warehousing", "Light manufacturing", "Field service"],
  },
  {
    name: "Bay Task Atlas",
    city: "San Francisco",
    country: "United States",
    area: "South Beach",
    coordinates: [-122.4194, 37.7749],
    type: "Data Company",
    modalities: ["Exocentric video", "Images"],
    capacity: "9.4 M frames",
    environments: ["Delivery", "Retail", "Mobility"],
  },
  {
    name: "ShibuyaSense Robotics",
    city: "Tokyo",
    country: "Japan",
    area: "Shibuya",
    coordinates: [139.7006, 35.6895],
    type: "Facility",
    modalities: ["Egocentric video", "Exocentric video", "Speech"],
    capacity: "31 h / week",
    environments: ["Robot lab", "Retail aisle", "Urban delivery"],
  },
  {
    name: "Kanto Assembly Studio",
    city: "Tokyo",
    country: "Japan",
    area: "Ota",
    coordinates: [139.7006, 35.6895],
    type: "Facility",
    modalities: ["Egocentric video", "Images"],
    capacity: "38 h / week",
    environments: ["Electronics assembly", "Inspection", "Packaging"],
  },
  {
    name: "Neon Atlas",
    city: "Tokyo",
    country: "Japan",
    area: "Shinjuku",
    coordinates: [139.7006, 35.6895],
    type: "Data Company",
    modalities: ["Exocentric video", "Images", "Speech"],
    capacity: "7.8 M frames",
    environments: ["Transit", "Sidewalk", "Convenience retail"],
  },
  {
    name: "Nori Field Records",
    city: "Tokyo",
    country: "Japan",
    area: "Koto",
    coordinates: [139.7006, 35.6895],
    type: "Data Company",
    modalities: ["Egocentric video", "Speech"],
    capacity: "11 teams",
    environments: ["Logistics", "Technician work", "Port operations"],
  },
  {
    name: "Bromley Motion Facility",
    city: "London",
    country: "United Kingdom",
    area: "Bromley",
    coordinates: [-0.1278, 51.5074],
    type: "Facility",
    modalities: ["Egocentric video", "Exocentric video", "Images"],
    capacity: "24 h / week",
    environments: ["Assembly", "Maintenance", "Goods handling"],
  },
  {
    name: "Thames Capture Works",
    city: "London",
    country: "United Kingdom",
    area: "Greenwich",
    coordinates: [-0.1278, 51.5074],
    type: "Facility",
    modalities: ["Egocentric video", "Speech"],
    capacity: "22 h / week",
    environments: ["Lab testing", "Repairs", "Training"],
  },
  {
    name: "Veritas Voice Labs",
    city: "London",
    country: "United Kingdom",
    area: "Shoreditch",
    coordinates: [-0.1278, 51.5074],
    type: "Data Company",
    modalities: ["Speech", "Images"],
    capacity: "96 speaker h",
    environments: ["Retail", "Home tasks", "Public services"],
  },
  {
    name: "Signal Lane",
    city: "London",
    country: "United Kingdom",
    area: "King's Cross",
    coordinates: [-0.1278, 51.5074],
    type: "Data Company",
    modalities: ["Exocentric video", "Images"],
    capacity: "5.6 M frames",
    environments: ["Station flow", "Mobility", "Storefronts"],
  },
  {
    name: "Nairobi Build Floor",
    city: "Nairobi",
    country: "Kenya",
    area: "Industrial Area",
    coordinates: [36.8219, -1.2921],
    type: "Facility",
    modalities: ["Egocentric video", "Images"],
    capacity: "29 h / week",
    environments: ["Assembly", "Repair", "Tool handling"],
  },
  {
    name: "Eastlands Operations Lab",
    city: "Nairobi",
    country: "Kenya",
    area: "Embakasi",
    coordinates: [36.8219, -1.2921],
    type: "Facility",
    modalities: ["Egocentric video", "Speech", "Images"],
    capacity: "19 h / week",
    environments: ["Equipment service", "Packaging", "Loading bay"],
  },
  {
    name: "Fieldline Nairobi",
    city: "Nairobi",
    country: "Kenya",
    area: "Westlands",
    coordinates: [36.8219, -1.2921],
    type: "Data Company",
    modalities: ["Egocentric video", "Images", "Speech"],
    capacity: "12 teams",
    environments: ["Logistics yard", "Farm field", "Equipment service"],
  },
  {
    name: "Sauti Context",
    city: "Nairobi",
    country: "Kenya",
    area: "Kilimani",
    coordinates: [36.8219, -1.2921],
    type: "Data Company",
    modalities: ["Speech", "Images"],
    capacity: "74 speaker h",
    environments: ["Support work", "Retail", "Community tasks"],
  },
  {
    name: "Okhla Assembly Network",
    city: "Delhi",
    country: "India",
    area: "Okhla",
    coordinates: [77.209, 28.6139],
    type: "Facility",
    modalities: ["Egocentric video", "Exocentric video", "Images"],
    capacity: "41 h / week",
    environments: ["Assembly", "Tooling", "Inspection"],
  },
  {
    name: "Gurugram Robot Floor",
    city: "Delhi",
    country: "India",
    area: "Gurugram",
    coordinates: [77.209, 28.6139],
    type: "Facility",
    modalities: ["Egocentric video", "Speech"],
    capacity: "33 h / week",
    environments: ["Robotics", "Warehouse", "Testing"],
  },
  {
    name: "Dilli Field Data",
    city: "Delhi",
    country: "India",
    area: "Saket",
    coordinates: [77.209, 28.6139],
    type: "Data Company",
    modalities: ["Exocentric video", "Images", "Speech"],
    capacity: "8.9 M frames",
    environments: ["Urban mobility", "Retail", "Delivery"],
  },
  {
    name: "Pragati Capture",
    city: "Delhi",
    country: "India",
    area: "Nehru Place",
    coordinates: [77.209, 28.6139],
    type: "Data Company",
    modalities: ["Egocentric video", "Images"],
    capacity: "15 crews",
    environments: ["Field repair", "Trade work", "Logistics"],
  },
];

const facilityCompanies: Record<string, string> = {
  "HimaVision Works": "Sanchaar Data Collective",
  "Valley Motion Lab": "Himalaya Scene Labs",
  "ForgeWorks Mobility": "Waypoint Collective",
  "Pacific Robotics Floor": "Bay Task Atlas",
  "ShibuyaSense Robotics": "Neon Atlas",
  "Kanto Assembly Studio": "Nori Field Records",
  "Bromley Motion Facility": "Veritas Voice Labs",
  "Thames Capture Works": "Signal Lane",
  "Nairobi Build Floor": "Fieldline Nairobi",
  "Eastlands Operations Lab": "Sauti Context",
  "Okhla Assembly Network": "Dilli Field Data",
  "Gurugram Robot Floor": "Pragati Capture",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const nodes: NodeData[] = seeds.map((seed, index) => {
  const isFacility = seed.type === "Facility";
  const companyName = facilityCompanies[seed.name];
  const mediaKind = seed.modalities.includes("Egocentric video")
    ? "video"
    : "image";
  const media = cityMedia[seed.city as keyof typeof cityMedia];
  return {
    ...seed,
    id: index + 1,
    slug: slugify(seed.name),
    isFacility,
    company: companyName
      ? { name: companyName, slug: slugify(companyName) }
      : undefined,
    media: {
      src: media,
      alt: `${seed.city} ${isFacility ? "facility" : "data collection"} preview`,
      kind: mediaKind,
      label:
        mediaKind === "video" ? "Motion-data preview" : "Image-data preview",
    },
    profile: {
      description: isFacility
        ? `${seed.name} is a vetted data-capture facility operated by ${companyName} in ${seed.area}, ${seed.city}. The catalogue shows city-level availability only; its address is withheld until sourcing review.`
        : `${seed.name} is a vetted data company operating across ${seed.area}, ${seed.city}. The catalogue shows city-level availability only; precise operating locations are withheld until sourcing review.`,
      dataStreams: seed.modalities,
      established: String(2018 + (index % 7)),
      capacity: seed.capacity,
      captureEnvironments: seed.environments,
    },
  };
});

export const countries = [...new Set(nodes.map((node) => node.country))].sort();

export const cities: CityData[] = Object.values(
  nodes.reduce<Record<string, CityData>>((collection, operator) => {
    const key = `${operator.country}/${operator.city}`;
    const city = collection[key] ?? {
      city: operator.city,
      country: operator.country,
      coordinates: operator.coordinates,
      operatorCount: 0,
      facilityCount: 0,
      dataCompanyCount: 0,
    };
    city.operatorCount += 1;
    if (operator.type === "Facility") city.facilityCount += 1;
    else city.dataCompanyCount += 1;
    collection[key] = city;
    return collection;
  }, {}),
).sort((a, b) => a.city.localeCompare(b.city));
