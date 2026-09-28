# TrustHome PH

A verified rental marketplace for the Philippines, with a fairness-scored, publicly-curated bank-acquired property catalog — replacing informal rental channels with reviewed listings, a real booking system, and a public accountability trail.

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

- **Renters and buyers** browse document-reviewed rental listings and a regularly refreshed catalog of bank-acquired properties from major Philippine banks.
- **Homeowners** list a room, unit, or house for rent; listings only go public after a verification step.
- **Bookings** run through a calendar-based workflow with status tracking and conflict prevention.
- **Trust & Fairness Score** ranks listings using completed booking history, ratings, and price fairness, not just recency or price.
- **Dispute trail** preserves a public record of reported issues and bad actor behavior.
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
| Serverless functions | Firebase Functions |
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
│   ├── requirements.txt
│   └── seed_demo_data.py
├── docs/                    # Project documentation and planning files
│   ├── TrustHome_PH_System_Build_Plan.pdf
│   ├── TrustHome_PH_Design_Guide.pdf
│   ├── TrustHome_PH_Firebase_Setup_Plan.pdf
│   ├── TrustHome_PH_Build_Instructions.pdf
│   ├── TrustHome_PH_Versioning_Plan.pdf
│   ├── TrustHome_Current_Progress_Report.md
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

- Node.js 18+ or later
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

If you need to point the app at a different Firebase project, update the config in `src/firebase.js` before running the app.

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
python scraper.py
python seed_demo_data.py --dry-run
python seed_demo_data.py
```

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

---

## Documentation Index

| Document | What's in it |
|---|---|
| `TrustHome_PH_System_Build_Plan.pdf` | Full data model and implementation details for the platform logic. |
| `TrustHome_PH_Design_Guide.pdf` | Design system, page inventory, and visual standards. |
| `TrustHome_PH_Firebase_Setup_Plan.pdf` | Firebase and Cloudinary setup guide for the team. |
| `TrustHome_PH_Build_Instructions.pdf` | Project setup and build instructions. |
| `TrustHome_PH_Versioning_Plan.pdf` | Release roadmap and feature assignment plan. |
| `TrustHome_Current_Progress_Report.md` | Current status and progress updates. |
| `TrustHomePH_SWOT_Analysis.pdf` | SWOT and project reflection summary. |

---

## Roadmap

| Version | Focus |
|---|---|
| v0.1 | Foundations — auth, listings, verification, search |
| v0.2 | Trust Engine — booking calendar, ratings, trust score |
| v0.3 | Accountability & Integration — disputes, bank catalog, loan calculator |
| v1.0 | Final release — dashboards, polish, QA, defense prep |

---

## Known Limitations

- Document review filters casual fraud, but it is not a legal title search.
- TrustHome does not custody deposit funds; protection comes from a public dispute trail instead.
- The bank-acquired catalog depends on manually mapped scraper selectors and scheduled refreshes.
- Current live catalog coverage depends on the scraper sources and data availability at the time of use.
- Uploaded documents are intentionally handled outside Firebase Storage for this project setup.

These are disclosed scope decisions for the current build and are documented in the project planning files.
