# Account Profile and Contact Preferences

**Status:** Opt-in public contact display implemented; private phone storage and contact workflows remain unimplemented
**Updated:** 2026-10-15

This document records the current account/profile behavior and privacy boundaries. The local Account UI can opt in to publishing the sign-in email and an optional phone number on `publicProfiles`; no Firestore Rules, backend service, Firebase billing, or production data were changed.

## Current behavior

- `/account` lets a signed-in user edit their display name and explicitly choose whether to publish their sign-in email and an optional phone number. The Auth email remains read-only. The page also shows account status, role, listing count, and recent account activity.
- `users/{uid}` holds private account/profile data. `publicProfiles/{uid}` is publicly readable and currently exposes a display name; it is used for reputation and accountability information.
- The opt-in contact implementation writes `contactEmail` and `contactPhone` to publicly readable `publicProfiles/{uid}` only when selected. It does not store an unshared phone number privately; if private contact storage is later required, add a `users/{uid}` field with appropriate rules first.
- Public owner profiles display each opted-in email address or phone number as text beside its email/call action. Anyone who can read the public profile can see the selected value; the action button is not a privacy boundary.
- Owner-submitted listing documents contain `ownerId` and `ownerName`. `CreateListing` currently falls back to the authentication email when neither a profile name nor Auth display name exists. Because verified listings are public, that fallback can expose an email address in listing data and should be removed in a follow-up implementation.
- A rental's **Request booking** action is the current way for a prospective renter to send the owner a booking request. It is not general messaging. Sale listings have no inquiry or viewing-request workflow.
- The `PublicProfile` page currently labels a profile **Verified account**, but the account model has no identity-verification field or documented account-verification process. Listing-document review is not the same as verifying a person's identity.
- The Account page's TrustHome Verified plan dialog is a display-only preview. Prices are not set; QR/receipt checkout and account upgrades are not active. Admin Users' plan preview does not modify the selected user's record.

## Recommended account fields

Keep authentication and contact data separate from public profile presentation.

| Field | Recommendation | Visibility |
|---|---|---|
| Display name | Editable; show on the public profile and listings | Public, with user awareness |
| Authentication email | Read-only in Account unless a verified email-change flow is designed; preferred contact channel only when the owner opts in | Private by default; never copy it into public listing labels |
| Contact number | Optional and normalized to E.164 before publishing | Public only with opt-in; currently not retained privately when unshared |
| Contact sharing preference | Explicit per-channel consent (`shareEmail`, `sharePhone`); default both to false. Preferred method is email when shared, otherwise phone only when shared | UI state; public fields exist only for selected channels |
| Public contact email | Copy the Auth email to `publicProfiles` only when the owner opts in | Public only with opt-in |
| Public contact number | Copy the validated number to `publicProfiles` only when the owner opts in | Public only with opt-in |
| Account status and role | Continue to be managed under existing account/admin rules | Private; not a verification or subscription status |

The account email is the preferred contact channel only when the owner opts in to public email contact. A user entering a phone number is not consent to publish it. The current UI stores the number only when public sharing is enabled; turning sharing off removes it from `publicProfiles`. If a future requirement needs a private saved number, store it in `users/{uid}` only after adding and testing a private owner/admin access rule.

Never put contact preferences or unshared phone/email values in public listings, notifications, URLs, or activity-log details. Validate phone country code/format without treating possession of a number as identity verification.

## Contact flows

### Rental listings

For now, the booking request is the contact action: the renter submits requested dates and the owner receives the request. Make that purpose clear beside the button. Do not expose the owner's private phone number on the public listing. A future handoff could reveal mutually consented contact details after a booking is confirmed, but only after the data path, access rules, revocation behavior, and emulator tests are designed.

### For-sale listings

There is currently no buyer inquiry, viewing request, messaging, or offer workflow. Do not show a non-functional **Contact seller** action as if it sends a message. A future feature should model a private inquiry/viewing request to the owner, include spam/abuse controls and notification behavior, and keep negotiation/payment outside TrustHome unless a separate approved product scope is defined.

### Public owner profile

Show the public display name and evidence-backed reputation information: verified listing count, public ratings/count/average, founded-dispute count with neutral wording, and member-since date only if it can be derived reliably. Display each opted-in email or phone value next to its email/call action; these values are public to all profile readers. Show contact methods only when present. Do not expose private booking records, exact addresses, or document contents.

Do not label every profile **Verified account**. Listing review only means listing documents were reviewed; it does not establish the owner's identity. Add an account-level verification badge only after defining an actual verification process and a separately stored, auditable state.

## TrustHome Verified and payment preview

The Account plan comparison and Admin Users **Preview plan** action are presentation-only demos. They must not write a plan, payment, receipt, phone, verification, or premium field to Firestore. Keep pricing marked **to be announced** until approved. The QR icon is a non-scannable preview, not a payment code. Disabled enrollment controls must remain explicit; no account should appear upgraded from opening or closing the preview.

If a paid plan is approved later, define the price, benefits, refund/cancellation policy, receipt handling, review process, upgrade state, and audit trail before building the payment path. A static QR image and receipt upload do not by themselves verify payment or justify an automatic premium/identity badge.

## Security and privacy requirements

1. Keep phone/email private by default; only write the existing public-profile fields after explicit opt-in.
2. Remove the Auth-email fallback from `ownerName`; use a safe display-name fallback instead. Review existing public listing records for email values before claiming this is resolved.
3. Define an explicit consent and access boundary before revealing contact details to another user. A UI-only visibility switch is not an access-control boundary.
4. Keep listing verification, account identity verification, account status, and paid-plan status as separate concepts.
5. Collect only contact fields required for an approved workflow. Do not include contact values in logs, analytics payloads, URLs, or notification text.
6. Use synthetic phone numbers and addresses during emulator testing. Never put real contact data in documentation or screenshots.

## Implementation checklist

- Define whether a private copy of the phone number is required; it is not stored when the current user declines public sharing.
- If private contact storage is added, define the private Firestore field, owner/admin read/write rules, validation, consent defaults, and deletion behavior before implementation.
- Add tests for public opt-in, opt-out/removal, and (if private storage is added) unauthorized reads.
- Keep Account and PublicProfile copy clear that selected contact methods are public; distinguish them from the private Auth email and unshared phone number.
- Add a sale inquiry/viewing flow only as a separate, explicitly scoped feature; the current rental booking flow is not a substitute.
- Replace the static account-verification label with a truthful state before presenting identity verification as implemented.

## References

- [Current progress report](TrustHome_Current_Progress_Report_2026-10-04.md)
- [Project audit](Project_Audit_2026-10-12.md)
- [Requested features and bugs audit](Requested_Features_and_Bugs_Audit_2026-10-12.md)
- [Local Firebase Emulator Guide](Local_Firebase_Emulator_Guide.md)