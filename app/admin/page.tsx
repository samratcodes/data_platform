import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";

export default async function AdminPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") redirect("/map");
  redirect("/admin/companies");
}
