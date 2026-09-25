/**
 * Clones an approved data company into additional verified companies at other locations.
 *
 * Every field is copied from the source company except the account (name, email, password),
 * the company name, and the location. Uploaded images and documents are copied into each new
 * company's own storage folder, so deleting one company's files never touches another's.
 *
 * Credentials come from the environment:
 *   HIMALAYA_EMAIL / HIMALAYA_PASSWORD, FILELABS_EMAIL / FILELABS_PASSWORD
 *   PARTNER_SEED_SOURCE_EMAIL (optional, defaults to humanloop@filemarket.ai)
 *
 * Running it again refreshes the same companies instead of creating duplicates.
 */
import { randomBytes, randomUUID, scrypt } from "node:crypto";
import nextEnv from "@next/env";
import pg from "pg";
import { GoogleAuth } from "google-auth-library";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const configuredUrl = process.env.DATABASE_URL || process.env.database;
if (!configuredUrl) throw new Error("Set database or DATABASE_URL before seeding partner companies.");
const parsedUrl = new URL(configuredUrl);
parsedUrl.searchParams.delete("sslmode");
parsedUrl.searchParams.delete("uselibpqcompat");
const connectionString = parsedUrl.toString();
const local = /localhost|127\.0\.0\.1/.test(connectionString);
const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";
const pool = new pg.Pool({ connectionString, ssl: local ? undefined : { rejectUnauthorized } });

const sourceEmail = (process.env.PARTNER_SEED_SOURCE_EMAIL || "humanloop@filemarket.ai").trim().toLowerCase();

/** The companies to create, with the location each one is registered at. */
const partners = [
  {
    key: "HIMALAYA",
    contactName: "Himalaya Data Lab",
    businessName: "Himalaya Data Lab Pvt Ltd",
    address: "Plot 278, Tyanglaphat, Ward 1, Kirtipur, Kathmandu, Bagmati Province, 44618, Nepal",
    city: "Kirtipur",
    country: "Nepal",
    latitude: 27.6816307,
    longitude: 85.2793631,
  },
  {
    key: "FILELABS",
    contactName: "FileMarket Labs",
    businessName: "FileMarket Labs Limited",
    address: "Unit 828-829, 8/F, Chun Shing Building, 85 Kwai Fuk Road, Kwai Chung, New Territories, Hong Kong",
    city: "Kwai Chung",
    country: "Hong Kong",
    latitude: 22.3611529,
    longitude: 114.1197,
  },
];

const scryptOptions = { cost: 32_768, blockSize: 8, parallelization: 1, maxmem: 64 * 1024 * 1024 };
const derive = (password, salt) => new Promise((resolve, reject) => {
  scrypt(password, salt, 64, scryptOptions, (error, key) => error ? reject(error) : resolve(key));
});
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await derive(password, salt);
  return `scrypt$${scryptOptions.cost}$${scryptOptions.blockSize}$${scryptOptions.parallelization}$${salt}$${hash.toString("hex")}`;
}

