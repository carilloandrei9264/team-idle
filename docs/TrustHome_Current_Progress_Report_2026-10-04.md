# TrustHome PH - Current Progress Report

**Snapshot date:** 2026-10-04
**Source scope:** Current working copy for PR #42 (`fixes`), based on `features/v1-3-navigation-settings`; it does not include `dev`.
**Purpose:** Source-backed reference for updating the build instructions, system build plan, Firebase setup guide, version plan, design guide, and use-case/test-case workbook.

## Executive Summary

TrustHome is a React marketplace prototype for reviewed Philippine rental listings, bookings, trust signals, disputes, and a separate catalog of bank-acquired properties. The application uses Firebase Authentication and Firestore, Cloudinary for listing media and verification documents, and Python/GitHub Actions for bank catalog refresh and scheduled maintenance.

The current working copy includes user and admin workflows for account access, listing submission and review, browsing, booking, ratings, disputes, notifications, trust scoring, bank catalog search, and loan estimates. The user has reported that listing creation and owner booking approval now work in the test project. Those reports are not substitutes for the automated and deployment evidence listed below.

The code is not release-ready. In particular, Cloudinary currently blocks delivery of the uploaded PDF with `show_original_customer_untrusted`; verification files are stored in Firestore's owner/admin-only `listingPrivate` documents, but the Cloudinary delivery URLs themselves are not private. The new admin Download link cannot bypass this account-level block. The direct client-side booking approval works without a deployed Cloud Function, but overlap checking happens before the write transaction and is not safe against simultaneous approvals. The current client path also does not copy the exact private address onto a confirmed booking.

## Account and contact design addendum - 2026-10-13

Account now offers explicit opt-ins to publish the read-only Auth email and an optional E.164 phone number through `publicProfiles`. Listing details and public owner profiles show email/call links only when those public fields exist. This uses the existing public-readable/owner-writable profile document; no Firestore Rules, server workflow, or production deployment changed. A phone number is not retained privately when the owner does not share it. See [Account Profile and Contact Preferences](Account_Profile_and_Contact_Preferences.md) for field boundaries and remaining work.

## Status At A Glance

| Area | Current source state | Evidence or caveat |
|---|---|---|
| Web app | React 19 + Vite SPA; public, signed-in, and admin routes | `src/App.jsx`; production build is a required gate |
| Identity | Firebase email/password and Google sign-in; profile-backed roles and status | `src/context/AuthContext.jsx`, `src/pages/Login.jsx`, route guards |
| Marketplace | Listing create/edit, pending review, verified-only public browsing | User reported create-and-admin-review path working |
| Booking | Renter request and owner approval use Firestore; no callable required by this UI path | User reported approval working; concurrent overlap race remains |
| Trust and disputes | Ratings, fairness/trust calculation, dispute submission and admin resolution | Automated unit tests; full live permission matrix still needed |
| Bank catalog | Metrobank is the only active source; Landbank parser is unverified; BDO is a placeholder | Scraper default is Metrobank; no current live-source benchmark |
| Firestore rules | Owner approval path and access boundaries are in source; latest rules deployment reported successful Oct 4 | Emulator suite passed 9 tests in the latest recorded run |
| Hosting | Firebase Hosting is configured | Last deployment recorded Oct 1; deployment of the current fixes branch is not verified |
| Functions | Callable confirmation and scheduled jobs exist in `functions/` source | No deployed Functions were verified; deployment was previously blocked by Blaze/Cloud Build requirements |
| Cloudinary | Unsigned `trusthome_uploads` preset accepts uploads; PDF delivery for this account is blocked | Cloudinary reported `show_original_customer_untrusted`; support/account review is required |
| Scraper package | V2 has been promoted to the canonical `bank_scraper` directory | Same scraper algorithm as the old copy; additional backup/migration tooling and tests |

## Product Scope And Roles

### Public visitor

- Browse verified TrustHome listings and filter by listing purpose and property details.
- View listing descriptions, photos, approximate map areas, trust information, and public profiles.
- Search the active bank-acquired property catalog and open source-bank details.
- Use a loan estimator for a bank-catalog property.
- Read legal pages and public accountability information.

