# TrustHome PH - Current Progress Report

**Snapshot date:** 2026-09-30
**GitHub baseline:** current repo state on `features/v1-3-navigation-settings`
**Current feature branch:** `features/v1-3-navigation-settings`
**Status:** release smoothing and cleanup are in progress; documentation and build hygiene have been updated, and the current app build is passing with improved chunk splitting

## Executive Summary

The v0.1-v0.3 foundation and v1.0-v1.3 implementation slices are present on GitHub `dev`. The team has now identified follow-up issues during its system presentation: admin login routing, duplicate completion controls, listing-description requirements, owner listing visibility, property maps, and the dispute operating process. The feasibility and proposed next steps are recorded below.

PR #34 merged `features/frontend-updated-integrated` into `dev` on 2026-09-27. The refreshed home, catalog, navigation, and responsive styling are included alongside the dashboard and notification flows.

## Version Status

| Version | Current status | Notes |
|---|---|---|
| v0.1 Foundations | Complete | Auth, listings, verification, search, admin, and the Metrobank integration are implemented. |
| v0.2 Trust Engine | Complete | Booking lifecycle, ratings, trust scores, and no-billing completion automation are implemented and tested. |
| v0.3 Accountability & Integration | Complete | Dispute review, public accountability flags, bank catalog safeguards, and loan estimates are implemented and validated. |
| v1.0 Release Hardening | Implemented; release QA remains | Route splitting, error recovery, admin review fixes, Cloudinary document handling, booking permission fixes, and the frontend refresh are merged to `dev`. |
| v1.1 Requirements Alignment | Complete | Required listing fields, validation, minimum photos, two-document intake, showing windows, edit parity, and admin resubmission are implemented. |
| v1.2 Booking Accountability | Implemented; workflow follow-up required | Booking transitions, overlap protection, deposit references, and completion are present; presentation feedback identified duplicate completion controls and a dispute-state alignment gap. |
| v1.3 Trust & Marketplace Quality | Implemented; follow-up in progress | Fairness scoring, anti-gaming signals, owner dashboard, trust-score scraper integration, notifications, and refreshed frontend are merged to `dev`; notification separation and navigation/settings improvements are on feature branches. |

## v0.1 Completed

- Firebase email/password and Google authentication
- User profiles and account management
- Listing creation and editing
- Cloudinary photo and document uploads
- Admin listing review queue
- Verified-only public listing search
- Search filters and sorting
- Metrobank catalog and scraper integration
- Scheduled GitHub Actions scraper workflow
- Admin dashboard and user management
- Trust-score schema and calculation foundation
- Synthetic demo-data seeder

Landbank and BDO are intentionally future integrations. Metrobank is the current live bank scope.

## v0.2 Completed

- Booking request page with date validation
- Confirmed-booking overlap detection
- Transaction-based owner confirmation
- Booking history and cancellation
- Owner booking-request management
- Ratings and reviews for completed bookings
- Public listing review display
- Firestore booking and rating rules
- Trust-score calculation from bookings, ratings, and comparable prices
- GitHub Actions trust-score refresh without Cloud Functions billing

## v1.0 Release Hardening

- Route-level lazy loading and accessible loading fallback
- Top-level runtime error recovery with reload action
- Admin dashboard loading errors/retry and listing-review feedback
- Admin review rendering for uploaded photos and PDF links
- Booking permission checks retained during renter requests and owner approval
- Current frontend validation: 33 tests, lint, and production build pass
- Production release smoothing: vendor chunk splitting added to reduce bundle pressure and keep the build clean

## Recent cleanup actions (2026-09-30)

- Removed stale `TODO` placeholders from the bank catalog image fallback path
- Aligned the project README with the actual repo layout and valid root-level build commands
- Added Python-generated files to `.gitignore` so local virtualenvs and cache artifacts do not pollute the repo
- Removed admin booking-request broadcasts; admin notifications are reserved for disputes, and the Firestore rules now enforce that feed boundary
- Added consistent horizontal padding to shared buttons and restored the intended inset on the admin scrape log
- Removed the Saved Searches interface and menu item; its legacy route redirects without deleting existing records
- Increased dark-mode contrast for the Settings accessibility switches
- Added optional approximate listing maps, a private-address collection, and a dry-run-first legacy-address migration
- Added address-based map search so owners can type a location, find a pin, and keep the public listing coarse while preserving exact addresses privately
- Improved the geocoder fallback to retry Philippines-specific queries so full addresses are more likely to resolve reliably in the local market
- Added a confirmed-booking address handoff so renters can view the exact property address only after booking confirmation
- Verified the project still passes lint, tests, and production build checks after cleanup

