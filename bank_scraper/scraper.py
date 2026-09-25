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

from __future__ import annotations  # lets list[dict]-style hints run on Python 3.8

import time
import re
import argparse
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

try:
    from .database import init_db, upsert_properties
except ImportError:
    from database import init_db, upsert_properties

HEADERS = {
    # Identify honestly as a browser-like client; some sites block requests
    # with no User-Agent at all.
    "User-Agent": "Mozilla/5.0 (capstone-project-scraper)"
}

REQUEST_DELAY_SECONDS = 2  # be a polite scraper — don't hammer their server
DEFAULT_BANKS = ["metrobank"]

LANDBANK_URL = "https://www.landbank.com/property-for-sale"
METROBANK_URL = "https://www.metrobank.com.ph/assets-for-sale/properties"
METROBANK_API_URL = "https://www.metrobank.com.ph/.netlify/functions/ropa-request/assets"
METROBANK_IMAGE_BASE = "https://metrobank-ropa-prod.s3.ap-southeast-1.amazonaws.com"
METROBANK_PAGE_SIZE = 12  # matches the size Metrobank's own site requests; larger values 500'd


# ---------------------------------------------------------------------------
# LANDBANK
# ---------------------------------------------------------------------------
def scrape_landbank() -> list[dict]:
    response = requests.get(LANDBANK_URL, headers=HEADERS, timeout=30)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    listings = []

    for row in soup.select("table tbody tr"):
        cells = [clean_text(cell.get_text(" ", strip=True)) for cell in row.select("th, td")]
        if len(cells) < 3:
            continue
        link = row.select_one("a[href]")
        reference_no = cells[0]
        listings.append({
            "reference_no": reference_no,
            "title": cells[1] if len(cells) > 1 else "Landbank property",
            "location": cells[2] if len(cells) > 2 else None,
            "price": cells[3] if len(cells) > 3 else None,
            "floor_area": extract_measurement(cells, "floor"),
            "lot_area": extract_measurement(cells, "lot"),
            "listing_url": urljoin(LANDBANK_URL, link["href"]) if link else LANDBANK_URL,
            "image_url": None,
        })

    if not listings:
        for card in soup.select(".property-card, .property-listing, [class*='property-card'], [class*='property-item']"):
            reference = card.select_one(".ref-no, [class*='reference'], [class*='ref']")
            if not reference:
                continue
            link = card.select_one("a[href]")
            image = card.select_one("img[src]")
            listings.append({
                "reference_no": clean_text(reference.get_text(" ", strip=True)),
                "title": text_from(card, ".property-title, [class*='title']"),
                "location": text_from(card, ".property-location, [class*='location'], [class*='address']"),
                "price": text_from(card, ".property-price, [class*='price']"),
                "floor_area": text_from(card, "[class*='floor']"),
                "lot_area": text_from(card, "[class*='lot']"),
                "listing_url": urljoin(LANDBANK_URL, link["href"]) if link else LANDBANK_URL,
                "image_url": urljoin(LANDBANK_URL, image["src"]) if image else None,
            })

    if not listings:
        listings = parse_landbank_text(soup)

    if not listings:
        raise RuntimeError("Landbank page loaded, but no property records matched the parser.")
    return listings


# ---------------------------------------------------------------------------
# METROBANK — the listing page loads its data from a JSON API rather than
# rendering server-side, so we call that API directly instead of scraping
# HTML or downloading the property-list PDF. Found via DevTools -> Network:
#   GET /.netlify/functions/ropa-request/assets?page=N&order=newest&display=50
# Each property record already includes a numeric `defaultImage` id that
# maps straight onto the S3 bucket Metrobank serves photos from, so no
# second request per property is needed for images.
# ---------------------------------------------------------------------------
def scrape_metrobank() -> list[dict]:
    listings = []
    page = 1
    while True:
        page_items, row_count = fetch_metrobank_page(page)
        if not page_items:
            break
        listings.extend(metrobank_item_to_listing(item) for item in page_items)
        if len(listings) >= row_count or len(page_items) < METROBANK_PAGE_SIZE:
            break
        page += 1
        time.sleep(REQUEST_DELAY_SECONDS)
    return listings


def fetch_metrobank_page(page: int, attempts: int = 3) -> tuple[list[dict], int]:
    # The API occasionally 500s on an otherwise-valid page; a couple of
    # retries with backoff gets past transient failures without a human
    # having to notice and re-run the whole scrape.
    last_error = None
    for attempt in range(1, attempts + 1):
        try:
            response = requests.get(
                METROBANK_API_URL,
                params={"page": page, "order": "newest", "display": METROBANK_PAGE_SIZE},
                headers={**HEADERS, "Accept": "application/json", "Referer": METROBANK_URL},
                timeout=30,
            )
            response.raise_for_status()
            payload = response.json()
            return payload.get("result", []), payload.get("rowCount", 0)
        except requests.HTTPError as error:
            last_error = error
            status = error.response.status_code if error.response is not None else None
            if status and status < 500:
                raise  # a 4xx means something's wrong with the request itself — don't retry
        except (requests.Timeout, requests.ConnectionError) as error:
            # A slow or dropped connection is worth retrying — it says nothing
            # about whether the request itself was valid.
            last_error = error
        if attempt < attempts:
            print(f"  [metrobank] page {page} attempt {attempt} failed ({last_error!r}), retrying...")
            time.sleep(attempt * 3)
    raise last_error


