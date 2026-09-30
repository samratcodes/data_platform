/**
 * Device products sold by device companies: shared by the product form, the API,
 * the supplier store, and the public storefront. Keep this file free of server-only imports.
 */

export const deviceCategories = [
  { value: "head-camera", label: "Head-mounted camera" },
  { value: "smart-glasses", label: "Smart glasses" },
  { value: "chest-camera", label: "Chest / body camera" },
  { value: "wrist-camera", label: "Wrist camera" },
  { value: "action-camera", label: "Action camera" },
  { value: "360-camera", label: "360° camera" },
  { value: "depth-camera", label: "Depth / 3D camera" },
  { value: "multi-camera-rig", label: "Multi-camera rig" },
  { value: "lidar", label: "LiDAR scanner" },
  { value: "audio-recorder", label: "Microphone / audio recorder" },
  { value: "motion-capture", label: "Motion capture / IMU" },
  { value: "data-glove", label: "Data glove / hand tracking" },
  { value: "eye-tracker", label: "Eye tracker" },
  { value: "other", label: "Other device" },
] as const;

export const deviceUseCases = [
  "Egocentric recording", "Factory & workplace capture", "Household tasks", "Robot teleoperation",
  "Hand & manipulation tracking", "Speech & audio capture", "3D scanning & mapping", "Outdoor & mobility", "Retail & in-store",
] as const;

export const deviceDataOutputs = [
  "Egocentric video", "Exocentric video", "Still images", "Depth maps", "Point clouds", "Audio",
  "IMU / motion", "Hand pose", "Eye gaze", "GPS / location",
] as const;

export const deviceAvailability = [
  { value: "in-stock", label: "In stock" },
  { value: "made-to-order", label: "Made to order" },
  { value: "pre-order", label: "Pre-order" },
  { value: "rental", label: "Available to rent" },
] as const;

/** Spec sheet rows every product can fill in; all are optional free text. */
export const deviceSpecFields = [
  { key: "resolution", label: "Resolution", placeholder: "4K (3840×2160)" },
  { key: "frameRate", label: "Frame rate", placeholder: "30 / 60 fps" },
  { key: "fieldOfView", label: "Field of view", placeholder: "120° diagonal" },
  { key: "sensors", label: "Sensors", placeholder: "RGB, depth, 6-axis IMU" },
  { key: "batteryLife", label: "Battery life", placeholder: "3 h continuous recording" },
  { key: "storage", label: "Storage", placeholder: "128 GB onboard + microSD" },
  { key: "weight", label: "Weight", placeholder: "95 g" },
  { key: "connectivity", label: "Connectivity", placeholder: "Wi-Fi 6, Bluetooth 5.2, USB-C" },
  { key: "fileFormat", label: "Output format", placeholder: "MP4 (H.265), WAV, CSV" },
] as const;

export type DeviceCategory = (typeof deviceCategories)[number]["value"];
export type DeviceAvailability = (typeof deviceAvailability)[number]["value"];
export type DeviceSpecKey = (typeof deviceSpecFields)[number]["key"];
export type DeviceSpecs = Partial<Record<DeviceSpecKey, string>>;
export type ProductImage = { key: string; name: string; contentType: string; size?: number };

/** A product as its owner edits it. */
export type DeviceProductInput = {
  name: string;
  category: DeviceCategory;
  categoryOther: string;
  description: string;
  useCases: string[];
  dataOutputs: string[];
  specs: DeviceSpecs;
  price: string;
  availability: DeviceAvailability;
  published: boolean;
};

/** A product as stored, with its images. */
export type DeviceProduct = DeviceProductInput & { id: string; images: ProductImage[]; createdAt: string; updatedAt: string };

/** A published product on a live store, with the store it belongs to. */
export type StoreProduct = DeviceProduct & { store: { slug: string; name: string; city: string; country: string; logo: string | null } };

export const MAX_PRODUCT_IMAGES = 6;
export const MAX_PRODUCT_IMAGE_BYTES = 10_000_000;

export const emptyDeviceProduct: DeviceProductInput = { name: "", category: "head-camera", categoryOther: "", description: "", useCases: [], dataOutputs: [], specs: {}, price: "", availability: "in-stock", published: true };

export function deviceCategoryLabel(product: Pick<DeviceProductInput, "category" | "categoryOther">) {
  if (product.category === "other") return product.categoryOther.trim() || "Other device";
  return deviceCategories.find((item) => item.value === product.category)?.label ?? "Device";
}

export const availabilityLabel = (value: string) => deviceAvailability.find((item) => item.value === value)?.label ?? "In stock";
export const priceLabel = (price: string) => price.trim() || "Price on enquiry";

