# TrustHome PH - Current Progress Report

**Snapshot date:** 2026-09-25
**Branch:** `features/v1-1-listing-intake`
**Status:** v1.1 listing-intake implementation in progress

## Executive Summary

The application has completed the v0.1 foundation, v0.2 trust engine, and v0.3 accountability and integration scope. v1.0 is focused on release hardening and real user-flow validation. Starting with v1.1, development will follow the revised product requirements for owner intake, admin verification, booking accountability, and trust ranking.

## Version Status

| Version | Current status | Notes |
|---|---|---|
| v0.1 Foundations | Complete | Auth, listings, verification, search, admin, and the Metrobank integration are implemented. |
| v0.2 Trust Engine | Complete | Booking lifecycle, ratings, trust scores, and no-billing completion automation are implemented and tested. |
| v0.3 Accountability & Integration | Complete | Dispute review, public accountability flags, bank catalog safeguards, and loan estimates are implemented and validated. |
| v1.0 Release Hardening | In progress | Route splitting, error recovery, admin review fixes, Cloudinary document handling, and booking permission fixes are implemented; manual QA remains. |
| v1.1 Requirements Alignment | In progress | Required listing fields, validation, minimum photos, and two-document intake are implemented; showing windows, edit parity, and full admin resubmission remain. |
| v1.2 Booking Accountability | Planned | Showing windows, strict booking state machine, deposit reference logging, completion, and dispute consequences. |
| v1.3 Trust & Marketplace Quality | Planned | Trust ranking, fairness presentation, anti-gaming review signals, and owner dashboard improvements. |

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

## Validation Already Passing

- `node --test`: 13 tests passed
- `npm run lint`: passed
- `npm run build`: passed
- `python -m unittest discover -p "test_*.py"`: 6 tests passed
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

## Next Milestones: v1.1+

### v1.1 - Listing Intake And Verification

1. Add showing availability windows to listing creation and edit flows.
2. Bring edit-listing fields and validation into parity with new listing creation.
3. Upgrade admin review to support explicit resubmission requests and document notes.
4. Add secure document storage/delivery that does not depend on public Cloudinary raw-file delivery.

### v1.2 - Booking Accountability

1. Add showing availability windows.
2. Align booking statuses with the required state machine.
3. Add deposit transaction reference logging.
4. Complete booking and dispute consequences.

### v1.3 - Trust And Marketplace Quality

1. Improve trust-score ranking and fairness explanations.
2. Add anti-gaming review signals.
3. Complete owner dashboard metrics.
4. Finish cross-browser, mobile, and release QA.
