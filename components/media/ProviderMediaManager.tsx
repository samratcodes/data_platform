"use client";

import { useState } from "react";
import Image from "next/image";
import { Building2, Eye, ImagePlus, ImageUp, Link2, LoaderCircle, RefreshCw, Trash2, X } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

export type SavedMediaAsset = { key: string; name: string; contentType: string; size?: number };

type Photo = { id: string; url: string; name: string; size?: number; asset?: SavedMediaAsset; linked?: string };
type PendingDelete = { kind: "logo" } | { kind: "photo"; photo: Photo };

const MAX_IMAGES = 10;
const MAX_TOTAL_BYTES = 50_000_000;
const MAX_LOGO_BYTES = 5_000_000;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const assetUrl = (key: string) => `/api/company-assets?key=${encodeURIComponent(key)}`;
const sizeLabel = (bytes?: number) => bytes ? `${(bytes / 1_000_000).toFixed(1)} MB` : "";

async function request(method: "POST" | "DELETE", params: Record<string, string>, form?: FormData) {
  const response = await fetch(`/api/company-assets?${new URLSearchParams(params)}`, { method, body: form });
  const data = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(data?.error || "The image change could not be saved. Please try again.");
}

/**
 * Manages the saved logo and photos of a company or facility application.
 * Every add, replace, and delete is saved immediately and sends the listing back to admin review.
 * A required logo (companies) can be replaced but never deleted; an optional one (facilities) can be deleted.
 */
