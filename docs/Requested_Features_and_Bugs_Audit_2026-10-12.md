# Requested Features and Bugs Audit — 2026-10-12

## Purpose and scope
This document checks the ten reported items against the current source, Firestore Rules, and existing tests. This is a source-based audit, not a browser reproduction of every workflow. Items 4 and 10 have local code fixes as of 2026-10-12; no Firebase project, Cloudinary account, or deployment was changed.

Status labels:
- **Confirmed defect**: the code directly supports the reported failure or unsafe behavior.
- **Confirmed gap**: the requested capability is absent from the current product.
- **Needs reproduction**: source shows a relevant path, but does not prove the reported runtime failure.

## Summary and suggested priority
1. **Fixed locally:** suspended-account state normalization; keep the regression test and verify in the local emulator.
2. **Fixed locally:** optional floor/lot area fields in Edit Listing (confirmed form defect).
3. **Implemented locally:** draggable map marker; verify pointer interaction in a browser and retain approximate-address privacy.
4. **Partially implemented locally:** booking check-in/out times and same-renter overlap warning; backend duplicate enforcement remains.
5. **Recommended policy:** renter marks a booking complete only after checkout, with a short owner review window and a dispute path; this is the leanest, least-confusing completion flow.
6. **Implemented locally:** rental term uses a visible two-choice radio-card control; verify keyboard/mobile UX.
7. Expand listing intake with conditional, minimally necessary fields (requirements/product-design work).
8. **Chosen model:** private Firebase Storage paths plus short-lived signed URLs from an authorized callable function; never store public document URLs in listing records.
9. Design an append-only activity log with privacy and retention controls.
10. Define account/contact fields and public/private boundaries before collecting phone numbers or adding an owner-inquiry flow.

## Findings

### 1. Rental-term control
**Status: Updated locally on 2026-10-12; browser UX verification remains.**

Create Listing and Edit Listing previously used a native select with two rental-term options. Both now use the existing accessible radio-card pattern already used for listing purpose, with the price unit shown on each choice.

**Fix and verification:** short-term shows “Price per night”; long-term shows “Price per month.” The sale flow still hides rental term. The production build passes; keyboard and mobile UX have not been manually checked.

**Evidence:** `src/pages/CreateListing.jsx`, `src/pages/EditListing.jsx`.

### 2. Map pin cannot be dragged; address lookup is approximate
**Status: Draggable marker implemented locally on 2026-10-12; browser interaction verification remains. Specific-address behavior is intentionally approximate.**

The map previously used a Leaflet `CircleMarker` without drag handlers, so users could click the map to move the pin but could not drag the existing marker. It now renders a draggable Leaflet `Marker` in editable forms and writes the dropped coordinates back as the existing approximate five-character geohash. Read-only maps remain non-draggable. Address search calls Nominatim with `limit=1`; it is not a guaranteed rooftop or exact-address pin.

**Fix and verification:** marker drag-end updates the approximate location, and the UI now tells users they can drag the marker or click the map. `npm run build` passes. A browser-level drag/search/remove-pin check is still needed. Keep exact street addresses in the private listing record, not the public map data.

**Evidence:** `src/components/PropertyMap.jsx`, `src/lib/propertyLocation.js`, `src/components/PropertyMap.css`.

### 3. Supporting documents for listings
**Status: Resolved with the recommended secure model; do not publish direct document URLs.**

Create Listing accepts one ownership document and one government ID. To keep the product lean and secure, the recommended model is: upload to private Firebase Storage in a path like `verification/{userId}/{listingId}/{kind}`; store only the private path and metadata in Firestore; allow reads only to the account owner and admins; and generate a short-lived signed URL via a callable function when the authorized party actually needs to preview or download the document. No public listing document URLs should be stored in `listings` or `listingPrivate` records.

**Implementation decision:** the repo now includes a callable `getSecureDocumentUrl` in `functions/index.js` and a corresponding helper in `src/secureDocument.js`. This narrows the risk to the approved private-delivery path and avoids the current direct-URL exposure problem.

**Recommendation:** support a small, typed, repeatable document list only after the secure delivery model is live. Limit file size/type, require admin-only access, define retention/deletion rules, and add consent text for sensitive verification files. Do not require every supporting document from every property type.

**Evidence:** `src/secureDocument.js`, `functions/index.js`, `src/pages/CreateListing.jsx`, `src/pages/EditListing.jsx`, `src/admin/AdminListings.jsx`, `firestore.rules`.

### 4. Floor area and lot area become required during edit
**Status: Fixed in local source on 2026-10-12; not deployed.**

The Edit Listing form renders floor and lot area through a shared `Field` component that always adds the HTML `required` attribute. The inputs' helper text says optional, Create Listing also treats them as optional, and `validateListingForm` does not require either field. Browser-native validation can therefore block saving when these values are empty.

**Fix:** requiredness is now configurable on the shared field component and floor/lot area explicitly pass `required={false}`. The production build passes. A browser-level save with blank area values remains to be checked.

