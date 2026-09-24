# TrustHome PH

A verified rental marketplace for the Philippines, with a fairness-scored, publicly-curated bank-acquired property catalog — replacing scam-prone informal rental channels (Facebook Marketplace, group chats) with reviewed listings, a real booking system, and a public accountability trail.

**Capstone project — [School/Program name here], 2026**

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

- **Renters/buyers** browse document-reviewed rental listings and a regularly-refreshed catalog of bank-acquired (foreclosed) properties from BDO, Landbank, and Metrobank — all in one place.
- **Homeowners** list a room, unit, or house for rent; listings only go public after a document-review step ("Verified" badge).
- **Bookings** run through a conflict-free calendar (no double-booking) and a real status workflow (`Pending → Confirmed → Completed`).
- **Trust & Fairness Score** ranks listings by actual completed-booking history, ratings, and price fairness — not just recency or price.
- **Dispute trail**: TrustHome doesn't hold deposit funds, but a founded dispute permanently and publicly flags a bad actor's account.
- **Loan calculator** on bank-acquired listings, since those are almost always bought via financing.

See [`docs/TrustHome_PH_System_Build_Plan.pdf`](./docs/TrustHome_PH_System_Build_Plan.pdf) for the full technical breakdown of how each feature actually works.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend (web) | React (JavaScript) |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| File storage (photos, ID docs) | Cloudinary *(not Firebase Storage — see note below)* |
| Scheduled jobs | Cloud Functions for Firebase |
| Hosting | Firebase Hosting |
| Bank scraper | Python (`requests` + `BeautifulSoup`) → writes to Firestore via `firebase-admin` |
| Scraper scheduling | GitHub Actions (scheduled workflow) |
| Future mobile app | React Native (planned — not yet built) |

> **Why Cloudinary instead of Firebase Storage:** as of Feb 2026, Firebase Storage requires a linked billing account (credit card), even on the free tier. Firestore and Auth are unaffected. Cloudinary's free tier needs no card, so file uploads (listing photos, ID/ownership documents) go through Cloudinary instead. Full reasoning in [`docs/TrustHome_PH_Firebase_Setup_Plan.pdf`](./docs/TrustHome_PH_Firebase_Setup_Plan.pdf).

Firebase Storage remains a possible future migration if the team later approves Blaze billing and has an appropriate payment method. It is intentionally not part of the current no-billing architecture.

**Platform note:** renter/homeowner-facing pages are designed **mobile-portrait** (most users are on phones). Admin pages are designed **desktop-landscape** (admins work from a laptop). Both live in the same React codebase. Native mobile app is an explicitly planned future phase, not part of this capstone's scope.

---

## Project Structure

```
trusthome-ph/
├── web/                    # React web app (renter/owner/admin UI)
│   ├── src/
│   │   ├── firebase.js     # Firebase (Firestore + Auth) config
│   │   ├── uploadImage.js  # Cloudinary upload helper
│   │   └── ...
│   └── package.json
│
├── bank_scraper/           # Python scraper — BDO / Landbank / Metrobank
│   ├── scraper.py          # per-bank scraping functions
│   ├── database.py         # Firestore upsert/dedup logic
│   ├── scheduler.py        # local scheduling loop (dev use)
│   ├── requirements.txt
│   └── .github/workflows/scrape.yml   # scheduled cloud run (production use)
│
├── docs/                   # All planning & design documentation
│   ├── TrustHome_PH_System_Build_Plan.pdf
│   ├── TrustHome_PH_Design_Guide.pdf
│   ├── TrustHome_PH_Versioning_Plan.pdf
│   ├── TrustHome_PH_Firebase_Setup_Plan.pdf
│   ├── TrustHome_PH_HighFidelity_Pages.svg
│   └── TrustHome_PH_SWOT_Analysis.docx
│
└── README.md                # you are here
```

---

## Getting Started

