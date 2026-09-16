import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth/guards";

export default async function AdminPage() {
  await requireAccess("/admin");
  redirect("/admin/companies");
}
