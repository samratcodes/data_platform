import { Building2, Database, Factory, Webcam } from "lucide-react";

export default function MapLocationKey({ showIncomplete = false }: { showIncomplete?: boolean }) {
  return <div className="map-location-key" aria-label="Map marker legend">
    <span><i className="legend-map-pin facility-marker"><Factory size={13}/></i> Facility</span>
    <span><i className="legend-map-pin company-marker"><Database size={13}/></i> Data company</span>
    <span><i className="legend-map-pin device-marker"><Webcam size={13}/></i> Device company</span>
    {showIncomplete && <span><i className="legend-map-pin incomplete-marker"><Building2 size={13}/></i> Incomplete</span>}
  </div>;
}
