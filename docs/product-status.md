# map.filemarket - Product Status

Last updated: 9 September 2026

## Product status

The complete map.filemarket marketplace MVP is implemented: public discovery, secure buyer and supplier accounts, email verification, password recovery, database-backed listings, buyer sourcing, supplier onboarding, messaging, access requests, concierge leads, administrator verification, Google Sheets export, and transactional email delivery.

## Pages

| Page | One-line description |
| --- | --- |
| `/` | Public 3D globe and 2D map for discovering verified data facilities, companies, and robotics providers. |
| `/map` | Buyer-first sourcing map with search, filters, samples, saved providers, requests, chat, and provider details. |
| `/signup` | Creates a secure buyer or supplier account with role selection and password validation. |
| `/login` | Signs buyers, suppliers, and administrators into their correct workspace. |
| `/verify-email` | Shows email-verification status and securely resends a fresh verification link. |
| `/verify-email/confirm` | Validates the single-use email token and redirects the user to the correct workspace. |
| `/forgot-password` | Requests a password-reset email without revealing whether an account exists. |
| `/reset-password` | Validates the reset token, changes the password, and revokes older sessions. |
| `/dashboard` | Redirects an authenticated user to the correct role-based workspace. |
| `/onboarding` | Lets suppliers submit company, facility, map location, capability, and verification evidence. |
| `/supplier` | Gives suppliers listing analytics, editable profiles, buyer requests, and conversations. |
| `/settings` | Lets users update their name, rotate their password, and sign out every device. |
| `/admin` | Admin console overview: review queue counts, applications awaiting review, recent activity, and Google Sheets sync status. |
| `/admin/companies` | Searchable, filterable table of data company applications. |
| `/admin/facilities` | Searchable, filterable table of facility submissions. |
| `/admin/applications/[id]` | Full review page for one application: applicant, profile, location, logo and images, documents, related records, history, and the approve/reject decision. |
| `/admin/leads` | Table of buyer concierge briefs with inline status updates and a detail view. |
| `/admin/activity` | Audit trail of every admin review decision and lead update. |
| `/operators/[slug]` | Opens a direct authenticated profile for a specific verified provider. |
| `/blog` | Presents concise map.filemarket sourcing and marketplace guidance. |
| `not-found` | Provides a branded recovery page when a route or provider does not exist. |
| `error` | Provides a safe retry screen when a page fails unexpectedly. |

## Completed platform capabilities

- The public experience uses one sample per country, preloads the next sample, and smoothly transitions between 3D and 2D.
- Buyers can filter the database catalogue, inspect profiles, save providers, request access, download demos, chat, and hire the map.filemarket team.
- Suppliers can place facilities on the map, submit evidence, track verification, edit approved profiles, and manage buyer requests.
- Administrators can approve or reject suppliers, assign verification levels, manage concierge leads, and review append-only audit records.
- PostgreSQL is the source of truth for accounts, sessions, providers, applications, requests, messages, leads, security tokens, and background jobs.
- Authentication includes scrypt password hashing, secure cookies, email verification, password reset, rate limits, origin checks, input limits, and role authorization.
- Transactional emails are queued reliably and the configured Resend worker sends them with retry and exponential backoff.
- Buyer and supplier records are queued for sanitized, idempotent Google Sheets synchronization without exporting credentials or private evidence.
- Maintenance scripts clean expired sessions, tokens, rate-limit records, completed jobs, and old email records.
- TypeScript, ESLint, the production build, database checks, and the six-flow browser/API suite pass.

## External setup still required

- Schedule `npm run emails:send` in the production job runner.
- Add the Google spreadsheet and service-account values, share the sheet, and schedule `npm run integrations:sync`.
- Set the production database URL, HTTPS app URL, unique administrator credentials, monitoring, backups, and secret rotation.
- Run the existing release checks in a staging environment before accepting real customer data.

## Product scope

The finished MVP covers verified provider discovery and lead generation; contracts, payments, escrow, licensing, and dataset delivery remain separate future commercial products rather than incomplete pages.