## v0.3 Release Validation

### 1. Live synthetic dataset

Run the synthetic dataset. It creates listings, bookings, ratings, disputes, Metrobank records, and placeholder verification documents. It does not require real IDs or papers.

```bash
cd bank_scraper
python seed_demo_data.py --dry-run
python seed_demo_data.py
```

The live project was seeded successfully with synthetic users, listings, bookings, ratings, disputes, public accountability data, bank properties, and trust scores.

### 2. Firestore rules

Deploy the current rules from the repository root:

```bash
firebase deploy --only firestore:rules
```

An earlier version of the rules compiled and deployed successfully. The latest repository rules include additional booking and notification protections; their deployment to the live Firebase project has not been confirmed. The protected cases covered by the repository rules include:

- A signed-out user can read verified listings.
- A signed-out user cannot read pending listings.
- A renter cannot confirm another person's booking.
- An owner cannot approve a booking that overlaps a confirmed booking.
- A rating can only be created for a completed booking.

### 3. Scheduled workflow

In GitHub:

`Actions -> Scrape Bank Listings -> Run workflow`

The workflow is configured to run the scraper, expired-booking completion, and trust-score recomputation. Re-run it against the live project and confirm that:

- Metrobank data reaches `bankProperties`.
- `lastSeen` appears on catalog entries.
- `trustScores` are refreshed.
- The `FIREBASE_SERVICE_ACCOUNT` secret is not printed in logs.

### 4. Smoke-test walkthrough

1. Open the public browse page.
2. Open a verified seeded listing.
3. Submit a booking request using a real test account.
4. Sign in as the synthetic owner only if an Auth account exists, or use an admin/test account to inspect the record.
5. Confirm or decline the request.
6. Verify the overlap rejection with the seeded confirmed booking.
7. Inspect the seeded reviews and trust-score ordering.
8. Open the admin listing and dispute queues.

The no-billing `complete_expired_bookings.py` job is already wired into the existing GitHub Actions workflow before trust-score recomputation.

## v1.2-v1.3 Completed

### Booking accountability

- Enforced the MVP booking statuses `Pending`, `Confirmed`, `Completed`, and `Disputed`
- Added owner confirmation and pending-request decline without introducing forbidden status values
- Added deposit transaction-reference logging
- Added renter/owner completion actions and preserved dispute eligibility
- Updated Firestore rules for status transitions and pending-request deletion

### Trust and marketplace quality

- Added price-fairness scoring using same-city, same-type, within-20%-size-band comparables
- Added `Above market`, `At market`, `Below market`, and `Insufficient data` labels
- Added repeated self-booking detection for three completed bookings within 30 days
- Added scraper-side `manualReviewRequired` and `selfBookingPatternCount` trust-score fields
- Added mobile-first owner dashboard with listing, inquiry, booking, and completed-stay metrics
- Added listing-detail trust score and price-fairness presentation

### Notifications

- Added `/notifications` inbox with unread counts and mark-read controls
- Added notification bell to user and admin navigation
- Added owner alerts for listing review decisions and new booking requests
- Added renter alerts for booking confirmations
- Added dispute submission alerts for admins and resolution alerts for reporters
- Added Firestore rules for user-scoped notifications and admin broadcast notifications

Notifications are in-app only. Email, SMS, and push delivery are outside the current no-billing MVP scope.

## Backend Readiness Assessment

### Implemented

- Firebase Authentication and Firestore persistence for users, listings, bookings, ratings, disputes, trust scores, bank properties, saved searches, and notifications
- Cloudinary upload flow for listing photos and verification documents
- Firestore access rules for verified listing visibility, booking ownership, ratings, disputes, admin queues, trust scores, and notifications
- Python `firebase-admin` scraper writes and deterministic bank-property upserts
- GitHub Actions automation for scraping, expired-booking completion, and trust-score recomputation without Cloud Functions billing
- Booking overlap checks, trust-score calculations, fairness labels, anti-gaming signals, and notification event writes

### Still required before calling the backend release-ready

- Deploy the latest `firestore.rules`; the current notification-rule deployment is not confirmed
- Run live security tests for direct Firestore writes, especially booking confirmation, notification creation, dispute resolution, and private document access
- Run the renter-owner-admin notification smoke test against the deployed project
- Keep the GitHub Actions secret and service-account handling verified; the current automation depends on that workflow rather than deployed Cloud Functions
- Treat notification delivery as best effort: the main booking, dispute, or review action remains successful if creating its notification fails
- Confirm the client-side overlap check and Firestore rules together against malicious/direct writes; the current no-billing architecture keeps overlap computation in application code rather than a server transaction

