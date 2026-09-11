"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Grid2X2, Info, LogOut, Map, Settings } from "lucide-react";
import Brand from "./Brand";
import type { User } from "./model";

type Props = {
  user?: User | null;
  current?: "login" | "signup" | "supplier" | "onboarding" | "admin" | "blog";
};

export default function PublicNav({ user, current }: Props) {
  const router = useRouter();
  const roleHref = user?.role === "admin" ? "/admin" : user?.role === "supplier" ? "/supplier" : "/dashboard";
  const roleLabel = user?.role === "admin" ? "Verification" : user?.role === "supplier" ? "Supplier workspace" : "Buyer workspace";

  return <header className="public-nav">
    <Brand/>
    <nav aria-label="Main navigation">
      <Link href="/map"><Map size={14}/>Explore map</Link>
      <Link className="public-nav-about" href="/#trust-and-transparency"><Info size={14}/>About</Link>
      <Link className="public-nav-insights" href="/blog" aria-current={current === "blog" ? "page" : undefined}><BookOpen size={14}/>Insights</Link>
      {user ? <>
        <Link href="/dashboard"><Grid2X2 size={14}/>Sourcing</Link>
        <Link href="/settings"><Settings size={14}/>Settings</Link>
        <Link href={roleHref} className="public-nav-workspace" aria-current={current && roleHref.includes(current) ? "page" : undefined}>{roleLabel}</Link>
        <span className="public-nav-user" title={user.email}><b>{user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</b><span>{user.name.split(" ")[0]}</span></span>
        <button className="public-nav-logout" title="Log out" aria-label="Log out" onClick={async () => { await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json", "X-FileMarket-Request": "1" }, body: "{}" }); router.push("/"); router.refresh(); }}><LogOut/></button>
      </> : <>
        <Link href="/login" aria-current={current === "login" ? "page" : undefined}>Log in</Link>
        <Link href="/signup" className="public-nav-join" aria-current={current === "signup" ? "page" : undefined}>Join map.filemarket <ArrowRight size={14}/></Link>
      </>}
    </nav>
  </header>;
}