export default function ProviderMediaManager({ applicationId, title, description, logo, showLogo = false, logoRequired = true, logoLabel = "Company logo", logoNoun = "logo", logoPhoto = false, images, linkedPhotos = [], onChanged }: {
  /** Facility application id; omit for the company profile. */
  applicationId?: string;
  title: string;
  description: string;
  logo?: SavedMediaAsset | null;
  showLogo?: boolean;
  logoRequired?: boolean;
  logoLabel?: string;
  /** What the logo image is called in buttons and messages, e.g. "profile photo". */
  logoNoun?: string;
  /** Preview the logo as a filled circle, the way a facility profile photo appears on the map. */
  logoPhoto?: boolean;
  images: SavedMediaAsset[];
  linkedPhotos?: string[];
  onChanged: (message: string) => Promise<void> | void;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [preview, setPreview] = useState<Photo | null>(null);
  const scope: Record<string, string> = applicationId ? { applicationId } : {};
  const photos: Photo[] = [
    ...images.map((asset) => ({ id: asset.key, url: assetUrl(asset.key), name: asset.name, size: asset.size, asset })),
    ...linkedPhotos.map((url, index) => ({ id: url, url, name: `Linked photo ${index + 1}`, linked: url })),
  ];
  const totalBytes = images.reduce((sum, asset) => sum + (asset.size || 0), 0);

  const run = async (id: string, action: () => Promise<void>, message: string) => {
    setBusy(id); setError("");
    try { await action(); await onChanged(message); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The image change could not be saved."); }
    finally { setBusy(""); }
  };
  const upload = (kind: "office" | "logo", files: File[], extra: Record<string, string> = {}) => {
    const form = new FormData();
    form.set("kind", kind);
    Object.entries({ ...scope, ...extra }).forEach(([name, value]) => form.set(name, value));
    files.forEach((file) => form.append("files", file));
    return request("POST", {}, form);
  };
  const invalid = (files: File[], maxBytes: number) => files.some((file) => !allowedTypes.has(file.type) || file.size === 0 || file.size > maxBytes);

  const addImages = (fileList: FileList | null) => {
    const files = [...(fileList || [])];
    if (!files.length) return;
    if (invalid(files, MAX_TOTAL_BYTES)) { setError("Choose non-empty JPG, PNG, or WebP images only."); return; }
    if (images.length + files.length > MAX_IMAGES) { setError(`You can upload at most ${MAX_IMAGES} images.`); return; }
    if (totalBytes + files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) { setError("Uploaded images must be 50 MB or less in total."); return; }
    void run("add", () => upload("office", files), `${files.length} image${files.length === 1 ? "" : "s"} added and sent for review.`);
  };
  const replacePhoto = (photo: Photo, file: File | undefined) => {
    if (!file) return;
    if (invalid([file], MAX_TOTAL_BYTES)) { setError("Choose a non-empty JPG, PNG, or WebP image."); return; }
    if (photo.asset) {
      if (totalBytes - (photo.size || 0) + file.size > MAX_TOTAL_BYTES) { setError("Uploaded images must be 50 MB or less in total."); return; }
      void run(photo.id, () => upload("office", [file], { replaceKey: photo.asset!.key }), "Image replaced and sent for review.");
    } else if (photo.linked) {
      if (images.length >= MAX_IMAGES) { setError(`You can upload at most ${MAX_IMAGES} images. Delete one first.`); return; }
      // Upload first so a failed upload never loses the linked photo.
      void run(photo.id, async () => { await upload("office", [file]); await request("DELETE", { ...scope, photo: photo.linked! }); }, "Photo replaced and sent for review.");
    }
  };
  const replaceLogo = (file: File | undefined) => {
    if (!file) return;
    if (invalid([file], MAX_LOGO_BYTES)) { setError(`Choose a JPG, PNG, or WebP ${logoNoun} no larger than 5 MB.`); return; }
    void run("logo", () => upload("logo", [file]), logo ? `${logoNoun.charAt(0).toUpperCase() + logoNoun.slice(1)} replaced and sent for review.` : `${logoNoun.charAt(0).toUpperCase() + logoNoun.slice(1)} added and sent for review.`);
  };
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    if (target.kind === "logo" && logo) await run("logo", () => request("DELETE", { ...scope, key: logo.key }), `${logoNoun.charAt(0).toUpperCase() + logoNoun.slice(1)} removed and sent for review.`);
    if (target.kind === "photo") { const { photo } = target; await run(photo.id, () => request("DELETE", photo.asset ? { ...scope, key: photo.asset.key } : { ...scope, photo: photo.linked! }), "Image deleted and sent for review."); }
    setPendingDelete(null);
    setPreview(null);
  };
  const fileInput = (onFiles: (files: FileList | null) => void, multiple = false) => <input type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} disabled={Boolean(busy)} onChange={(event) => { onFiles(event.target.files); event.currentTarget.value = ""; }}/>;

  return <section className="media-manager" aria-label={title}>
    <header className="media-manager-heading"><span className="wizard-upload-icon"><ImagePlus/></span><div><h3>{title}</h3><p>{description}</p></div></header>
    {error && <p className="form-error media-manager-error" role="alert">{error}</p>}

    {showLogo && <div className="media-manager-logo">
      <div className={`company-logo-preview ${logoPhoto ? "is-photo" : ""}`}>{logo ? <Image src={assetUrl(logo.key)} alt={logoLabel} fill unoptimized sizes="96px"/> : <Building2 aria-hidden/>}{busy === "logo" && <span className="media-manager-busy"><LoaderCircle className="spin"/></span>}</div>
      <div className="company-logo-copy">
        <strong>{logoLabel} {logoRequired ? <em className="is-required">Required</em> : <em>Optional</em>}</strong>
        <small>{logo ? `${logo.name}${logo.size ? ` · ${sizeLabel(logo.size)}` : ""}` : `${logoRequired ? `No ${logoNoun} yet. Upload one to appear on the map.` : `No ${logoNoun} yet, so your company logo is shown.`} Square JPG, PNG, or WebP · 5 MB maximum.`}</small>
        <div className="company-logo-actions">
          <label className={`company-logo-upload ${busy ? "is-disabled" : ""}`}>{logo ? <RefreshCw size={15}/> : <ImageUp size={15}/>}{logo ? `Replace ${logoNoun}` : `Upload ${logoNoun}`}{fileInput((files) => replaceLogo(files?.[0]))}</label>
          {logo && !logoRequired && <button type="button" className="company-logo-remove" disabled={Boolean(busy)} onClick={() => setPendingDelete({ kind: "logo" })}><Trash2 size={15}/>Delete</button>}
        </div>
      </div>
    </div>}

    <div className="media-manager-toolbar">
      <span>{images.length} of {MAX_IMAGES} uploaded images{totalBytes ? ` · ${sizeLabel(totalBytes)} of 50 MB` : ""}{linkedPhotos.length ? ` · ${linkedPhotos.length} linked` : ""}</span>
      <label className={`office-image-picker-add ${busy || images.length >= MAX_IMAGES ? "is-disabled" : ""}`}>{busy === "add" ? <LoaderCircle className="spin" size={16}/> : <ImagePlus size={16}/>}{images.length >= MAX_IMAGES ? "Image limit reached" : "Add images"}{images.length < MAX_IMAGES && fileInput(addImages, true)}</label>
    </div>

    {photos.length ? <div className="media-manager-grid">{photos.map((photo, index) => <article key={photo.id}>
      <button type="button" className="media-manager-thumb" onClick={() => setPreview(photo)} aria-label={`View image ${index + 1}: ${photo.name}`}>
        <Image src={photo.url} alt={photo.name} fill unoptimized sizes="220px"/>
        {photo.linked && <em><Link2 size={12}/>Linked</em>}
        <span><Eye size={14}/>View</span>
        {busy === photo.id && <i className="media-manager-busy"><LoaderCircle className="spin"/></i>}
      </button>
      <div className="media-manager-meta"><strong title={photo.name}>{photo.name}</strong>{photo.size ? <small>{sizeLabel(photo.size)}</small> : null}</div>
      <div className="media-manager-actions">
        <label className={busy ? "is-disabled" : ""}><RefreshCw size={14}/>Replace{fileInput((files) => replacePhoto(photo, files?.[0]))}</label>
        <button type="button" disabled={Boolean(busy)} onClick={() => setPendingDelete({ kind: "photo", photo })}><Trash2 size={14}/>Delete</button>
      </div>
    </article>)}</div> : <p className="office-image-picker-empty">No images yet. Add images so buyers and reviewers can see this location.</p>}

    <p className="fieldset-note">Changes save immediately. Your approved listing keeps its current images until an admin approves the update.</p>

    {preview && <div className="office-image-review-backdrop" role="presentation" onClick={() => setPreview(null)}><div className="office-image-review media-manager-preview" role="dialog" aria-modal="true" aria-label={`Preview ${preview.name}`} onClick={(event) => event.stopPropagation()}>
      <header><div><small>IMAGE PREVIEW</small><h3>{preview.name}</h3></div><button type="button" aria-label="Close image preview" onClick={() => setPreview(null)}><X size={19}/></button></header>
      <div className="office-image-review-hero"><Image src={preview.url} alt={preview.name} fill unoptimized sizes="(max-width: 800px) 90vw, 700px"/></div>
      <footer><button type="button" onClick={() => setPendingDelete({ kind: "photo", photo: preview })} disabled={Boolean(busy)}><Trash2 size={15}/>Delete</button><button type="button" className="office-image-review-confirm" onClick={() => setPreview(null)}>Done</button></footer>
    </div></div>}

    {pendingDelete && <ConfirmDialog
      title={pendingDelete.kind === "logo" ? `Delete ${logoNoun}?` : "Delete image?"}
      message={pendingDelete.kind === "logo" ? `The ${logoLabel.toLowerCase()} will be deleted. This change is sent for admin review.` : `“${pendingDelete.photo.name}” will be deleted. This change is sent for admin review.`}
      busy={Boolean(busy)}
      onCancel={() => setPendingDelete(null)}
      onConfirm={() => void confirmDelete()}
    />}
  </section>;
}
