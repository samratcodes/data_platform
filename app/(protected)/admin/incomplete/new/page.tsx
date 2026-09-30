import { redirect } from "next/navigation";

/** Adding a company moved into the Data companies page. */
export default function AddIncompleteCompanyPage() {
  redirect("/admin/companies/new");
}
