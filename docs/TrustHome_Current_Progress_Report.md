# TrustHome PH - Current Progress Report

**Snapshot date:** 2026-09-25
**Branch:** `features/v1-3-notifications`
**Status:** v1.3 marketplace-quality and notification implementation complete; release QA and Firebase deployment remain

## Executive Summary

The application has completed the v0.1 foundation, v0.2 trust engine, v0.3 accountability and integration scope, and the v1.1-v1.3 requirements-alignment slices. The current focus is release QA, Firebase rules deployment, and validating the complete notification, booking, verification, and trust-score flows against the live synthetic dataset.

## Version Status

| Version | Current status | Notes |
|---|---|---|
| v0.1 Foundations | Complete | Auth, listings, verification, search, admin, and the Metrobank integration are implemented. |
| v0.2 Trust Engine | Complete | Booking lifecycle, ratings, trust scores, and no-billing completion automation are implemented and tested. |
| v0.3 Accountability & Integration | Complete | Dispute review, public accountability flags, bank catalog safeguards, and loan estimates are implemented and validated. |
| v1.0 Release Hardening | Complete with QA remaining | Route splitting, error recovery, admin review fixes, Cloudinary document handling, and booking permission fixes are implemented. |
| v1.1 Requirements Alignment | Complete | Required listing fields, validation, minimum photos, two-document intake, showing windows, edit parity, and admin resubmission are implemented. |
| v1.2 Booking Accountability | Complete | Strict four-state booking workflow, overlap protection, deposit reference logging, completion, dispute consequences, and pending-request decline are implemented. |
| v1.3 Trust & Marketplace Quality | Complete with release QA remaining | Fairness scoring, anti-gaming signals, owner dashboard, trust-score scraper integration, and user/admin notifications are implemented. |

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

## v1.0 Completed And In Progress

- Route-level lazy loading and accessible loading fallback
- Top-level runtime error recovery with reload action
- Admin dashboard loading errors and retry behavior
- Admin listing review success/error feedback
- Admin review rendering for uploaded photos and PDF links
- Booking permission fix for renter requests and owner approval
- Confirmed booking overlap protection retained during owner approval
- Local verification: 13 frontend tests, lint, and production build passing

The booking-permissions fix is currently stored on the local branch
`features/v1-0-booking-permissions` and has been pushed to GitHub. The local
Firebase service-account file and generated Python cache remain uncommitted.

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

The rules compiled and deployed successfully. The protected cases include:

- A signed-out user can read verified listings.
- A signed-out user cannot read pending listings.
- A renter cannot confirm another person's booking.
- An owner cannot approve a booking that overlaps a confirmed booking.
- A rating can only be created for a completed booking.

### 3. Scheduled workflow

In GitHub:

`Actions -> Scrape Bank Listings -> Run workflow`

Confirm that:

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

## Validation Already Passing

- `node --test`: 21 tests passed
- `npm run lint`: passed
- `npm run build`: passed
- `python -m unittest discover -s bank_scraper -p "test_*.py"`: 9 tests passed
- Firestore rules deployment: passed
- Live seed and trust-score recomputation: passed

The production build still reports a non-blocking large JavaScript bundle warning.

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
- Owners need visibility into inquiries, bookings, and listing performance

## Next Milestones: Release QA

1. Deploy the updated Firestore rules, including notification access rules, to the live Firebase project.
2. Run the notification smoke test with a renter, owner, and admin account.
3. Verify notification reads, booking confirmation, listing approval, and dispute resolution in the deployed build.
4. Resolve Cloudinary raw-PDF delivery/security configuration while preserving the no-Blaze project constraint.
5. Finish cross-browser, mobile, and release QA.

Firebase Storage is documented as a future option only if the project later moves to Blaze billing with an approved payment method. BDO and Landbank are also future catalog integrations; Metrobank remains the sole active source because it already supplies a substantial catalog.