def metrobank_item_to_listing(item: dict) -> dict:
    reference_no = item.get("propAcctNo")
    location = clean_text(", ".join(filter(None, [
        item.get("address") or item.get("city"), item.get("province"),
    ]))) or None
    image_id = item.get("defaultImage")
    return {
        "reference_no": reference_no,
        "title": clean_text(" ".join(filter(None, [item.get("propCategory"), item.get("propType")]))) or "Metrobank acquired property",
        "location": location,
        "price": item.get("price"),  # already a plain number from the API
        "floor_area": format_area(item.get("floorArea"), item.get("floorAreaUnit")),
        "lot_area": format_area(item.get("lotArea"), item.get("lotUnit")),
        "listing_url": f"https://www.metrobank.com.ph/assets-for-sale/properties/details?id={reference_no}",
        "image_url": f"{METROBANK_IMAGE_BASE}/{image_id}" if image_id else None,
    }


def format_area(value, unit):
    if value in (None, ""):
        return None
    return f"{value} {unit}".strip() if unit else str(value)


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
    selected_banks = [bank.lower() for bank in (banks or DEFAULT_BANKS)]
    successful_banks = []
    failed_banks = []

    for bank_name in selected_banks:
        scrape_fn = SCRAPERS.get(bank_name)
        if not scrape_fn:
            print(f"[{bank_name}] SKIPPED: unsupported bank")
            continue
        try:
            print(f"Scraping {bank_name}...")
            listings = validate_listings(scrape_fn())
            upsert_properties(bank_name, listings)
            successful_banks.append(bank_name)
        except Exception as e:
            # One bank failing (e.g. site redesign) shouldn't crash the whole run
            print(f"[{bank_name}] FAILED: {e}")
            failed_banks.append(bank_name)
        time.sleep(REQUEST_DELAY_SECONDS)

    return {"successful": successful_banks, "failed": failed_banks}


def dry_run(banks):
    """Fetch and parse sources without initializing Firebase or writing data."""
    for bank_name in banks:
        scrape_fn = SCRAPERS.get(bank_name.lower())
        if not scrape_fn:
            print(f"[{bank_name}] SKIPPED: unsupported bank")
            continue
        try:
            listings = validate_listings(scrape_fn())
            print(f"[{bank_name}] parsed {len(listings)} properties")
            for listing in listings[:3]:
                print(f"  - {listing.get('reference_no')}: {listing.get('title')}")
        except Exception as error:
            print(f"[{bank_name}] FAILED: {error}")


def run_all():
    run_banks(DEFAULT_BANKS)


def clean_text(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def is_valid_listing(listing):
    """Return whether a scraped record has the identity needed for upsert."""
    return isinstance(listing, dict) and bool(clean_text(listing.get("reference_no")))


def validate_listings(listings):
    """Reject malformed rows and fail closed when a source returns no usable data."""
    valid = [listing for listing in listings if is_valid_listing(listing)]
    skipped = len(listings) - len(valid)
    if skipped:
        print(f"Skipped {skipped} malformed property records.")
    if not valid:
        raise RuntimeError("Scraper returned no valid property records; existing catalog was left unchanged.")
    return valid


def text_from(node, selector):
    match = node.select_one(selector)
    return clean_text(match.get_text(" ", strip=True)) if match else None


def extract_measurement(cells, label):
    for index, cell in enumerate(cells):
        if label in cell.lower() and index + 1 < len(cells):
            return cells[index + 1]
    return None


def find_pdf_link(soup, base_url):
    for link in soup.select("a[href]"):
        href = link["href"]
        label = link.get_text(" ", strip=True).lower()
        if href.lower().endswith(".pdf") or "download property list" in label:
            return urljoin(base_url, href)
    return None


def is_header_row(cells):
    joined = " ".join(cells).lower()
    return "property no" in joined or ("tct" in joined and "address" in joined)


def find_value(cells, label):
    for index, cell in enumerate(cells):
        if label in cell.lower() and index + 1 < len(cells):
            return cells[index + 1]
    return None


def parse_landbank_text(soup):
    """Fallback for pages whose records are rendered as text blocks."""
    listings = []
    for link in soup.select("a[href]"):
        text = clean_text(link.parent.get_text(" ", strip=True))
        match = re.search(r"(?:property|reference|ref(?:erence)?)[\s#:.-]*([A-Z0-9-]{4,})", text, re.I)
        if not match:
            continue
        listings.append({
            "reference_no": match.group(1),
            "title": clean_text(link.get_text(" ", strip=True)) or "Landbank property",
            "location": text,
            "price": None,
            "floor_area": None,
            "lot_area": None,
            "listing_url": urljoin(LANDBANK_URL, link["href"]),
            "image_url": None,
        })
    return listings


def value_for_header(cells, indexes, fragment):
    for header, index in indexes.items():
        if fragment in header and index < len(cells):
            return cells[index]
    return None


def parse_amount(value):
    """Convert formatted bank prices to numbers while preserving unavailable values."""
    if not value:
        return None
    cleaned = re.sub(r"[^0-9.-]", "", value)
    try:
        return float(cleaned) if cleaned else None
    except ValueError:
        return None


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape bank-acquired properties.")
    parser.add_argument("banks", nargs="*", choices=sorted(SCRAPERS), default=DEFAULT_BANKS)
    parser.add_argument("--dry-run", action="store_true", help="Parse sources without writing to Firestore")
    args = parser.parse_args()
    if args.dry_run:
        dry_run(args.banks)
    else:
        run_banks(args.banks)