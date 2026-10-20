# TrustHome PH

A rental marketplace prototype for the Philippines, with owner-submitted listings reviewed by admins, booking workflows, trust and dispute features, and a separate bank-acquired property catalog. Metrobank is the only currently active bank source.

**Capstone project — 2026**

---

## Team

| Member | Role |
|---|---|
| Andresa, Rev Andrei | Scrum Master · Auth & User Roles · Admin Dashboard |
| Carillo, Christopher Andrei | Lead Developer · Marketplace & Booking · Firestore Security · Trust & Dispute Workflows |
| Laurente, Vien Melvic | Search & Browse · Booking Calendar · Dispute & Accountability Trail |
| Prades, Justine James | Ratings & Reviews · Trust & Fairness Score |
| Solpico, Robert | Bank-Acquired Catalog + Scraper · Loan Calculator · Public Profile |

### Carillo's Contributions

- Led development of the rental marketplace, including verified listing intake and the owner dashboard; authored the majority of the project's 110+ commits.
- Built booking approvals around per-listing leases and atomic Firestore transactions to prevent overlapping confirmed bookings.
- Implemented trust and fairness scoring, dispute and accountability workflows, notifications, and public owner-profile features.
- Wrote Firestore and Storage security rules for renter, owner, and admin roles, and verified them with emulator-based tests.
- Set up GitHub Actions checks for unit tests, security-rule tests, linting, and production builds.

---

## What This App Does

- **Renters** browse verified rental listings and request bookings. Users can also browse a separate catalog of bank-acquired properties.
- **Homeowners** list a room, unit, or house for rent; listings only go public after a verification step.
- **Bookings** use a calendar-based workflow with status tracking. Owner approvals serialize overlap checks through a per-listing lease; a backend-authoritative callable is not deployed.
- **Trust & Fairness Score** ranks listings using completed booking history, ratings, and price fairness, not just recency or price.
- **Disputes** can be reviewed by admins; founded-dispute counts are shown on public accountability profiles.
- **Public owner profiles** show verified listings and ratings, plus the email address or phone number only when the owner opts in. Shared contact details are publicly visible and have direct email/call actions.
- **Loan calculator** helps users estimate financing for bank-acquired listings.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| File uploads | Cloudinary for listing photos and verification documents; Firebase Storage is not enabled for this Spark project |
| Hosting | Firebase Hosting |
| Optional backend jobs | Firebase Functions source exists; deployment is not verified and requires an approved billing-enabled environment |
| Bank scraper | Python (`requests` + `BeautifulSoup`) |
| Scraper scheduling | GitHub Actions / local worker |

---

## Project Structure

```text
team-idle/
├── src/                     # React app source
│   ├── App.jsx
│   ├── firebase.js
│   ├── uploadImage.js
│   ├── components/
│   ├── context/
│   ├── lib/
│   ├── pages/
│   └── routes/
├── public/                  # Static assets
├── functions/               # Firebase Functions
├── bank_scraper/            # Python scraper and demo data scripts
│   ├── scraper.py
│   ├── database.py
│   ├── scheduler.py
│   ├── trust_scores.py
│   ├── backup_firestore.py
│   ├── restore_firestore.py
│   ├── complete_expired_bookings.py
│   ├── migrate_verification_documents.py
│   ├── requirements.txt
│   └── seed_demo_data.py
├── docs/                    # Project documentation and planning files
│   ├── TrustHome_PH_01_Project_Overview_and_Scope.pdf
│   ├── TrustHome_PH_02_System_Architecture_and_Data_Model.pdf
│   ├── TrustHome_PH_03_Functional_Specification_and_Business_Rules.pdf
│   ├── TrustHome_PH_04_Firebase_Cloudinary_and_Security_Setup.pdf
│   ├── TrustHome_PH_05_Development_Build_and_Deployment_Guide.pdf
│   ├── TrustHome_PH_06_Bank_Catalog_Scraper_and_Data_Operations.pdf
│   ├── TrustHome_PH_07_UI_UX_Design_System_and_Page_Inventory.pdf
│   ├── TrustHome_PH_08_QA_and_Testing_Strategy.pdf
│   ├── TrustHome_PH_09_Release_Roadmap_and_Versioning_Plan.pdf
│   ├── TrustHome_PH_Use_Cases_and_Test_Cases_2026-10-04.xlsx
│   ├── TrustHome_Current_Progress_Report_2026-10-04.md
│   └── TrustHomePH_SWOT_Analysis.pdf
├── package.json
├── vite.config.js
├── eslint.config.js
├── firebase.json
├── firestore.indexes.json
├── firestore.rules
├── index.html
├── README.md
└── .gitignore
```

---

## Getting Started

### Prerequisites

- Node.js 20.19+ or 22.12+ (Vite 8 requirement)
- npm
- Python 3.10+
- Firebase project access and local configuration if you are using a team environment

### Web app

From the project root:

```bash
npm install
```

Local development uses the Firebase Auth, Firestore, and Storage emulators by default so it does not write to the shared `trusthome-ph` project. Start them in a separate terminal with `npm run emulators` (Firebase CLI and Java required). Functions are not needed for the current browser workflows and are not started by this command. To intentionally use the shared project during local development, set `VITE_USE_SHARED_FIREBASE=true` in an untracked `.env.local` file; avoid this for routine testing. Validate the verification-file Storage rules locally with `npm run test:storage-rules`; this uses a demo project ID and does not access the shared project.

Run these in two terminals from the project root:

```bash
# Terminal 1
npm run emulators

# Terminal 2
npm run dev
```

The app runs locally in development mode with Vite. For a production build:

```bash
npm run build
npm run preview
```

