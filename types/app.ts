import type { UserRole } from "@/lib/auth/roles";
import type { NodeData } from "./provider";

/** Provider fields that are safe to send to the browser in lists and on the map. */
export type PublicOperator = Pick<NodeData, "id" | "slug" | "name" | "city" | "country" | "coordinates" | "type" | "modalities" | "profile" | "media" | "verificationLevel" | "company">;
export type User = { id: string; name: string; email: string; role: UserRole; emailVerifiedAt?: string | null; companyLogo?: string | null };
export type AccessRequest = { id: string; operator_slug: string; purpose: string; status: string; created_at: string };
export type Workspace = { saved: string[]; requests: AccessRequest[] };
