# TrustHome PH

A verified rental marketplace prototype for the Philippines, with reviewed user listings, a booking system, trust and dispute features, and a public bank-acquired property catalog. Metrobank is currently the only bank catalog source intended for production.

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

- **Renters and buyers** browse document-reviewed rental listings and a catalog of bank-acquired properties. Metrobank is currently the only intended production source.
- **Homeowners** list a room, unit, or house for rent; listings only go public after a verification step.
- **Bookings** run through a calendar-based workflow with status tracking and conflict prevention.
- **Availability calendar** shows confirmed stays before a renter submits a request; the owner-side confirmation flow remains the final conflict check.
- **Trust & Fairness Score** ranks listings using completed booking history, ratings, and price fairness, not just recency or price.
- **Browse** can prioritize nearby listings when the user grants location access; otherwise it falls back to trust score.
- **Promotions** give property owners a labeled place to promote rental listings within Browse.
- **TrustHome Verified** is a planned optional profile badge priced at ₱99/month; it is not available yet and no payments are processed.
- **User feedback** includes loading, empty, error, offline, slow-network, permission, and session states.
- **Dispute trail** preserves a public record of reported issues and bad actor behavior.
- **Loan calculator** helps users estimate financing for bank-acquired listings with preset loan terms.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| File uploads | Cloudinary |
| Hosting | Firebase Hosting |
| Serverless functions | Firebase Functions |
| API | Authenticated Node.js routes in `api-server/` |
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
├── api-server/              # Authenticated API routes and tests
├── bank_scraper/            # Python scraper and demo data scripts
│   ├── scraper.py
│   ├── database.py
│   ├── scheduler.py
│   ├── trust_scores.py
│   ├── requirements.txt
│   └── seed_demo_data.py
├── docs/                    # Project documentation and planning files
│   ├── 01_TrustHome_PH_Product_Requirements_and_Scope.pdf
│   ├── 02_TrustHome_PH_System_Architecture_and_Data_Design.pdf
│   ├── 03_TrustHome_PH_Infrastructure_Setup_and_Deployment.pdf
│   ├── 04_TrustHome_PH_Security_and_Privacy.pdf
│   ├── 05_TrustHome_PH_UIUX_Design_System.pdf
│   ├── 06_TrustHome_PH_Roadmap_and_Release_Plan.pdf
│   ├── 07_TrustHome_PH_QA_and_Testing_Strategy.pdf
│   ├── TrustHome_Current_Progress_Report.md
│   └── Rev2_Requirement_Traceability_Inventory.md
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

- Node.js 22.x (the API package targets Node.js 22)
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

Booking availability is loaded through the authenticated API in `api-server/`. Configure
`VITE_API_BASE_URL` for the deployed API before building the web app. Availability shown
in the calendar is advisory; the booking confirmation endpoint performs the final conflict
check.

If you need to point the app at a different Firebase project, update the config in `src/firebase.js` before running the app.

The API has its own dependencies and tests:

```bash
npm install --prefix api-server
npm test --prefix api-server
```

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
```

The normal scraper run writes the default Metrobank source to Firestore. BDO and
Landbank are not verified for production; see [the scraper README](./bank_scraper/README.md)
before running other sources or the worker.

---

## Build Instructions

Use these commands from the repository root:

```bash
npm install
npm run build
```

This creates a production bundle in the `dist/` folder for deployment or previewing. For local development, use:

```bash
npm run dev
```

Run the frontend lint and test suites from the repository root with `npm run lint` and
`npm test`. Python scraper tests can be run from `bank_scraper/` with
`python -m unittest discover -s . -p "test_*.py"`.

---

## Documentation Index

| Document | What's in it |
|---|---|
| `01_TrustHome_PH_Product_Requirements_and_Scope.pdf` | Product scope and requirements. |
| `02_TrustHome_PH_System_Architecture_and_Data_Design.pdf` | System architecture and data design. |
| `03_TrustHome_PH_Infrastructure_Setup_and_Deployment.pdf` | Infrastructure and deployment setup. |
| `04_TrustHome_PH_Security_and_Privacy.pdf` | Security and privacy decisions. |
| `05_TrustHome_PH_UIUX_Design_System.pdf` | UI/UX design system. |
| `06_TrustHome_PH_Roadmap_and_Release_Plan.pdf` | Release roadmap. |
| `07_TrustHome_PH_QA_and_Testing_Strategy.pdf` | QA and test strategy. |
| `TrustHome_Current_Progress_Report.md` | Current progress report. |
| `Rev2_Requirement_Traceability_Inventory.md` | Requirement traceability for the Rev 2 reconstruction. |

---

## Roadmap

| Version | Focus |
|---|---|
| Current | Authenticated listings, booking workflows, trust and dispute features, bank catalog, and loan estimates |
| Next | Continue integration testing, improve data-source coverage, and prepare a stable release |

---

## Known Limitations

- Document review filters casual fraud, but it is not a legal title search.
- TrustHome does not custody deposit funds; protection comes from a public dispute trail instead.
- Metrobank is the only currently intended production source for the bank-acquired catalog; other scraper sources are unverified.
- Scraped property information can become stale. Confirm availability and details with the bank.
- Booking calendar availability is advisory; the owner confirmation API is the authoritative conflict check.
- Verification documents use authenticated Cloudinary delivery through the API; review of those documents is not a legal title search.

These are disclosed scope decisions for the current build and are documented in the project planning files.
