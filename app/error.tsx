"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";
import PublicNavigationRail from "@/components/navigation/PublicNavigationRail";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="sourcing-app system-page">
    <PublicNavigationRail/>
    <section className="system-card"><span><AlertTriangle/></span><p className="landing-kicker">TEMPORARY INTERRUPTION</p><h1>We could not open this view.</h1><p>Your account and saved work are unchanged. Retry the request, or return to the network map.</p><div><button className="primary-button" onClick={reset}><RotateCcw/>Try again</button><Link className="secondary-button" href="/map">Open the map</Link></div></section>
  </main>;
}
