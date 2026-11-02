"""Process scraperJobs created by the TrustHome admin panel.

Run locally with:
    python worker.py

The worker uses the same Firebase credential environment variables as
database.py and never exposes credentials to the React application.
"""

import time

from firebase_admin import firestore
try:
    from .database import get_db, get_queued_jobs
    from .scraper import DEFAULT_BANKS, run_banks
    from .trust_scores import recompute_trust_scores
except ImportError:
    from database import get_db, get_queued_jobs
    from scraper import DEFAULT_BANKS, run_banks
    from trust_scores import recompute_trust_scores

POLL_SECONDS = 15


def process_one_job(job):
    job_ref = get_db().collection("scraperJobs").document(job.id)
    job_data = job.to_dict()
    job_ref.update({"status": "running", "startedAt": firestore.SERVER_TIMESTAMP})

    try:
        result = run_banks(job_data.get("banks") or DEFAULT_BANKS)
        if not result["successful"]:
            raise RuntimeError(f"All requested banks failed: {', '.join(result['failed'])}")
        recompute_trust_scores()
        job_ref.update({
            "status": "completed",
            "completedAt": firestore.SERVER_TIMESTAMP,
            "successfulBanks": result["successful"],
            "failedBanks": result["failed"],
        })
    except Exception as error:
        job_ref.update({"status": "failed", "completedAt": firestore.SERVER_TIMESTAMP, "error": str(error)[:500]})
        print(f"[{job.id}] FAILED: {error}")


def run_worker():
    print(f"Scraper worker started; polling every {POLL_SECONDS} seconds.")
    while True:
        jobs = get_queued_jobs()
        if jobs:
            process_one_job(jobs[0])
        else:
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    run_worker()