# TrustHome Test Run Findings

**Run date:** 2026-09-30  
**Target:** Firebase project `trusthome-ph` and local Vite app at `http://127.0.0.1:5173`  
**Test data:** Synthetic `demo-*` users, listings, bookings, reviews, disputes, and bank properties only.  
**Source plan:** `TrustHome_PH_Use_Cases_and_Test_Cases.xlsx` (42 use cases, 166 test cases, including 2 retired).

## Summary

The application is not ready to call fully verified. Live browser flows passed for sign-in, listing review, booking, completion, rating, navigation, settings, map search, and the bank catalog. Direct Firestore checks exposed important security and workflow gaps. The workbook's recorded statuses were not changed; this document records only checks actually performed in this run.

## Findings

### F-01 - Firebase Admin credential is tracked in Git

**Severity: Critical**  
`bank_scraper/serviceAccountKey.json` had been tracked and contains a Firebase service-account private key. `.gitignore` already covered it, but that does not protect a file already in Git. The local key has the same project and service-account identity as the committed key but a different key ID, suggesting a replacement key was generated; revocation of the committed key is unconfirmed. The local file was preserved and removed from Git tracking, so it remains available to the scraper and is now ignored. This report does not contain credential material.

**Status:** Repository tracking is resolved. Credential revocation and remote-history exposure are not verified.

**Action:** Confirm the old key is revoked in Google Cloud IAM and assess repository history and remote exposure. Do not put the replacement key in Git. Keep the current local key outside Git until the scraper is separated.

### F-02 - Home page featured listings fail due to a missing Firestore index

**Severity: High**  
The home page initially showed “Featured listings could not be loaded.” Its query filters `verificationStatus` and orders by `createdAt`, requiring a composite index.

**Status: Resolved.** The index is declared in `firestore.indexes.json` and was created in the `trusthome-ph` Console as `CICAgNiav4AK` (`verificationStatus ASC`, `createdAt DESC`, collection scope). The Firestore API reports `READY`; the exact query returns six documents, and reloading Home renders six featured cards without an alert.

**Action:** None for this finding.

### F-03 - Deployed rules deny an owner's private-address read

**Severity: High**  
The active Firestore rules release was last updated September 25 and did not include the repository's `listingPrivate` match, which explained the owner's `403` response.

**Status: Resolved.** The current repository rules compiled and were published to `trusthome-ph` as ruleset `2bed286e-a9ba-4020-aee2-b7167092052e`. A direct read by the active synthetic owner returned `200`; an unrelated active renter received `403`.

**Action:** None for this finding. Other rule findings remain open and are tracked separately.

### F-04 - Booking completion rules allow unrelated fields to be changed

**Severity: High**  
**Status: Resolved.** Booking transition rules now restrict affected fields, permit a renter to complete their own confirmed booking, permit renter disputes from confirmed/completed, and deny owner-side manual completion. In the deployed rules, a renter completion that also changed `renterId` returned `403`, a status-only renter completion returned `200`, and owner manual completion returned `403`. The synthetic booking was restored to `Confirmed`.

**Action:** None for this finding.

### F-05 - Firestore permits an overlapping booking to be confirmed

**Severity: High**  
**Status: Open (architecture blocker).** A synthetic pending request overlapping an existing confirmed stay was confirmed directly by the owner; Firestore returned `200`. Re-tested against the latest deployed rules on 2026-09-30 with the same result; the probe booking was deleted. The UI checks overlap, but Firestore Rules cannot query an arbitrary set of bookings across a date range, so direct/concurrent writes remain possible.

**Action:** Choose an authoritative confirmation design: a trusted server transaction (which may require approving a billable runtime) or a discrete reservation-slot model with enforcement rules. Do not mark overlap protection complete based only on the current client-side check.

### F-06 - Disputing a completed booking leaves an orphan dispute

**Severity: High**  
**Status: Resolved.** Deployed rules now allow the renter's `Completed -> Disputed` transition with only dispute-related fields. The UI writes the dispute and booking update in one batch. A live completed-booking test produced a `Disputed` booking linked to an `Open` dispute with `priorStatus: Completed`; both temporary records and the notification were removed after verification.