### Signed-in user

- Manage a display name, view a read-only authentication email, optionally publish contact email/phone on a public profile, and set device-local appearance/accessibility preferences. Public contact opt-in is not private phone storage.
- Create, edit, and track owned listings.
- Request bookings on verified rental listings; view and manage their renter-side bookings.
- As listing owner, inspect booking requests, check dates, approve or decline pending requests.
- Save a deposit transaction reference after confirmation; TrustHome does not collect or custody funds.
- Mark a booking completed as renter, submit a rating, raise an eligible dispute, and read in-app notifications.

### Administrator

- Review pending listings and their submitted ownership/government-ID evidence.
- Approve, request changes, or reject listings; review dispute submissions and record a resolution.
- Manage users and inspect dashboard counts/activity.
- Review admin notifications and queue bank-catalog refresh jobs.
- Open Settings in admin mode.

## Route And Page Inventory

Routes are declared in `src/App.jsx`; user routes require authentication, and `/admin/*` routes use the `RequireAdmin` guard.

| Route | Page/workflow |
|---|---|
| `/` | Home and featured verified listings |
| `/browse` | TrustHome listing search, filtering, and sorting |
| `/listings/:listingId` | Public listing detail, trust signals, approximate location |
| `/listings/new` | Owner listing submission |
| `/listings/:listingId/edit` | Owner listing edit/resubmission |
| `/my-listings` | Owner's listings and statuses |
| `/my-activity` | Owner/user activity tabs: listings, bookings, booking requests |
| `/dashboard` | Owner metrics and recent activity |
| `/listings/:listingId/book` | Renter booking request form |
| `/my-bookings` | Renter booking status, deposit reference, completion, review, dispute actions |
| `/booking-requests`, `/manage-bookings` | Owner booking-request/availability views; one may be embedded in My Activity |
| `/bookings/:bookingId/review` | Rating form for eligible completed booking |
| `/bookings/:bookingId/dispute` | Dispute submission for eligible booking |
| `/notifications` | User-scoped in-app notifications |
| `/settings`, `/account`, `/login` | Device-local preferences, basic account profile with opt-in public contact fields, authentication |
| `/bank-catalog` | Bank-acquired property search |
| `/bank-catalog/:propertyId` | Bank property detail and loan estimate |
| `/profiles/:userId` | Public profile and accountability summary |
| `/legal/:documentId` | Legal/privacy/terms content |
| `/saved-searches` | Redirects to `/browse`; old saved-search records are not deleted |
| `/admin` | Admin dashboard |
| `/admin/listings` | Listing review queue |
| `/admin/disputes` | Dispute review/resolution |
| `/admin/users` | User administration |
| `/admin/notifications` | Admin notification inbox |
| `/admin/bank-catalog` | Queue bank scraper jobs |
| `/admin/settings` | Admin appearance/accessibility settings |

## How The System Works

### 1. Authentication and authorization

Firebase Authentication establishes the signed-in identity. `AuthContext` listens to `users/{uid}` and exposes the user profile and role. Incomplete legacy profiles are normalized to an active regular-user profile without replacing an existing role. `RequireAuth` gates signed-in pages; `RequireAdmin` requires a verified, active admin profile and fails closed when the profile cannot be read. Firestore rules independently enforce access; hiding an admin route is not the security boundary.

### 2. Listing intake and publication

1. The owner fills title, property type, rent/sale purpose, rental term, private address, city, price, room/size details, availability, amenities, showing windows, and optional approximate map pin.
2. Client validation requires the core fields, at least four property photos, one ownership document, one government photo ID, and at least one valid showing window. A description is required and limited to 400 words; 150-400 words is recommended in the UI, not enforced as a minimum.
3. Photos and verification documents are uploaded to Cloudinary. PDFs use the `raw` resource type; other uploads use automatic/image handling. Listing-specific folders and tags organize assets.
4. A Firestore batch writes the public listing with `verificationStatus: pending` and public photos, plus the exact address and verification-document URLs in `listingPrivate/{listingId}`.
5. A best-effort admin notification links to the new review item. Admin reviews the documents/photos and approves, requests changes, or rejects. Approved listings become visible in public browse/search.

