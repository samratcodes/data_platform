# FileMarket

A full-stack global data-sourcing workspace for AI and robotics teams, built with Next.js 16, React 19, Tailwind CSS 4, Framer Motion, and WebGL maps. The mint (#29CDA5) and blue (#5C86E5) design follows the supplied FileMarket logo.

## Run locally

Requires **Node.js 24** (the backend uses `node:sqlite`) and npm.

```bash
npm ci
npm run dev
```

Open http://localhost:3000. On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`.

No credentials are needed for local development. Create an account at `/signup`; accounts, hashed sessions, saved providers, and access requests persist in `.data/filemarket.sqlite`. This directory is ignored by Git. Passwords are salted and scrypt-hashed. Session cookies are HTTP-only, SameSite=Lax, expire after seven days, and use Secure in production. Mutation routes check their origin, and authentication attempts are rate-limited per account.

## Map configuration

Without a token, the app uses MapLibre GL with a globe projection, bundled Natural Earth country polygons, bundled label glyphs, and clustered operator markers. The map does not rely on external tile requests. The install script copies the installed MapLibre module worker and its shared dependency into `public/vendor/maplibre/`; this explicitly handles MapLibre 6 workers under Turbopack.

To use Mapbox GL JS and the Mapbox Dark style, create `.env.local`:

```dotenv
NEXT_PUBLIC_MAPBOX_TOKEN=your_public_mapbox_token
# Optional: persistent database location outside the default .data directory
# FILEMARKET_DB_PATH=/persistent-storage/filemarket.sqlite
```

Restart the dev server after setting the token. Restrict the public Mapbox token to your deployment origin in your Mapbox account. The Mapbox-specific path requires a valid token and was not exercised without one.

## Application flows

- **Public landing:** keeps a light, full-screen world map fixed behind three scrolling content sections. Passive five-second video cards stay pinned to source locations. Search and the three controls—country, data type, and location type—are the only discovery inputs; clicking the map does not open results.
- **Public exploration:** search countries and data types, then narrow the map by country, modality, and facility or data company. Search results move the map to the matching source while the map itself remains visual context.
- **Authenticated explorer:** unified search, avatar menu, sliding profiles, geographic context, capture environments, saved providers, videos, an interactive point-cloud viewer, and JSON/PLY sample downloads.
- **Requests:** submit a use case, then view its persistent Pending status in your workspace. Duplicate requests to the same provider are idempotent.
- **Mobile:** stacked search and filters, scrollable results, and a profile bottom sheet. Drag its handle upward or use Expand profile; drag downward to dismiss. Dialogs support keyboard focus, Escape, and backdrop dismissal.

Routes: `/`, `/map`, `/login`, `/signup`, `/dashboard`, and protected `/operators/[slug]` links that open the explorer profile.

## API

| Route | Access | Behavior |
| --- | --- | --- |
| GET /api/catalogue | Public | Public operator summary fields |
| GET /api/catalogue?slug=... | Authenticated | Full operator profile |
| GET /api/auth/session | Public | Current user or null |
| POST /api/auth/signup | Same-origin | Create an account and session |
| POST /api/auth/login | Same-origin | Verify password and create session |
| POST /api/auth/logout | Same-origin | Revoke session and remove cookie |
| GET /api/workspace | Authenticated | Current user's saved providers and requests |
| POST /api/workspace | Authenticated, same-origin | save, unsave, or request |
| GET /api/samples/[slug] | Authenticated | Download synthetic JSON metadata |
| GET /api/samples/[slug]?format=ply | Authenticated | Download synthetic point cloud |

## Verification

```bash
npm run lint
npx tsc --noEmit --incremental false
npm run build
npx playwright install chromium
# With npm run dev running in a separate terminal:
npm run test:e2e
```

The browser suite covers tour progression and interruption, auth guards, sign-up/login/logout, session persistence, saved providers, requests, sample downloads, reduced motion, and responsive directory behavior. Tests create disposable `@example.test` accounts in the local database. Screenshots and traces are written to ignored `test-results/`. Set `TEST_BASE_URL` to test another local server.

## Project layout

- `components/explorer/`: active application, map, profiles, authentication, dialogs, point-cloud viewer.
- `components/Landing/nodes.ts`: the existing 25-entry illustrative catalogue; edit this to update operators.
- `lib/`: SQLite schema, session/password handling, shared synthetic point data.
- `app/api/`: authenticated and public route handlers.
- `app/explorer.css`: current responsive design system.
- `public/demo/`: original five-second H.264 demonstration clips and posters.
- `scripts/generate_samples.py`: reproducible synthetic video generation (requires Pillow and imageio-ffmpeg).
- `scripts/sync-map-assets.mjs`: MapLibre worker setup, run automatically after npm install.
- `tests/explorer.spec.ts`: browser and API checks.

The earlier Leaflet components and boundary endpoints remain available in the repository but are not used by the new explorer.

## Data and deployment scope

The catalogue, capacities, previews, videos, and downloadable samples are **illustrative**, not live provider inventory. Generated samples are marked synthetic in the interface and exported files. Access requests are persisted locally; no provider email or external approval workflow is connected. Accounts are functional local accounts; email verification, password recovery, SSO, and account administration are not implemented.

Deploy this version to a Node 24 server with persistent writable storage for SQLite and HTTPS. Ephemeral/serverless filesystems will not preserve accounts across instances; use a shared production database and an established identity provider before a multi-instance rollout. Back up the database and serve the production app behind HTTPS. Interface fonts are self-contained system fonts, so builds do not depend on Google Fonts.

Natural Earth boundary data is public domain. MapLibre GL JS uses the BSD 3-Clause license; the worker setup copies its license alongside the redistributed assets. Mapbox is an optional external service governed by its own terms.