**Action:** None for this finding. Duplicate-open-dispute enforcement remains tracked in F-07.

### F-07 - Direct writes can create multiple open disputes for one booking

**Severity: High**  
**Status: Resolved.** Dispute creation rules now require a same-batch booking transition to `Disputed` with the exact new dispute ID. A standalone direct create returned `403`; the legitimate batched UI submission succeeded and produced one linked open dispute. The disposable booking, dispute, and notification were deleted after verification.

**Action:** None for this finding. The required same-batch linkage also prevents a duplicate from being attached to an already-disputed booking.

### F-08 - Rating rules allow duplicate creation and reviewer edits

**Severity: High**  
**Status: Resolved.** Rating creation now requires the deterministic `{bookingId}_{reviewerId}` document ID, and only admins may update/delete ratings. Deployed-rule probes accepted a valid deterministic rating (`200`), denied an alternate-ID duplicate (`403`), and denied a reviewer edit (`403`). Disposable probe documents were deleted.

**Action:** None for this finding.

### F-09 - Suspended owners' verified listings remain public

**Severity: High**  
**Status: Resolved.** Admin suspension now atomically marks that owner's verified listings non-public while preserving their previous verification status. In the test project, suspension removed both Cabuyao listings from Browse and an unrelated renter's direct read returned `403`; reactivation restored the owner and both listings, after which Browse showed them and the renter's direct read returned `200`.

**Action:** None for this finding. The synthetic owner and listings were restored to active/verified states after testing.

### F-10 - Confirmed bookings do not receive the exact address in the canonical activity flow

**Severity: High**  
**Status: Resolved.** The My Activity booking-request flow now reads the private address and writes it with the booking confirmation. An owner confirmed a synthetic request, the renter saw the exact address on the confirmed booking, and the disposable booking was deleted afterward.

**Action:** None for this finding. F-03's deployed owner-read and unrelated-renter-denial checks also passed.

### F-11 - Bank catalog filters are inaccessible between 800px and 899px

**Severity: Medium**  
**Status: Resolved.** The base `display: none` rule was overriding the mobile Filters trigger, and the `899px` breakpoint left a fractional-width gap before the `900px` desktop breakpoint. The base rule now precedes the breakpoint rules, and the mobile breakpoint ends at `899.98px`. Verified after fresh page loads at 390px, 862px, and 899px (trigger visible, drawer initially hidden) and at 900px and 1280px (sidebar visible, trigger hidden).

**Action:** None for this finding.

### F-12 - Active bank catalog data has obvious quality anomalies

**Severity: Medium**  
**Status: Resolved.** Scraper validation now rejects missing, non-numeric, non-finite, zero, negative, and sentinel prices at or below PHP 1 before upsert. Metrobank category-only and generic `Real Estate` titles now include the available city/province while specific property types remain unchanged. A full live dry run parsed 721 usable records and skipped 13 unpriced/sentinel rows; after refresh, the test project had 721 active source records, 0 active prices at or below PHP 1, and 0 generic category-only titles. The five synthetic `MTB-DEMO` fixtures were restored to active afterward.

**Action:** None for this finding.

### F-13 - Suspending a user has no confirmation step

**Severity: Low**  
**Status: Resolved.** Suspending now asks for confirmation and names the account. Dismissing the dialog left the synthetic owner active; accepting suspended the account. The owner was restored to active after the test.

**Action:** None for this finding.

### F-14 - Loan estimate currency precision is inconsistent

**Severity: Low**  
**Status: Resolved.** Loan estimate values now use fixed two-decimal currency formatting without changing listing-price formatting. The focused unit test passes, the live calculator displays `₱15,416.67` and `₱0.00`, and the workbook's PHP 2,000,000 / 20% down / 6% / 20-year example formats as `₱11,462.90`.

**Action:** None for this finding.

### F-15 - A completed booking still offers “Rate stay” after it was reviewed

