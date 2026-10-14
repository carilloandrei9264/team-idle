# Project Audit — 2026-10-12

## Scope
This audit reviewed the current repository state, key implementation files, project documentation, and validation commands. The goal was to identify material problems, operational risks, and duplication or stale patterns that should be tracked before release.

## Executive summary
- The current project is in a generally healthy code state: automated tests, linting, and the production build all pass in this snapshot.
- There are no obvious failing unit tests or blocking compile errors in the current app source.
- The main risks are product/release risks rather than broken code: unverified live document delivery, incomplete scraper coverage, residual limits in client-side booking concurrency, and deployment verification gaps.
- I did not find evidence of a major source-level duplication crisis in the app itself. The main duplication concern is the intentional mirror of validation logic between client and server-side flows, which is acceptable in a Firebase app but should stay synchronized.

## Verification status
These checks were run on the current workspace:

- `npm test` -> 48 tests passed, 0 failed after reverting the Firebase Storage listing-flow dependency
- `npm run test:firestore-rules` -> 10 tests passed, including direct-confirm denial and one-winner behavior for concurrent overlapping confirmations
- `npm run test:storage-rules` -> 1 focused emulator test passed for owner/admin access and unrelated-user denial; the Firebase CLI printed a Java rules-runtime error during shutdown after the successful test result (command exit code 0)
- `python -m unittest discover -s bank_scraper -p "test_*.py"` -> 30 tests passed
- `python bank_scraper/scraper.py bdo` -> blocked as unverified with exit status 1 before Firebase initialization
- `npm run lint` -> passed with no errors
- `npm run build` -> production bundle built successfully

## Findings

### 1) Shared Firebase project was the default for local development
Severity: Medium
Status: mitigated in local development; production/shared project is still configured for deployed builds.
Evidence:
- `src/firebase.js` uses the fake client configuration and `demo-trusthome-local` project ID in default Vite emulator mode; `trusthome-ph` is selected for production builds and explicit shared-project opt-in.
- The app now connects local Vite development to Auth, Firestore, and Storage emulators by default.
- `README.md` documents `npm run emulators` and the explicit `VITE_USE_SHARED_FIREBASE=true` opt-in.

Impact before the change:
- Local development could mutate shared data and mix test records into the team's project.

Fix implemented:
- `src/firebase.js` connects the Auth, Firestore, Functions, and Storage SDK instances to localhost during Vite development unless a developer explicitly opts into the shared Firebase project. Emulator mode uses `demo-trusthome-local` and a fake config; `npm run emulators` starts Auth, Firestore, and Storage with that same demo ID. Functions are not needed by the current browser workflows.
- `firebase.json` configures the Storage emulator and local Storage rules in addition to the existing Auth/Firestore/Functions emulators.
- `storage.rules` limits verification-file reads to the owner or an active admin profile and limits uploads to an active account's own path, a 20 MiB maximum, and PDF/image MIME types.
- `package.json` adds the `npm run emulators` convenience script; Firebase CLI must be installed separately.
- `scripts/storage-rules-smoke.mjs` and `npm run test:storage-rules` exercise owner upload/read, admin read, unrelated-user denial, unauthenticated denial, and an invalid file type against local emulators using a demo project ID.
- Local admin testing is performed by promoting only the emulator's `users/{uid}` document in the Emulator UI; the app itself does not expose a self-promotion control.

Effect and limitation:
- Routine local app writes now target localhost and cannot reach the shared Firebase project through these SDK instances.
- The emulator uses non-default Firestore/Storage ports because `8080` and `8081` were already occupied in this workspace; the app and emulator test clients use the configured ports.
- This does not change production Firebase configuration, deploy rules, or validate the live project's billing/Storage availability. Do not deploy or claim live document delivery is fixed until the team confirms Storage service availability and deploys/reviews the Storage rules under its no-Blaze constraint.

### 2) Booking confirmation race is mitigated in the app, but not backend-authoritative
Severity: High
Status: concurrent approvals through both current owner screens are serialized in code; full server-side enforcement remains unverified and is not deployed.
Evidence:
- Both `src/pages/BookingRequests.jsx` and `src/pages/ManageBookingRequests.jsx` now call `src/lib/bookingConfirmation.js`.
- The shared flow acquires a 60-second per-listing lease, queries confirmed bookings while holding it, then confirms the booking and releases the lease in one transaction.
- `firestore.rules` requires the owner to release a valid lease in the same atomic update that confirms a booking, denying direct status changes without the lock protocol.
- `npm run test:firestore-rules` passed 10 tests, including a concurrent overlap regression where exactly one request confirms.

