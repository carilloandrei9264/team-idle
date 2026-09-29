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
- Current frontend validation: 23 tests, lint, and production build pass
- Production release smoothing: vendor chunk splitting added to reduce bundle pressure and keep the build clean

## Recent cleanup actions (2026-09-30)

- Removed stale `TODO` placeholders from the bank catalog image fallback path
- Aligned the project README with the actual repo layout and valid root-level build commands
- Added Python-generated files to `.gitignore` so local virtualenvs and cache artifacts do not pollute the repo
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

- `node --test`: 23 tests passed
- `npm run lint`: passed
- `npm run build`: passed
- `python -m unittest discover -s bank_scraper -p "test_*.py"`: 9 tests passed
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

**Finding:** The application already wraps `/admin` in `RequireAdmin`. It waits for Auth/profile loading, then permits only `profile.role === "admin"`; ordinary users are redirected to `/`. Login routing also depends on this Firestore profile role. Therefore, the observed symptom is more likely a missing/misspelled role, a failed profile read, stale account data, or a wrong admin test account than an absent URL blocker. A client-side route guard is necessary for UX but is not the security boundary; Firestore rules must also deny non-admin reads/writes.

**Next:** Reproduce with one known active admin and one ordinary user. Check `users/{uid}.role`, `users/{uid}.status`, profile-load errors, the post-login destination, and direct navigation to `/admin` and nested routes. Add a clear loading/denied state and regression tests; verify Firestore admin-only rules independently.

**Acceptance:** An active admin consistently lands on the admin dashboard after profile loading. An ordinary or suspended user cannot render any admin route by typing its URL and cannot access admin-only Firestore data. Missing/erroring role profiles fail closed and show a useful message rather than silently looking like a normal user login.

### P0 - Separate admin and user notification feeds

**Finding:** The admin shell used the shared bell, which linked to `/notifications`; that page combined the admin's personal UID feed with the `__admins__` broadcast feed. This made admins open a user-facing page and see notifications intended for their personal user account.

**Implemented on the current feature branch:** Admin bells now open `/admin/notifications` and subscribe only to the shared admin feed. Admins who manually visit `/notifications` are redirected to the admin inbox. Regular users query only their own UID feed. Firestore rules now restrict admins to `__admins__` documents, users to their own documents, and notification updates to the `read` field. User-created admin alerts must reference a real pending booking or open dispute. The admin inbox is available in the admin sidebar.

**Remaining:** Merge this branch, deploy the updated Firestore rules, and test with an admin who also owns/lists properties plus a separate regular user. Confirm that the admin sees booking-request/dispute broadcasts only, cannot read a user's approval or booking notification, and that a regular user cannot read the admin feed. Admin broadcast read state is shared among admins because the inbox uses one `__admins__` recipient.

**Acceptance:** Admin notification UI stays inside `/admin/*`; admin counts and inbox results contain only admin broadcasts; user counts and inbox results contain only that user's notifications; Firestore denies cross-feed reads/updates even if a client issues a direct query.

### P2 - Simplify the navigation and move theme controls into Settings

**Finding:** The desktop header repeated My Listings, Dashboard, and My Bookings actions that are already available in the account menu. Theme controls also appeared in both the desktop header and mobile drawer.

**Implemented on the current feature branch:** Removed those repeated header actions and both inline theme toggles. Added a Settings page with Light/Dark appearance controls backed by the existing browser-persisted theme preference. Settings is reachable from the user profile menu/mobile drawer and from the admin profile menu; admin settings remains under the protected admin layout.

**Remaining:** Merge the feature branch and visually verify desktop and mobile navigation, Settings active states, and theme persistence after page reload. Confirm the notification bell remains visible and the existing menu routes remain reachable.

**Acceptance:** Header contains only primary navigation, notifications, and profile/menu controls; all existing account destinations remain reachable from the menu; Light/Dark preference can be changed in Settings and persists after reload for both user and admin shells.

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

**Finding:** My Listings already displays each listing's title, city, verification status, and review note. The owner dashboard already summarizes listing and booking counts. The gap is that the listing row is sparse, so owners have limited at-a-glance detail; the Manage Requests page also has an empty state when there are no requests.

**Next:** Enrich the existing My Listings cards rather than adding another page: show thumbnail, price, property type, verification/review state, and clear View/Edit actions; show pending request count per listing and link directly to that listing's requests. Keep exact address and verification documents private.

**Acceptance:** Owners can distinguish listings and see status, key details, review feedback, and relevant request counts on mobile without entering each page. Empty states explain that no requests are waiting and provide a useful next action.

### P2 - Add a property map with location privacy

**Feasibility:** Yes. Listings currently store address/city text but no coordinates or map component. A map needs coordinates, a map provider, and a decision about geocoding. Google Maps requires a configured API key and may require billing; Leaflet with OpenStreetMap tiles is a no-key alternative subject to tile-provider usage policies.

**Recommendation:** Prototype Leaflet/OpenStreetMap first to preserve the no-billing goal. Store latitude/longitude and a location precision value; display an approximate neighborhood/city pin publicly and keep the exact address hidden until a confirmed booking, consistent with the existing privacy requirement. Do not send private ID/document data to a map provider.

**Acceptance:** Owners can set or confirm a pin, edit it, and see a preview; renters can see the disclosed approximate location on listing detail; invalid coordinates are rejected; existing listings without coordinates continue to work without a broken map.

### P1 - Define and implement the dispute operating process

**Current gap:** A renter submits a reason and the admin queue can mark the dispute Founded or Dismissed with notes. The booking is not changed to `Disputed` when the report is submitted. A Founded decision increments the public accountability count, but this admin flow does not itself suspend the account or hide its listings. AdminUsers can suspend accounts separately. The code therefore does not yet enforce the full promised consequence workflow end-to-end.

**Proposed process for team approval:** (1) renter opens a dispute from an eligible booking and submits a reason plus evidence; (2) system records the prior booking status and atomically marks the booking Disputed; (3) notify the admin queue and give the other party a response opportunity; (4) admin records Founded or Dismissed with resolution notes; (5) if Founded, suspend the responsible account, unpublish/disable its active listings, retain the audit record, and notify both parties; (6) if Dismissed, restore the prior booking status and notify both parties. Define who may appeal, the appeal window, and who can reinstate an account before coding permanent consequences.

**Acceptance:** Each dispute has a traceable booking, reporter, evidence/notes, decision-maker, timestamps, and final outcome. Booking status and user/listing access match that outcome; duplicate open disputes are blocked; notifications are sent; the public flag reflects founded cases only. Verify all transitions in Firestore rules and tests, not only in the UI.

## Remaining Work: Release QA

1. Diagnose and close the admin login/access issue, including direct-route and Firestore-rule tests.
2. Merge and smoke-test the notification separation and navigation/settings feature branches.
3. Approve the single completion authority and the dispute operating/appeal policy.
4. Implement and test the description, owner-listing, and dispute-flow improvements above.
5. Decide the map provider and location-precision policy before implementation.
6. Deploy the current Firestore rules, including notification access rules, to the live Firebase project.
7. Run renter-owner-admin smoke tests and direct-write security checks for booking transitions, notifications, dispute review, and private documents.
8. Resolve Cloudinary raw-PDF delivery/security configuration while preserving the no-Blaze project constraint.
9. Finish cross-browser, mobile, and final release QA.

Firebase Storage remains a future migration only if billing is approved. BDO and Landbank remain future catalog integrations; Metrobank is the active bank source. These are intentionally excluded from the current implementation-completion assessment.
