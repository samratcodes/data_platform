import { redirect } from "next/navigation";

/** Incomplete listings moved into the Data companies page. */
export default function IncompleteListingsPage() {
  redirect("/admin/companies?view=incomplete");
}
