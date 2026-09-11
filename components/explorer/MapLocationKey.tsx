import { Bot, Database, Factory } from "lucide-react";

export default function MapLocationKey() {
  return <div className="map-location-key" aria-label="Map marker legend">
    <span><i className="legend-map-pin facility-marker"><Factory size={13}/></i> Facility</span>
    <span><i className="legend-map-pin company-marker"><Database size={13}/></i> Data company</span>
    <span><i className="legend-map-pin robotics-marker"><Bot size={13}/></i> Robotics</span>
  </div>;
}
