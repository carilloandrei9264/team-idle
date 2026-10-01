# Rev 2 Reconstruction Traceability

**Baseline:** Rev 2 reference set dated 2026-10-01  
**Repository branch:** `reconstruction/rev2-alignment`  
**Purpose:** Track the difference between source code, automated evidence, and live deployment. This is an initial source review, not release certification.

## Evidence rules

- **Source present** means a relevant implementation was found in this worktree; it does not prove the deployed system matches it.
- **Automated test** means a nearby repository test exists. Only the test run and its result establish whether it currently passes.
- **Live evidence** requires a deployed-system case with tester, date, and evidence recorded in the Rev 2 workbook.
- Requirements marked **Open** or **Partial** below must not be reported as release-ready based only on source or emulator behavior.

## Functional requirements

| ID | Current source evidence | Initial assessment / next action |
|---|---|---|
| FR-001 | `src/context/AuthContext.jsx`, `src/routes/RequireAuth.jsx`, `src/routes/RequireAdmin.jsx`, `src/lib/adminAccess.test.js` | Implemented in source. Confirm suspended-user protected actions and live admin guard cases. |
| FR-002 | `src/lib/listingValidation.js`, `src/lib/listingValidation.test.js`, `src/pages/CreateListing.jsx`, `src/pages/EditListing.jsx` | Partial alignment. Rev 2 permits non-empty descriptions below 150 words; validation source defines `MIN_DESCRIPTION_WORDS` but the inspected validation path only rejects empty or over-400 descriptions. Verify floor-area/price constraints, today-or-later dates, and whole-peso input against the complete form and tests. |
| FR-003 | `src/pages/CreateListing.jsx`, `src/admin/AdminListings.jsx`, `firestore.rules`, `bank_scraper/migrate_verification_documents.py` | Workflow and dry-run migration exist. Document URLs remain accessible through public Cloudinary delivery; migrate/private delivery work remains under FR-028. |
| FR-004 | `src/pages/Browse.jsx`, `firestore.rules`, `src/lib/trustScore.js` | Verified search exists. Reconcile active-owner visibility and default score sorting with deployed behavior; check purpose/price filters and live cases. |
| FR-005 | `firestore.rules`, `src/lib/booking.js`, `src/lib/dispute.js`, `functions/index.js` | State transitions exist across rules and callable source. Verify only the four specified states, deletion on decline/withdrawal, dispute window, and live behavior. |
| FR-006 | `functions/index.js`, `functions/booking.test.js`, `firestore.rules` | **Open.** Transaction and per-listing lock are in legacy Functions source, but callable deployment is blocked by the Spark/Blaze constraint. Port to the Rev 2 trusted API, deny direct client confirmation, then run concurrency tests live. |
| FR-007 | `firestore.rules`, `src/pages/MyBookings.jsx` | Source supports renter deposit-reference updates. Verify field allowlist and live direct-write denial for other actors/fields. |
| FR-008 | `firestore.rules`, `bank_scraper/complete_expired_bookings.py`, `.github/workflows/scrape.yml` | Completion paths exist. Check that only the renter manually completes, the job completes after end date, and rating prompting is present; do not rely on legacy Functions scheduling. |
| FR-009 | `src/pages/RaiseDispute.jsx`, `src/lib/dispute.js`, `firestore.rules`, `src/admin/AdminDisputes.jsx` | Dispute lifecycle exists in source/tests. Reconcile completed-booking dispute window with the proposed 7 days and verify one-open-dispute and founded/dismissed live outcomes. |
| FR-010 | `bank_scraper/trust_scores.py`, `src/lib/trustScore.js`, `src/lib/trustScore.test.js` | **Partial; algorithm conflicts with Rev 2.** No ratings currently yields 0 rather than neutral 0.5; fewer than 3 comparables do not receive the neutral score; even-sized medians select the upper middle value. Align Python and JavaScript implementations and add regression tests. |
| FR-011 | `bank_scraper/trust_scores.py`, `src/lib/trustScore.js`, `src/lib/trustScore.test.js` | Detection/flagging exists. **Partial:** inspected scoring code still includes flagged completed bookings in the booking score; implement and test the specified booking-component freeze until admin clearance. |
| FR-012 | `src/pages/MyDashboard.jsx`, `src/pages/MyListings.jsx`, `src/pages/MyBookings.jsx`, `src/pages/BookingRequests.jsx` | Dashboard/request surfaces exist. Check failed count-load handling and live owner workflows. |
| FR-013 | `src/lib/notifications.js`, `firestore.rules`, `src/pages/Notifications.jsx`, `src/admin/AdminNotifications.jsx` | **Partial.** Recipient/feed controls and UI exist; run the renter/owner/reporter/admin notification matrix and confirm main actions remain successful when notification writes fail. |
| FR-014 | `bank_scraper/scraper.py`, `bank_scraper/database.py`, `.github/workflows/scrape.yml` | Metrobank scraper/upsert workflow exists. Confirm daily cadence, delisting of missing items, and visible last-verified dates against the current workflow and live catalog. |
| FR-015 | `src/lib/loanCalculator.js`, `src/lib/loanCalculator.test.js`, `src/pages/BankPropertyDetail.jsx` | Calculator and zero-rate tests exist. Verify listing-price prefill and current UI output. |
| FR-016 | `src/admin/AdminDashboard.jsx`, `src/admin/AdminUsers.jsx`, `src/admin/AdminBankCatalog.jsx`, `firestore.rules` | Admin surfaces exist. Verify active-admin boundary, confirmation before suspension, and scraper-job execution/worker limitation. |
| FR-017 | `src/App.jsx` | Retired as specified; `/saved-searches` redirects to Browse. Preserve stored records. |
| FR-018 | `src/pages/PublicProfile.jsx`, `firestore.rules` | Public profile route exists. Verify email is never public and founded-dispute flags are shown accurately. |
| FR-019 | `src/routes/RequireAdmin.jsx`, `src/lib/adminAccess.js`, `src/lib/adminAccess.test.js` | Guard and policy tests exist. Confirm missing/unreadable profiles fail closed with retry, including live direct-route navigation. |
| FR-020 | `src/admin/AdminNotifications.jsx`, `firestore.rules`, `src/lib/notifications.js` | Feed separation exists in source. Verify admin feed is limited to disputes/submissions and user feeds cannot be read or spoofed across accounts. |
| FR-021 | `src/pages/MyActivity.jsx`, `src/pages/Settings.jsx`, `src/context/ThemeProvider.jsx`, `src/App.jsx` | My Activity, settings, and route exist. Verify all required tabs, URL state, persisted theme/accessibility settings, and live behavior. |
| FR-022 | `src/lib/propertyLocation.js`, `src/lib/propertyLocation.test.js`, `firestore.rules`, `bank_scraper/migrate_listing_addresses.py` | Coarse map/private address implementation and dry-run migration exist. Verify exactly 5-character public geohash, private exact address, backup-first migration, and deployed rules. |
| FR-023 | `src/pages/MyListings.jsx` | Page exists. Verify required per-listing fields and that count-load errors render unavailable/retry rather than zero. |
| FR-024 | `functions/index.js`, `src/pages/MyBookings.jsx`, `firestore.rules` | Legacy callable writes address onto the booking after confirmation. Recheck whether this matches the Rev 2 privacy boundary and migrate handoff behavior to the trusted API; test unrelated-user reads. |
| FR-025 | `src/lib/listingValidation.js`, `src/pages/Browse.jsx`, `src/pages/ListingDetail.jsx`, `firestore.rules`, `bank_scraper/trust_scores.py` | Purpose/sale behavior exists, but field vocabulary differs from the reference (`listingPurpose`/`rentalTerm` vs `purpose`/`pricePeriod`; `day` may represent `nightly`). Define a canonical schema and migrate compatibly; reconcile fairness filtering and tests. |
| FR-026 | `src/pages/CreateListing.jsx`, `src/lib/notifications.js`, `firestore.rules` | Same-batch submission alert is reported in source/progress notes. Confirm target link and failure behavior with emulator and authenticated live test. |
| FR-027 | `functions/index.js`, `src/pages/BookingRequests.jsx`, `src/pages/ManageBookingRequests.jsx` | **Open.** Browser still invokes Firebase callable; no `api-server/` or shared frontend API service exists. Implement Vercel Node 22 endpoint with verified token, fresh profile/listing checks, transaction lock, and emulator/live tests. |
| FR-028 | `src/uploadImage.js`, `src/pages/CreateListing.jsx`, `src/pages/EditListing.jsx`, `src/admin/AdminListings.jsx`, `bank_scraper/migrate_verification_documents.py` | **Open.** Documents are uploaded using the existing Cloudinary flow and private Firestore records store URLs, but direct delivery remains public. Add signed authenticated uploads, store asset identifiers (not URLs), issue short-lived authorized links, migrate assets/records, and test old URL denial. |
| FR-029 | `src/pages/Notifications.jsx`, `src/lib/notifications.js`, `firestore.rules` | Navigation/read/clear behavior exists in source. Verify mark-read-on-open, link destinations, Clear/Clear read, and live account isolation. |

