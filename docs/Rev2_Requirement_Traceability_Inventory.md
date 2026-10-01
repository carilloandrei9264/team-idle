# Rev 2 Requirement Traceability Inventory

**Baseline:** Numbered Rev 2 reference PDFs dated 2026-10-01
**Historical references:** PDFs prefixed `old_`
**Branch reviewed:** `reconstruction/rev2-alignment`
**Purpose:** Inventory requirement-to-source, automated-test, and live-verification evidence. This is not a release certification.

## Evidence rules

- **Source** identifies relevant implementation or configuration. Source presence does not prove behavior or deployment.
- **Automated evidence** identifies existing tests. A test is not called passing until it is run; unit, emulator, and local API results remain development evidence.
- **Live verification** is limited to behavior described in the current progress report or test findings. A live pass requires the Rev 2 workbook's tester, date, actual result, and evidence link. Workbook status was not independently inspected for this inventory.
- **Status** describes alignment/evidence still needed, not an assertion that a requirement is complete.

## Functional requirements

| ID | Source evidence | Automated test evidence | Live verification / gap |
|---|---|---|---|
| FR-001 | `src/context/AuthContext.jsx`; `src/routes/RequireAuth.jsx`; `src/routes/RequireAdmin.jsx` | `src/lib/adminAccess.test.js` covers admin guard policy; run result recorded below after validation | Sep 30 report records active-admin access and regular-user redirect. Suspended protected actions and unreadable-profile retry need live evidence. |
| FR-002 | `src/lib/listingValidation.js`; `src/pages/CreateListing.jsx`; `src/pages/EditListing.jsx` | `src/lib/listingValidation.test.js` passes locally, including a short non-empty description | Current source/test allows fewer than 150 words, unlike the older progress-report wording. Verify price, size, date, amenities, and image constraints against the full form and record a complete live intake case. |
| FR-003 | `src/pages/CreateListing.jsx`; `src/admin/AdminListings.jsx`; `firestore.rules`; `bank_scraper/migrate_verification_documents.py` | `bank_scraper/test_migrate_verification_documents.py`; Firestore emulator rule tests are documented in progress report | Pending listing/review flows have reported live checks. Existing public Cloudinary delivery remains open under FR-028; live migration not run. |
| FR-004 | `src/pages/Browse.jsx`; `firestore.rules`; `src/lib/trustScore.js` | `src/lib/trustScore.test.js`; no dedicated browse integration test identified | Browse and city filtering were reported live. Verify active-owner visibility, purpose filters, default trust sort, and complete live filter matrix. |
| FR-005 | `firestore.rules`; `src/lib/booking.js`; `src/lib/dispute.js`; `functions/index.js` | `src/lib/booking.test.js`; `src/lib/dispute.test.js`; `functions/booking.test.js` | Selected booking/dispute transitions were reported live. Confirm exact four-state lifecycle, decline/withdraw deletion, and dispute-window policy; TC-DISP-009 decision is still needed. |
| FR-006 | `functions/index.js` uses a transaction and per-listing lock; client confirmation calls the callable | `functions/booking.test.js` and Functions emulator concurrency test are reported passing in development | **Open (F-05).** Callable is not deployed; no live contention proof. Rev 2 requires the Vercel trusted API. |
| FR-007 | `firestore.rules`; `src/pages/MyBookings.jsx` | `src/lib/booking.test.js` is the nearest unit suite; direct rules coverage must be confirmed | Deposit-reference flow was exercised in the reported live booking walkthrough. Verify direct-write actor/field denials against deployed rules. |
| FR-008 | `firestore.rules`; `bank_scraper/complete_expired_bookings.py`; `.github/workflows/scrape.yml`; `src/pages/MyBookings.jsx` | `bank_scraper/test_complete_expired_bookings.py`; no dedicated UI test identified | Manual completion was reported in a live flow. Automatic job cadence/result and rating prompt need live evidence. |
| FR-009 | `src/pages/RaiseDispute.jsx`; `src/lib/dispute.js`; `firestore.rules`; `src/admin/AdminDisputes.jsx` | `src/lib/dispute.test.js` | Completed-booking dispute and dismissal were reported live. Confirm one-open-dispute and founded outcome live; resolve the proposed 7-day window. |
| FR-010 | `bank_scraper/trust_scores.py`; `src/lib/trustScore.js`; `src/pages/ListingDetail.jsx` | `bank_scraper/test_trust_scores.py`; `src/lib/trustScore.test.js` pass locally | **Partial.** Source uses zero for no ratings/few comparables and chooses the upper middle for even-sized medians; Rev 2 requires neutral 0.5 defaults, at least 3 comparables, and the average of two middle values. Align both implementations and tests. No Rev 2 live score evidence recorded. |
| FR-011 | `bank_scraper/trust_scores.py`; `src/lib/trustScore.js` | `bank_scraper/test_trust_scores.py`; `src/lib/trustScore.test.js` pass locally | Pattern detection/flagging exists, but flagged booking points are not frozen out of the score until admin clearance. Implement and test this behavior; live evidence is also required. |
| FR-012 | `src/pages/MyDashboard.jsx`; `src/pages/MyListings.jsx`; `src/pages/MyBookings.jsx`; `src/pages/BookingRequests.jsx` | No focused dashboard test identified | Owner dashboard surface exists. Verify all counts and that failed count loads show unavailable rather than zero. |
| FR-013 | `src/lib/notifications.js`; `src/pages/Notifications.jsx`; `src/admin/AdminNotifications.jsx`; `firestore.rules` | `src/lib/notifications.test.js` | Selected notification flows were reported, but full owner/renter/reporter/admin isolation matrix and best-effort failure behavior remain unverified. |
| FR-014 | `bank_scraper/scraper.py`; `bank_scraper/database.py`; `.github/workflows/scrape.yml` | `bank_scraper/test_scraper_validation.py` | Metrobank data refresh was reported live. Verify Rev 2 daily schedule, missing-item delisting, and visible Last verified dates; current workflow cadence needs review. |
| FR-015 | `src/lib/loanCalculator.js`; `src/pages/BankPropertyDetail.jsx` | `src/lib/loanCalculator.test.js` | Zero-rate and formatted calculator examples were reported live. Verify bank-property price prefill in the workbook. |
| FR-016 | `src/admin/AdminDashboard.jsx`; `src/admin/AdminUsers.jsx`; `src/admin/AdminBankCatalog.jsx`; `firestore.rules` | No focused admin workflow suite identified | Suspension confirmation was reported live. Verify scraper-job queue/worker behavior and all admin role boundaries. |
| FR-017 | `src/App.jsx` | No focused route test identified | Redirect from `/saved-searches` to Browse was reported live. Stored records should remain untouched. |
| FR-018 | `src/pages/PublicProfile.jsx`; `firestore.rules` | No focused public-profile test identified | Verify no email is exposed and founded-dispute flags are accurate; no current live evidence recorded. |
| FR-019 | `src/routes/RequireAdmin.jsx`; `src/lib/adminAccess.js` | `src/lib/adminAccess.test.js` | Admin and ordinary-user navigation were reported live. Missing/unreadable profile retry and suspended-admin cases need live confirmation. |
| FR-020 | `src/admin/AdminNotifications.jsx`; `src/lib/notifications.js`; `firestore.rules` | `src/lib/notifications.test.js`; Firestore emulator rules checks are reported in progress notes | A renter's denial from the admin feed was reported live. Complete admin-feed type limits and cross-user feed isolation matrix. |
| FR-021 | `src/pages/MyActivity.jsx`; `src/pages/Settings.jsx`; `src/context/ThemeProvider.jsx`; `src/App.jsx` | No dedicated My Activity/settings integration suite identified | Tab URL persistence and settings persistence were reported live. Verify all required tabs and all Rev 2 accessibility settings. |
| FR-022 | `src/lib/propertyLocation.js`; `src/pages/CreateListing.jsx`; `src/pages/EditListing.jsx`; `firestore.rules`; `bank_scraper/migrate_listing_addresses.py` | `src/lib/propertyLocation.test.js`; `bank_scraper/test_migrate_listing_addresses.py` | Address/map flows were reported live and rules deployed Oct 1 per progress report. Verify exact 5-character geohash, unrelated-user denial, and migration after backup. |
| FR-023 | `src/pages/MyListings.jsx` | No focused My Listings test identified | Verify required fields and that pending-request count errors render unavailable/retry rather than zero; do not infer from page presence. |
| FR-024 | `functions/index.js`; `src/pages/MyBookings.jsx`; `firestore.rules` | `functions/booking.test.js`; no dedicated handoff test identified | Address handoff after a live confirmation was reported. Review whether copying exact address into a booking is consistent with Rev 2 privacy/access rules; verify unrelated-user denial. |
| FR-025 | `src/lib/listingValidation.js`; `src/pages/Browse.jsx`; `src/pages/ListingDetail.jsx`; `firestore.rules`; `bank_scraper/trust_scores.py` | `src/lib/listingValidation.test.js`; `bank_scraper/test_trust_scores.py` | Purpose handling was reported in progress notes, but schema vocabulary differs (`listingPurpose`/`rentalTerm` vs Rev 2 `purpose`/`pricePeriod`). Define compatibility/migration and verify sale cannot be booked and fairness period matching. |
| FR-026 | `src/pages/CreateListing.jsx`; `src/lib/notifications.js`; `firestore.rules` | No focused same-batch notification test identified | Same-batch submission alert is reported in source/progress notes; verify link target and alert-write failure behavior with emulator and live account. |
| FR-027 | `functions/index.js`; `src/pages/BookingRequests.jsx`; `src/pages/ManageBookingRequests.jsx` | `functions/booking.test.js`; no Vercel API test suite exists | **Open.** Browser still invokes Firebase Functions; no `api-server/` or `src/services/api.js`. Vercel endpoint and live API tests are not present. |
| FR-028 | `src/uploadImage.js`; `src/pages/CreateListing.jsx`; `src/pages/EditListing.jsx`; `src/admin/AdminListings.jsx`; `bank_scraper/migrate_verification_documents.py` | `src/uploadImage.test.js`; `bank_scraper/test_migrate_verification_documents.py` | **Open (F-16).** Private Firestore location does not make Cloudinary URLs private. Authenticated asset upload, signed short-lived links, migration, and old-URL denial are not verified. |
| FR-029 | `src/pages/Notifications.jsx`; `src/lib/notifications.js`; `firestore.rules` | `src/lib/notifications.test.js` | Notification navigation/read/clear behavior was reported in QA. Verify against Rev 2 workbook evidence and cross-account rules. |

