import "server-only";

import { query } from "@/lib/db/client";
import { isUuid } from "@/lib/security";
import type { DeviceProduct, ProductImage, SentEnquiry, StoreProduct } from "@/lib/devices";

type ProductRow = {
  id: string; name: string; category: DeviceProduct["category"]; category_other: string; description: string;
  use_cases: string[]; data_outputs: string[]; specs: DeviceProduct["specs"]; price: string;
  availability: DeviceProduct["availability"]; images: ProductImage[]; published: boolean; created_at: string; updated_at: string;
};
type StoreRow = ProductRow & { store_slug: string; store_name: string; store_city: string; store_country: string; store_logo: string | null };

const productColumns = `products.id, products.name, products.category, products.category_other, products.description, products.use_cases,
  products.data_outputs, products.specs, products.price, products.availability, products.images, products.published,
  products.created_at, products.updated_at`;

// A store is live when its device company has an approved, public listing.
const liveStore = `providers.provider_type = 'Device Supplier' AND providers.status = 'approved'
  AND providers.verification_level IN ('online', 'physical') AND providers.is_demo = FALSE`;
const storeColumns = `providers.slug AS store_slug, providers.name AS store_name, providers.city AS store_city,
  providers.country AS store_country, providers.profile->>'logo' AS store_logo`;

const fromRow = (row: ProductRow): DeviceProduct => ({
  id: row.id, name: row.name, category: row.category, categoryOther: row.category_other, description: row.description,
  useCases: row.use_cases, dataOutputs: row.data_outputs, specs: row.specs, price: row.price, availability: row.availability,
  images: row.images, published: row.published, createdAt: row.created_at, updatedAt: row.updated_at,
});
const fromStoreRow = (row: StoreRow): StoreProduct => ({
  ...fromRow(row),
  store: { slug: row.store_slug, name: row.store_name, city: row.store_city, country: row.store_country, logo: row.store_logo },
});

/** Every product a device company owns, published or hidden, for its own store manager. */
export async function ownerProducts(userId: string) {
  const result = await query<ProductRow>(`SELECT ${productColumns} FROM device_products products WHERE products.user_id = $1 ORDER BY products.created_at DESC`, [userId]);
  return result.rows.map(fromRow);
}