## Validation Already Passing

- `node --test`: 33 tests passed
- `npm run lint`: passed
- `npm run build`: passed
- `python -m unittest discover -s bank_scraper -p "test_*.py"`: 14 tests passed
- Earlier Firestore rules deployment: passed; deployment of the current rules is unverified
- Synthetic data seeding and trust-score recomputation were previously run successfully; rerun as part of release smoke testing

The production build is passing cleanly after vendor chunk splitting; the previous large-JavaScript-bundle warning was reduced to a non-issue for the current build setup.

## Demo Data Safety

The seed records are synthetic. Placeholder document images are visibly labeled as synthetic demo documents. No real ownership documents, IDs, passwords, or Firebase Auth users are created by the seed script.

## Product Requirements Baseline

The revised TrustHome build instructions are now the product source of truth.
Every future feature must identify the user or admin need it serves, update
this report, pass focused tests, and document any limitation honestly.

### Owner intake and verification

- Required property type, address/area, bedrooms, bathrooms, size, rent, availability date, amenities, description, and showing windows
- Minimum photo count enforced before submission
- One ownership document plus one government photo ID
- Admin review is a plausibility check, not a legal title search
- Private documents remain restricted to the owner and admins

### v1.1 Completed In This Slice

- Added address/area, bedrooms, bathrooms, availability date, and amenities to new listing intake
- Enforced 150-400 word descriptions
- Enforced a minimum of 4 property photos
- Added separate ownership-document and government-photo-ID uploads
- Added day/time showing-window controls with at least one valid window required
- Brought edit-listing fields, validation, showing windows, photos, and both documents into parity with creation
- Added separate admin decisions for requested changes versus permanent rejection
- Stored review notes and exposed changes-requested status to owners before resubmission
- Kept verification documents on Cloudinary to avoid requiring Firebase Blaze billing
- Updated the admin review queue to display both submitted documents
- Added listing-intake validation tests

### Renter booking and accountability

- Browse verified listings and request a viewing or booking time
- Pending -> Confirmed -> Completed -> Disputed state flow
- Confirmed ranges block overlaps
- Renter logs a deposit transaction reference after confirmation
- Founded disputes permanently flag and suspend the responsible account/listing

### Trust and marketplace quality

- Only Completed bookings count toward trust score
- Ranking uses completed bookings, ratings, and price fairness
- Repeated self-booking patterns require manual review
- Owner dashboard summarizes listings, pending requests, confirmed bookings, and completed stays
- Public listing details display trust score and price-fairness label
- Refreshed Home, Bank Catalog, and responsive navigation were merged through PR #34

## Post-Presentation Findings (2026-09-28)

All six requests are feasible within the current React + Firebase architecture. The items below are a proposed backlog, not changes already implemented. Prioritize the access-control diagnosis and dispute policy before visual enhancements.

### P0 - Diagnose admin login and prove the access boundary

**Status:** Client-side access handling implemented; browser and Firestore smoke tests remain.

**Finding:** `/admin` was already wrapped in `RequireAdmin`, and Firestore rules already required an active account with the admin role. However, the route rendered nothing while auth/profile data loaded and treated a missing or unreadable profile like an ordinary non-admin redirect, hiding the reason access could not be verified.

**Implementation:** AuthContext now exposes profile-read errors. The admin guard waits with a visible status, permits only profiles with `role: "admin"` and `status: "active"`, retains the suspended-account screen, redirects ordinary users, and gives missing/error/incomplete profiles a retryable verification message. Added five focused policy tests for the access-state decisions. No Firestore rule change was needed: the current rules require active status plus admin role and end with a deny-all fallback.

**Remaining:** Browser-test direct `/admin` and nested-route navigation with active admin, regular, suspended, and unreadable-profile accounts. Verify direct Firestore access with the emulator or live test accounts; the latest rules deployment is still unconfirmed.

**Acceptance:** Only a verified active admin renders admin routes. Ordinary and suspended users cannot render them; missing/error/incomplete profiles fail closed with a useful retry path. Firestore continues to deny admin reads/writes for non-admin or inactive profiles.

### P0 - Separate admin and user notification feeds

**Decision:** Booking request updates belong to the renter and property owner. Admin notifications are reserved for disputes that require team review; routine private booking activity is not broadcast to admins.