/** The filled spec rows in display order. */
export const specRows = (specs: DeviceSpecs) => deviceSpecFields.flatMap((field) => specs[field.key]?.trim() ? [{ key: field.key, label: field.label, value: specs[field.key]!.trim() }] : []);

export const productImageUrl = (key: string) => `/api/product-images?key=${encodeURIComponent(key)}`;
export const productPageUrl = (id: string) => `/devices/${id}`;

/** When the sender needs the devices, chosen on the enquiry form. */
export const enquiryTimelines = ["As soon as possible", "Within a month", "In 1–3 months", "Later this year", "Just exploring"] as const;

/**
 * An enquiry the viewer sent, from the enquiry form or their first chat message about a product,
 * with the product and store it went to.
 */
export type SentEnquiry = {
  id: string; product_id: string; status: string; created_at: string; updated_at: string;
  quantity: number | null; timeline: string; message: string;
  product_name: string; product_image: string | null; store_name: string; store_slug: string | null;
  conversation_id: string | null;
};

/** Normalizes an untrusted enquiry form body, or returns the problem to show. */
export function parseEnquiry(input: Record<string, unknown>): { enquiry: { productId: string; quantity: number | null; timeline: string; message: string }; error?: never } | { enquiry?: never; error: string } {
  const productId = typeof input.productId === "string" ? input.productId : "";
  const rawQuantity = input.quantity === "" || input.quantity == null ? null : Number(input.quantity);
  if (rawQuantity !== null && (!Number.isInteger(rawQuantity) || rawQuantity < 1 || rawQuantity > 100_000)) return { error: "Enter a quantity between 1 and 100,000, or leave it empty." };
  const timeline = enquiryTimelines.find((item) => item === input.timeline) ?? "";
  const message = typeof input.message === "string" ? input.message.normalize("NFKC").replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim() : "";
  if (message.length < 10 || message.length > 4_000) return { error: "Tell the store what you need in 10–4,000 characters." };
  return { enquiry: { productId, quantity: rawQuantity, timeline, message } };
}

type Issues = Partial<Record<"name" | "category" | "categoryOther" | "description" | "useCases" | "dataOutputs" | "price", string>>;

/** Returns a problem message per field; an empty object means the product is valid. */
export function productIssues(product: DeviceProductInput): Issues {
  const issues: Issues = {};
  if (product.name.trim().length < 2) issues.name = "Enter a product name with at least 2 characters.";
  if (!deviceCategories.some((item) => item.value === product.category)) issues.category = "Choose the device type.";
  if (product.category === "other" && product.categoryOther.trim().length < 2) issues.categoryOther = "Name the device type.";
  if (product.description.trim().length < 20) issues.description = "Describe the device in at least 20 characters.";
  if (!product.useCases.length) issues.useCases = "Choose at least one thing this device is used for.";
  if (!product.dataOutputs.length) issues.dataOutputs = "Choose at least one kind of data it provides.";
  if (product.price.length > 60) issues.price = "Keep the price under 60 characters.";
  return issues;
}

const clean = (value: unknown, max: number) => typeof value === "string" ? value.normalize("NFKC").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
const pick = (value: unknown, allowed: readonly string[]) => Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && allowed.includes(item)))] : [];

/** Normalizes untrusted input (API bodies, stored rows) into a product, or returns its problems. */
export function parseDeviceProduct(input: unknown): { product: DeviceProductInput; issues: Issues } {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const category = deviceCategories.find((item) => item.value === raw.category)?.value ?? ("" as DeviceCategory);
  const specsInput = raw.specs && typeof raw.specs === "object" && !Array.isArray(raw.specs) ? raw.specs as Record<string, unknown> : {};
  const specs: DeviceSpecs = {};
  for (const field of deviceSpecFields) { const value = clean(specsInput[field.key], 120); if (value) specs[field.key] = value; }
  const description = typeof raw.description === "string" ? raw.description.normalize("NFKC").replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim().slice(0, 3_000) : "";
  const product: DeviceProductInput = {
    name: clean(raw.name, 120),
    category,
    categoryOther: category === "other" ? clean(raw.categoryOther, 80) : "",
    description,
    useCases: pick(raw.useCases, deviceUseCases),
    dataOutputs: pick(raw.dataOutputs, deviceDataOutputs),
    specs,
    price: clean(raw.price, 60),
    availability: deviceAvailability.find((item) => item.value === raw.availability)?.value ?? "in-stock",
    published: raw.published !== false,
  };
  return { product, issues: productIssues(product) };
}