Impact and remaining limitation:
- Normal simultaneous approvals through the supported app flow no longer both pass the overlap check.
- Firestore Rules cannot independently validate the confirmed-booking query. A deliberately modified client could acquire/release a valid lease while skipping that query, so this is not a backend-authoritative guarantee.
- The stronger callable in `functions/index.js` is not the active frontend path and its deployment requires the billing-enabled environment excluded by the team's no-Blaze constraint.

Fix implemented without Blaze:
- Consolidated both UI approval paths behind one shared transaction workflow, added a short lease that expires after 60 seconds if a tab crashes, enforced lease transitions in Firestore Rules, added the required composite index, and added local emulator regression coverage.
- Do not deploy the revised Firestore Rules or claim production behavior until reviewed against the live project. The code and emulator tests do not require Blaze.

### 3) Unverified bank sources are blocked from production writes
Severity: Medium
Status: production write gate implemented; Landbank and BDO remain unverified.
Evidence:
- `bank_scraper/scraper.py` maintains an explicit production allowlist containing Metrobank only.
- `run_banks()` rejects unsupported or unverified sources before calling `init_db()`, so blocked requests cannot initialize Firebase or write catalog data.
- `worker.py` sends admin-created scraper jobs through `run_banks()`, so the same gate applies to the admin worker path.
- Unverified Landbank/BDO parsers remain available only through an explicitly requested `--dry-run`, which does not initialize Firebase or write data.
- `bank_scraper/test_scraper_validation.py` verifies blocked-only and mixed active/unverified requests.
- A live Landbank dry-run on 2026-10-12 returned no matching records. A direct read-only response was HTTP 200 but contained an Imperva “Pardon Our Interruption” challenge, not listings.
- BDO's public rendered results page exposed property titles, categories, prices, floor/lot areas, and `propertyCode` detail links through web-content inspection. A direct Python request timed out, and the existing scraper still targets a placeholder endpoint; no parser/data-quality test passed.

Impact before the change:
- Explicit CLI or admin-job requests could invoke parser code for sources that were not verified, including BDO's placeholder endpoint.

Fix implemented:
- Split active and unverified scraper registries. Production writes and the worker use only the active registry; unsupported or unverified requests are returned as failures, and CLI production runs exit nonzero when any requested source is blocked or fails.
- Kept dry-run parser diagnostics available with an explicit unverified warning.

Remaining work:
- Keep Landbank and BDO disabled. Landbank needs an approved way to access the real listings instead of the anti-bot challenge. BDO needs a validated request/parser path and repeatable sample-quality checks. Diagnostic attempts can contact external sites but cannot modify Firestore.

### 4) Verification-document delivery is not yet verified for live use
Severity: High
Status: blocked under the current no-Blaze constraint; no Firebase Storage integration is active in the listing flow.
Evidence:
- `README.md` states that Cloudinary blocks the PDF with `show_original_customer_untrusted` and the app cannot bypass the account-level restriction.
- A read-only Firebase Console check on 2026-10-12 showed the project is on the Spark plan. The Storage page states: “Storage requires a billing account (Blaze)” and presents an upgrade prompt instead of an existing bucket or Rules view.
- The Cloudinary dashboard showed the Free plan. The account Settings and upload-settings routes did not render their configuration, so authenticated delivery/preset options could not be verified.
- The active listing flow has been restored to Cloudinary uploads; Firebase Storage is not used by the app's create/edit/admin document path.
- Cloudinary direct delivery links are not short-lived authenticated URLs, and the reported PDF delivery block remains unresolved.

Impact:
- Ownership and ID documents may be exposed or not securely deliverable.
- This is a real security/compliance issue, not just a UI gap.

Recommendation:
- Do not enable Firebase Storage or upgrade billing under the current constraint. No bucket or deployed Storage Rules were available to inspect, and no console changes were made.
- Do not treat Cloudinary's Free-plan status as proof that secure document delivery is enabled. No upload preset, access policy, or account configuration was changed.
- Keep this issue marked as a release blocker. Resolve Cloudinary's account-level PDF restriction and evaluate a secure delivery option available within the approved plan before claiming document handling is production-safe.

### 5) Live deployment is behind the current repository
Severity: High
Evidence:
- Firebase Hosting's current release is dated October 1, 2026 at 11:08 AM, hash `21c406`.
- The Firestore Rules history's latest listed revision is October 4, 2026 at 10:31 AM. The active Rules text does not contain `bookingConfirmationLocks` or `hasReleasedConfirmationLock`, which are present in the repository.
- The live Firestore Indexes page shows 10 enabled manual indexes. It contains the prior bookings index (`listingId`, `status`) but not the repository's additional bookings index (`listingId`, `ownerId`, `status`).
- The repository's `firebase.json` configures Hosting from `dist/`, Firestore Rules from `firestore.rules`, and indexes from `firestore.indexes.json`.
- `docs/TrustHome_Current_Progress_Report_2026-10-04.md` notes that hosting deployment of the current fixes branch was not verified, and Firebase Functions deployment was previously blocked by the Blaze/Cloud Build requirement.
- The README states that optional backend jobs require a billing-enabled environment and that deployment is not verified.