**Severity: Low**  
**Status: Resolved.** My Bookings now loads the renter's ratings and shows a Reviewed badge instead of a Rate stay link for bookings that already have a rating. Browser checks confirmed rated completed bookings show Reviewed, while an unrated completed fixture still offers Rate stay; the temporary fixture was removed.

**Action:** None for this finding.

### F-16 - Public verified-listing reads expose verification document URLs

**Severity: High**  
An unauthenticated Firestore read of a verified synthetic listing returned its `verificationDocUrl`. Listing creation stores ownership/ID document URLs on the `listings` document, and the public verified-listing rule returns the complete document. Raw Cloudinary URLs may therefore be accessible to anyone who can read that record.

**Status: Open.** The new Privacy Policy and Data & Compliance pages warn users not to upload real identity or ownership documents to this test build.

**Action:** Move verification URLs out of public listing records into a restricted document store, migrate existing records, and verify both Firestore reads and direct file delivery are denied to unrelated users before accepting real documents.

## Checks Passed

- Created the documented synthetic seed set in the test project: 5 user profiles, 10 listings, 6 bookings, 4 ratings, 2 disputes, 5 bank properties, and 8 trust scores.
- Created synthetic Firebase Auth actors for owner, renter, and admin UI tests. No real user records or IDs were used.
- Active admin sign-in and direct `/admin` navigation rendered the admin dashboard. A regular renter was redirected away from `/admin` without admin content.
- Admin approved one synthetic listing and requested changes on another; both left the pending review queue. Synthetic document previews rendered.
- Admin dismissed an open synthetic dispute; the dispute became `Dismissed` and its booking returned to its recorded `Completed` prior status.
- Renter booking request appeared as `Pending`; owner confirmed it through My Activity; renter saved a deposit reference, marked it `Completed`, and submitted a rating.
- The app blocked a second rating submission, although Firestore rules did not.
- Exact-address shortcut rendered after entering a private address. Searching the fictional test address returned a helpful no-match message; searching `Makati City, Philippines` produced an approximate map pin.
- Browse city filtering returned the expected Makati listings. Bank catalog loaded; desktop bank/city/price filters returned four Antipolo matches, showed an empty state for a no-match city, and Clear filters restored results.
- The deployed homepage composite index reached `READY`; the exact verified-listings query succeeded and Home rendered six featured cards.
- Metrobank dry run parsed 721 usable records and skipped 13 unpriced/sentinel rows; after refreshing the test catalog, 721 active source records remained with 0 sentinel prices and 0 generic category-only titles. Five synthetic bank fixtures were restored afterward.
- My Activity tab URL state survived reload; the account menu had one My Activity entry and no Saved Searches entry; `/saved-searches` redirected to Browse.
- Theme and accessibility settings persisted through reload. The zero-interest and zero-term calculator cases did not produce `NaN` or `Infinity`; loan estimate currency now consistently displays two decimal places and matches the workbook's known payment example.
- Direct Firestore checks denied unrelated private-address reads, role escalation, client writes to trust scores/bank properties, and renter access to the admin notification feed. A renter could query their own notification feed.
- An unauthenticated read of a verified listing returned a verification-document URL; the legal notices explicitly disclose this test-build limitation and advise against real-document uploads.
- The current repository rules are deployed; the listing owner can read their private address while an unrelated active renter is denied.
- Deployed booking rules denied `renterId` tampering and owner manual completion while allowing a status-only renter completion; the synthetic booking was restored afterward.
- A renter disputed a completed synthetic booking; the atomic batch created a linked open dispute and changed the booking to Disputed. Temporary records and notification were removed afterward.
- A standalone dispute create was denied without a matching same-batch booking transition; the valid atomic submission passed and its test fixture was removed.
- Rating rules accepted a valid deterministic document ID, rejected an alternate-ID duplicate, and rejected reviewer edits; all temporary rating test data was deleted.
- Through My Activity, an owner confirmed a synthetic request and the renter saw the exact address only after confirmation; the test booking was removed afterward.
- Admin suspension requires confirmation; cancel preserved the active status, confirm suspended the synthetic account, and the account was restored afterward.
- Suspending a synthetic owner hid all four verified listings from public queries and denied direct reads; reactivation restored the saved statuses and public access.
- My Bookings now distinguishes already-reviewed completed bookings from unrated completed bookings; the disposable test booking used for this check was deleted.
- Latest automated gates passed: 39 Node tests, 17 Python tests, ESLint, and production build. The production dependency audit reported 0 vulnerabilities.

