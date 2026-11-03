# TrustHome PH

A capstone rental marketplace prototype for the Philippines. Renters can discover
verified rental listings and request bookings; homeowners can submit properties for
review; admins can manage listings, disputes, and trust-related workflows. A separate
catalog displays bank-acquired properties, currently from Metrobank only.

> **Project status:** This is a prototype, not a production-ready property, legal, or
> financial service. See [Known limitations](#known-limitations) before using or
> deploying it.

## Contents

- [Features](#features)
- [Technology](#technology)
- [Getting started](#getting-started)
- [Checks and build](#checks-and-build)
- [Bank property scraper](#bank-property-scraper)
- [Deployment](#deployment)
- [Project structure](#project-structure)
- [Documentation](#documentation)
- [Team](#team)
- [Known limitations](#known-limitations)

## Features

- **Rental marketplace:** homeowners submit properties for review; renters browse
  listings and request bookings.
- **Bookings:** booking requests have status tracking and date/time selection in
  Philippine time. Owner approvals use a per-listing Firestore lease to serialize
  overlap checks.
- **Trust and accountability:** ratings, trust and fairness scoring, dispute review,
  notifications, and public owner profiles.
- **Bank property catalog:** filter, sort, and browse bank-acquired properties, with
  an informational loan estimate.
- **Responsive feedback:** loading, empty, error, offline, permission, and form
  validation states.

## Technology

| Area | Technology |
| --- | --- |
| Frontend | React, Vite |
| Authentication and database | Firebase Authentication, Cloud Firestore |
| Listing images and verification documents | Cloudinary |
| Hosting | Firebase Hosting |
| Optional backend | Firebase Functions (deployment is not verified) |
| Bank scraper | Python, Requests, Beautiful Soup |

## Getting started

### Prerequisites

- Node.js **20.19+** or **22.12+**, and npm
- Firebase CLI and Java for the local Firebase emulators and rules tests
- Python **3.10+** only if you plan to use the bank scraper

### Run the web app locally

Install the project dependencies from the repository root:

```bash
npm ci
```

The development app connects to local Firebase Auth, Firestore, and Storage
emulators by default. Install the Firebase CLI if needed (`npm install --global
firebase-tools`), then start the emulators and Vite in separate terminals:

```bash
# Terminal 1
npm run emulators
```

```bash
# Terminal 2
npm run dev
```

Open the local URL printed by Vite. Java and the Firebase CLI must be available for
the emulator command.

To deliberately connect local development to the shared Firebase project, create an
untracked `.env.local` file in the repository root:

```dotenv
VITE_USE_SHARED_FIREBASE=true
```

This opts out of the local emulators. Use the shared project only when you intend to
interact with its data.

### Run the bank scraper

The scraper has separate Python dependencies and Firebase Admin credential
requirements. Follow the [bank scraper guide](./bank_scraper/README.md) for virtual
environment setup, dry-run commands, credentials, and safe catalog operations.

## Checks and build

Run these commands from the repository root:

```bash
npm test
npm run lint
npm run build
npm run test:firestore-rules
npm run test:storage-rules
python -m unittest discover -s bank_scraper -p "test_*.py"
```

The emulator-based rules tests require Java and the Firebase CLI. They use demo
project IDs rather than the shared Firebase project. CI runs the unit tests, lint,
build, Firestore rules tests, and Python tests.

To serve a production build locally:

```bash
npm run build
npm run preview
```

## Bank property scraper

The public bank-acquired property catalog currently supports **Metrobank only**.
Other bank parsers are diagnostic-only and cannot write to the catalog. Scraped
information can become stale; verify availability, property details, and financing
directly with the bank. For operational instructions and limitations, see
[`bank_scraper/README.md`](./bank_scraper/README.md).

## Deployment

The GitHub Actions workflow deploys **Firebase Hosting only** when changes are pushed
to the `fixes` branch. It runs tests, lint, and a production build before deployment.
Configure the `FIREBASE_SERVICE_ACCOUNT` repository secret with a service account
authorized to deploy Hosting to the `trusthome-ph` Firebase project.

The separate CI workflow runs on pull requests and pushes to `fixes` or `main`.
Hosting deployment does not deploy Firestore rules, Storage rules, or Functions.
Review the project audit and verify production configuration before treating a
deployment as release-ready.

## Project structure

```text
src/                  React application
public/               Static assets
functions/            Firebase Functions source
bank_scraper/         Python scraper, tests, and catalog operations
docs/                 Project, setup, audit, and testing documentation
scripts/              Firebase rules smoke tests
firebase.json         Firebase emulator and Hosting configuration
firestore.rules       Firestore security rules
storage.rules         Storage security rules
```

## Documentation

- [Local Firebase Emulator Guide](./docs/Local_Firebase_Emulator_Guide.md)
- [Firebase, Cloudinary, and Security Setup](./docs/TrustHome_PH_04_Firebase_Cloudinary_and_Security_Setup.pdf)
- [Development, Build, and Deployment Guide](./docs/TrustHome_PH_05_Development_Build_and_Deployment_Guide.pdf)
- [QA and Testing Strategy](./docs/TrustHome_PH_08_QA_and_Testing_Strategy.pdf)
- [Bank Catalog Scraper and Data Operations](./docs/TrustHome_PH_06_Bank_Catalog_Scraper_and_Data_Operations.pdf)
- [Current Project Audit](./docs/Project_Audit_2026-10-12.md)
- [Problems and Fixes](./docs/TrustHome_PH_Problems_and_Fixes_2026-10-15.md)
- [Current Progress Report](./docs/TrustHome_Current_Progress_Report_2026-10-04.md)
- [Account Profile and Contact Preferences](./docs/Account_Profile_and_Contact_Preferences.md)
- [Project Overview and Scope](./docs/TrustHome_PH_01_Project_Overview_and_Scope.pdf)
- [System Architecture and Data Model](./docs/TrustHome_PH_02_System_Architecture_and_Data_Model.pdf)
- [Functional Specification and Business Rules](./docs/TrustHome_PH_03_Functional_Specification_and_Business_Rules.pdf)
- [UI/UX Design System and Page Inventory](./docs/TrustHome_PH_07_UI_UX_Design_System_and_Page_Inventory.pdf)
- [Release Roadmap and Versioning Plan](./docs/TrustHome_PH_09_Release_Roadmap_and_Versioning_Plan.pdf)

## Team

| Member | Role |
| --- | --- |
| Andresa, Rev Andrei | Scrum Master; project documentation |
| Carillo, Christopher Andrei | Lead developer; marketplace, booking, security, and trust workflows |
| Laurente, Vien Melvic | Project manager; bank catalog, scraper, and frontend |
| Prades, Justine James | Frontend design, settings, ratings, and trust scoring |
| Solpico, Robert | QA, loan calculator, disputes, and accountability |

## Known limitations

- Property document review is a plausibility check, not a legal title search.
- The app does not hold, transfer, or recover deposits; a deposit reference is only a
  text record.
- Metrobank is the only active bank catalog source. Confirm property and financing
  information with the bank.
- Verification documents use Cloudinary. PDF delivery is currently blocked for some
  assets, and document URLs are not short-lived authenticated links.
- Booking overlap protection uses a client flow and Firestore lease rules; a
  backend-authoritative callable is not deployed. Local rules and indexes must match
  production before relying on these changes there.
- Firebase Functions deployment requires an approved billing-enabled environment.
- Native mobile development and activation of additional bank sources are outside the
  currently verified implementation.

See the [current project audit](./docs/Project_Audit_2026-10-12.md) for deployment
parity, verification evidence, and remaining release risks.
