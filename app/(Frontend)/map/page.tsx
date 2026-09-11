import type { Metadata } from "next";
import Entry from "@/components/explorer/Entry";

export const metadata: Metadata = {
  title: "Network Explorer",
  description: "Explore verified real-world data facilities, data companies, and robotics operators around the world.",
};

export default function MapPage() {
  return <Entry />;
}