## Cross-cutting non-functional requirements

| ID | Source evidence | Automated test evidence | Live verification / gap |
|---|---|---|---|
| NFR-COST-01 | Firebase Spark, Cloudinary, GitHub Actions configuration; `functions/` is legacy and not deployable on the stated free plan | No automated billing-plan test | Current progress says no Blaze change was made. Confirm Vercel Hobby/Cloudinary plan and no service requiring billing before release. |
| NFR-SEC-01 | `firestore.rules` has a deny-all fallback | `scripts/firestore-rules-smoke.mjs`; progress report records five focused emulator tests | Full emulator matrix and deployed rules/worktree parity remain unverified. |
| NFR-SEC-02 | Root and scraper `.gitignore` exclude `serviceAccountKey.json`; the local file exists but is untracked and ignored. `.github/workflows/scrape.yml` passes the GitHub secret through an environment variable. | `gitleaks`, TruffleHog, and detect-secrets are unavailable. Non-printing marker scans found no non-public credential markers in tracked `HEAD` or the new-to-remote commit delta; the public Firebase client config is not a secret. | **Open (F-01):** Git history contains private-key material in revisions of `bank_scraper/serviceAccountKey.json`; IAM revocation is unconfirmed. The reconstruction branch was pushed without introducing the key file/object. |
| NFR-PRIV-01 | `firestore.rules`; `listingPrivate` migrations; current document flow | `bank_scraper/test_migrate_listing_addresses.py`; `bank_scraper/test_migrate_verification_documents.py`; focused emulator rule tests reported | Address isolation has selected live checks; document URLs remain publicly deliverable (F-16 open). |
| NFR-REL-01 | `src/lib/notifications.js`; notification calls in booking/listing workflows | `src/lib/notifications.test.js` | Verify injected notification failure does not fail each main action; not established by code presence alone. |
| NFR-REL-02 | Migration scripts include dry-run modes; backup procedure is documented in Rev 2 infrastructure PDF | Migration unit tests exist; no backup/restore automated test identified | No Oct 1 live backup/migration evidence recorded for the pending private-document migration. |
| NFR-PERF-01 | `src/App.jsx` route structure; `vite.config.js` build configuration | Production build is an indirect check only | Lighthouse mobile score/LCP and lazy loading need live measurement. |
| NFR-PERF-02 | No Vercel API implementation currently | No API integration/performance suite | Not measurable until trusted API is deployed; p95 target remains unverified. |
| NFR-ACC-01 | Existing UI/accessibility settings and styles | No axe automation identified | Full axe, keyboard, zoom, and viewport checks remain live QA. |
| NFR-QUOTA-01 | Paginated/listener patterns require review across UI | No quota test identified | Firebase Usage after a full rehearsal is required; no current measurement recorded. |
| NFR-MAINT-01 | Root `package.json`; Python test modules; `.github/workflows/` | Node, Python, lint, and build checks are run during this order; CI workflow presence/status to be verified | CI green on each PR is not established by local checks; inspect and record workflow results. |

