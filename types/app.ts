import type { UserRole } from "@/lib/auth/roles";
import type { NodeData } from "./provider";
import type { CompanyFocus } from "@/lib/company-focus";

/** Provider fields that are safe to send to the browser in lists and on the map. */
export type PublicOperator = Pick<NodeData, "id" | "slug" | "name" | "city" | "country" | "coordinates" | "type" | "modalities" | "profile" | "media" | "verificationLevel" | "company" | "facilityCount" | "productCount">;
/**
 * Where a company account stands with clients: "unverified" until it submits its profile, "pending" while
 * it is reviewed, "rejected" when changes were requested, and "verified" once approved online or physically.
 */
export type CompanyStanding = "unverified" | "pending" | "rejected" | "verified";
export type User = { id: string; name: string; email: string; role: UserRole; emailVerifiedAt?: string | null; companyLogo?: string | null; companyFocus?: CompanyFocus | null; companyStanding?: CompanyStanding | null; companyName?: string | null };
export type AccessRequest = { id: string; operator_slug: string; purpose: string; status: string; created_at: string };
export type Workspace = { saved: string[]; requests: AccessRequest[] };
