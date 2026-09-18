import { adminRequired, adminUser, listAuditEntries, privateJson } from "@/lib/admin/queries";

export async function GET() {
  if (!await adminUser()) return adminRequired();
  return privateJson({ activity: await listAuditEntries({ limit: 300 }) });
}