The rules keep the exact address and document URL fields out of public listing records and limit `listingPrivate` Firestore reads to the active owner/admin. This does **not** secure Cloudinary delivery: anyone with an unsigned/public asset URL may still request the file when Cloudinary permits delivery.

### 3. Booking and accountability

1. A renter can request dates only for a verified rental listing; sale listings are not bookable.
2. A booking stores listing, renter, owner, date range, status, and display metadata. Its initial status is `Pending`.
3. The owner sees requests and a day-number availability grid. Before approval, the client queries confirmed bookings scoped to the owner and checks for overlapping dates.
4. A Firestore transaction rechecks that the request still exists, belongs to the owner, and remains pending, then changes it to `Confirmed`. Firestore rules allow only the owner to make this narrow pending-to-confirmed update. A confirmation notification is best effort.
5. The renter can store a deposit reference, mark a confirmed stay completed, rate a completed booking, or raise a dispute. Deposit references are text records only; payments are outside the system.
6. Disputes update the booking and create a dispute record in one batch. Admins mark a dispute Founded or Dismissed; founded disputes increment the public accountability count.

**Important booking limitations:** the overlap query runs before the transaction; two owners/actions racing on the same listing can both pass the check. `functions/index.js` contains a callable that uses a per-listing lock, but the current UI uses the client transaction and no deployed callable was verified. The current client approval update changes booking status/timestamps but does not copy `listingPrivate.address` into the booking. The callable source does copy the address; that handoff is not active through the current client route. Do not describe atomic overlap protection or confirmed-address handoff as verified current behavior.

Confirmed bookings can be completed manually by the renter. The Python `complete_expired_bookings.py` job also completes expired confirmed bookings; the GitHub Actions workflow runs it weekly. A daily scheduled Firebase Function exists in source but is not known to be deployed.

### 4. Trust and fairness

The trust score is normalized to 0-1 and displayed on a five-point scale. The intended weights are 40% booking history, 40% average ratings, and 20% price fairness. Recent completed bookings have more weight than older completed bookings. Price fairness compares verified rental listings of the same city/property type and price period, with floor area within 20%, using median price per square metre. Labels are Above market, At market, Below market, or Insufficient data. Three completed bookings between the same renter-owner pair within 30 days flag a manual review pattern.

Trust-score code exists in both `src/lib/trustScore.js` and `bank_scraper/trust_scores.py`. The Python job recomputes stored `trustScores`; the app reads the cached data. Sale listings are excluded from rental fairness/trust comparisons. Validate formula parity when making future changes.

### 5. Bank-acquired property catalog

The bank catalog is separate from owner-submitted TrustHome listings. It reads active `bankProperties` documents, supports bank/city/keyword/price filters, sorting, pagination, result counts, and source links. The current UI config exposes Metrobank only. Detail pages show source property data and a principal/monthly-payment/total-interest estimate; this is an estimate, not a loan offer or approval.

### 6. Notifications

Notifications are in-app Firestore records. Personal feeds are scoped to the user's UID. Admin broadcast records use `recipientId: "__admins__"`; admins are intended to receive listing-submission and dispute alerts, not routine private booking activity. Main user actions generally remain successful if the follow-up notification write fails.

## Data Model And Access Boundary