const publicAssetUrl = (key) => `/api/company-assets?public=1&key=${encodeURIComponent(key)}`;
const mapsUrl = (latitude, longitude) => `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "provider";

/** Copies one stored object into another company's folder, server side. */
async function copyAsset(sourceKey, targetKey) {
  const bucket = process.env.GCS_BUCKET;
  const projectId = process.env.GCS_PROJECT_ID;
  const clientEmail = process.env.GCS_CLIENT_EMAIL;
  const privateKey = process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!bucket || !projectId || !clientEmail || !privateKey) throw new Error("GCS is not configured, so company images cannot be copied.");
  const auth = await new GoogleAuth({
    credentials: { project_id: projectId, client_email: clientEmail, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/devstorage.read_write"],
  }).getClient();
  await auth.request({
    method: "POST",
    url: `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(sourceKey)}/copyTo/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(targetKey)}`,
  });
}

/** Rebuilds one stored asset under the new company, keeping its file name, size, and type. */
async function cloneAsset(asset, applicationId, folder) {
  const name = asset.name || asset.key.split("/").pop();
  const key = `company-submissions/${applicationId}/${folder}/${randomUUID()}-${name}`;
  await copyAsset(asset.key, key);
  return { ...asset, key };
}

const client = await pool.connect();
try {
  const source = (await client.query(`
    SELECT applications.*, users.name AS applicant_name
    FROM supplier_applications applications
    JOIN users ON users.id = applications.user_id
    WHERE users.email = $1 AND applications.application_kind = 'company'
    ORDER BY applications.submitted_at DESC LIMIT 1
  `, [sourceEmail])).rows[0];
  if (!source) throw new Error(`No company application found for ${sourceEmail}.`);
  const sourceProvider = (await client.query("SELECT media, profile FROM providers WHERE slug = $1", [source.provider_slug])).rows[0];
  console.log(`Cloning "${source.business_name}" (${source.office_images.length} images, ${source.official_documents.length} documents).`);

  for (const partner of partners) {
    const email = process.env[`${partner.key}_EMAIL`]?.trim().toLowerCase();
    const password = process.env[`${partner.key}_PASSWORD`];
    if (!email || !password) throw new Error(`Set ${partner.key}_EMAIL and ${partner.key}_PASSWORD before seeding ${partner.businessName}.`);
    if (password.length < 12) throw new Error(`${partner.key}_PASSWORD must contain at least 12 characters.`);

    await client.query("BEGIN");

    // The account. An existing address keeps its id so the company and its listing stay attached.
    const userId = (await client.query(`
      INSERT INTO users (id, name, email, password_hash, role, email_verified_at)
      VALUES ($1, $2, $3, $4, 'supplier', NOW())
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash,
        role = 'supplier', email_verified_at = COALESCE(users.email_verified_at, NOW())
      RETURNING id
    `, [randomUUID(), partner.contactName, email, await hashPassword(password)])).rows[0].id;

    const existing = (await client.query("SELECT id, provider_slug, office_images FROM supplier_applications WHERE user_id = $1 AND application_kind = 'company' ORDER BY submitted_at DESC LIMIT 1", [userId])).rows[0];
    const applicationId = existing?.id ?? randomUUID();
    const slug = existing?.provider_slug ?? `${slugify(partner.businessName)}-${applicationId.slice(0, 6)}`;

    // Copy the images and documents once; a rerun keeps the files already in place.
    const copied = existing?.office_images?.length ? null : {
      logo: source.company_logo ? await cloneAsset(source.company_logo, applicationId, "logo") : null,
      officeImages: await Promise.all(source.office_images.map((asset) => cloneAsset(asset, applicationId, "office"))),
      documents: await Promise.all(source.official_documents.map((asset) => cloneAsset(asset, applicationId, "document"))),
    };
    const assets = copied ?? {
      logo: (await client.query("SELECT company_logo FROM supplier_applications WHERE id = $1", [applicationId])).rows[0].company_logo,
      officeImages: existing.office_images,
      documents: (await client.query("SELECT official_documents FROM supplier_applications WHERE id = $1", [applicationId])).rows[0].official_documents,
    };
    // Keep the background the source company chose, matched by file name.
    const sourceCoverName = source.cover_image?.split("/").pop()?.replace(/^[0-9a-f-]{36}-/, "");
    const cover = assets.officeImages.find((asset) => asset.name === sourceCoverName) ?? assets.officeImages[0];

    await client.query(`
      INSERT INTO supplier_applications (
        id, user_id, application_kind, business_name, maps_url, physical_address, city, country,
        longitude, latitude, hardware_pictures, office_images, official_documents, company_logo, cover_image,
        linkedin_url, twitter_url, huggingface_url, website_url, provider_type, modalities, robotics_types,
        profile_description, capacity, capture_environments, facility_details, company_focus,
        provider_slug, status, verification_level, admin_notes, submitted_at, reviewed_at
      ) VALUES ($1,$2,'company',$3,$4,$5,$6,$7,$8,$9,'[]'::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13,
        $14,$15,$16,$17,$18,$19::jsonb,$20::jsonb,$21,$22,$23::jsonb,$24::jsonb,$25,$26,'approved',$27,'Seeded partner company.',NOW(),NOW())
      ON CONFLICT (id) DO UPDATE SET business_name = EXCLUDED.business_name, maps_url = EXCLUDED.maps_url,
        physical_address = EXCLUDED.physical_address, city = EXCLUDED.city, country = EXCLUDED.country,
        longitude = EXCLUDED.longitude, latitude = EXCLUDED.latitude, cover_image = EXCLUDED.cover_image,
        modalities = EXCLUDED.modalities, profile_description = EXCLUDED.profile_description,
        website_url = EXCLUDED.website_url, status = 'approved', verification_level = EXCLUDED.verification_level,
        reviewed_at = NOW()
    `, [
      applicationId, userId, partner.businessName, mapsUrl(partner.latitude, partner.longitude), partner.address,
      partner.city, partner.country, partner.longitude, partner.latitude,
      JSON.stringify(assets.officeImages), JSON.stringify(assets.documents), JSON.stringify(assets.logo), cover?.key ?? null,
      source.linkedin_url, source.twitter_url, source.huggingface_url, source.website_url, source.provider_type,
      JSON.stringify(source.modalities), JSON.stringify(source.robotics_types), source.profile_description,
      source.capacity, JSON.stringify(source.capture_environments), JSON.stringify(source.facility_details),
      source.company_focus, slug, source.verification_level,
    ]);

    // The public listing, built the way an admin approval builds it: background first.
    const photos = [cover, ...assets.officeImages.filter((asset) => asset.key !== cover?.key)].filter(Boolean).map((asset) => publicAssetUrl(asset.key));
    const media = { ...sourceProvider.media, src: photos[0], alt: `${partner.businessName} company` };
    const profile = {
      ...sourceProvider.profile,
      photos,
      logo: assets.logo ? publicAssetUrl(assets.logo.key) : null,
      links: { ...sourceProvider.profile.links, maps: mapsUrl(partner.latitude, partner.longitude) },
    };
    await client.query(`
      INSERT INTO providers (owner_id, slug, name, city, country, longitude, latitude, provider_type, modalities, media, profile, verification_level, status, is_demo)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12,'approved',FALSE)
      ON CONFLICT (slug) DO UPDATE SET owner_id = EXCLUDED.owner_id, name = EXCLUDED.name, city = EXCLUDED.city,
        country = EXCLUDED.country, longitude = EXCLUDED.longitude, latitude = EXCLUDED.latitude,
        provider_type = EXCLUDED.provider_type, modalities = EXCLUDED.modalities, media = EXCLUDED.media,
        profile = EXCLUDED.profile, verification_level = EXCLUDED.verification_level, status = 'approved',
        is_demo = FALSE, updated_at = NOW()
    `, [
      userId, slug, partner.businessName, partner.city, partner.country, partner.longitude, partner.latitude,
      source.provider_type, JSON.stringify(source.modalities), JSON.stringify(media), JSON.stringify(profile),
      source.verification_level,
    ]);

    await client.query("COMMIT");
    console.log(`${partner.businessName} is live at ${partner.city}, ${partner.country} — /operators/${slug} (${email}).`);
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