## Baseline checks for this inventory

| Check | Result | Scope |
|---|---|---|
| Node tests | Passed: 47 tests, 0 failures (`npm test`) | Local development evidence only |
| Python tests | Passed: 23 tests (`python -m unittest discover -s bank_scraper -p "test_*.py"`) | Local development evidence only |
| ESLint | Passed (`npm run lint`) | Local development evidence only |
| Production build | Passed (`npm run build`) | Local development evidence only |
| Live QA workbook reconciliation | Not performed | Must be reconciled by test-case ID, tester, date, actual result, and evidence link |
| Secret scan | Partial: tracked `HEAD` scan found no non-public credential markers; history scan found private-key material in the service-account file path | Dedicated scanners unavailable. The branch push is held for credential revocation confirmation; scan results do not establish revocation. |

## Repository state and push gate

- Branch: `reconstruction/rev2-alignment`.
- The worktree already contains a user deletion of `docs/Rev2_Reconstruction_Traceability.md`; this inventory uses a new path and does not restore or overwrite that file.
- `bank_scraper/serviceAccountKey.json` exists locally but is ignored and absent from the current Git index. Git history contains private-key material at that path; the local file's contents were not opened or printed.
- The reconstruction branch was pushed after confirming the key file/object was not part of the push delta. F-01 remains open until the project owner confirms historical key revocation in IAM. Never include credential contents in chat or commits.