**Evidence:** `src/pages/EditListing.jsx` (`Field` and its floor/lot call sites), `src/pages/CreateListing.jsx`, `src/lib/listingValidation.js`.

### 5. Listing intake feels incomplete
**Status: Partial improvement implemented locally; further fields need requirements approval.**

The form already collects title, description, type, purpose, address/area, city, price/unit, bedrooms, bathrooms, availability date, amenities, showing windows, floor/lot area, map location, photos, ownership document, and government ID. It now also offers optional property condition (`new`, `excellent`, `good`, `fair`, `needs_repair`) and furnishing status (`furnished`, `partially_furnished`, `unfurnished`) for non-land listings; the detail page displays them when supplied. Form validation and Firestore Rules constrain these values. More additions may help, but collecting everything as required would create friction and collect unnecessary personal/property data.

**Implemented:** optional condition and furnishing fields are available in create/edit forms and are shown on listing details. They are not required; Land listings hide furnishing. Invalid enum values are rejected by client validation and Firestore Rules. The focused Firestore Rules suite passed 11/11 after the rule update.

**Recommendation:** agree a minimum remaining schema with the professor/team and use progressive disclosure by property type and purpose. Candidate fields:
- Property condition and furnishing status.
- Utilities/services included in the displayed rent and recurring fees/deposit, with clear units and frequency.
- Parking, accessibility, occupancy/capacity, and key house rules where relevant.
- For rentals: minimum stay/lease term, availability, and viewing/contact preferences.
- For sale: ownership/authority-to-sell verification state and known fees or material disclosures, with legal review before collecting sensitive title details.

Keep optional fields optional, explain why sensitive data is requested, and avoid collecting government IDs or document contents beyond the approved verification need. Do not expand the public schema with exact address/document URLs.

**Evidence:** `src/pages/CreateListing.jsx`, `src/pages/EditListing.jsx`, `src/pages/ListingDetail.jsx`, `src/lib/listingValidation.js`, `firestore.rules`, and the listing detail Rules test in `scripts/firestore-rules-smoke.mjs`.

### 6. Booking times and duplicate requests
**Status: Date/time UI and normal-flow duplicate prevention implemented locally on 2026-10-12; backend enforcement remains a gap.**

Booking requests now collect check-in and check-out date/time, convert input to UTC timestamps using an explicit `Asia/Manila` offset, and render those timestamps in PHT. Before creating a request, the app queries the renter's own requests for that listing and blocks overlapping Pending, Confirmed, or Disputed intervals; Completed requests do not block a new stay. A composite `bookings(renterId, listingId)` index was added, and the Firestore Rules emulator smoke test verifies that the renter-scoped query is permitted.

Firestore Rules still permit a renter to create another Pending request if they bypass the UI check. Two fast clients can also both query before either writes. Therefore this is a normal-flow duplicate guard, not a backend-authoritative or concurrency-proof uniqueness guarantee; the time selection and PHT normalization are locally implemented, not deployed.

**Fix and verification:** date/time helpers cover PHT conversion and half-open overlap boundaries. The current query is scoped by renter and listing. `npm run test:firestore-rules` passed 12/12 including the renter-scoped query and concurrent owner confirmation; the full JavaScript tests/build are also run after this slice. Backend enforcement remains limited by the no-Blaze/no-deploy decision.

**Next:** browser-test same-day stays, next-day checkout, and time-zone display. If the professor instead means viewing appointments, model those separately from overnight stays.

**Evidence:** `src/pages/BookingRequest.jsx`, `src/lib/booking.js`, `src/lib/bookingConfirmation.js`, `firestore.rules`.

### 7. Mark booking complete
**Status: Implemented locally: renter completion after checkout, with an explicit owner confirmation review window and dispute fallback.**

The renter-side My Bookings button hides the completion action until the booking’s confirmed checkout time has passed. The shared helper `canRenterCompleteBooking()` still requires a Confirmed status and rejects early completion for both modern `bookingTimeZone: "Asia/Manila"` stays and legacy date-only entries. The completion action now writes a `completionRequestedAt` marker and a `completionRequestedBy: "renter"` field, while the owner Booking Requests screen shows the stay as `Completed` with a clear `Awaiting owner confirmation` state and a `Confirm completion` action.

**Recommended policy:**
- A renter may mark a booking complete only once the checkout timestamp has passed.
- The owner gets a visible review state and can confirm completion or raise a dispute if there is a material issue.
- The completed state is not a mutual-approval gate; the owner review window is separate from the completion trigger.
- If the product later adds stricter settlement controls, that should be an additional workflow layer, not the default completion rule.

This keeps the app simple without creating a deadlock between renter and owner. The repository Rules enforce the checkout timing; this remains a source-level guarantee only, not a deployed adversarial security boundary.

**Evidence:** `src/pages/MyBookings.jsx`, `src/pages/BookingRequests.jsx`, `src/lib/booking.js`, `firestore.rules`, and the completion policy regression in `scripts/firestore-rules-smoke.mjs`.

### 8. Dispute evidence uploads
**Status: Confirmed gap; shares the unresolved secure-file dependency.**

