"""
Handles all Firestore logic: connecting to Firebase, and the insert/update/
delist logic for scraped bank listings.

Unique key: each document ID is set to f"{bank}_{reference_no}" (e.g.
"bdo_R-2024002140"). This makes upserts trivial — Firestore's set(merge=True)
on a deterministic ID does the "insert if new, update if exists" check for
you, so there's no separate SELECT-then-INSERT-or-UPDATE branch needed like
there would be in SQL.

Setup required before this works:
1. In the Firebase Console, go to Project Settings -> Service Accounts.
2. Click "Generate new private key" -> downloads a JSON file.
3. Keep it outside this repository; set GOOGLE_APPLICATION_CREDENTIALS to its absolute path, or provide the JSON through FIREBASE_SERVICE_ACCOUNT_JSON. For local-only testing you may place serviceAccountKey.json in this folder because it is ignored by Git. **Never commit or share this file** — it is a full admin credential.
"""

import json
import os
import re
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import credentials, firestore

_app = None
_db = None


def get_db():
    """Lazily initializes the Firebase Admin SDK and returns a Firestore client."""
    global _app, _db
    if _db is None:
        service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        if service_account_json:
            cred = credentials.Certificate(json.loads(service_account_json))
        else:
            credential_path = os.getenv(
                "GOOGLE_APPLICATION_CREDENTIALS",
                os.path.join(os.path.dirname(__file__), "serviceAccountKey.json"),
            )
            if not os.path.isfile(credential_path):
                raise RuntimeError(
                    "Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON, "
                    "or place serviceAccountKey.json in bank_scraper for local testing."
                )
                )
            cred = credentials.Certificate(credential_path)
        _app = firebase_admin.initialize_app(cred)
        _db = firestore.client()
    return _db


def upsert_properties(bank: str, scraped_listings: list[dict]):
    """
    Takes the freshly scraped listings for one bank and reconciles them
    against what's already stored in the 'bankProperties' collection:
      - reference_no not seen before      -> document created
      - reference_no already exists       -> document fields updated
      - reference_no in Firestore but NOT in this scrape run -> status
        set to 'delisted' (never deleted outright, so booking/rating
        history tied to it — if any — isn't orphaned)
    """
    db = get_db()
    now = datetime.now(timezone.utc)
    collection = db.collection("bankProperties")

    scraped_ids = set()
    inserted, updated = 0, 0

    for item in scraped_listings:
        doc_id = safe_document_id(bank, item["reference_no"])
        scraped_ids.add(doc_id)

        doc_ref = collection.document(doc_id)
        existed = doc_ref.get().exists

        doc_ref.set(
            {
                "bank": bank,
                "referenceNo": item["reference_no"],
                "title": item.get("title"),
                "location": item.get("location"),
                "price": item.get("price"),
                "floorArea": item.get("floor_area"),
                "lotArea": item.get("lot_area"),
                "listingUrl": item.get("listing_url"),
                "imageUrl": item.get("image_url"),
                "status": "active",
                "lastSeen": now,
                **({"firstSeen": now} if not existed else {}),
            },
            merge=True,  # <-- this one flag does the "insert-or-update" for us
        )

        if existed:
            updated += 1
        else:
            inserted += 1

    # Anything for this bank that was active before but wasn't seen this
    # run has presumably been sold or taken down -> flag it, don't delete it.
    delisted = 0
    existing_active = collection.where("bank", "==", bank).where("status", "==", "active").stream()
    for doc in existing_active:
        if doc.id not in scraped_ids:
            doc.reference.update({"status": "delisted", "lastSeen": now})
            delisted += 1

    print(f"[{bank}] inserted={inserted} updated={updated} delisted={delisted}")


def init_db():
    """
    Kept for compatibility with scraper.py's existing run_all() call.
    Firestore has no schema/tables to create ahead of time — collections
    and documents are created automatically the first time you write to
    them — so this just verifies the connection works.
    """
    get_db()
    print("Firestore connection OK — no schema setup needed (collections are created on first write).")


def get_queued_jobs(limit=1):
    """Return the oldest queued scraper jobs for the worker to process."""
    return list(
        get_db()
        .collection("scraperJobs")
        .where("status", "==", "queued")
        .order_by("createdAt")
        .limit(limit)
        .stream()
    )
