import Link from "next/link";
import { ArrowRight, Clock3, ShieldAlert, TriangleAlert } from "lucide-react";
import type { User } from "@/types/app";

const copy = {
  unverified: {
    icon: ShieldAlert,
    title: "Clients see you as an unverified company",
    text: "You have no verification badge yet. Complete your company profile and submit it for review to get verified.",
    action: "Complete profile",
  },
  rejected: {
    icon: TriangleAlert,
    title: "Changes requested on your company profile",
    text: "Clients still see you as unverified. Update your profile with the reviewer's feedback and submit it again.",
    action: "Update profile",
  },
  pending: {
    icon: Clock3,
    title: "Profile submitted, pending review",
    text: "Clients see you as unverified until a reviewer approves your profile, usually within two business days.",
    action: "View profile",
  },
} as const;

/**
 * The bar across the top of every company page until the company is verified online or physically:
 * it says how clients see the company and leads to the profile form, then shows the review as pending.
 */
export default function VerificationBar({ user, onProfile = false, href = "/onboarding#company-profile" }: { user: User; onProfile?: boolean; href?: string }) {
  const standing = user.companyStanding;
  if (user.role !== "supplier" || !standing || standing === "verified") return null;
  const { icon: Icon, title, text, action } = copy[standing];
  return <div className={`verification-bar is-${standing}`} role="status">
    <span className="verification-bar-icon"><Icon size={17}/></span>
    <p><strong>{title}</strong><span>{text}</span></p>
    {!onProfile && <Link className="verification-bar-action" href={href}>{action}<ArrowRight size={14}/></Link>}
  </div>;
}
