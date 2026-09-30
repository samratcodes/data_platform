"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Camera, ExternalLink, PackageSearch, Search } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import { deviceCategoryLabel, priceLabel, productImageUrl, productPageUrl, type DeviceCategory } from "@/lib/devices";
import { formatRelative } from "@/lib/format";
import type { AdminDevice } from "@/lib/admin/queries";

type Filter = "all" | "live" | "waiting" | "hidden";

/** Whether buyers can see a device: only published products of a verified store are live. */
function deviceState(device: AdminDevice): Exclude<Filter, "all"> {
  if (!device.published) return "hidden";
  return device.store_level === "online" || device.store_level === "physical" ? "live" : "waiting";
}
const stateBadge = { live: { status: "approved", label: "Live" }, waiting: { status: "pending", label: "Store not verified" }, hidden: { status: "unverified", label: "Hidden by store" } } as const;
const filters: Array<{ value: Filter; label: string }> = [{ value: "all", label: "All" }, { value: "live", label: "Live" }, { value: "waiting", label: "Waiting on store" }, { value: "hidden", label: "Hidden" }];

/** Every device across the device companies, with where each one stands. */
export default function AdminDevices({ devices }: { devices: AdminDevice[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const counts = useMemo(() => {
    const result: Record<Filter, number> = { all: devices.length, live: 0, waiting: 0, hidden: 0 };
    for (const device of devices) result[deviceState(device)] += 1;
    return result;
  }, [devices]);
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return devices.filter((device) => (filter === "all" || deviceState(device) === filter)
      && (!term || [device.name, device.store_name, device.store_email, deviceCategoryLabel({ category: device.category as DeviceCategory, categoryOther: device.category_other })].some((value) => value.toLowerCase().includes(term))));
  }, [devices, filter, search]);

  return <div className="table-card">
    <div className="table-toolbar">
      <div className="segmented" role="tablist" aria-label="Filter devices">
        {filters.map(({ value, label }) => <button key={value} type="button" role="tab" aria-selected={filter === value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}<b>{counts[value]}</b></button>)}
      </div>
      <div className="table-toolbar-controls">
        <label className="search-field"><Search size={15} aria-hidden/><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search device, type, or store" aria-label="Search devices"/></label>
      </div>
    </div>
    {!devices.length ? <EmptyState icon={<PackageSearch/>} title="No devices yet" description="Devices appear here as soon as a device company adds them to its store."/>
      : !rows.length ? <EmptyState icon={<Search/>} title="No matches" description="Try another filter or search."/>
        : <div className="table-scroll"><table className="data-table admin-devices">
          <thead><tr><th scope="col">Device</th><th scope="col">Store</th><th scope="col">Price</th><th scope="col">Added</th><th scope="col">Status</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
          <tbody>{rows.map((device) => {
            const state = deviceState(device);
            return <tr key={device.id}>
              <td data-label="Device"><span className="admin-device">
                <span className="admin-device-photo">{device.image_key ? <Image src={productImageUrl(device.image_key)} alt="" fill unoptimized sizes="44px"/> : <Camera size={16}/>}</span>
                <span className="cell-stack"><strong>{device.name}</strong><small>{deviceCategoryLabel({ category: device.category as DeviceCategory, categoryOther: device.category_other })}</small></span>
              </span></td>
              <td data-label="Store"><span className="cell-stack">
                {device.application_id ? <Link className="table-primary-link" href={`/admin/applications/${device.application_id}`}><strong>{device.store_name}</strong></Link> : <strong>{device.store_name}</strong>}
                <small>{device.store_email}</small>
              </span></td>
              <td data-label="Price">{priceLabel(device.price)}</td>
              <td data-label="Added">{formatRelative(device.created_at)}</td>
              <td data-label="Status"><StatusBadge status={stateBadge[state].status} label={stateBadge[state].label}/></td>
              <td className="cell-action">{state === "live" && <Link className="table-action" href={productPageUrl(device.id)}>Open<ExternalLink size={13}/></Link>}</td>
            </tr>;
          })}</tbody>
        </table></div>}
    {rows.length > 0 && <p className="table-footnote">Showing {rows.length} of {devices.length} devices</p>}
  </div>;
}