## Not Run / Still Blocked

- Firestore rules compilation/deployment was not run: Firebase CLI is unavailable. Live direct-write tests above exercised the rules currently deployed to the test project, not every rule/path.
- Cloudinary photo/PDF upload and document-delivery security were not exercised; an upload would create an external asset that cannot be safely cleaned up with the available credentials.
- Legacy address migration dry run/apply, GitHub Actions scheduled workflow, full renter-owner-admin notification matrix, and complete cross-browser/accessibility walkthrough remain untested.
- The workbook had 103 cases marked Not Run before this execution. Only the scenarios listed above were exercised here; do not treat unmentioned workbook cases as passed.
- Test-project synthetic data is intentionally retained for follow-up. The synthetic owner used for suspension testing is active again; all temporary `qa-*` direct-write probes were deleted or restored.

## Recommended Order

1. Rotate and untrack the service-account key; assess Git history exposure.
2. Fix booking, dispute, and rating rule boundaries, then test them with the Firestore emulator/direct writes before deployment.
3. Reconcile deployed rules with source, add the missing listings index, and verify private-address access/handoff.
4. Hide suspended owners' listings and fix the bank catalog's 800-899px filter breakpoint.
5. Review scraper data quality and loan currency formatting; add confirmation to account suspension.
6. Continue the remaining workbook cases, starting with blocked security cases and the end-to-end renter-owner-admin flow.

## Follow-up (2026-10-01)

- A generated 1x1 PNG was uploaded through the real `uploadToCloudinary` helper and `trusthome_uploads` preset. Cloudinary returned HTTP 200, `asset_folder=trusthome/_smoke-test`, and the expected `trusthome,smoke-test` tags. The synthetic test asset remains in that folder for cleanup; no existing asset was opened or deleted.
- The Cloudinary account uses Dynamic Folders. The `trusthome` and `trusthome/legacy-unclassified` folders were created. The 11 reported root-level assets were not moved; foldering is organizational and does not restrict delivery.
- New create/edit writes now put verification URLs in the owner/admin-restricted `listingPrivate` document. Admin review reads that record and removes legacy public URL fields when it makes a decision. A dry-run-first migration was added at `bank_scraper/migrate_verification_documents.py` and four fake-Firestore migration tests pass.
- The updated Firestore rules compiled in the local emulator, and five emulator tests passed for private-record access, rejection of public URL writes, owner/admin cleanup of legacy fields, and denial of direct owner booking confirmation. These Oct 1 rules have not been deployed to `trusthome-ph`; no live migration was applied.
- F-16 remains open: existing public listing records require migration, and Cloudinary file delivery itself is still public when a URL is known. Do not upload real identity or ownership documents until delivery access is restricted and tested.
- F-05 remains open in the deployed app. Source now uses an authenticated `confirmBooking` callable with a per-listing transaction lock and removes the direct owner update rule. The Functions emulator test rejected an existing overlap and allowed only one of two concurrent overlapping requests to confirm, handing the exact address to the winning renter. The emulator used host Node 24 while `functions/package.json` targets Node 20; repeat under Node 20 before deployment. The callable has not been deployed or tested against the live project; deployment may require Blaze approval.
- The local create-listing route redirected to sign-in, so the photo/PDF preview workflow was not manually exercised in the browser. The production build and automated suite are the current code-level checks.
- The current automated gates pass: 43 Node tests, 21 Python tests, ESLint, production build, and npm audit (0 vulnerabilities).
- The workbook remains unchanged: 166 cases are currently 6 Passed, 27 Passed (Dev), 27 Blocked, 103 Not Run, 1 Failed, and 2 Retired. `TC-MAP-003` remains marked Failed in the workbook; the Sep 30 run separately recorded that the exact-address shortcut rendered. F-01 credential revocation/history exposure remain unverified.