export async function ownerProduct(userId: string, id: string) {
  if (!isUuid(id)) return null;
  const result = await query<ProductRow>(`SELECT ${productColumns} FROM device_products products WHERE products.id = $1 AND products.user_id = $2`, [id, userId]);
  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

/** Published products of one live store. */
export async function storeProducts(storeSlug: string) {
  const result = await query<StoreRow>(`
    SELECT ${productColumns}, ${storeColumns}
    FROM device_products products
    JOIN providers ON providers.owner_id = products.user_id
    WHERE providers.slug = $1 AND ${liveStore} AND products.published
    ORDER BY products.created_at DESC
  `, [storeSlug]);
  return result.rows.map(fromStoreRow);
}

/** Published products across every live store, for the device marketplace. */
export async function marketplaceProducts() {
  const result = await query<StoreRow>(`
    SELECT ${productColumns}, ${storeColumns}
    FROM device_products products
    JOIN providers ON providers.owner_id = products.user_id
    WHERE ${liveStore} AND products.published
    ORDER BY products.created_at DESC
    LIMIT 500
  `);
  return result.rows.map(fromStoreRow);
}

/** A published product on a live store, used to accept enquiries. */
export async function liveProduct(id: string) {
  if (!isUuid(id)) return null;
  const result = await query<StoreRow & { owner_id: string }>(`
    SELECT ${productColumns}, ${storeColumns}, products.user_id AS owner_id
    FROM device_products products
    JOIN providers ON providers.owner_id = products.user_id
    WHERE products.id = $1 AND ${liveStore} AND products.published
    LIMIT 1
  `, [id]);
  const row = result.rows[0];
  return row ? { product: fromStoreRow(row), ownerId: row.owner_id } : null;
}

export type ReceivedEnquiry = {
  id: string; product_id: string; product_name: string; quantity: number | null; timeline: string; message: string; status: string;
  sender_name: string; sender_email: string; sender_role: string; sender_company: string | null; created_at: string;
  /** The chat thread about this product, when the sender started one. */
  conversation_id: string | null;
};

/** Enquiries sent to a device company about any of its products, newest first. */
export async function receivedEnquiries(ownerId: string) {
  const result = await query<ReceivedEnquiry>(`
    SELECT enquiries.id, enquiries.product_id, products.name AS product_name, enquiries.quantity, enquiries.timeline, enquiries.message,
           enquiries.status, enquiries.created_at, users.name AS sender_name, users.email AS sender_email, users.role AS sender_role,
           (SELECT business_name FROM supplier_applications WHERE user_id = users.id AND application_kind = 'company' ORDER BY submitted_at DESC LIMIT 1) AS sender_company,
           (SELECT id FROM conversations WHERE conversations.product_id = enquiries.product_id AND conversations.buyer_id = enquiries.user_id LIMIT 1) AS conversation_id
    FROM product_enquiries enquiries
    JOIN device_products products ON products.id = enquiries.product_id
    JOIN users ON users.id = enquiries.user_id
    WHERE products.user_id = $1
    ORDER BY enquiries.updated_at DESC
    LIMIT 200
  `, [ownerId]);
  return result.rows;
}

/** The viewer's own enquiries with the product and store each went to, newest activity first. */
export async function sentEnquiries(userId: string) {
  const result = await query<SentEnquiry>(`
    SELECT enquiries.id, enquiries.product_id, enquiries.status, enquiries.created_at, enquiries.updated_at,
           enquiries.quantity, enquiries.timeline, enquiries.message, products.name AS product_name,
           products.images->0->>'key' AS product_image,
           COALESCE(providers.name, (SELECT business_name FROM supplier_applications WHERE user_id = products.user_id AND application_kind = 'company' ORDER BY submitted_at DESC LIMIT 1), 'Device company') AS store_name,
           providers.slug AS store_slug,
           (SELECT id FROM conversations WHERE conversations.product_id = enquiries.product_id AND conversations.buyer_id = enquiries.user_id LIMIT 1) AS conversation_id
    FROM product_enquiries enquiries
    JOIN device_products products ON products.id = enquiries.product_id
    LEFT JOIN providers ON providers.owner_id = products.user_id AND providers.provider_type = 'Device Supplier'
    WHERE enquiries.user_id = $1
    ORDER BY enquiries.updated_at DESC
    LIMIT 500
  `, [userId]);
  return result.rows;
}

/**
 * A product as its page shows it: any published product on a live store, or the owner's own
 * product in any state (a preview before it is published or the store is approved).
 */
export async function productForPage(id: string, viewerId: string) {
  const live = await liveProduct(id);
  if (live) return { product: live.product, isOwner: live.ownerId === viewerId, isLive: true };
  const own = await ownerProduct(viewerId, id);
  if (!own) return null;
  const company = (await query<{ business_name: string; city: string | null; country: string | null; slug: string | null }>(`
    SELECT applications.business_name, applications.city, applications.country, providers.slug
    FROM supplier_applications applications
    LEFT JOIN providers ON providers.owner_id = applications.user_id AND providers.provider_type = 'Device Supplier'
    WHERE applications.user_id = $1 AND applications.application_kind = 'company'
    ORDER BY applications.submitted_at DESC LIMIT 1
  `, [viewerId])).rows[0];
  const product: StoreProduct = { ...own, store: { slug: company?.slug ?? "", name: company?.business_name ?? "Your store", city: company?.city ?? "", country: company?.country ?? "", logo: null } };
  return { product, isOwner: true, isLive: false };
}