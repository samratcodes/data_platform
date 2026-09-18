import { adminRequired, adminUser, listApplications, privateJson } from "@/lib/admin/queries";

const kinds = new Set(["company", "facility"]);
const statuses = new Set(["pending", "approved", "rejected"]);

export async function GET(request: Request) {
  if (!await adminUser()) return adminRequired();
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind");
  const status = params.get("status");
  const applications = await listApplications({
    kind: kind && kinds.has(kind) ? kind : undefined,
    status: status && statuses.has(status) ? status : undefined,
  });
  return privateJson({ applications });
}
