import Link from "next/link";

export default function Brand() {
  return <Link href="/" className="brand" aria-label="FileMarket home">
    <svg width="33" height="39" viewBox="0 0 52 64" fill="none" aria-hidden="true">
      <defs><linearGradient id="brand-gradient" x1="2" y1="5" x2="47" y2="52" gradientUnits="userSpaceOnUse"><stop stopColor="#5a80e2"/><stop offset=".55" stopColor="#23cda5"/><stop offset="1" stopColor="#4b8de8"/></linearGradient></defs>
      <path d="M10 4h32a6 6 0 0 1 6 6v32L27 61H10a6 6 0 0 1-6-6V10a6 6 0 0 1 6-6Zm2 8v41h14V38h14V12H12Z" fill="url(#brand-gradient)"/>
      <path d="m31 60 17-17v17h-4V52l-8 8h-5Z" fill="#5a80e2"/>
    </svg>
    <span>File<span className="brand-light">Market</span><small>THE WORLD IS YOUR DATASET</small></span>
  </Link>;
}
