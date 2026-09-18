# Bank Property Scraper — Starter Project

Scrapes publicly listed acquired/foreclosed properties from BDO, Landbank, and Metrobank
directly into your team's **Firestore** database, using each listing's own reference
number as part of the document ID so re-running the scraper updates instead of duplicating.

## Firestore setup (do this once, per machine that runs the scraper)

1. In the [Firebase Console](https://console.firebase.google.com), open your project →
   **Project Settings** (gear icon) → **Service Accounts** tab.
2. Click **Generate new private key** — this downloads a JSON file.
3. Keep it outside this repository; set `GOOGLE_APPLICATION_CREDENTIALS` to its absolute path, or provide the JSON through `FIREBASE_SERVICE_ACCOUNT_JSON`. For local-only testing you may place it in this folder as `serviceAccountKey.json`. **Never commit or share this file** — it is a full admin credential for Firebase.

This is a different, separate step from setting up the React web app's Firebase config —
the web app uses a public client-side config (safe to expose), while this scraper uses a
private admin credential (never expose this one).

## Why this needs no Linux server

"Cron job" just means *"run this script automatically on a schedule."* That concept exists
everywhere — you're not locked into Linux:

| Where you are | How to schedule it |
|---|---|
| **Developing in VS Code (Windows/Mac)** | Just run `python scheduler.py` and leave the terminal open — it loops and triggers itself. |
| **Windows, no code running 24/7** | Use built-in **Task Scheduler** to run `python scraper.py` daily. No extra software needed. |
| **Deployed for your defense/demo** | Use a free **GitHub Actions** scheduled workflow (included below) — GitHub runs it in the cloud on a timer, so nothing needs to stay on locally at all. |

For your capstone demo day, the realistic setup is: GitHub Actions runs the scraper and
trust-score refresh automatically in the background before your defense, **plus** a manual
"Run Scraper Now" button backed by `worker.py` so you can trigger it live if a panelist asks
to see it work.

## Setup (in VS Code)

```bash
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # Mac/Linux
pip install -r requirements.txt
python scraper.py            # runs once, immediately
python scraper.py --dry-run landbank metrobank  # parse sources without Firestore writes
python seed_demo_data.py --dry-run              # preview synthetic demo data
python seed_demo_data.py                        # write synthetic demo data to Firestore
```

## Files

- `database.py` — connects to Firestore and handles insert/update/delisting logic,
   keyed by document ID (`{bank}_{reference_no}`).
- `scraper.py` — one function per bank (`scrape_landbank()`, `scrape_metrobank()`,
   `scrape_bdo()`). Each returns a list of normalized property dicts.
- `worker.py` — consumes `scraperJobs` created by the admin panel and runs requested banks.
- `trust_scores.py` — recomputes the public trust-score cache with the same Admin SDK credential, without Cloud Functions.
- `seed_demo_data.py` — writes repeatable synthetic listings, bookings, ratings, disputes, users, and Metrobank properties for testing.
- `scheduler.py` — runs the scraper automatically every N hours, for local testing
   without Task Scheduler or GitHub Actions.
- `.github/workflows/scrape.yml` — GitHub Actions config that runs the scraper and
   trust-score refresh on a schedule in the cloud. Add the service-account JSON as a
   GitHub Actions secret named `FIREBASE_SERVICE_ACCOUNT`; the workflow passes it through the environment.

## ⚠️ Before this actually works, you must do this one manual step per bank

I could not inspect the *live rendered* HTML of these pages myself, so the CSS selectors
in `scraper.py` are marked `# TODO: verify selector` — realistic placeholders based on
common listing-page patterns, not guaranteed to match exactly. To fix each one:

1. Open the bank's listing page in Chrome.
2. Right-click a property card → **Inspect**.
3. Note the actual tag/class names wrapping the title, price, location, and reference number.
4. Update the matching selector in `scraper.py`.

**For BDO specifically:** its results page loads listings via a background request, not
in the initial HTML. Before writing a scraper for it:
1. Open BDO's real estate results page in Chrome.
2. Open DevTools → **Network** tab → filter by **Fetch/XHR**.
3. Reload the page or run a search.
4. Look for a request that returns JSON (not HTML) containing property data.
5. If you find one, just call that URL directly with `requests.get()` — this is *easier*
   and more reliable than scraping HTML, since JSON has a fixed structure that won't shift
   with a redesign.
6. If no such request appears (all rendering happens client-side with no clean API), you'll
   need `playwright` instead of `requests` to load the page in a real headless browser
   before parsing it — a fallback function using Playwright is included and commented out.

This inspection step is normal, expected scraper-development work — every real scraper
project starts this way, and it's a fine thing to say plainly in your defense: *"we
inspected each bank's page structure and adapted our parser to it."*

## Admin button flow

The React admin button creates a `scraperJobs` document with status `queued`. It does not
run Python in the browser. Start `python worker.py` in a trusted Python environment to
poll that collection, run the requested banks, write `bankProperties`, and mark the job
`completed` or `failed`.
For the first live parser test, run only the two verified source strategies:

```bash
python scraper.py --dry-run landbank metrobank
```

BDO remains disabled for production scraping until its browser/API endpoint is verified.
