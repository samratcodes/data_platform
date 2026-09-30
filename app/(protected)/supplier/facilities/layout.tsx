import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";

/** Device companies sell products instead of running facilities, so every facility page sends them to their store. */
export default async function FacilitiesLayout({ children }: LayoutProps<"/supplier/facilities">) {
  const user = await getUser();
  if (user?.companyFocus === "devices") redirect("/supplier");
  return children;
}