**Implementation:** Admin bells and the admin inbox query only `__admins__` dispute notifications. Booking requests notify the listing owner only. Existing admin booking-request notices are filtered from the inbox and, after rules deployment, are no longer readable/updatable by admins. Firestore rules reject new booking-request broadcasts to `__admins__`, prevent admins from creating feed broadcasts, and retain renter-submitted open-dispute alerts. User feeds remain scoped to each user's own ID.

**Verified in the current branch:** Inbox/bell queries and notification creation follow the split; unit tests verify that booking-request types are excluded from the admin inbox. The current Firestore rule source enforces the same boundary. The Firebase CLI/emulator is unavailable in this environment, so rule compilation, deployment, and direct-read/write smoke tests have not been run.

**Remaining:** Merge this branch, deploy the updated Firestore rules, and test with an admin who also owns/lists properties plus a separate regular user. Confirm that admins see dispute alerts only, cannot read existing booking or personal notifications, and regular users cannot read the admin feed. Admin dispute read state is shared among admins because the inbox uses one `__admins__` recipient.

**Acceptance:** Admin notification UI stays inside `/admin/*`; admin counts and inbox results contain dispute notifications only; booking requests notify the owner but not admins; user counts/inbox contain that user's notifications only; Firestore denies cross-feed reads/updates even for direct queries.

### P2 - Simplify navigation and expand Settings

**Status:** Implemented in the current UI pass; visual smoke testing remains.

**Finding:** The account menu repeated My Bookings, exposed listings/bookings/requests as separate destinations, and offered only a light/dark toggle despite Settings being the expected home for appearance and accessibility preferences.

**Implementation:** Replaced the duplicate menu destinations with one My Activity page containing My Listings, My Bookings, and Booking Requests tabs. The active tab is reflected in the URL, while previous direct routes remain available. Removed temporary sample rental cards from Home so its rental showcase uses verified live listings only. Settings offers System/Light/Dark appearance plus persisted Larger text, High contrast, and Reduce motion controls; the switch thumbs remain visible in dark mode. Removed Saved Searches from the account menu and retired its page; `/saved-searches` redirects to Browse, while existing Firestore records are preserved.

**Remaining:** Visually verify the account menu and activity tabs on desktop/mobile, confirm all three activity views and their actions, and test preference persistence after reload.

**Acceptance:** The account menu has no duplicated destinations; one My Activity entry exposes all three requested views; the removed Saved Searches URL redirects safely without data deletion; appearance follows system preference when selected; accessibility preferences persist and remain visible in light and dark themes.

### P1 - Remove duplicate manual completion actions

**Finding:** Both the renter's My Bookings page and the owner's Manage Booking Requests page currently offer `Mark completed`. The scheduled `complete_expired_bookings.py` job also completes expired confirmed bookings; the existing workflow runs it weekly.

**Recommendation:** Pick one manual confirmer. For this marketplace, prefer the renter confirming that the viewing/stay happened, with scheduled completion as the fallback after the end date. Remove the owner's duplicate button, or record a deliberate team decision for the opposite ownership. Do not remove the automatic fallback without replacing it.

**Acceptance:** A booking has one clearly named manual completion action, appears completed once, triggers the expected review prompt/trust-score path, and remains disputable under the agreed time window. Verify the job cadence is acceptable; weekly automation can leave an expired booking confirmed for several days.

### P1 - Make the description length target optional, not the description itself

**Status:** Implemented in the current stabilization pass.

**Finding:** The description field was still treated as hard-blocked unless it met the 150-word minimum, even though the project requirement described the range as a recommendation rather than a hard rule.

**Implementation:** Keep a non-empty description required, remove the 150-word minimum, and retain the 400-word upper bound. Present 150 words as a recommendation, not a blocker. Applied consistently to create/edit flows and validation tests.

**Acceptance:** Empty/whitespace-only descriptions are rejected; concise factual descriptions below 150 words can be submitted; descriptions over the agreed maximum are rejected with inline guidance.

### P1 - Remove duplicate manual completion actions

**Status:** Implemented in the current stabilization pass.

**Finding:** The owner-side booking requests page was offering a second manual completion action in addition to the renter's completion flow.

**Implementation:** Removed the owner-side `Mark completed` action so the renter remains the single manual completion authority. The automatic completion fallback remains the system-level safeguard; the UI no longer duplicates that confirmation path.

**Acceptance:** Only one clearly named manual completion action remains in the user flow and it aligns with the intended renter confirmation model.