The client configuration in `src/firebase.js` contains the app's Firebase project identifiers. Vite development connects to local emulators by default; production builds use the configured Firebase project. Shared-project access from local development must be explicitly enabled with `VITE_USE_SHARED_FIREBASE=true`.

### Bank scraper

```bash
cd bank_scraper
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate
pip install -r requirements.txt
```

You can then run the scraper locally or use the demo seed script:

```bash
python scraper.py --dry-run metrobank
python scraper.py
python seed_demo_data.py --dry-run
python seed_demo_data.py
python -m unittest discover -s . -p "test_*.py"
```

The live scraper writes to Firestore and needs a trusted Firebase Admin credential through `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_SERVICE_ACCOUNT_JSON`. Keep service-account keys outside Git and never include them in reports or logs. Run `--dry-run` first when checking source parsing.

---

## Build Instructions

Use these commands from the repository root:

```bash
npm install
npm test
npm run test:firestore-rules
npm run test:storage-rules
npm run lint
npm run build
```

`npm run test:firestore-rules` and `npm run test:storage-rules` require the Firebase CLI and Java and use demo project IDs with local emulators.

This creates a production bundle in the `dist/` folder for deployment or previewing. For local development, use:

```bash
npm run dev
```

---

## Documentation Index

| Document | What's in it |
|---|---|
| `TrustHome_PH_01_Project_Overview_and_Scope.pdf` | Project scope, users, roles, and limitations. |
| `TrustHome_PH_02_System_Architecture_and_Data_Model.pdf` | Application architecture, routes, data model, and access boundaries. |
| `TrustHome_PH_03_Functional_Specification_and_Business_Rules.pdf` | Listing, booking, trust, dispute, and catalog behavior with known gaps. |
| `TrustHome_PH_04_Firebase_Cloudinary_and_Security_Setup.pdf` | Firebase configuration, Firestore rules, Cloudinary, and credential guidance. |
| `TrustHome_PH_05_Development_Build_and_Deployment_Guide.pdf` | Developer setup, quality gates, Git workflow, and deployment checks. |
| `TrustHome_PH_06_Bank_Catalog_Scraper_and_Data_Operations.pdf` | Scraper sources, jobs, backups, restores, migrations, and seed data. |
| `TrustHome_PH_07_UI_UX_Design_System_and_Page_Inventory.pdf` | Current page inventory, visual system, and accessibility conventions. |
| `TrustHome_PH_08_QA_and_Testing_Strategy.pdf` | Test evidence levels, procedures, and workbook usage. |
| `TrustHome_PH_09_Release_Roadmap_and_Versioning_Plan.pdf` | Version history, release blockers, ownership, and release practices. |
| `TrustHome_PH_Use_Cases_and_Test_Cases_2026-10-04.xlsx` | Use cases, test cases, requirements, summary, and known gaps. |
| `Local_Firebase_Emulator_Guide.md` | Local emulator setup, isolated test accounts, Google sign-in simulation, and safety boundaries. |
| `docs/Account_Profile_and_Contact_Preferences.md` | Account contact-sharing behavior, privacy boundaries, owner contact flow, and remaining public trust-profile gaps. |
| `Project_Audit_2026-10-12.md` | Current project audit, fixes implemented, remaining risks, and verification evidence. |
| `TrustHome_Current_Progress_Report_2026-10-04.md` | Source-backed system flows, evidence, current status, and release gaps. |
| `TrustHomePH_SWOT_Analysis.pdf` | SWOT and project reflection summary. |

---

## Roadmap

| Version | Focus |
|---|---|
| v0.1 | Foundations: authentication, listings, verification, search, and Metrobank catalog foundation |
| v0.2 | Booking and trust: booking lifecycle, ratings, trust scoring, and expired-booking job |
| v0.3 | Accountability and integration: disputes, public accountability, catalog safeguards, and loan estimate |
| v1.0-v1.3 | Requirements alignment, booking accountability, marketplace quality, notifications, navigation, settings, and UI hardening |
| v1.4+ | Release blockers and verification work; see the roadmap PDF before treating these as completed features |

---

## Known Limitations

- Document review filters casual fraud, but it is not a legal title search.
- TrustHome does not hold, transfer, or recover deposit funds. A deposit reference is a text record only.
- Listing document review is a plausibility check, not a legal title search.
- Metrobank is the only active bank catalog source. Landbank parsing is unverified and BDO remains a placeholder.
- Cloudinary currently blocks delivery of verification PDFs with `show_original_customer_untrusted`, including legacy uploads. The admin download link cannot bypass that account-level restriction; new verification PDFs use the same Cloudinary path.
- Verification documents continue to use Cloudinary URLs. Firebase Console confirms this project is on Spark and its Storage page requires Blaze, so the app does not use Firebase Storage for document uploads. Cloudinary PDF delivery remains blocked for some assets, and direct URLs are not short-lived authenticated links; treat document handling as a release blocker.
- Both owner approval routes now use a shared client flow that acquires a 60-second per-listing lease, checks confirmed bookings, and atomically confirms the booking while releasing the lease. Firestore Rules require the lease transition, and local emulator tests cover concurrent approvals. Rules cannot independently verify that an intentionally modified client checked for overlaps; a backend-authoritative callable is not deployed.
- Deployment parity is not current: the live Hosting release is dated Oct 1, 2026; live Firestore Rules do not include the booking lease requirement, and the live index list is missing the repository's new `bookings(listingId, ownerId, status)` index. See the audit before considering the local booking changes production-ready.
- Firebase Functions require an approved billing-enabled deployment environment. The current frontend booking approval does not require a deployed callable.
- Native mobile development and BDO/Landbank activation are outside the currently verified implementation.

These are disclosed scope decisions for the current build and are documented in the project planning files.
