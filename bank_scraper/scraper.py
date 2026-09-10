"""
One function per bank. Each returns a list of dicts shaped like:

    {
        "reference_no": "R-2024002140",   # required, this is the unique key
        "title": "...",
        "location": "...",
        "price": "...",
        "floor_area": "...",
        "lot_area": "...",
        "listing_url": "...",
        "image_url": "...",
    }

Run this file directly to scrape all three banks once and save to the database:
    python scraper.py
"""

import time
import requests
from bs4 import BeautifulSoup

from database import init_db, upsert_properties

HEADERS = {
    # Identify honestly as a browser-like client; some sites block requests
    # with no User-Agent at all.
    "User-Agent": "Mozilla/5.0 (capstone-project-scraper)"
}

REQUEST_DELAY_SECONDS = 2  # be a polite scraper — don't hammer their server


# ---------------------------------------------------------------------------
# LANDBANK
# ---------------------------------------------------------------------------
def scrape_landbank() -> list[dict]:
    url = "https://www.landbank.com/property-for-sale"
    response = requests.get(url, headers=HEADERS, timeout=15)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    listings = []

    # TODO: verify selector — inspect the real page and replace ".property-card"
    # with whatever actually wraps each listing.
    for card in soup.select(".property-card"):
        reference_no = card.get("data-ref") or card.select_one(".ref-no")
        title = card.select_one(".property-title")
        location = card.select_one(".property-location")
        price = card.select_one(".property-price")
        link = card.select_one("a")
        image = card.select_one("img")

        if not reference_no:
            continue  # skip anything we can't uniquely identify

        listings.append({
            "reference_no": reference_no.get_text(strip=True) if hasattr(reference_no, "get_text") else str(reference_no),
            "title": title.get_text(strip=True) if title else None,
            "location": location.get_text(strip=True) if location else None,
            "price": price.get_text(strip=True) if price else None,
            "floor_area": None,
            "lot_area": None,
            "listing_url": link["href"] if link and link.has_attr("href") else url,
            "image_url": image["src"] if image and image.has_attr("src") else None,
        })

    return listings


# ---------------------------------------------------------------------------
# METROBANK
# ---------------------------------------------------------------------------
def scrape_metrobank() -> list[dict]:
    url = "https://www.metrobank.com.ph/loans/assets-for-sale"
    response = requests.get(url, headers=HEADERS, timeout=15)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    listings = []

    # TODO: verify selector — same idea as Landbank above.
    for card in soup.select(".asset-item"):
        reference_no = card.select_one(".control-no")
        title = card.select_one(".asset-title")
        location = card.select_one(".asset-location")
        price = card.select_one(".asset-price")
        link = card.select_one("a")
        image = card.select_one("img")

        if not reference_no:
            continue

        listings.append({
            "reference_no": reference_no.get_text(strip=True),
            "title": title.get_text(strip=True) if title else None,
            "location": location.get_text(strip=True) if location else None,
            "price": price.get_text(strip=True) if price else None,
            "floor_area": None,
            "lot_area": None,
            "listing_url": link["href"] if link and link.has_attr("href") else url,
            "image_url": image["src"] if image and image.has_attr("src") else None,
        })

    return listings


# ---------------------------------------------------------------------------
# BDO — loads listings dynamically, so plain requests may return an empty
# shell. Try the JSON-API approach first (see README). This function assumes
# you found that API endpoint via DevTools and are calling it directly.
# ---------------------------------------------------------------------------
def scrape_bdo() -> list[dict]:
    # TODO: replace with the real API endpoint you found in DevTools -> Network -> Fetch/XHR
    api_url = "https://www.bdo.com.ph/api/PLACEHOLDER-real-estate-search"

    response = requests.get(api_url, headers=HEADERS, timeout=15)
    response.raise_for_status()
    data = response.json()  # assuming it returns JSON — adjust if it's shaped differently

    listings = []
    for item in data.get("results", []):  # TODO: adjust key name to match real response
        listings.append({
            "reference_no": item.get("propertyCode"),
            "title": item.get("title"),
            "location": item.get("location"),
            "price": item.get("price"),
            "floor_area": item.get("floorArea"),
            "lot_area": item.get("lotArea"),
            "listing_url": f"https://www.bdo.com.ph/personal/assets-for-sale/real-estate/details-page?propertyCode={item.get('propertyCode')}",
            "image_url": item.get("imageUrl"),
        })

    return listings


# ---------------------------------------------------------------------------
# BDO fallback — use this instead of scrape_bdo() above if no JSON API exists
# and the page truly only renders via JavaScript. Requires:
#     pip install playwright
#     playwright install chromium
# ---------------------------------------------------------------------------
# from playwright.sync_api import sync_playwright
#
# def scrape_bdo_with_browser() -> list[dict]:
#     listings = []
#     with sync_playwright() as p:
#         browser = p.chromium.launch(headless=True)
#         page = browser.new_page()
#         page.goto("https://www.bdo.com.ph/personal/assets-for-sale/real-estate/results-page")
#         page.wait_for_selector(".property-card")  # TODO: verify selector
#         cards = page.query_selector_all(".property-card")
#         for card in cards:
#             # TODO: extract fields the same way, using card.query_selector(...)
#             pass
#         browser.close()
#     return listings


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------
SCRAPERS = {
    "landbank": scrape_landbank,
    "metrobank": scrape_metrobank,
    "bdo": scrape_bdo,
}


def run_banks(banks=None):
    init_db()
    selected_banks = [bank.lower() for bank in (banks or SCRAPERS)]

    for bank_name in selected_banks:
        scrape_fn = SCRAPERS.get(bank_name)
        if not scrape_fn:
            print(f"[{bank_name}] SKIPPED: unsupported bank")
            continue
        try:
            print(f"Scraping {bank_name}...")
            listings = scrape_fn()
            upsert_properties(bank_name, listings)
        except Exception as e:
            # One bank failing (e.g. site redesign) shouldn't crash the whole run
            print(f"[{bank_name}] FAILED: {e}")
        time.sleep(REQUEST_DELAY_SECONDS)


def run_all():
    run_banks()


if __name__ == "__main__":
    run_all()
