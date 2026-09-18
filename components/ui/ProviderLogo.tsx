"use client";

import { useState } from "react";
import Image from "next/image";
import { analyzeLogo, defaultLogoFit, type LogoFit } from "@/lib/logo-fit";
import { isPublicAsset } from "@/lib/image";
import type { PublicOperator } from "@/types/app";

type Props = {
  name: string;
  logo?: string | null;
  type?: PublicOperator["type"];
  /** Diameter in pixels. */
  size?: number;
  className?: string;
  /** Always fill the circle, e.g. for a facility profile photo. */
  cover?: boolean;
};

export const providerInitials = (name: string) => name.split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
export const providerTypeClass = (type?: PublicOperator["type"]) => type === "Facility" ? "is-facility" : type === "Robotics" ? "is-robotics" : "is-company";

/**
 * Round provider logo used across the map, directories, and profiles.
 * Square logos fill the circle; wide wordmarks are contained on a matching background
 * (see `analyzeLogo`); `cover` forces a fill for photos. Falls back to initials if the logo is missing or fails to load.
 */
export default function ProviderLogo({ name, logo, type, size = 44, className = "", cover = false }: Props) {
  const [failed, setFailed] = useState(false);
  const [fit, setFit] = useState<LogoFit>(defaultLogoFit);
  const showLogo = Boolean(logo) && !failed;
  return <span
    className={`provider-logo-disc ${providerTypeClass(type)} ${showLogo ? (cover || fit.cover ? "is-cover" : "is-contain") : "is-fallback"} ${className}`}
    style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * .36)), ...(showLogo ? { background: fit.background } : {}) }}
    aria-hidden="true"
  >
    {showLogo
      ? <span className="provider-logo-disc-inner"><Image src={logo!} alt="" fill unoptimized={!isPublicAsset(logo!)} sizes={`${size * 2}px`} onLoad={(event) => setFit(analyzeLogo(event.currentTarget))} onError={() => setFailed(true)}/></span>
      : providerInitials(name)}
  </span>;
}
