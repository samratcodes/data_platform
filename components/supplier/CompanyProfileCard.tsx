import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Building2, Pencil } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { isPublicAsset } from "@/lib/image";
import type { User } from "@/types/app";

const standingLabel = { unverified: "Not verified", pending: "In review", rejected: "Changes requested", verified: "Verified" } as const;
const standingBadge = { unverified: "unverified", pending: "pending", rejected: "rejected", verified: "approved" } as const;

/**
 * The company-profile block at the top of a dashboard's side column: who the company is, where its
 * verification stands, the reviewer's feedback, and the way into editing the profile.
 */
export default function CompanyProfileCard({ user, name, detail, feedback, publicHref }: {
  user: User;
  name: string;
  /** A short line under the name, e.g. the place or "Device manufacturer". */
  detail?: string;
  feedback?: string | null;
  /** The live public profile or store, once there is one. */
  publicHref?: string | null;
}) {
  const standing = user.companyStanding ?? "unverified";
  return <section className="desk-side-block company-profile-card" aria-label="Company profile">
    <h3>Company profile</h3>
    <div className="company-profile-card-head">
      <span className="company-profile-card-logo">{user.companyLogo ? <Image src={user.companyLogo} alt="" fill unoptimized={!isPublicAsset(user.companyLogo)} sizes="44px"/> : <Building2 size={18}/>}</span>
      <div><strong>{name}</strong>{detail && <small>{detail}</small>}</div>
    </div>
    <StatusBadge status={standingBadge[standing]} label={standingLabel[standing]}/>
    {feedback && <p className="company-profile-card-feedback"><b>Reviewer feedback</b>{feedback}</p>}
    <div className="company-profile-card-actions">
      <Link className="primary-button" href="/onboarding#company-profile"><Pencil size={14}/>{standing === "unverified" ? "Complete profile" : "Edit company profile"}</Link>
      {publicHref && <Link className="secondary-button" href={publicHref}>View public profile<ArrowUpRight size={14}/></Link>}
    </div>
  </section>;
}
