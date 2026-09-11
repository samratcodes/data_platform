import type { CityData, NodeData } from "./types";

const fileMarketPhoto = "https://lh3.googleusercontent.com/gps-cs-s/AHRPTWktuDAxxijVC0fSnMQF-7J75QHsFEAETc2uS9beT1ZJzGIcAknqPQVV5K_BWVZBR_GGCRKgQcKvQ33LADof62ZkG3KBSwfAtiwrAurytKhu5WjKjOynzRu0J_DAJ1Coe9w4cbqqvG4_oQM=w1200-h800-k-no";

export const nodes: NodeData[] = [{
  id: 1,
  slug: "filemarket-ai",
  name: "FileMarket.ai",
  city: "Kathmandu",
  country: "Nepal",
  area: "4 Kumari Mai Marg, Kathmandu 44600",
  coordinates: [85.3194004, 27.7204035],
  type: "Facility",
  isFacility: true,
  verificationLevel: "physical",
  modalities: ["Egocentric video", "Exocentric video", "Speech", "Images"],
  media: {
    src: fileMarketPhoto,
    alt: "FileMarket.ai facility in Kathmandu",
    kind: "image",
    label: "Google Maps place photo",
  },
  profile: {
    description: "FileMarket.ai operates an in-house data factory in Kathmandu for robotics, speech, and multimodal AI training data.",
    dataStreams: ["Egocentric video", "Exocentric video", "Speech", "Images"],
    established: "Publicly listed",
    capacity: "150+ collection agents",
    captureEnvironments: ["In-house data factory", "Robotics collection", "Speech collection"],
    photos: [fileMarketPhoto],
    publicExactLocation: true,
    links: {
      website: "https://filemarket.ai/",
      maps: "https://maps.app.goo.gl/m3hBnguVjPc5aDqY6",
    },
  },
}];

export const countries = ["Nepal"];

export const cities: CityData[] = [{
  city: "Kathmandu",
  country: "Nepal",
  coordinates: [85.3194004, 27.7204035],
  operatorCount: 1,
  facilityCount: 1,
  dataCompanyCount: 0,
  roboticsCount: 0,
}];
