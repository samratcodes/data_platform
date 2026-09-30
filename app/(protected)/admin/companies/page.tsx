import type { Metadata } from "next";
import CompaniesAdmin from "@/components/admin/CompaniesAdmin";
import { requireAccess } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Data companies" };

export default async function DataCompaniesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireAccess("/admin/companies");
  const { view } = await searchParams;
  return <CompaniesAdmin segment="collection" view={view === "incomplete" ? "incomplete" : "applications"}/>;
}