| Firestore collection | Purpose and key fields | Intended access |
|---|---|---|
| `users/{uid}` | Current private profile, name/email, role, active/suspended status, creation time. No phone field is currently stored privately. | Owner and active admins; rules govern profile repair and admin writes |
| `publicProfiles/{uid}` | Public display/reputation fields plus opt-in `contactEmail` and `contactPhone` fields when the owner chooses to share them | Public read; owner/admin write under existing rules |
| `listings/{listingId}` | Public listing fields, owner ID/name, photos, purpose, coarse map location, verification status. Current creation code can use Auth email as the `ownerName` fallback; remove this before treating owner labels as privacy-safe. | Public reads only verified records; owners read own records; admins review |
| `listingPrivate/{listingId}` | Exact address and ownership/government document URLs, owner ID | Active owner/admin reads; tightly constrained create/update rules |
| `bookings/{bookingId}` | Renter/owner/listing IDs, dates, status, optional deposit reference/address | Renter, owner, admins; transition rules restrict writes |
| `ratings/{ratingId}` | Booking/reviewer/owner, score 1-5, comment | Public read; eligible renter creates after completion; admins moderate |
| `disputes/{disputeId}` | Booking, reporter, owner, reason, status, prior status, resolution | Reporter/admin access and constrained transitions |
| `publicAccountability/{uid}` | Public count of founded disputes | Public read; admin writes |
| `trustScores/{listingId}` | Cached score, booking/rating/fairness metrics, computed time | Public read; trusted scraper/admin write |
| `notifications/{notificationId}` | Recipient/type/title/message/link/entity/read/createdAt | Recipient-scoped; admin types are limited by rules |
| `bankProperties/{bank_reference}` | Curated bank listing, source link, price/area/image, keywords, active/delisted, first/last seen | Public active records; admin can inspect/write |
| `scraperJobs/{jobId}` | Admin-requested banks, job status and result fields | Admin access; trusted Python worker processes jobs |
| `savedSearches/{id}` | Legacy user saved-search records | Owner-scoped rules; current route redirects to Browse |

Firestore rules live in `firestore.rules`; composite query indexes live in `firestore.indexes.json`. Rules are not automatically deployed when edited locally.

## Bank Scraper Review And Retained Version

The added `bank_scraper_2.0` package was promoted into the canonical `bank_scraper` path used by `.github/workflows/scrape.yml`. The duplicate `bank_scraper_2.0` directory and the older duplicate package were removed after validation. `bank_scraper` now contains the richer v2 files, including `backup_firestore.py`, `restore_firestore.py`, and `test_firestore_backup.py`.

### Efficiency comparison

- The two `scraper.py` files had identical SHA-256 content. Their parsing algorithm, HTTP request pattern, two-second inter-request delay, Metrobank page size of 12, and retry behavior are therefore identical.
- No network throughput benchmark was run; live bank sites and rate limits make a timing comparison noisy and unnecessary when the source files are identical.
- The v2 package is more complete and safer operationally, not faster at scraping. It had 28 passing Python tests versus 23 in the older package. The five additional tests cover backup/restore and stronger Cloudinary migration behavior.

### Current scraper behavior

- Metrobank is the default and only enabled production source. It uses Metrobank's paginated JSON endpoint rather than scraping the rendered page; transient errors are retried, with a polite delay between pages.
- Landbank has HTML/table/card/text fallback parsers, but selectors and current live output still require validation before enabling it.
- BDO remains a placeholder endpoint and must not be described as implemented/live.
- Validation requires a reference number and a finite price greater than one. If a source returns no valid records, the run fails closed instead of delisting the catalog from an empty response.
- `database.py` creates deterministic IDs from bank/reference, merges refreshed fields, records first/last seen, and marks no-longer-seen active properties as delisted instead of deleting history. It also creates lowercase location prefixes for Firestore keyword search.
- `worker.py` polls admin-created `scraperJobs` every 15 seconds when explicitly running in a trusted environment. `scheduler.py` runs locally every 24 hours and once at startup. GitHub Actions runs the configured workflow weekly and executes scrape, expired-booking completion, then trust-score recomputation.

### V2 backup and migration tools

