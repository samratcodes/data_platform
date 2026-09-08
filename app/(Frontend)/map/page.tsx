import type { Metadata } from "next";
import Entry from "@/components/explorer/Entry";

export const metadata: Metadata = {
  title: "Network Explorer | FileMarket",
};

export default function MapPage() {
  return <Entry />;
}
