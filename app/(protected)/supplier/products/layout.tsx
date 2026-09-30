import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";

/** Only device companies have a product store; everyone else goes back to their workspace. */
export default async function ProductsLayout({ children }: LayoutProps<"/supplier/products">) {
  const user = await getUser();
  if (user && user.companyFocus !== "devices") redirect("/supplier");
  return children;
}
