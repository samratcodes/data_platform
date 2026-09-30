"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, Check, Cpu, Database, Eye, EyeOff, ImagePlus, LoaderCircle, Save, Star, Tag, Target, Trash2, X } from "lucide-react";
import ProductCard, { ProductPhoto } from "@/components/devices/ProductCard";
import { api } from "@/lib/api-client";
import { MAX_PRODUCT_IMAGE_BYTES, MAX_PRODUCT_IMAGES, deviceAvailability, deviceCategories, deviceDataOutputs, deviceSpecFields, deviceUseCases, emptyDeviceProduct, productIssues, type DeviceProduct, type DeviceProductInput } from "@/lib/devices";
import type { User } from "@/types/app";
import SupplierShell, { SideCard } from "./SupplierShell";

type LocalPhoto = { file: File; url: string };
type FieldKey = keyof ReturnType<typeof productIssues>;

const inputFrom = (product?: DeviceProduct): DeviceProductInput => product
  ? { name: product.name, category: product.category, categoryOther: product.categoryOther, description: product.description, useCases: product.useCases, dataOutputs: product.dataOutputs, specs: product.specs, price: product.price, availability: product.availability, published: product.published }
  : emptyDeviceProduct;

async function uploadPhotos(productId: string, photos: LocalPhoto[]) {
  if (!photos.length) return;
  const body = new FormData();
  photos.forEach((photo) => body.append("files", photo.file));
  const response = await fetch(`/api/supplier/products/${productId}/images`, { method: "POST", body });
  const data = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(data.error || "The photos could not be uploaded.");
}

