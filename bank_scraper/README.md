# Bank Property Catalog and Scraper

The public bank-acquired property catalog currently supports **Metrobank only**.
Its scraper reads listing data from Metrobank's JSON endpoint and writes normalized
records to Firestore's `bankProperties` collection. BDO and Landbank parsers are
unverified; they are available for network diagnostics only and are blocked from
production writes. Do not treat their results as catalog-ready.

The web catalog filters by bank, location, and budget; sorts by price; and paginates
results. The listing detail page shows the collected information and a loan estimate.
Users should verify availability, property details, and financing directly with the
bank. Scraped content may become stale and is not an endorsement.

The scraper validates that records have a reference number and a usable price. If a
run returns no valid listings, it fails without changing the existing catalog. On a
successful run, records are upserted using a deterministic bank/reference document ID;
previously active records absent from that source run are marked `delisted`, not
deleted. A site/API change can still affect data quality, so review output and spot
check the bank's source.

## Run locally

From this directory:

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate
pip install -r requirements.txt
```

For safe parser checks, use a dry run. It makes requests to the selected public source
but does not initialize Firebase or write data:

```bash
python scraper.py --dry-run metrobank
python scraper.py --dry-run landbank
python scraper.py --dry-run bdo
```

Only the default Metrobank run is allowed to write:

```bash
python scraper.py
```

Passing an unverified source to the normal runner (for example, `python scraper.py bdo`)
is blocked and exits with an error. `--dry-run` is diagnostic only; it is not proof that
a source is complete or safe to activate.

### Firebase credentials

The writing scraper and worker use a Firebase Admin service-account credential. In the
[Firebase Console](https://console.firebase.google.com), open **Project Settings →
Service Accounts** and generate a private key. Store it outside the repository and set
`GOOGLE_APPLICATION_CREDENTIALS` to its absolute path, or provide the credential JSON
through `FIREBASE_SERVICE_ACCOUNT_JSON`. For local-only work, `serviceAccountKey.json`
in this directory is supported if it remains untracked. Never commit or share the key:
it grants administrative access. This private credential is separate from the
client-side Firebase configuration used by the web app.

### Demo data and tests

The seed script writes synthetic data to Firestore, so preview first and only write to
an intentional test/demo project:

```bash
python seed_demo_data.py --dry-run
python seed_demo_data.py
python -m unittest discover -s . -p "test_*.py"
```

## Scheduling and admin-triggered runs

The scraper can be run on a schedule using any trusted host:

| Where you are | How to schedule it |
|---|---|
| **Developing in VS Code (Windows/Mac)** | Just run `python scheduler.py` and leave the terminal open — it loops and triggers itself. |
| **Windows, no code running 24/7** | Use built-in **Task Scheduler** to run `python scraper.py` daily. No extra software needed. |
| **Deployed for your defense/demo** | Use the **GitHub Actions** scheduled workflow in `.github/workflows/scrape.yml` after configuring its required credential secret. |

## Files

- `database.py` — connects to Firestore and upserts/delists properties in `bankProperties`.
- `scraper.py` — scrapes Metrobank and contains unverified BDO/Landbank diagnostics.
- `worker.py` — polls `scraperJobs` created by the admin panel and processes queued
   jobs. Run it in a trusted environment with the Admin credential; it polls every
   15 seconds and processes one queued job at a time.
- `trust_scores.py` — recomputes the public trust-score cache with the same Admin SDK credential, without Cloud Functions.
- `complete_expired_bookings.py` — marks ended confirmed bookings as `Completed` without any paid Firebase Functions runtime.
- `seed_demo_data.py` — writes repeatable synthetic listings, bookings, ratings, disputes, users, and Metrobank properties for testing.
- `scheduler.py` — runs the scraper automatically every configured interval for local testing.
- `.github/workflows/scrape.yml` — scheduled GitHub Actions workflow. Configure its
   required Firebase credential secret before enabling scheduled writes.
- `test_*.py` — scraper and data-operation tests, runnable with the unittest command above.

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

**Application compatibility gate:** the current web app still uploads and previews
direct URL fields (`ownershipDocumentUrl` and `governmentIdUrl`). It does not yet resolve
`listingPrivate.documents` metadata into authenticated short-lived delivery URLs. Do not
run this migration with `--apply` on the live project until that secure delivery path is
implemented, deployed, and tested with the admin preview/download flow. A Firestore
backup alone does not make the migrated documents usable by the current UI.

## Admin button flow

The React admin button creates a `scraperJobs` document with status `queued`; Python
does not run in the browser. Start `python worker.py` in a trusted Python environment
to poll that collection. The worker invokes the same production allowlist as the
command-line runner, so only Metrobank can be written. Check the job status and its
`successfulBanks`/`failedBanks` result in Firestore or the admin page.

```bash
python worker.py
```

The admin "Clear catalog" action deletes every document in `bankProperties`, including
records outside the currently enabled source. Use it only in an intentional test/demo
environment.
