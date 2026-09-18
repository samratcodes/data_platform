import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Bookmark, Clock3, Eye, Factory, FileQuestion, Footprints, Hand, MessageSquare, Pencil, ShieldCheck, Users } from "lucide-react";
import { isPublicAsset } from "@/lib/image";
import StatusBadge from "@/components/ui/StatusBadge";
import { factoryCategoryLabel, formatCount, parseFacilityDetails } from "@/lib/facility";
import type { SupplierListing } from "@/types/supplier";
import { facilityState, facilityStateBadge, facilityStateLabels } from "./facility-status";

const assetUrl = (key: string) => `/api/company-assets?key=${encodeURIComponent(key)}`;

/**
 * The facility's round profile photo. Without one, the company logo stands in, as it does on the map.
 * Photos always fill the circle.
 */
export function FacilityAvatar({ photoKey, companyLogo, size = 56, approved = false }: { photoKey?: string | null; companyLogo?: string | null; size?: number; approved?: boolean }) {
  // Approved photos are public, so they can be served resized instead of as the original upload.
  const source = photoKey ? (approved ? `/api/company-assets?public=1&key=${encodeURIComponent(photoKey)}` : assetUrl(photoKey)) : companyLogo;
  return <span className={`facility-avatar ${photoKey ? "is-photo" : companyLogo ? "is-logo" : ""}`} style={{ width: size, height: size }} aria-hidden="true">
    {source ? <Image src={source} alt="" fill unoptimized={!isPublicAsset(source)} sizes={`${size * 2}px`}/> : <Factory size={Math.round(size * .42)}/>}
  </span>;
}

/** Summary card for one facility; opens that facility's dashboard. */
export default function FacilityCard({ listing, companyLogo }: { listing: SupplierListing; companyLogo?: string | null }) {
  const details = parseFacilityDetails(listing.facility_details);
  const cover = listing.office_images[0] ? (listing.status === "approved" ? `/api/company-assets?public=1&key=${encodeURIComponent(listing.office_images[0].key)}` : assetUrl(listing.office_images[0].key)) : listing.hardware_pictures[0];
  const state = facilityState(listing);
  const dashboard = `/supplier/facilities/${listing.id}`;
  return <article className="factory-card" data-state={state}>
    <Link className="factory-card-cover" href={dashboard} aria-label={`Open ${listing.business_name} dashboard`}>
      {cover ? <Image src={cover} alt="" fill unoptimized={!isPublicAsset(cover)} sizes="(max-width: 760px) 100vw, 420px"/> : <span className="factory-card-placeholder"><Factory/></span>}
      <StatusBadge status={facilityStateBadge[state]} label={facilityStateLabels[state]}/>
      <FacilityAvatar photoKey={listing.company_logo?.key} companyLogo={companyLogo} approved={listing.status === "approved"}/>
    </Link>
    <div className="factory-card-body">
      <div className="factory-card-title">
        <Link href={dashboard}><strong>{listing.business_name}</strong></Link>
        <small>{details ? factoryCategoryLabel(details) : "Facility"} · {[listing.city, listing.country].filter(Boolean).join(", ")}</small>
      </div>
      {details
        ? <dl className="factory-card-workforce">
          <div><dt><Users size={13}/>Workers</dt><dd>{formatCount(details.totalWorkers)}</dd></div>
          <div><dt><Hand size={13}/>Seated</dt><dd>{formatCount(details.seatedWorkers)}</dd></div>
          <div><dt><Footprints size={13}/>Moving</dt><dd>{formatCount(details.mobileWorkers)}</dd></div>
        </dl>
        : <p className="factory-card-missing"><Clock3 size={14}/>Add the workforce details to complete this facility.</p>}
      {state === "rejected" && listing.admin_notes && <p className="factory-card-feedback"><ShieldCheck size={14}/>{listing.admin_notes}</p>}
      {state === "live" || state === "changes"
        ? <div className="listing-analytics" aria-label={`${listing.business_name} listing analytics`}><span><Eye size={13}/><strong>{listing.profile_views}</strong>Views</span><span><Bookmark size={13}/><strong>{listing.saves}</strong>Saves</span><span><FileQuestion size={13}/><strong>{listing.access_requests}</strong>Requests</span><span><MessageSquare size={13}/><strong>{listing.conversations}</strong>Chats</span></div>
        : null}
      <div className="factory-card-actions">
        <Link className="primary-button" href={dashboard}>Open dashboard<ArrowUpRight size={14}/></Link>
        <Link className="secondary-button" href={`${dashboard}/edit`}><Pencil size={14}/>Edit</Link>
      </div>
    </div>
  </article>;
}
