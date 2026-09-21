import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const configuredUrl = process.env.DATABASE_URL || process.env.database;
if (!configuredUrl) throw new Error("Set database or DATABASE_URL before running maintenance.");
const parsedUrl = new URL(configuredUrl);
parsedUrl.searchParams.delete("sslmode");
parsedUrl.searchParams.delete("uselibpqcompat");
const connectionString = parsedUrl.toString();
const local = /localhost|127\.0\.0\.1/.test(connectionString);
const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";
const pool = new pg.Pool({ connectionString, ssl: local ? undefined : { rejectUnauthorized } });

try {
  const [sessions, attempts, tokens, integrationOutbox, emailOutbox] = await Promise.all([
    pool.query("DELETE FROM sessions WHERE expires_at < $1", [Date.now()]),
    pool.query("DELETE FROM auth_attempts WHERE reset_at < $1", [Date.now()]),
    pool.query("DELETE FROM auth_tokens WHERE expires_at < NOW() - INTERVAL '7 days' OR consumed_at < NOW() - INTERVAL '7 days'"),
    pool.query("DELETE FROM integration_outbox WHERE status = 'completed' AND processed_at < NOW() - INTERVAL '30 days'"),
    pool.query("DELETE FROM email_outbox WHERE status IN ('sent', 'failed') AND created_at < NOW() - INTERVAL '30 days'"),
  ]);
  // Point every approved listing at the background image its supplier chose, in case a listing
  // was rebuilt before the choice was recorded.
  const publicAssetUrl = (key) => `/api/company-assets?public=1&key=${encodeURIComponent(key)}`;
  const listings = await pool.query(`
    SELECT applications.cover_image, providers.slug, providers.profile->'photos' AS photos
    FROM supplier_applications applications
    JOIN providers ON providers.slug = applications.provider_slug AND providers.owner_id = applications.user_id
    WHERE applications.cover_image IS NOT NULL AND providers.status = 'approved'
  `);
  let backgrounds = 0;
  for (const listing of listings.rows) {
    const cover = listing.cover_image.startsWith("http") ? listing.cover_image : publicAssetUrl(listing.cover_image);
    const photos = Array.isArray(listing.photos) ? listing.photos : [];
    if (!photos.includes(cover) || photos[0] === cover) continue;
    await pool.query(
      "UPDATE providers SET profile = jsonb_set(profile, '{photos}', $1::jsonb), media = jsonb_set(media, '{src}', $2::jsonb), updated_at = NOW() WHERE slug = $3",
      [JSON.stringify([cover, ...photos.filter((photo) => photo !== cover)]), JSON.stringify(cover), listing.slug],
    );
    backgrounds += 1;
    console.log(`Profile background restored for ${listing.slug}.`);
  }
  if (!backgrounds) console.log("Every approved listing already leads with its chosen background.");

  console.log(`Database maintenance complete: ${sessions.rowCount ?? 0} sessions, ${attempts.rowCount ?? 0} rate-limit rows, ${tokens.rowCount ?? 0} auth tokens, ${integrationOutbox.rowCount ?? 0} completed integration jobs, and ${emailOutbox.rowCount ?? 0} email records removed.`);
} finally {
  await pool.end();
}
