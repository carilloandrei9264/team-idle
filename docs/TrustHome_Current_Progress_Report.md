# TrustHome PH - Current Progress Report

**Snapshot date:** 2026-09-18  
**Branch:** `feature/v0-2-trust-engine`  
**Latest commit:** `9fc7594 Add synthetic demo data seeder`

## Executive Summary

The application has a working v0.1 foundation and most of the v0.2 trust-engine implementation. The remaining work is primarily live-environment verification, demo preparation, and one no-billing scheduling gap.

## Version Status

| Version | Current status | Notes |
|---|---|---|
| v0.1 Foundations | About 95% complete | Feature code is present; live Firebase setup, seed execution, and smoke testing remain. |
| v0.2 Trust Engine | About 80-85% complete | Booking, ratings, reviews, and score calculation are implemented; automatic completion needs a no-billing job. |

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

## The Remaining 5%

### 1. Seed the Firebase project

Run the synthetic dataset. It creates listings, bookings, ratings, disputes, Metrobank records, and placeholder verification documents. It does not require real IDs or papers.

```bash
cd bank_scraper
python seed_demo_data.py --dry-run
python seed_demo_data.py
```

The script requires either `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_SERVICE_ACCOUNT_JSON`.

### 2. Deploy and verify Firestore rules

Deploy the current rules from the repository root:

```bash
firebase deploy --only firestore:rules
```

Verify these cases manually:

- A signed-out user can read verified listings.
- A signed-out user cannot read pending listings.
- A renter cannot confirm another person's booking.
- An owner cannot approve a booking that overlaps a confirmed booking.
- A rating can only be created for a completed booking.

### 3. Run the scheduled workflow once manually

In GitHub:

`Actions -> Scrape Bank Listings -> Run workflow`

Confirm that:

- Metrobank data reaches `bankProperties`.
- `lastSeen` appears on catalog entries.
- `trustScores` are refreshed.
- The `FIREBASE_SERVICE_ACCOUNT` secret is not printed in logs.

### 4. Complete one smoke-test walkthrough

1. Open the public browse page.
2. Open a verified seeded listing.
3. Submit a booking request using a real test account.
4. Sign in as the synthetic owner only if an Auth account exists, or use an admin/test account to inspect the record.
5. Confirm or decline the request.
6. Verify the overlap rejection with the seeded confirmed booking.
7. Inspect the seeded reviews and trust-score ordering.
8. Open the admin listing and dispute queues.

### 5. Replace the paid scheduled-function dependency

The optional Firebase Functions code includes automatic transition from `Confirmed` to `Completed`, but it requires billing. For the no-billing setup, add a small Python `complete_expired_bookings.py` job and run it from the existing GitHub Actions workflow before recomputing trust scores.

That is the only important functional gap left in the v0.2 workflow.

## Validation Already Passing

- `npm test`: 6 tests passed
- `npm run lint`: passed
- `npm run build`: passed
- `node --check functions/index.js`: passed
- `python -m compileall bank_scraper`: passed

The production build still reports a non-blocking large JavaScript bundle warning.

## Demo Data Safety

The seed records are synthetic. Placeholder document images are visibly labeled as synthetic demo documents. No real ownership documents, IDs, passwords, or Firebase Auth users are created by the seed script.

## Recommended Order

1. Run the seed script.
2. Deploy Firestore rules and hosting.
3. Run the GitHub Action manually.
4. Perform the smoke-test walkthrough.
5. Add the no-billing expired-booking job.
6. Freeze the demo dataset and rehearse the defense flow.
