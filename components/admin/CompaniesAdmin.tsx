import Link from "next/link";
import { CircleDashed, ClipboardCheck, Package, Plus } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import type { AdminDevice } from "@/lib/admin/queries";
import AdminDevices from "./AdminDevices";
import ApplicationsTable from "./ApplicationsTable";
import IncompleteListings from "./IncompleteListings";

export type CompanySegment = "collection" | "devices";
export type CompaniesView = "applications" | "incomplete" | "devices";

/** Where each company type lives in the admin console. */
export const segmentBase: Record<CompanySegment, string> = { collection: "/admin/companies", devices: "/admin/device-companies" };

const copy = {
  collection: {
    eyebrow: "DATA COMPANIES", title: "Data companies",
    description: "Companies that capture data with their own teams and facilities. Review their profiles, or put one on the map yourself with just its logo, email, and location.",
  },
  devices: {
    eyebrow: "DEVICE COMPANIES", title: "Device companies",
    description: "Companies selling cameras, wearables, and capture hardware. Review their profiles before their store goes live, add one yourself, and see every device they list.",
  },
} as const;

/** The admin page for one company type: its applications, its grey listings on the map, and for device companies, their devices. */
export default function CompaniesAdmin({ segment, view, devices = [] }: { segment: CompanySegment; view: CompaniesView; devices?: AdminDevice[] }) {
  const base = segmentBase[segment];
  const views = [
    { value: "applications", label: "Applications", icon: ClipboardCheck, href: base },
    { value: "incomplete", label: "Incomplete on map", icon: CircleDashed, href: `${base}?view=incomplete` },
    ...(segment === "devices" ? [{ value: "devices", label: `Devices · ${devices.length}`, icon: Package, href: `${base}?view=devices` }] : []),
  ];
  return <section className="admin-page-body">
    <PageHeader eyebrow={copy[segment].eyebrow} title={copy[segment].title} description={copy[segment].description}
      actions={<Link className="primary-button" href={`${base}/new`}><Plus size={15}/>{segment === "devices" ? "Add device company" : "Add company"}</Link>}/>
    <nav className="companies-views" aria-label={`${copy[segment].title} views`}>
      {views.map(({ value, label, icon: Icon, href }) => <Link key={value} href={href} className={view === value ? "active" : ""} aria-current={view === value ? "page" : undefined}><Icon size={15}/>{label}</Link>)}
    </nav>
    {view === "incomplete" ? <IncompleteListings segment={segment}/>
      : view === "devices" && segment === "devices" ? <AdminDevices devices={devices}/>
        : <ApplicationsTable kind="company" focus={segment} embedded/>}
  </section>;
}
