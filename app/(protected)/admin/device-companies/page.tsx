import type { Metadata } from "next";
import CompaniesAdmin from "@/components/admin/CompaniesAdmin";
import { listDevices } from "@/lib/admin/queries";
import { requireAccess } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Device companies" };

export default async function DeviceCompaniesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireAccess("/admin/device-companies");
  const { view } = await searchParams;
  const devices = await listDevices();
  return <CompaniesAdmin segment="devices" view={view === "incomplete" ? "incomplete" : view === "devices" ? "devices" : "applications"} devices={devices}/>;
}