- `backup_firestore.py` writes every top-level collection to timestamped JSONL under the user's home directory by default, preserves Firestore timestamps, writes through a temporary file, and refuses to overwrite an existing backup.
- `restore_firestore.py` validates the full backup before any write. It is a dry run by default; `--apply` writes in batches of 400. It does not delete database records absent from the backup.
- `migrate_verification_documents.py` is dry-run by default. With credentials and `--apply`, it can rename eligible Cloudinary assets to authenticated delivery, write asset metadata under `listingPrivate.documents`, and remove old URL fields only when conversion succeeds.
- **Do not apply the document migration to the live project yet.** The current web app still uploads and reads direct URL fields (`ownershipDocumentUrl` and `governmentIdUrl`); it does not currently resolve authenticated `listingPrivate.documents` metadata to short-lived delivery URLs. Deploy and test that compatible secure-delivery path first, then take/verify a backup and review migration dry-run output.
- A local `bank_scraper/serviceAccountKey.json` exists in this working copy and is excluded by the root and scraper `.gitignore` files. It is not part of the project source and must not be committed, copied into reports, or shared. Whether any previously exposed key has been revoked is not verified.

## Build, Run, And Deployment Reference

### Web app

From the repository root:

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

The Firebase client project configuration is in `src/firebase.js`. A teammate clone points to the configured `trusthome-ph` project unless that file is changed; local code does not create an isolated Firebase project. Use test accounts and coordinate shared live data changes.

### Python scraper

```bash
cd bank_scraper
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python scraper.py --dry-run metrobank
python -m unittest discover -s . -p "test_*.py"
```

Real Firestore writes require a trusted Firebase Admin service-account credential via `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_SERVICE_ACCOUNT_JSON`. Do not place service credentials in Git, PDFs, workbooks, screenshots, or logs. GitHub Actions uses the repository secret `FIREBASE_SERVICE_ACCOUNT`.

### Firebase

```bash
firebase emulators:exec --only firestore -- "node --test scripts/firestore-rules-smoke.mjs"
firebase deploy --only firestore:rules --project trusthome-ph
firebase deploy --only hosting --project trusthome-ph
```

The first command needs Firebase CLI and a free emulator port. Rules deployment was reported successful for `trusthome-ph` on 2026-10-04. Hosting's last documented deployment was 2026-10-01; no deployment of the current fixes branch was verified in this snapshot. Firebase Functions deployment was previously blocked by the Blaze/Cloud Build requirement; do not claim callable/scheduler behavior is live without confirming deployment.

## Verification Evidence

| Check | Latest evidence available for this snapshot | Scope/limit |
|---|---|---|
| Web unit tests | 48 Node tests passed in the previous fresh run | Run again after final report/package edits |
| ESLint | `npm run lint` passed in the previous fresh run | Run again after final report/package edits |
| Vite production build | `npm run build` passed in the previous fresh run | Run again after final report/package edits |
| Firestore rules emulator | 9 focused tests passed, including owner approval and owner-scoped booking query | Emulator test project only; not a full penetration/security test |
| Python scraper package | 28 tests passed after v2 promotion into `bank_scraper` | Unit/fake-store tests; no live bank scrape or live migration was run |
| User-observed app behavior | User reported listing create/admin visibility and owner booking approval working | Browser-reported; not independently re-exercised in this report update |
| Cloudinary PDF delivery | Blocked with `show_original_customer_untrusted` for the Cloudinary customer | Account-level Cloudinary issue; app link flags cannot bypass it |

## Current Gaps And Release Risks

### P0 - Secure and restore verification-document delivery

Cloudinary currently blocks the PDF asset because the customer is marked untrusted. The current unsigned upload preset returns direct URLs, and Firestore's private collection does not make those URLs private. The admin Download action adds Cloudinary's attachment-delivery flag but cannot override an account-level block. Contact Cloudinary support for an account review and secure-delivery guidance. Do not make IDs/ownership documents publicly accessible to fix previews. Do not run the authenticated-asset migration until the app can generate and consume short-lived authenticated delivery URLs.

### P0 - Make booking overlap/address guarantees match the product claim

Both current owner approval routes now share `src/lib/bookingConfirmation.js`. The client acquires a short-lived per-listing lease, checks confirmed bookings while holding it, then confirms the request and releases the lease in one transaction. Firestore Rules require this lease transition; `npm run test:firestore-rules` verifies direct confirmation is denied and only one of two concurrent overlapping app confirmations succeeds. This is a no-Blaze client-side mitigation, not an authoritative backend guarantee: Rules cannot independently inspect the full confirmed-booking query, and a modified client could bypass the overlap check while following the lease protocol. The callable in `functions/index.js` is not the active frontend path and deployment remains unverified. The client route also does not hand the exact private address to the renter. Do not claim production-grade booking guarantees until a backend-authoritative approach is available and deployed.