/** Adds or edits a product: device type, use, data outputs, spec sheet, price, availability, and photos, with a live card preview. */
export default function ProductForm({ user, product }: { user: User; product?: DeviceProduct }) {
  const router = useRouter();
  const [values, setValues] = useState(() => inputFrom(product));
  const [saved, setSaved] = useState(product?.images ?? []);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState("");
  const [error, setError] = useState("");

  // Local previews are released when the form closes; removing one photo releases it right away.
  const photoUrls = useRef<string[]>([]);
  useEffect(() => { photoUrls.current = photos.map((photo) => photo.url); }, [photos]);
  useEffect(() => () => photoUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const issues = attempted ? productIssues(values) : {};
  const set = <K extends keyof DeviceProductInput>(field: K, value: DeviceProductInput[K]) => setValues((current) => ({ ...current, [field]: value }));
  const toggle = (field: "useCases" | "dataOutputs", item: string) => set(field, values[field].includes(item) ? values[field].filter((value) => value !== item) : [...values[field], item]);
  const errorText = (field: FieldKey) => issues[field] && <small id={`${field}-error`} className="wizard-field-error">{issues[field]}</small>;
  const errorProps = (field: FieldKey) => ({ "aria-invalid": Boolean(issues[field]), "aria-describedby": issues[field] ? `${field}-error` : undefined });
  const photoCount = saved.length + photos.length;
  const preview = useMemo<DeviceProduct>(() => ({ ...values, name: values.name || "Your product name", id: product?.id ?? "preview", images: saved, createdAt: "", updatedAt: "" }), [values, saved, product?.id]);

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const picked = [...files];
    if (picked.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > MAX_PRODUCT_IMAGE_BYTES)) { setError("Use JPG, PNG, or WebP photos of 10 MB or less."); return; }
    if (photoCount + picked.length > MAX_PRODUCT_IMAGES) { setError(`A product can have up to ${MAX_PRODUCT_IMAGES} photos.`); return; }
    setError("");
    setPhotos((current) => [...current, ...picked.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  };
  const removeLocal = (url: string) => { URL.revokeObjectURL(url); setPhotos((current) => current.filter((photo) => photo.url !== url)); };
  const savedAction = async (key: string, action: "cover" | "delete") => {
    if (!product) return;
    setPhotoBusy(key); setError("");
    try {
      if (action === "delete") { await api(`/api/supplier/products/${product.id}/images?key=${encodeURIComponent(key)}`, { method: "DELETE" }); setSaved((current) => current.filter((image) => image.key !== key)); }
      else { await api(`/api/supplier/products/${product.id}/images`, { method: "PATCH", body: JSON.stringify({ cover: key }) }); setSaved((current) => [...current.filter((image) => image.key === key), ...current.filter((image) => image.key !== key)]); }
    } catch (reason) { setError((reason as Error).message); }
    finally { setPhotoBusy(""); }
  };

  const submit = async () => {
    if (Object.keys(productIssues(values)).length) {
      setAttempted(true); setError("");
      window.setTimeout(() => document.querySelector<HTMLElement>('.product-form [aria-invalid="true"], .product-form .has-error')?.scrollIntoView({ block: "center", behavior: "smooth" }), 0);
      return;
    }
    setBusy(true); setError("");
    try {
      const id = product ? product.id : (await api<{ id: string }>("/api/supplier/products", { method: "POST", body: JSON.stringify(values) })).id;
      if (product) await api(`/api/supplier/products/${product.id}`, { method: "PATCH", body: JSON.stringify(values) });
      let outcome = product ? "updated" : "created";
      try { await uploadPhotos(id, photos); } catch { outcome = "partial"; }
      router.push(`/supplier/products?saved=${outcome}`);
      router.refresh();
    } catch (reason) { setError((reason as Error).message); setBusy(false); }
  };

  return <SupplierShell
    user={user} active="products" eyebrow={product ? "EDIT PRODUCT" : "NEW PRODUCT"} title={product ? product.name : "Add a product"}
    description="Describe the device the way a buyer compares it: what it is, what it is used for, the data it provides, and its specs."
    back={{ href: "/supplier/products", label: "All products" }}
    notice={error && <p className="form-error" role="alert">{error}</p>}
    aside={<>
      <SideCard title="Card preview" icon={<Eye size={16}/>}>
        <p>This is how the product appears in your store and the device marketplace.</p>
        <div className="product-form-preview"><ProductCard product={preview} photoSrc={saved.length ? undefined : photos[0]?.url}/></div>
      </SideCard>
    </>}
  >
    <form className="product-form" noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      {attempted && Object.keys(issues).length > 0 && <div className="company-wizard-alert" role="alert"><AlertTriangle size={19}/><span><strong>Check the highlighted fields</strong><small>Correct each highlighted field to save the product.</small></span></div>}

      <fieldset className="product-form-card">
        <legend><Tag size={16}/>Product basics</legend>
        <label className={`wizard-input-card ${issues.name ? "has-error" : ""}`}><span>Product name</span><input value={values.name} maxLength={120} onChange={(event) => set("name", event.target.value)} placeholder="e.g. EgoCam X2 head-mounted camera" {...errorProps("name")}/>{errorText("name")}</label>
        <div><span className="wizard-section-label">Device type</span>
          <div className={`product-choice-grid ${issues.category ? "has-error" : ""}`}>{deviceCategories.map((category) => <button type="button" key={category.value} className={values.category === category.value ? "selected" : ""} aria-pressed={values.category === category.value} onClick={() => set("category", category.value)}><Camera size={15}/>{category.label}{values.category === category.value && <Check size={14}/>}</button>)}</div>
        </div>
        {values.category === "other" && <label className={`wizard-input-card ${issues.categoryOther ? "has-error" : ""}`}><span>Name the device type</span><input value={values.categoryOther} maxLength={80} onChange={(event) => set("categoryOther", event.target.value)} placeholder="e.g. Thermal camera" {...errorProps("categoryOther")}/>{errorText("categoryOther")}</label>}
        <label className={`wizard-input-card ${issues.description ? "has-error" : ""}`}><span>Description</span><textarea value={values.description} maxLength={3000} rows={5} onChange={(event) => set("description", event.target.value)} placeholder="What makes this device good for data collection? Mounting, comfort for long sessions, recording workflow, what's in the box…" {...errorProps("description")}/>{errorText("description")}</label>
      </fieldset>

      <fieldset className="product-form-card">
        <legend><Target size={16}/>What it is used for</legend>
        <div className={`product-chip-picker ${issues.useCases ? "has-error" : ""}`}>{deviceUseCases.map((item) => <button type="button" key={item} aria-pressed={values.useCases.includes(item)} className={values.useCases.includes(item) ? "selected" : ""} onClick={() => toggle("useCases", item)}>{values.useCases.includes(item) && <Check size={13}/>}{item}</button>)}</div>
        {issues.useCases && <p className="wizard-section-error">{issues.useCases}</p>}
      </fieldset>

      <fieldset className="product-form-card">
        <legend><Database size={16}/>Data it provides</legend>
        <div className={`product-chip-picker is-data ${issues.dataOutputs ? "has-error" : ""}`}>{deviceDataOutputs.map((item) => <button type="button" key={item} aria-pressed={values.dataOutputs.includes(item)} className={values.dataOutputs.includes(item) ? "selected" : ""} onClick={() => toggle("dataOutputs", item)}>{values.dataOutputs.includes(item) && <Check size={13}/>}{item}</button>)}</div>
        {issues.dataOutputs && <p className="wizard-section-error">{issues.dataOutputs}</p>}
      </fieldset>

      <fieldset className="product-form-card">
        <legend><Cpu size={16}/>Specifications <small>Fill in what applies</small></legend>
        <div className="product-spec-grid">{deviceSpecFields.map((field) => <label className="wizard-input-card" key={field.key}><span>{field.label}</span><input value={values.specs[field.key] ?? ""} maxLength={120} onChange={(event) => set("specs", { ...values.specs, [field.key]: event.target.value })} placeholder={field.placeholder}/></label>)}</div>
      </fieldset>

      <fieldset className="product-form-card">
        <legend><Tag size={16}/>Price and availability</legend>
        <label className={`wizard-input-card ${issues.price ? "has-error" : ""}`}><span>Price <small>Optional — leave empty to show &ldquo;Price on enquiry&rdquo;</small></span><input value={values.price} maxLength={60} onChange={(event) => set("price", event.target.value)} placeholder="e.g. USD 1,299 per unit" {...errorProps("price")}/>{errorText("price")}</label>
        <div><span className="wizard-section-label">Availability</span><div className="product-chip-picker">{deviceAvailability.map((item) => <button type="button" key={item.value} aria-pressed={values.availability === item.value} className={values.availability === item.value ? "selected" : ""} onClick={() => set("availability", item.value)}>{values.availability === item.value && <Check size={13}/>}{item.label}</button>)}</div></div>
        <label className="product-publish-toggle"><input type="checkbox" checked={values.published} onChange={(event) => set("published", event.target.checked)}/><span>{values.published ? <Eye size={16}/> : <EyeOff size={16}/>}<strong>{values.published ? "Published in your store" : "Hidden from your store"}</strong><small>{values.published ? "Visible to buyers and data companies once your company is approved." : "Only you can see this product until you publish it."}</small></span></label>
      </fieldset>

      <fieldset className="product-form-card">
        <legend><ImagePlus size={16}/>Photos <small>{photoCount} of {MAX_PRODUCT_IMAGES} · the first photo is the cover</small></legend>
        <div className="product-photo-grid">
          {saved.map((image, index) => <figure key={image.key} className={index === 0 ? "is-cover" : ""}>
            <ProductPhoto product={{ images: saved, name: values.name }} index={index} sizes="160px"/>
            {index === 0 && <span className="product-photo-cover"><Star size={11}/>Cover</span>}
            <figcaption>
              {index > 0 && <button type="button" disabled={photoBusy === image.key} onClick={() => savedAction(image.key, "cover")} aria-label="Make this the cover photo"><Star size={13}/></button>}
              <button type="button" disabled={photoBusy === image.key} onClick={() => savedAction(image.key, "delete")} aria-label="Delete this photo">{photoBusy === image.key ? <LoaderCircle size={13} className="spin"/> : <Trash2 size={13}/>}</button>
            </figcaption>
          </figure>)}
          {photos.map((photo, index) => <figure key={photo.url} className={!saved.length && index === 0 ? "is-cover" : ""}>
            <ProductPhoto product={{ images: [], name: values.name }} src={photo.url} sizes="160px"/>
            <span className="product-photo-new">New</span>
            <figcaption><button type="button" onClick={() => removeLocal(photo.url)} aria-label="Remove this photo"><X size={13}/></button></figcaption>
          </figure>)}
          {photoCount < MAX_PRODUCT_IMAGES && <label className="product-photo-add"><ImagePlus/><span>Add photos</span><small>JPG, PNG, or WebP · 10 MB each</small><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { addPhotos(event.target.files); event.target.value = ""; }}/></label>}
        </div>
      </fieldset>

      <div className="product-form-actions">
        <Link className="secondary-button" href="/supplier/products">Cancel</Link>
        <button type="submit" className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16}/> : <><Save size={15}/>{product ? "Save changes" : "Add to store"}</>}</button>
      </div>
    </form>
  </SupplierShell>;
}
