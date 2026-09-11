import {
  BadgeCheck,
  Bot,
  Building2,
  Check,
  ChevronLeft,
  Factory,
  Layers3,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";

type Props = {
  countries: string[];
  modalityOptions: string[];
  open: boolean;
  query: string;
  country: string;
  verification: string;
  types: string[];
  modalities: string[];
  resultCount: number;
  onOpenChange: (open: boolean) => void;
  onQuery: (value: string) => void;
  onCountry: (value: string) => void;
  onVerification: (value: string) => void;
  onToggleType: (value: string) => void;
  onToggleModality: (value: string) => void;
  onClear: () => void;
};

const providerTypes = [
  { value: "Facility", label: "Facilities", Icon: Factory },
  { value: "Data Company", label: "Data companies", Icon: Building2 },
  { value: "Robotics", label: "Robotics", Icon: Bot },
] as const;

export default function BuyerFilterSidebar(props: Props) {
  const activeCount = Number(!!props.query.trim()) + Number(!!props.country) + Number(!!props.verification) + props.types.length + props.modalities.length;

  return <aside id="buyer-map-filters" className={`buyer-filter-sidebar glass ${props.open ? "is-open" : ""}`} aria-label="Provider search and filters">
      <header>
        <div><span><SlidersHorizontal size={14}/> SOURCING FILTERS</span><strong>Refine the network</strong></div>
        <button aria-label="Close search and filters" onClick={() => props.onOpenChange(false)}><ChevronLeft size={17}/></button>
      </header>

      <label className="buyer-filter-search">
        <span><Search size={13}/>Search</span>
        <div><Search size={15}/><input autoFocus={props.open} value={props.query} onChange={(event) => props.onQuery(event.target.value)} placeholder="Company, place, or data type" aria-label="Search geography, companies, or facilities"/></div>
      </label>

      <label className="buyer-filter-select">
        <span><MapPin size={13}/>Country</span>
        <select value={props.country} onChange={(event) => props.onCountry(event.target.value)}>
          <option value="">All countries</option>
          {props.countries.map((country) => <option key={country}>{country}</option>)}
        </select>
      </label>

      <fieldset>
        <legend><BadgeCheck size={13}/>Verification</legend>
        <div className="buyer-filter-pills">
          {[{ value: "physical", label: "Physical" }, { value: "online", label: "Online" }].map((option) => <button key={option.value} aria-pressed={props.verification === option.value} onClick={() => props.onVerification(props.verification === option.value ? "" : option.value)}><Check size={11}/>{option.label}</button>)}
        </div>
      </fieldset>

      <fieldset>
        <legend><Building2 size={13}/>Provider type</legend>
        <div className="buyer-filter-options">
          {providerTypes.map(({ value, label, Icon }) => <button key={value} aria-pressed={props.types.includes(value)} onClick={() => props.onToggleType(value)}><span><Icon size={15}/>{label}</span><i>{props.types.includes(value) && <Check size={11}/>}</i></button>)}
        </div>
      </fieldset>

      <fieldset>
        <legend><Layers3 size={13}/>Data modalities</legend>
        <div className="buyer-filter-pills">
          {props.modalityOptions.map((modality) => <button key={modality} aria-pressed={props.modalities.includes(modality)} onClick={() => props.onToggleModality(modality)}>{modality}</button>)}
        </div>
      </fieldset>

      <footer>
        <span><strong>{props.resultCount}</strong> verified locations</span>
        {activeCount > 0 && <button onClick={props.onClear}><RotateCcw size={12}/>Reset</button>}
      </footer>
    </aside>;
}
