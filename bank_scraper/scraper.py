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
import io
import re
import argparse
from urllib.parse import urljoin

import pdfplumber
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
# METROBANK
# ---------------------------------------------------------------------------
def scrape_metrobank() -> list[dict]:
    response = requests.get(METROBANK_URL, headers=HEADERS, timeout=30)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    pdf_link = find_pdf_link(soup, METROBANK_URL)
    if not pdf_link:
        raise RuntimeError("Metrobank property-list PDF link was not found.")

    pdf_response = requests.get(pdf_link, headers=HEADERS, timeout=60)
    pdf_response.raise_for_status()
    return parse_metrobank_pdf(pdf_response.content)


def parse_metrobank_pdf(content: bytes) -> list[dict]:
    listings = []
    header_indexes = None
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            for row in page.extract_tables() or []:
                if not row:
                    continue
                rows = [[clean_text(value or "") for value in values] for values in row]
                header_row_index = next((index for index, values in enumerate(rows) if is_header_row(values)), None)
                if header_row_index is not None:
                    headers = [value.lower() for value in rows[header_row_index]]
                    header_indexes = {header: index for index, header in enumerate(headers) if header}
                    data_rows = rows[header_row_index + 1:]
                elif header_indexes:
                    data_rows = rows
                else:
                    continue
                for cells in data_rows:
                    if len(cells) < 4 or is_header_row(cells) or not cells[0].isdigit():
                        continue
                    reference_no = value_for_header(cells, header_indexes, "property") or cells[0]
                    if not reference_no or reference_no.lower() in {"n/a", "-"}:
                        continue
                    listings.append({
                        "reference_no": reference_no,
                        "title": value_for_header(cells, header_indexes, "category") or "Metrobank acquired property",
                        "location": " ".join(
                            value_for_header(cells, header_indexes, field) or ""
                            for field in ("address", "city", "province")
                        ).strip(),
                        "price": parse_amount(value_for_header(cells, header_indexes, "price")),
                        "floor_area": value_for_header(cells, header_indexes, "floor"),
                        "lot_area": value_for_header(cells, header_indexes, "lot"),
                        "listing_url": f"https://www.metrobank.com.ph/assets-for-sale/properties/details?id={reference_no}",
                        "image_url": None,
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
