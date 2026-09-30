"""Move legacy exact listing addresses out of publicly readable listing documents.

Run with --dry-run (the default) before --apply. Back up Firestore before applying.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone

from firebase_admin import firestore

try:
    from .database import get_db
except ImportError:
    from database import get_db

BATCH_WRITE_LIMIT = 400


def migrate_listing_addresses(db, apply: bool = False) -> dict[str, int]:
    listings = db.collection("listings")
    private_listings = db.collection("listingPrivate")
    batch = db.batch()
    pending_writes = 0
    scanned = 0
    planned = 0
    skipped = 0
    now = datetime.now(timezone.utc)

    for listing_snapshot in listings.stream():
        scanned += 1
        listing = listing_snapshot.to_dict() or {}
        address = listing.get("address")
        owner_id = listing.get("ownerId")
        if not isinstance(owner_id, str) or not owner_id:
            skipped += 1
            continue
        has_public_address = isinstance(address, str) and bool(address.strip())
        has_legacy_address_field = "address" in listing

        private_ref = private_listings.document(listing_snapshot.id)
        private_snapshot = private_ref.get()
        private_data = private_snapshot.to_dict() or {}
        if private_snapshot.exists and private_data.get("ownerId") != owner_id:
            skipped += 1
            continue
        if not has_legacy_address_field and private_snapshot.exists:
            continue

        private_update = {"ownerId": owner_id, "updatedAt": now}
        if has_public_address and not private_data.get("address"):
            private_update["address"] = address

        planned += 1
        if not apply:
            continue

        batch.set(private_ref, private_update, merge=True)
        pending_writes += 1
        if has_legacy_address_field:
            batch.update(listing_snapshot.reference, {"address": firestore.DELETE_FIELD})
            pending_writes += 1
        if pending_writes >= BATCH_WRITE_LIMIT:
            batch.commit()
            batch = db.batch()
            pending_writes = 0

    if apply and pending_writes:
        batch.commit()

    return {"scanned": scanned, "migrated": planned, "skipped": skipped, "applied": int(apply)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write changes; without this flag only report a dry run")
    args = parser.parse_args()

    result = migrate_listing_addresses(get_db(), apply=args.apply)
    mode = "Applied" if args.apply else "Dry run"
    print(f"{mode}: scanned={result['scanned']} migrated={result['migrated']} skipped={result['skipped']}")
    if result["skipped"]:
        print("Listings with missing owners or conflicting private records need manual review.")


if __name__ == "__main__":
    main()
