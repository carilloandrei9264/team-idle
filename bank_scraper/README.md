# Bank Property Catalog and Scraper

The scraper contains parsers for publicly listed acquired/foreclosed properties from BDO, Landbank, and Metrobank. **Metrobank is the only source currently intended for production writes.** The Landbank parser is unverified, and the BDO parser still contains a placeholder endpoint.

The Metrobank scraper writes normalized records to your team's **Firestore** database,
using each listing's reference number in the document ID so repeat runs update records
instead of duplicating them.

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
python scraper.py --dry-run metrobank           # inspect the active source without Firestore writes
python scraper.py --dry-run landbank             # diagnostic only; parser is unverified
python scraper.py --dry-run bdo                   # diagnostic only; endpoint is a placeholder
python seed_demo_data.py --dry-run              # preview synthetic demo data
python seed_demo_data.py                        # write synthetic demo data to Firestore
```

`python scraper.py` defaults to Metrobank. The command-line runner and admin worker
currently accept explicitly selected BDO or Landbank parsers too; they do not enforce a
production-source allowlist. Do not pass or queue those sources for normal writes until
their parser and data quality have been verified.

Run the scraper tests from this directory with:

```bash
python -m unittest discover -s . -p "test_*.py"
```

## Files

- `database.py` — connects to Firestore and handles insert/update/delisting logic,
   keyed by document ID (`{bank}_{reference_no}`).
- `scraper.py` — one function per bank (`scrape_landbank()`, `scrape_metrobank()`,
   `scrape_bdo()`). Each returns a list of normalized property dicts.
- `worker.py` — consumes `scraperJobs` created by the admin panel and runs requested banks.
- `trust_scores.py` — recomputes the public trust-score cache with the same Admin SDK credential, without Cloud Functions.
- `complete_expired_bookings.py` — marks ended confirmed bookings as `Completed` without any paid Firebase Functions runtime.
- `seed_demo_data.py` — writes repeatable synthetic listings, bookings, ratings, disputes, users, and Metrobank properties for testing.
- `scheduler.py` — runs the scraper automatically every N hours, for local testing
   without Task Scheduler or GitHub Actions.
- `.github/workflows/scrape.yml` — GitHub Actions config that runs the scraper and
   trust-score refresh on a schedule in the cloud. Add the service-account JSON as a
   GitHub Actions secret named `FIREBASE_SERVICE_ACCOUNT`; the workflow passes it through the environment.

## Verification-document privacy migration

Before any live migration, create and verify a private JSONL backup:

```bash
python backup_firestore.py
python restore_firestore.py "$HOME/TrustHomeBackups/backup-YYYYMMDD-HHMMSS.jsonl"
```

The restore command is a dry run unless `--apply` is supplied. Keep backup files
outside the repository in an access-controlled location; they contain personal
data. The backup command defaults to a timestamped file under the current user's
home directory. Replace `YYYYMMDD-HHMMSS` with the timestamp printed by the backup
command. Never test a restore against the live project.

The migration at `migrate_verification_documents.py` is dry-run by default. Before
applying it, take and verify a Firestore JSON backup. Review the dry-run counts and
confirm the Cloudinary cloud name matches the project. The dry run does not print
document URLs.

Applying the migration also requires `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
and `CLOUDINARY_API_SECRET` in the trusted machine's environment, plus the Firestore
Admin credential described above. Keep the API secret in a password manager or host
secret store; never put it in Git, the workbook, logs, or chat. Then run:

```bash
python migrate_verification_documents.py --apply
```

The script converts eligible Cloudinary assets to authenticated delivery, writes
`publicId`/`format`/`resourceType` metadata under `listingPrivate.documents`, and removes
legacy URL fields only for successfully converted assets. Unrecognized URLs and
conversion failures remain untouched and are counted for manual review. After applying,
wait about 10 minutes and verify old delivery URLs no longer work before marking F-16
closed. Never run this against the live project without the backup and review steps.

## Source readiness

- **Metrobank** is the default and only source intended for production writes. It reads
  the bank's JSON endpoint and paginates results.
- **Landbank** has an unverified HTML parser. A dry run may help diagnose source changes,
  but its output must be reviewed before enabling writes.
- **BDO** is not implemented: its configured API URL is a placeholder. Its dry run is
  expected to fail until a real source endpoint and parser are verified.

The CLI and worker currently allow explicitly requested bank names; this is not a
production safety allowlist. Only run the default Metrobank job against the live
catalog. Treat other sources as unavailable until their URLs, parsed fields, and data
quality have been reviewed.

## Admin button flow

The React admin button creates a `scraperJobs` document with status `queued`. It does not
run Python in the browser. Start `python worker.py` in a trusted Python environment to
poll that collection, run the requested banks, write `bankProperties`, and mark the job
`completed` or `failed`.
For the first live parser test, use Metrobank only. A dry run fetches and parses data
without initializing Firebase or writing to Firestore:

```bash
python scraper.py --dry-run metrobank
```

BDO and Landbank remain future integrations. Metrobank remains the default production source.
