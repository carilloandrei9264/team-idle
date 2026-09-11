"""
Optional: run this instead of calling scraper.py manually every time.
Leave this running in a VS Code terminal and it will re-scrape automatically
on the interval you set below — useful for local testing without needing
Windows Task Scheduler or GitHub Actions set up yet.

    python scheduler.py
"""

import schedule
import time
try:
    from .scraper import run_all
except ImportError:
    from scraper import run_all

# Change this to whatever cadence makes sense (e.g. every 1 day for real use,
# every few minutes while you're testing that it works).
RUN_EVERY_HOURS = 24

schedule.every(RUN_EVERY_HOURS).hours.do(run_all)

if __name__ == "__main__":
    print(f"Scheduler started — scraping every {RUN_EVERY_HOURS} hour(s). Press Ctrl+C to stop.")
    run_all()  # run once immediately on startup, then wait for the schedule
    while True:
        schedule.run_pending()
        time.sleep(60)
