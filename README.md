# TrustHome PH

A rental marketplace prototype for the Philippines, with owner-submitted listings reviewed by admins, booking workflows, trust and dispute features, and a separate bank-acquired property catalog. Metrobank is the only currently active bank source.

**Capstone project — 2026**

---

## Team

| Member | Role |
|---|---|
| Andresa, Rev Andrei | Scrum Master · Auth & User Roles · Admin Dashboard |
| Carillo, Christopher Andrei | Listing Management · Verified Listing Intake · Owner Dashboard |
| Laurente, Vien Melvic | Search & Browse · Booking Calendar · Dispute & Accountability Trail |
| Prades, Justine James | Ratings & Reviews · Trust & Fairness Score |
| Solpico, Robert | Bank-Acquired Catalog + Scraper · Loan Calculator · Public Profile |

---

## What This App Does

- **Renters** browse verified rental listings and request bookings. Users can also browse a separate catalog of bank-acquired properties.
- **Homeowners** list a room, unit, or house for rent; listings only go public after a verification step.
- **Bookings** use a calendar-based workflow with status tracking and a client-side overlap check. Concurrent approval race protection remains a release gap.
- **Trust & Fairness Score** ranks listings using completed booking history, ratings, and price fairness, not just recency or price.
- **Disputes** can be reviewed by admins; founded-dispute counts are shown on public accountability profiles.
- **Loan calculator** helps users estimate financing for bank-acquired listings.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| File uploads | Cloudinary |
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
npm run dev
```

The app runs locally in development mode with Vite. For a production build:

```bash
npm run build
npm run preview
```

The client configuration in `src/firebase.js` points to the shared `trusthome-ph` Firebase project. A local clone uses that same project unless the configuration is changed; local development does not create a separate database. Coordinate test data and writes with the team.

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
npm run lint
npm run build
```

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
- Cloudinary currently blocks delivery of the PDF with `show_original_customer_untrusted`. The admin download link cannot bypass that account-level restriction.
- Verification-document URLs are stored in Firestore's private listing record, but Cloudinary delivery is not yet securely authenticated. Do not run the authenticated-document migration on live data until the app supports short-lived authenticated delivery URLs.
- The current owner booking approval path checks overlapping confirmed bookings before the Firestore write transaction; simultaneous approvals can race. Stronger server-side confirmation exists in Functions source but is not verified deployed.
- Firebase Functions require an approved billing-enabled deployment environment. The current frontend booking approval does not require a deployed callable.
- Native mobile development and BDO/Landbank activation are outside the currently verified implementation.

These are disclosed scope decisions for the current build and are documented in the project planning files.