## Cross-cutting mismatches and blockers

| Area | Evidence | Required action |
|---|---|---|
| F-01 credentials | `bank_scraper/serviceAccountKey.json` is ignored and absent from the current Git index, but historical commits contain the path. No key contents were opened. | A project owner must revoke exposed keys in IAM, create least-privilege per-consumer accounts, update host secrets, and record proof. Confirm revocation before declaring F-01 closed or publishing new history; history cleanup is secondary to revocation. |
| Architecture | `functions/` contains the callable and scheduled jobs; the Rev 2 API layout is absent. `.github/workflows/scrape.yml` is weekly, not the daily schedule in Rev 2. | Move only critical trusted operations to `api-server/`; keep scheduled jobs in GitHub Actions and update its cadence/secret handling after review. |
| Schema | Product/architecture PDFs and current Firestore/code use differing purpose and price-period field names/values. | Decide canonical field names and value mapping before broad edits; include existing records and compatibility in migration tests. |
| Trust score | `bank_scraper/trust_scores.py` and `src/lib/trustScore.js` both diverge from Rev 2 neutral defaults, comparable minimum, even median, and frozen flagged-booking component. | Fix parity with focused Python and Node regression tests before claiming FR-010/011 complete. |
| Documentation | `README.md` still describes Firebase Functions and old document names; current report notes v2 workbook and the Vercel architecture. | Update README only after the architecture/schema are agreed; preserve the user's current report edits and reference renames. |
| Evidence | Current progress report describes development tests and some deployed checks, but the new QA workbook's live statuses/evidence were not inspected in this source inventory. | Reconcile against the Rev 2 workbook; do not infer live Passed status from unit/emulator tests. |

## Checkpoint status

- Reconstruction branch created: `reconstruction/rev2-alignment`.
- Existing worktree changes (including renamed references and progress-report edits) are retained.
- This inventory is based on source reads and the supplied Rev 2 PDFs; it is not a complete test run or live security assessment.
- **Push held:** F-01 revocation is unverified while the exposed credential path remains in repository history. Resume the first push after the owner confirms rotation/revocation; never include credential contents in chat or commits.