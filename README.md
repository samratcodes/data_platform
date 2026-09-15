# map.filemarket

map.filemarket is a map-first sourcing network for enterprise AI teams and verified real-world data providers. Buyers discover facilities, data companies, and robotics operators; suppliers submit evidence and manage their listings; admins verify providers and manage procurement leads.

## Local setup

Requirements: Node.js 24, npm, and PostgreSQL.

```bash
npm ci
copy .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. On Windows PowerShell, use `npm.cmd` if script execution blocks `npm.ps1`.

Set either `DATABASE_URL` or `database` to the PostgreSQL connection URL. The migration is idempotent and can be run again after pulling schema changes.

```dotenv
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
```

## Accounts and roles

- **Buyer:** searches the verified network, saves providers, requests access, chats with suppliers, and submits concierge procurement briefs.
- **Supplier:** uses a business email, submits facilities for verification, edits approved listings, monitors views and saves, handles buyer requests, and replies to conversations.
- **Admin:** reviews supplier evidence, assigns online or physical verification, records internal notes, and manages concierge leads.

To create the first administrator without shipping a default backdoor, set a unique ID and password in the environment, then run the idempotent seed:

```dotenv
ADMIN_SEED_NAME=map.filemarket Admin
ADMIN_SEED_EMAIL=admin@your-company.com
ADMIN_SEED_PASSWORD=use-a-unique-password-of-at-least-12-characters
```

```bash
npm run db:seed
```

The same command imports the demonstration provider catalogue into PostgreSQL. Runtime catalogue pages read only approved database rows; they never merge hardcoded sample companies. Existing provider edits are preserved when the seed is rerun. To grant admin access to an existing account instead:

For a local first run, the seed can generate a strong one-time password instead of storing a password in a file. It creates `admin@filemarket.local` and prints the password once:

```bash
npm run db:seed -- --create-admin
```

Set environment credentials for shared or production deployments; the generated local credential is intended only for development.

```bash
npm run admin:grant -- person@company.com
```

Authentication uses scrypt password hashes, random server-side sessions, HTTP-only SameSite cookies, origin checks on mutations, and database-backed rate limiting. Supplier signup rejects common free-email domains. New buyer and supplier accounts must verify email before saving providers, requesting access, starting chats, submitting supplier applications, or sending concierge briefs. Forgot-password and reset-password flows use hashed, single-use tokens and generic responses to avoid account enumeration.

Email-verification and password-reset messages are recorded in `email_outbox` and immediately sent with the awaited Resend Node.js SDK call. Password-change alerts remain queued. Set `APP_URL`, `EMAIL_FROM`, and `RESEND_API_KEY`, then run `npm run emails:send` on a short production schedule to retry failed or deferred messages.

## Google Sheets user directory

New registrations and supplier application changes are added transactionally to a PostgreSQL outbox. PostgreSQL remains the source of truth, so a Google outage cannot block signup. Configure the four `GOOGLE_*` values documented in `.env.example`, share the spreadsheet with the service-account email, then run:

```bash
npm run integrations:sync
```

Run this command on a schedule in production. It creates or updates rows by internal user UUID, retries failed work with backoff, and never exports passwords, sessions, tokens, evidence images, or private addresses.

Run `npm run db:maintain` on a daily schedule to remove expired sessions, expired rate-limit rows, and completed integration jobs older than 30 days. Admin audit history is retained.

## Product flows

- The public landing page opens on an auto-rotating 3D globe. Dragging, clicking, or zooming changes it to a navigable 2D map.
- Facility, data-company, and robotics markers use distinct category icons. Closely located providers remain separate without overlapping.
- A single preloaded sample video spotlight appears at a time on the 3D globe. Profile details remain gated until signup.
- Only approved providers with online or physical verification are read from the database into the public catalogue.
- Authenticated buyers get persistent country, provider-type, modality, and verification filters plus full provider side panels.
- Access requests have pending, reviewing, accepted, and declined states. Suppliers manage them from their workspace.
- Built-in conversations support buyer/supplier messages. The inbox refreshes while the app is open.
- Supplier approval and provider publication run in one database transaction.

## Project structure

- `app/` contains route files and API handlers. Each account-creation path has its own route folder so the URL, metadata, and role are unambiguous.
- `components/explorer/` contains the interactive map, navigation rails, authentication form, and role-specific workspace UI.
- `lib/` contains server-side data access, authentication, and catalogue helpers.
- `tests/` contains Playwright coverage for the public, authentication, workspace, and responsive flows.

### Account creation routes

- `/signup/data-buyer` creates a buyer account for discovering and sourcing verified providers.
- `/signup/data-company` is a full-page data-company application: account, company profile, location, and data capabilities are submitted together. After email verification, it appears as pending in the supplier workspace.
- `/signup` redirects to `/signup/data-buyer` for older links and bookmarks.

## Main routes

| Route | Purpose |
| --- | --- |
| `/` and `/map` | Public globe and authenticated map explorer |
| `/signup/data-buyer` | Data-buyer account creation |
| `/signup/data-company` | Data-company account and verification application |
| `/signup` and `/login` | Buyer-signup redirect and sign-in |
| `/verify-email` | Email verification and resend flow |
| `/forgot-password` and `/reset-password` | Secure password recovery |
| `/dashboard` | Buyer sourcing workspace |
| `/onboarding` | Supplier application form |
| `/supplier` | Supplier listings, analytics, requests, and inbox |
| `/settings` | Profile, password rotation, and global session logout |
| `/admin` | Verification queue and concierge lead pipeline |
| `/operators/[slug]` | Auth-gated provider deep link |
| `/blog` | map.filemarket sourcing insights |

The route handlers under `app/api/` cover catalogue access, authentication, buyer workspaces, supplier applications and dashboards, verification, conversations, samples, location boundaries, and concierge requests.

## Map and media

The app uses MapLibre GL with local map assets and world boundaries. Mapbox can be enabled with an optional public token:

```dotenv
NEXT_PUBLIC_MAPBOX_TOKEN=your_public_mapbox_token
```

Restart the dev server after changing public environment variables. Restrict a Mapbox token to the deployment origin. Demonstration video and point-cloud samples are synthetic and clearly marked in the UI.

## Verification

```bash
npm run lint
npx tsc --noEmit --incremental false
npm run build
npx playwright install chromium
npm run test:e2e
```

The Playwright suite checks the public globe-to-map flow, filters, responsive behavior, signup/login/logout, session persistence, workspace isolation, saved providers, access requests, and sample downloads. The test server defaults to `http://localhost:3000`; set `TEST_BASE_URL` to override it.

## Deployment

Deploy to a Node.js 24 runtime with a reachable PostgreSQL database and HTTPS. Run `npm run db:migrate` during release setup, store the database URL as a secret, and grant the first admin account after signup. The application does not implement escrow, contract execution, or data delivery; it handles verified discovery, lead generation, access requests, and direct conversations.