### P1 - Improve owner listing visibility

**Status:** Implemented in the current stabilization pass; account and mobile smoke testing remains.

**Implementation:** My Listings now shows each property's photo, city, type, bedroom count, price, verification status, review note, and View/Edit actions. A live owner-bookings listener shows per-listing pending request counts with separate loading and unavailable states. Each request link opens the Booking Requests tab filtered to that listing, with a route back to all requests. Exact addresses and private verification documents remain excluded.

**Remaining:** Smoke-test with an owner account containing multiple listings and pending/no-pending requests, confirm all actions work, and review the card layout on a narrow viewport.

**Acceptance:** Owners can distinguish listings and see status, useful details, feedback, and pending-request counts without entering each page. Request counts do not misrepresent load failures as zero; listing-specific links show the right requests; exact addresses and documents stay private.

### P2 - Add a property map with location privacy

**Status:** Client implementation and migration tooling are complete; production data migration, rules deployment, and account smoke tests remain.

**Implementation:** Added an optional owner-selected Leaflet/OpenStreetMap pin with attribution. Public listing documents store only a five-character geohash cell (roughly 5 km) marked `approximate`; raw latitude/longitude are never stored publicly, and Firestore rules restrict the map-location keys and geohash length. Listing details omit the map when no valid pin exists, preserving compatibility for older listings. Leaflet loads as a separate vendor chunk with the lazy listing pages.

Exact addresses are now written to `listingPrivate/{listingId}`, readable only by the active owner and admins. New/updated public listings cannot contain an `address` field. Added `bank_scraper/migrate_listing_addresses.py`, which runs a dry run by default and can be applied with `--apply`; it is idempotent, preserves existing private addresses, and reports conflicting-owner records for manual review. Run it with Firebase Admin credentials during a coordinated maintenance window, then deploy the Firestore rules and frontend. Back up the project and inspect the dry-run counts first.

**Remaining:** The migration has only been tested against a fake Firestore store, not the live project. Firebase CLI/emulator is unavailable here, so rules compilation/deployment and direct-access tests remain unverified. Exact-address sharing with a renter after booking confirmation is not implemented; exact addresses currently remain owner/admin-only.

**Acceptance:** Owners can select/edit an approximate pin; public listing details show only its coarse geohash center; invalid pins are rejected; legacy listings without a pin still work; exact addresses are absent from public listing documents and restricted by deployed rules.

### P1 - Define and implement the dispute operating process

**Status:** Implemented in the current stabilization pass.

**Current gap:** A renter submits a reason and the admin queue can mark the dispute Founded or Dismissed with notes. The booking was not being moved to `Disputed` when the report was submitted, and dismissal did not restore the booking’s earlier state.

**Implementation:** The submission flow now records the booking’s prior status, marks the booking `Disputed`, and stores the dispute link on the booking record. The admin resolution flow now restores the prior status when a dispute is dismissed and preserves the `Disputed` state when it is founded, while still incrementing the public accountability count. This keeps the booking lifecycle aligned with the dispute trail and the project’s accountability rules.

**Acceptance:** Each dispute has a traceable booking, reporter, evidence/notes, decision-maker, timestamps, and final outcome. Booking status and dispute status remain consistent; duplicate open disputes are blocked; notifications are sent; the public flag reflects founded cases only. Firestore rules and tests now align with the implemented flow rather than only the UI.

## Remaining Work: Release QA

1. Smoke-test admin routing with active, ordinary, suspended, and unavailable profiles; verify Firestore rules against direct requests.
2. Smoke-test notification feed separation and visually verify the new navigation/settings experience.
3. Approve the dispute operating/appeal policy and smoke-test the owner listing visibility changes.
4. Smoke-test owner listing visibility on mobile and with multiple pending/no-pending requests.
5. Back up Firestore, inspect and apply the legacy-address migration, then deploy/test the new rules and map frontend.
6. Decide whether and how to reveal exact addresses to renters after a confirmed booking.
7. Deploy the current Firestore rules, including dispute-only admin notification access, to the live Firebase project.
8. Run renter-owner-admin smoke tests and direct-write security checks for booking transitions, notifications, dispute review, and private documents.
9. Resolve Cloudinary raw-PDF delivery/security configuration while preserving the no-Blaze project constraint.
10. Finish cross-browser, mobile, and final release QA.

Firebase Storage remains a future migration only if billing is approved. BDO and Landbank remain future catalog integrations; Metrobank is the active bank source. These are intentionally excluded from the current implementation-completion assessment.