Impact:
- A team member could assume the backend features are live when the deployment state has not been verified.
- This creates release risk and weakens evidence for product claims.

Recommendation:
- Separate “implemented in code” from “deployed and verified in production” in all release notes and QA checklists.
- Require a deployment verification pass before marking a backend feature as complete.

### 6) Generated artifacts are present and should be treated as build output, not source
Severity: Low
Evidence:
- The workspace contains a `dist/` output directory and a large `node_modules/` tree.
- These are normal generated outputs for a Vite/Node project, but they should not be treated as application source or hand-edited code.

Impact:
- They add noise and increase the chance of confusion during review.
- They can hide real source changes if the team does not distinguish build output from source files.

Recommendation:
- Keep generated folders out of source review when possible and avoid editing them directly.
- Use a clean build/review workflow before shipping or archiving the repo.

### 7) Account contact and verification states need a defined privacy boundary
Severity: Medium  
Status: Partially addressed in local frontend on 2026-10-13; no Firestore Rules or server changes made.

Evidence:
- `src/pages/Account.jsx` edits a name, displays the Auth email read-only, and allows explicit opt-in to publish that email and an optional E.164 phone number on `publicProfiles`.
- `src/pages/ListingDetail.jsx` and `src/pages/PublicProfile.jsx` display email/call actions only for contact fields present on the public profile. `publicProfiles` is publicly readable, so opted-in values are public rather than private storage.
- An unshared phone number is not retained privately. Firestore Rules were not changed; contact fields are written only to the existing owner-writable `publicProfiles` document.
- `src/pages/CreateListing.jsx` uses `user.email` as the last `ownerName` fallback. Verified listing documents are publicly readable, so an account email can become a public listing label when no display name is available.
- Listing review is not identity verification. Public profiles should use evidence-backed listing, rating, and accountability signals; identity verification requires a separate documented process and state.
- Rental booking requests are the existing owner-contact path. The app has no sale inquiry or viewing-request flow.

Recommendation:
- Follow `docs/Account_Profile_and_Contact_Preferences.md` before collecting contact numbers or exposing contact information.
- Treat opted-in contact values on `publicProfiles` as public; keep unshared values out of public records. Add private phone storage only with an approved Firestore access rule and tests.
- Remove the email fallback from public `ownerName`, review existing records, and replace unsupported account-verification claims with a truthful state.
- Treat TrustHome Verified/payment UI as a preview only. Do not record a paid or verified status without an approved verification/payment workflow.
- Decide and implement a private inquiry/viewing workflow before promising direct seller contact.

## Duplication and stale-pattern review
- I did not find a meaningful duplicate app feature implementation in the main source tree.
- The project does contain some mirrored logic between frontend validation and backend callable logic; that is normal, but it is a maintenance risk because both sides must remain aligned.
- The previously noted duplicate bank scraper package issue appears to have been resolved; the repo’s current docs explicitly say the duplicate package was removed and the canonical scraper was promoted into `bank_scraper`.

## Verification-document check and code status
Read-only console result: the `trusthome-ph` project is on Spark, and Firebase Storage requires a Blaze billing account. I did not click the upgrade prompt, change billing, or deploy rules.

To avoid making the live app depend on unavailable Firebase Storage, the active create/edit/admin flow uses its existing Cloudinary URL path again. This does not solve the document security or PDF delivery issue; it leaves the issue accurately marked blocked. The local Storage emulator and Rules test are isolated development tools only and do not imply that the live project has a Storage bucket or deployed Rules.

## Deployment parity check
Read-only console evidence on 2026-10-12: Hosting release `21c406` (October 1, 2026, 11:08 AM); latest Rules history entry October 4, 2026, 10:31 AM, with no booking lease rules; 10 enabled manual indexes, missing the new `bookings(listingId ASC, ownerId ASC, status ASC)` index. No console changes or deployments were made. The lease/rules/index changes remain local until an explicitly approved release.

## Overall assessment
The project is in a solid code-health state for a development snapshot: tests pass, lint passes, and the front-end builds. The unresolved issues are mainly product-security and operational-release gaps, not active development breakages. The project is likely ready for continued feature work, but not yet ready to be described as a fully verified production-ready marketplace in all areas without additional deployment and security validation.

## Account/contact addendum - 2026-10-13

See [Account Profile and Contact Preferences](Account_Profile_and_Contact_Preferences.md) for the implemented opt-in public contact fields, privacy boundary, current owner-contact paths, and remaining work. Contact fields use the existing public-profile document; no rules or server code changed, and unshared phone numbers are not stored privately.