**First time setup for the whole team:** follow [`docs/TrustHome_PH_Firebase_Setup_Plan.pdf`](./docs/TrustHome_PH_Firebase_Setup_Plan.pdf) start to finish — it covers creating the shared Firebase project, Cloudinary account, and getting every teammate's local config set up. Do this once, together, before anyone starts building.

### Web app

```bash
cd web
npm install
npm start          # runs locally at http://localhost:3000
```

Requires `src/firebase.js` to exist with your project's config (see Setup Plan, Step 8) — this file is git-ignored since configs can differ per environment; copy `src/firebase.example.js` if present, or paste the config from the team's Firebase Console.

### Bank scraper

```bash
cd bank_scraper
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
python scraper.py
```

The scraper requires credentials outside this repository. Set `GOOGLE_APPLICATION_CREDENTIALS`
to the key path or provide `FIREBASE_SERVICE_ACCOUNT_JSON` (see the scraper README).

For a demo dataset, use `bank_scraper/seed_demo_data.py`. It uses clearly labeled synthetic records and placeholder verification documents, so no real identity or ownership papers are needed:

```bash
cd bank_scraper
python seed_demo_data.py --dry-run
python seed_demo_data.py
```

### Trust-score recomputation without billing

The active v0.2 setup does not require Cloud Functions or a billing-enabled Firebase project. GitHub Actions runs `bank_scraper/trust_scores.py` after the Metrobank scrape, using the existing `FIREBASE_SERVICE_ACCOUNT` repository secret. The local worker runs the same recomputation after a manually queued scrape.

The optional `functions/` implementation is retained for a future migration to scheduled Cloud Functions. Do not deploy it while the project is avoiding billing.

---

## Documentation Index

| Document | What's in it |
|---|---|
| `TrustHome_PH_System_Build_Plan.pdf` | Full Firestore data model, and exactly how each feature's logic works (booking conflict check, trust score formula, dispute flow, scraper upsert logic). |
| `TrustHome_PH_Design_Guide.pdf` | Page inventory (20 pages), low-fidelity wireframe rules, and the full high-fidelity design system (colors, type, spacing, components). |
| `TrustHome_PH_Versioning_Plan.pdf` | 4-week release plan (v0.1 → v1.0), feature-to-owner assignments, and how it maps to the SoftDev Midterm and Scrum Weekly Report submissions. |
| `TrustHome_PH_Firebase_Setup_Plan.pdf` | Step-by-step Firebase + Cloudinary project setup for the whole team. |
| `TrustHome_PH_HighFidelity_Pages.svg` | All 20 pages mocked up (mobile-portrait for users, desktop-landscape for admin) — importable into Figma. |
| `TrustHome_PH_SWOT_Analysis.docx` | SWOT/TOWS analysis and reflection for the project. |

---

## Roadmap (1-Month Plan)

| Version | Week | Focus |
|---|---|---|
| v0.1 | Week 1 | Foundations — auth, listings, verification, search *(30% Midterm milestone)* |
| v0.2 | Week 2 | Trust Engine — booking calendar, ratings, trust score |
| v0.3 | Week 3 | Accountability & Integration — disputes, bank catalog, loan calculator |
| v1.0 | Week 4 | Final Release — dashboards, polish, full QA, defense prep |

Full breakdown with per-member weekly assignments in `docs/TrustHome_PH_Versioning_Plan.pdf`.

---

## Known Limitations (stated honestly, not hidden)

- Document review filters casual fraud (fake IDs, stolen photos) — it is **not** a legal title search.
- TrustHome does not custody deposit funds; protection comes from a public, permanent dispute-flag system, not fund escrow.
- The bank-acquired property catalog depends on manually-mapped scraper selectors per bank, refreshed on a fixed schedule — not a live data partnership with any bank.
- The current live catalog scope is Metrobank only because it already provides a large usable property supply. Landbank and BDO are future scraper integrations; they are not currently scraped or presented as active sources.
- Uploaded documents (Cloudinary, unsigned preset) are unlisted but not cryptographically private.

These are intentional, disclosed scope decisions — see the SWOT analysis and System Build Plan for the reasoning behind each one.
