# TrustHome PH - Current Progress Report

**Snapshot date:** 2026-09-19
**Branch:** `features/v0-3-public-accountability`
**Status:** v0.3 complete and validated against the live Firebase project

## Executive Summary

The application has completed the v0.1 foundation, v0.2 trust engine, and v0.3 accountability and integration scope. The next milestone is v1.0 release polish, dashboards, and final QA.

## Version Status

| Version | Current status | Notes |
|---|---|---|
| v0.1 Foundations | Complete | Auth, listings, verification, search, admin, and the Metrobank integration are implemented. |
| v0.2 Trust Engine | Complete | Booking lifecycle, ratings, trust scores, and no-billing completion automation are implemented and tested. |
| v0.3 Accountability & Integration | Complete | Dispute review, public accountability flags, bank catalog safeguards, and loan estimates are implemented and validated. |

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

## Next Milestone: v1.0

1. Finalize admin and user dashboards.
2. Complete cross-browser and mobile QA.
3. Reduce the production bundle warning through route-level code splitting.
4. Freeze the demo dataset and rehearse the defense flow.
