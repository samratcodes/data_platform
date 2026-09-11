import { MapPinOff } from "lucide-react";
import Link from "next/link";
import PublicNavigationRail from "@/components/explorer/PublicNavigationRail";

export default function NotFoundPage() {
  return <main className="sourcing-app system-page">
    <PublicNavigationRail/>
    <section className="system-card"><span><MapPinOff/></span><p className="landing-kicker">404 · LOCATION NOT FOUND</p><h1>This page is outside the network.</h1><p>The listing may have moved or is no longer public. Return to the map to find a verified provider.</p><div><Link className="primary-button" href="/map">Explore the network</Link><Link className="secondary-button" href="/">Return home</Link></div></section>
  </main>;
}