Raise Dispute accepts a text reason only. The dispute record and admin review UI have no evidence-file field or evidence viewer. Adding proof uploads through the current public/direct Cloudinary URL flow would introduce more sensitive material without access control.

**Recommendation:** coordinate this with item 3's secure document decision. Once approved, allow a limited number of typed image/PDF attachments, validate MIME type/size, store private metadata rather than public links, authorize access only to the involved parties and admins, and define retention/deletion handling. Test unauthorized access and redaction before exposing uploads.

**Evidence:** `src/pages/RaiseDispute.jsx`, `src/admin/AdminDisputes.jsx`, `firestore.rules`.

### 9. Account activity log
**Status: Confirmed gap.**

The app has timestamps on individual records, notifications, dispute resolution fields, and count-only public accountability data, but no general append-only account activity log that records a consistent actor/action/target/time event. Notifications are not an audit log: they are user-facing, selectively generated, and can be read/deleted under their own rules.

**Recommendation:** define a narrow event catalogue for material actions (listing create/edit/review, booking request/confirm/complete, dispute submit/resolve, account suspend/reactivate). Record actor ID, target type/ID, action, server timestamp, and minimal before/after metadata; never log passwords, document contents, exact private addresses, or tokens. Make records append-only, restrict reads to authorized admins and the affected user as appropriate, decide retention/export/deletion policy, and avoid claiming tamper-proof logging if writes remain client-controlled. Security-sensitive actions should use trusted server-side logging when available; under the no-Blaze constraint, explicitly document the limits of client-generated events.

**Evidence:** current collections/rules in `firestore.rules`, `src/lib/notifications.js`, `src/admin/AdminDisputes.jsx`, and `src/admin/AdminUsers.jsx`.

### 10. Suspended accounts still appear active in the app
**Status: Fixed in local source on 2026-10-12; not deployed.**

`normalizeUserProfileData()` previously forced every profile to `status: "active"`. `AuthContext` used that normalized value for route guards even when the stored profile was suspended. It now preserves an explicit suspended status while still defaulting missing/legacy statuses to active. The AuthContext no longer sees a status mismatch for a standard suspended profile and therefore does not attempt to overwrite it. Firestore Rules remain the protected-data enforcement layer.

**Fix and verification:** `src/lib/userProfile.js` preserves the suspended state; `src/lib/adminAccess.test.js` verifies a normalized suspended admin still resolves to the `suspended` route state. The focused suite passed 7/7 and the full JavaScript suite passed 49/49. Browser-level suspend/reactivate flow and deployed behavior have not been tested; deployment is not planned at this time.

**Evidence:** `src/lib/userProfile.js`, `src/context/AuthContext.jsx`, `src/routes/RequireAuth.jsx`, `src/routes/RequireAdmin.jsx`, `src/lib/adminAccess.js`, `firestore.rules`.

## Suggested implementation order
1. **Complete:** suspended-account normalization fix; keep its test and perform a local emulator/browser check.
2. **Complete locally:** Edit Listing optional area fields; perform a browser save with blank area values.
3. **Complete locally:** make map placement draggable; verify drag/search/remove-pin behavior in a browser and document the approximate geocoding privacy boundary.
4. Agree on remaining listing intake fields with the professor; implement only approved conditional fields. Rental-term, condition, and furnishing controls are implemented locally.
5. **Partially complete:** check-in/out times are stored in PHT and normal-flow duplicates are blocked; next define and enforce the completion transition and decide whether duplicate guarantees beyond the client are required.
6. Choose an approved secure file-delivery approach before adding supporting documents or dispute attachments. Until then, do not upload real personal or ownership documents.
7. Design the minimal activity-event catalogue, access rules, retention policy, and integrity boundary before implementing a logbook UI.

## Verification limits
This audit confirms code structure and Firestore Rules behavior from repository source. It does not independently reproduce the map, booking-completion, or post-fix suspension behavior in a browser session, inspect production data, or deploy any changes. The reported completion failure should be reproduced locally; the suspension fix is locally tested but not deployed.

## Account/contact addendum - 2026-10-13

### 11. Account contact details and owner inquiry
**Status: Partially implemented locally on 2026-10-13; private phone storage and sale inquiry remain gaps.**

Account now allows owners to opt in to displaying their Auth email and an optional E.164 phone number on their publicly readable profile. Listing detail and public-profile pages show email/call actions only when those fields exist. The phone is not stored privately when it is not shared, and no Firestore Rules/server changes were made. Rental booking requests remain the contact path when no direct contact is shared; sale inquiry/viewing is not implemented. Listing creation still has an Auth-email fallback for public `ownerName`, which remains a privacy issue. Listing review also does not constitute account identity verification.

**Recommendation:** follow `docs/Account_Profile_and_Contact_Preferences.md`. Treat opted-in contact values as public; add a private phone field only with approved Firestore access rules and tests; remove the email fallback; distinguish listing review from identity verification; and define a protected sale inquiry/viewing flow before promising direct contact. The Account plan/QR preview is not a paid or verified state.
