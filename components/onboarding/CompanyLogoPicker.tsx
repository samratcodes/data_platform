"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Building2, ImageUp, RefreshCw, Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

/** The selected logo: `file` is set for a new local pick, `key` for a logo already saved to storage. */
export type CompanyLogo = { url: string; name: string; contentType: string; size: number; file?: File; key?: string };

const MAX_BYTES = 5_000_000;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const sizeLabel = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

export default function CompanyLogoPicker({ logo, onChange, onError, error, label = "Company logo", required = true, hint = "Shown on your map pin and public profile after approval.", noun = "logo", photo = false }: {
  /** Preview as a filled circle, the way a facility profile photo appears on the map. */
  photo?: boolean;
  /** What the image is called in buttons and messages, e.g. "profile photo". */
  noun?: string;
  logo: CompanyLogo | null;
  onChange: (logo: CompanyLogo | null) => void;
  onError: (message: string) => void;
  /** Validation message shown while no logo has been chosen. */
  error?: string;
  label?: string;
  required?: boolean;
  hint?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const previewUrls = useRef(new Set<string>());

  useEffect(() => {
    const urls = previewUrls.current;
    return () => { urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, []);

  const release = (current: CompanyLogo | null) => {
    if (current?.file) { URL.revokeObjectURL(current.url); previewUrls.current.delete(current.url); }
  };
  const selectFile = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    if (!allowedTypes.has(file.type) || file.size === 0 || file.size > MAX_BYTES) { onError(`Choose a JPG, PNG, or WebP ${noun} no larger than 5 MB.`); return; }
    onError("");
    const url = URL.createObjectURL(file);
    previewUrls.current.add(url);
    release(logo);
    onChange({ url, name: file.name, contentType: file.type, size: file.size, file });
  };

  return <section className={`company-logo-picker ${dragging ? "is-dragging" : ""} ${error ? "has-error" : ""}`} aria-label={label} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files); }}>
    <div className={`company-logo-preview ${photo ? "is-photo" : ""}`}>{logo ? <Image src={logo.url} alt={`${logo.name} ${noun} preview`} fill unoptimized sizes="96px"/> : <Building2 aria-hidden/>}</div>
    <div className="company-logo-copy">
      <strong>{label} {required ? <em className="is-required">Required</em> : <em>Optional</em>}</strong>
      <small>{logo ? `${logo.name} · ${sizeLabel(logo.size)}` : `Square JPG, PNG, or WebP · 5 MB maximum. ${hint}`}</small>
      <div className="company-logo-actions">
        <label className="company-logo-upload">{logo ? <RefreshCw size={15}/> : <ImageUp size={15}/>}{logo ? `Replace ${noun}` : `Upload ${noun}`}<input type="file" accept="image/jpeg,image/png,image/webp" aria-invalid={Boolean(error)} aria-describedby={error ? "logo-error" : undefined} onChange={(event) => { selectFile(event.target.files); event.currentTarget.value = ""; }}/></label>
        {logo && <button type="button" className="company-logo-remove" onClick={() => setConfirming(true)}><Trash2 size={15}/>Remove</button>}
      </div>
      {error && <small id="logo-error" className="wizard-field-error">{error}</small>}
    </div>
    {confirming && logo && <ConfirmDialog title={`Remove ${noun}?`} message={`The ${label.toLowerCase()} will be removed from this application.`} confirmLabel="Remove" onCancel={() => setConfirming(false)} onConfirm={() => { release(logo); onChange(null); setConfirming(false); }}/>}
  </section>;
}
