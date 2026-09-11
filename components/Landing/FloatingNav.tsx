import Image from "next/image";
import Link from "next/link";
import { LogIn, Menu } from "lucide-react";

export default function FloatingNav() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-4 z-40 px-4 sm:top-6">
      <nav
        aria-label="Main navigation"
        className="pointer-events-auto mx-auto flex h-14 max-w-[78rem] items-center justify-between rounded-xl border border-white/10 bg-slate-950/55 px-3 shadow-2xl shadow-black/30 backdrop-blur-xl sm:h-16 sm:px-4"
      >
        <Link
          href="/"
          aria-label="map.filemarket home"
          className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm font-bold tracking-tight text-white transition-colors hover:bg-white/10"
        >
          <span className="grid size-8 place-items-center overflow-hidden rounded-lg bg-white shadow-lg shadow-cyan-500/25">
            <Image src="/brand-logo.png" alt="" width={32} height={32} priority/>
          </span>
          <span>map.filemarket</span>
        </Link>
        <div className="hidden items-center gap-2 sm:flex">
          <Link
            href="/map"
            className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-blue-300"
          >
            Explore map
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-teal-300 hover:bg-teal-400/10 hover:text-teal-200"
          >
            <LogIn size={15} />
            Log in
          </Link>
        </div>
        <button
          type="button"
          aria-label="Open navigation menu"
          className="rounded-lg p-2.5 text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-600 sm:hidden"
        >
          <Menu size={19} />
        </button>
      </nav>
    </header>
  );
}
