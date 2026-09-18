"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Eye, FilePlus2, FileText, Trash2, X } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

/** A selected document: `file` is set for new local picks, `key` for documents already saved to storage. */
export type OfficialDocument = { url: string; name: string; contentType: string; size: number; type: string; file?: File; key?: string };

const MAX_DOCUMENTS = 5;
const MAX_FILE_BYTES = 10_000_000;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const sizeLabel = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

export default function OfficialDocumentPicker({ documents, onChange, onError, showTypeErrors = false, title = "Official company documents", required = false, typePlaceholder = "e.g. Certificate of incorporation", error }: {
  documents: OfficialDocument[];
  onChange: (documents: OfficialDocument[]) => void;
  onError: (message: string) => void;
  showTypeErrors?: boolean;
  title?: string;
  required?: boolean;
  typePlaceholder?: string;
  /** Validation message, for example when a required document is missing. */
  error?: string;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<OfficialDocument | null>(null);
  const previewUrls = useRef(new Set<string>());
  const preview = documents.find((document) => document.url === previewUrl);

  useEffect(() => {
    const urls = previewUrls.current;
    return () => { urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, []);

  const selectFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const files = [...fileList];
    if (documents.length + files.length > MAX_DOCUMENTS) { onError(`You can add at most ${MAX_DOCUMENTS} documents.`); return; }
    if (files.some((file) => !allowedTypes.has(file.type) || file.size === 0 || file.size > MAX_FILE_BYTES)) { onError("Each document must be a PDF, JPG, PNG, or WebP file no larger than 10 MB."); return; }
    onError("");
    const added = files.map((file) => {
      const url = URL.createObjectURL(file);
      previewUrls.current.add(url);
      return { url, name: file.name, contentType: file.type, size: file.size, file, type: "" };
    });
    onChange([...documents, ...added]);
    setPreviewUrl(added[0].url);
  };

  const updateType = (url: string, type: string) => onChange(documents.map((document) => document.url === url ? { ...document, type } : document));
  const remove = (url: string) => {
    onChange(documents.filter((document) => document.url !== url));
    URL.revokeObjectURL(url);
    previewUrls.current.delete(url);
    if (previewUrl === url) setPreviewUrl(null);
  };

  return <section className={`official-document-picker ${error ? "has-error" : ""}`} aria-label={title}>
    <div className="official-document-heading"><span className="wizard-upload-icon"><FileText/></span><div><strong>{title} {required ? <em className="is-required">Required</em> : <em>Optional</em>}</strong><small>Up to 5 PDF or image files · 10 MB maximum per file</small></div></div>
    <div className="official-document-toolbar"><span>{documents.length} of {MAX_DOCUMENTS} documents</span><label className={documents.length === MAX_DOCUMENTS ? "is-full" : ""}><FilePlus2 size={16}/>{documents.length === MAX_DOCUMENTS ? "5-document limit reached" : documents.length ? "Add another document" : "Choose documents"}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple disabled={documents.length === MAX_DOCUMENTS} aria-invalid={Boolean(error)} aria-describedby={error ? "documents-error" : undefined} onChange={(event) => { selectFiles(event.target.files); event.currentTarget.value = ""; }}/></label></div>
    {documents.length ? <div className="official-document-gallery">{documents.map((document, index) => <article key={document.url} className={showTypeErrors && document.type.trim().length < 2 ? "has-error" : ""}><button type="button" className="official-document-thumbnail" onClick={() => setPreviewUrl(document.url)} aria-label={`Preview document ${index + 1}: ${document.name}`}>{document.contentType === "application/pdf" ? <FileText size={40}/> : <Image src={document.url} alt={document.name} fill unoptimized sizes="150px"/>}<span><Eye size={14}/>Preview</span></button><div className="official-document-details"><small>{document.name} · {sizeLabel(document.size)}</small><label>Document type<input value={document.type} readOnly={Boolean(document.key)} maxLength={120} onChange={(event) => updateType(document.url, event.target.value)} placeholder={typePlaceholder} aria-label={`Document type for ${document.name}`} aria-invalid={showTypeErrors && document.type.trim().length < 2}/>{showTypeErrors && document.type.trim().length < 2 && <small className="wizard-field-error">Enter the document type.</small>}</label><button type="button" onClick={() => setConfirming(document)} aria-label={`Delete ${document.name}`}><Trash2 size={15}/>Delete</button></div></article>)}</div> : <p className="official-document-empty">Selected documents will appear here. You can preview each one and name its document type.</p>}
    {error && <small id="documents-error" className="wizard-field-error">{error}</small>}
    {preview && <div className="official-document-preview-backdrop" role="presentation" onClick={() => setPreviewUrl(null)}><div className="official-document-preview" role="dialog" aria-modal="true" aria-label={`Preview ${preview.name}`} onClick={(event) => event.stopPropagation()}><header><div><small>DOCUMENT {documents.indexOf(preview) + 1} OF {documents.length}</small><strong>{preview.name}</strong></div><button type="button" aria-label="Close document preview" onClick={() => setPreviewUrl(null)}><X size={18}/></button></header>{preview.contentType === "application/pdf" ? <iframe src={preview.url} title={preview.name}/> : <div className="official-document-preview-image"><Image src={preview.url} alt={preview.name} fill unoptimized sizes="(max-width: 800px) 95vw, 750px"/></div>}<footer><label>Document type<input value={preview.type} readOnly={Boolean(preview.key)} maxLength={120} onChange={(event) => updateType(preview.url, event.target.value)} placeholder="What type of document is this?" aria-invalid={showTypeErrors && preview.type.trim().length < 2}/>{showTypeErrors && preview.type.trim().length < 2 && <small className="wizard-field-error">Enter the document type.</small>}</label><button type="button" onClick={() => setConfirming(preview)}><Trash2 size={15}/>Delete</button><button type="button" className="official-document-preview-done" onClick={() => setPreviewUrl(null)}>Done</button></footer></div></div>}
    {confirming && <ConfirmDialog title="Delete document?" message={`Remove “${confirming.name}” from these documents?`} onCancel={() => setConfirming(null)} onConfirm={() => { remove(confirming.url); setConfirming(null); }}/>}
  </section>;
}
