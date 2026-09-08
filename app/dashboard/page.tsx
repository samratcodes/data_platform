import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import Entry from "@/components/explorer/Entry";
export default async function DashboardPage() {
  if (!await getUser()) redirect("/login?next=/dashboard");
  return <Entry dashboard/>;
}
