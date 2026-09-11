import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Map, MapPinned } from "lucide-react";
import PublicNavigationRail from "@/components/explorer/PublicNavigationRail";

export const metadata: Metadata = { title: "Insights" };

export default function BlogPage() {
  return <main className="sourcing-app blog-page">
    <PublicNavigationRail active="blog"/>
    <section>
      <span className="landing-kicker">map.filemarket INSIGHTS</span>
      <h1>Better data starts with better sourcing.</h1>
      <p>Practical notes on verified facilities, data rights, exclusivity, and building reliable real-world datasets.</p>
      <div className="blog-card-grid">
        <article><small>VERIFICATION · FIELD NOTE</small><h2>What a verified data facility should disclose</h2><p>The operating details buyers should see before a sourcing conversation begins.</p><span>Identity · location · capacity</span></article>
        <article><small>DATA RIGHTS · PLAYBOOK</small><h2>How to make exclusivity clear before collection</h2><p>A simple framework for aligning usage rights, geography, and delivery terms.</p><span>Rights · geography · reuse</span></article>
        <article><small>CONTRACTING · GUIDE</small><h2>Using milestones for data projects</h2><p>How acceptance criteria can protect both buyers and capture partners.</p><span>Scope · review · acceptance</span></article>
      </div>
      <div className="blog-cta"><div><small>READY TO SOURCE?</small><h2>Move from research to a verified partner.</h2><p>Explore the global network, or list a facility for review.</p></div><div><Link className="primary-button" href="/map"><Map/>Explore the map <ArrowRight/></Link><Link className="secondary-button" href="/signup?role=data-company"><MapPinned/>List a provider</Link></div></div>
    </section>
  </main>;
}
