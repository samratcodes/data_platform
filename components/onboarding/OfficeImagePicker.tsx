"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Eye, ImagePlus, Trash2, X } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

/** A selected image: `file` is set for new local picks, `key` for images already saved to storage. */
export type OfficeImage = { url: string; name: string; contentType: string; size: number; file?: File; key?: string };

const MAX_IMAGES = 10;
const MAX_BYTES = 50_000_000;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const sizeLabel = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

export default function OfficeImagePicker({ images, onChange, onError, title = "Office and company images", required = false }: {
  images: OfficeImage[];
  onChange: (images: OfficeImage[]) => void;
  onError: (message: string) => void;
  title?: string;
  required?: boolean;
}) {
  const [pending, setPending] = useState<OfficeImage[] | null>(null);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState<OfficeImage | null>(null);
  const previewUrls = useRef(new Set<string>());
  const totalBytes = images.reduce((sum, image) => sum + image.size, 0);
  const reviewImages = pending ? [...images, ...pending] : images;
  const active = reviewImages.find((image) => image.url === activeUrl) || reviewImages[0];

  // Revoke browser previews when this form is removed after navigation.
  useEffect(() => {
    const urls = previewUrls.current;
    return () => { urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, []);

  const selectFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const files = [...fileList];
    if (files.some((file) => !allowedTypes.has(file.type) || file.size === 0)) { onError("Choose non-empty JPG, PNG, or WebP images only."); return; }
    if (images.length + files.length > MAX_IMAGES) { onError(`You can add at most ${MAX_IMAGES} office images.`); return; }
    if (totalBytes + files.reduce((sum, file) => sum + file.size, 0) > MAX_BYTES) { onError("Office images must be 50 MB or less in total."); return; }
    onError("");
    const selection = files.map((file) => { const url = URL.createObjectURL(file); previewUrls.current.add(url); return { file, url, name: file.name, contentType: file.type, size: file.size }; });
    setPending(selection);
    setActiveUrl(selection[0].url);
  };

  const closeReview = () => {
    pending?.forEach((image) => { URL.revokeObjectURL(image.url); previewUrls.current.delete(image.url); });
    setPending(null);
    setActiveUrl(null);
  };
  const remove = (url: string) => {
    if (pending?.some((image) => image.url === url)) {
      const removed = pending.find((image) => image.url === url);
      if (removed) { URL.revokeObjectURL(removed.url); previewUrls.current.delete(removed.url); }
      setPending((current) => current?.filter((image) => image.url !== url) || null);
    } else {
      onChange(images.filter((image) => image.url !== url));
      URL.revokeObjectURL(url);
      previewUrls.current.delete(url);
    }
    if (activeUrl === url) setActiveUrl(null);
  };

  return <section className={`office-image-picker ${dragging ? "is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); selectFiles(event.dataTransfer.files); }}>
    <div className="office-image-picker-heading"><span className="wizard-upload-icon"><ImagePlus/></span><div><strong>{title} {required ? <em className="is-required">Required</em> : <em>Optional</em>}</strong><small>JPG, PNG, or WebP · up to 10 images · 50 MB total</small></div></div>
    <div className="office-image-picker-toolbar"><span>{images.length} of {MAX_IMAGES} images · {sizeLabel(totalBytes)} of 50 MB</span><label className="office-image-picker-add"><ImagePlus size={16}/>{images.length ? "Add more images" : "Choose images"}<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { selectFiles(event.target.files); event.currentTarget.value = ""; }}/></label></div>
    {images.length ? <div className="office-image-gallery" aria-label="Selected office images">{images.map((image, index) => <article key={image.url}><button type="button" className="office-image-gallery-view" onClick={() => { setPending([]); setActiveUrl(image.url); }} aria-label={`View image ${index + 1}: ${image.name}`}><Image src={image.url} alt={image.name} fill unoptimized sizes="160px"/><span><Eye size={15}/>View</span></button><div><strong>{image.name}</strong><small>{sizeLabel(image.size)}</small><button type="button" onClick={() => setConfirming(image)} aria-label={`Delete ${image.name}`}><Trash2 size={16}/></button></div></article>)}</div> : <p className="office-image-picker-empty">Your images will appear here after you review and confirm them.</p>}
    {pending && <div className="office-image-review-backdrop" role="presentation" onClick={closeReview}><div className="office-image-review" role="dialog" aria-modal="true" aria-label="Review office images" onClick={(event) => event.stopPropagation()}><header><div><small>IMAGE REVIEW</small><h3>Review all selected images</h3><p>{reviewImages.length} of 10 images · {sizeLabel(reviewImages.reduce((sum, image) => sum + image.size, 0))} of 50 MB</p></div><button type="button" aria-label="Close image review" onClick={closeReview}><X size={19}/></button></header><div className="office-image-review-main">{active && <div className="office-image-review-hero"><Image src={active.url} alt={active.name} fill unoptimized sizes="(max-width: 800px) 90vw, 600px"/><span>{active.name}</span></div>}<div className="office-image-review-grid">{reviewImages.map((image, index) => <article key={image.url} className={active?.url === image.url ? "active" : ""}><button type="button" onClick={() => setActiveUrl(image.url)} aria-label={`Preview image ${index + 1}: ${image.name}`}><Image src={image.url} alt={image.name} fill unoptimized sizes="120px"/></button><small>{image.name}</small><button type="button" className="office-image-review-delete" onClick={() => setConfirming(image)} aria-label={`Delete ${image.name}`}><Trash2 size={14}/></button></article>)}</div></div><footer><button type="button" onClick={closeReview}>Cancel</button><button type="button" className="office-image-review-confirm" onClick={() => { onChange([...images, ...pending]); setPending(null); setActiveUrl(null); }} disabled={!pending.length}>{pending.length ? `OK · keep ${pending.length} new image${pending.length === 1 ? "" : "s"}` : "Done"}</button></footer></div></div>}
    {confirming && <ConfirmDialog title="Delete image?" message={`Remove “${confirming.name}” from your images? You can add it again later.`} onCancel={() => setConfirming(null)} onConfirm={() => { remove(confirming.url); setConfirming(null); }}/>}
  </section>;
}