### P1 - Deployment parity and end-to-end evidence

- Rules have been deployed; hosting updates after 2026-10-01 have not been verified. Deploy the current frontend before telling remote testers that the booking calendar or admin download UI is live.
- The updated workbook records `TC-MAP-003` as Failed: the “Use my exact address” control was not observed in the latest live browser run. Source renders it only when the address hint is non-empty (`PropertyMap` receives the owner's address in listing create/edit); verify the form state and viewport, then rerun this case before calling the shortcut live-verified.
- Run authenticated end-to-end tests for listing submission, admin notification/review, booking request/approval/decline, renter completion/rating, dispute resolution, and notifications.
- Confirm live account role/status and admin permissions; local emulator tests do not prove production profile data or deployment parity.
- Review and apply existing address/document migrations only after verified backup, dry run, and a rollback plan.

### P1 - Credential and operational hygiene

- Keep the local Admin SDK key out of Git and move operational credentials to a protected machine/secret store. Rotate/revoke any key found to have been shared or committed; no revocation evidence is available in this snapshot.
- Validate GitHub Actions secret access, workflow results, quota behavior, and the weekly refresh against a controlled test run.
- Backup/restore tools are new source and tested with fakes; no live backup/restore rehearsal is recorded. Never test restore with `--apply` on production data.

### P2 - Catalog coverage and product/legal follow-up

- Verify Landbank parser selectors and live field quality before enabling it. Replace the BDO placeholder only after inspecting a supported source/API. Metrobank is the only active source.
- Keep loan estimates clearly labeled as estimates, not bank offers. TrustHome does not hold deposits or guarantee recovery.
- Review retention/account deletion, privacy notices, accessibility, and legal language with the team; these are project disclosures, not legal advice or a legal title verification process.

## PDF And Workbook Update Checklist

Use this report as the factual baseline. For each PDF/workbook, update:

1. Product name, scope, roles, current route inventory, and the distinction between TrustHome listings and the bank-property catalog.
2. Listing fields/validation, review state transitions, approximate-map privacy, exact-address handling, and verification-document storage/delivery caveats.
3. Booking status flow, who may approve/complete/dispute, the deposit-reference-only model, and the current overlap/address limitations.
4. Trust score formula, fairness comparables, anti-gaming threshold, and current Metrobank-only catalog status.
5. Firestore collections/rules/indexes, Cloudinary upload/delivery model, GitHub Actions/worker jobs, and required Admin SDK secrets.
6. Mark each item separately as **implemented in source**, **unit/emulator tested**, **reported working by a user**, or **deployed/live verified**. Do not use these labels interchangeably.
7. Keep future integrations (BDO, Landbank activation, payments, secure document delivery, and deployed Functions) in the roadmap until they are implemented and verified.

## Primary Source Files

- App routes: `src/App.jsx`
- Authentication and role guards: `src/context/AuthContext.jsx`, `src/routes/RequireAuth.jsx`, `src/routes/RequireAdmin.jsx`
- Listing forms and validation: `src/pages/CreateListing.jsx`, `src/pages/EditListing.jsx`, `src/lib/listingValidation.js`
- Booking and dispute logic: `src/pages/BookingRequest.jsx`, `src/pages/BookingRequests.jsx`, `src/pages/MyBookings.jsx`, `src/pages/RaiseDispute.jsx`, `src/lib/booking.js`, `src/lib/dispute.js`
- Admin workspaces: `src/admin/`
- Trust and notification helpers: `src/lib/trustScore.js`, `src/lib/notifications.js`
- Firestore access and indexes: `firestore.rules`, `firestore.indexes.json`
- Bank catalog scraper and jobs: `bank_scraper/`
- Scheduled GitHub workflow: `.github/workflows/scrape.yml`
