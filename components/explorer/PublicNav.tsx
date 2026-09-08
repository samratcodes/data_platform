import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Brand from "./Brand";

export default function PublicNav() {
  return <header className="public-nav">
    <Brand/>
    <nav aria-label="Main navigation">
      <Link href="/map">Explore map</Link>
      <Link href="/login">Log in</Link>
      <Link href="/signup" className="public-nav-join">Join FileMarket <ArrowRight size={14}/></Link>
    </nav>
  </header>;
}
