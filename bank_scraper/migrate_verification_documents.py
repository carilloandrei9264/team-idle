"""Move legacy verification URLs out of public listing records.

Run without --apply first and back up Firestore before applying changes.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone

from firebase_admin import firestore

try:
    from .database import get_db
except ImportError:
    from database import get_db

PUBLIC_URL_FIELDS = ("ownershipDocumentUrl", "governmentIdUrl", "verificationDocUrl")
BATCH_WRITE_LIMIT = 400


def migrate_verification_documents(db, apply: bool = False) -> dict[str, int]:
    listings = db.collection("listings")
    private_listings = db.collection("listingPrivate")
    batch = db.batch()
    pending_writes = 0
    scanned = 0
    migrated = 0
    skipped = 0
    now = datetime.now(timezone.utc)

    for listing_snapshot in listings.stream():
        scanned += 1
        listing = listing_snapshot.to_dict() or {}
        legacy_fields = [field for field in PUBLIC_URL_FIELDS if field in listing]
        if not legacy_fields:
            continue

        owner_id = listing.get("ownerId")
        if not isinstance(owner_id, str) or not owner_id:
            skipped += 1
            continue

        private_ref = private_listings.document(listing_snapshot.id)
        private_snapshot = private_ref.get()
        private_data = private_snapshot.to_dict() or {}
        if private_snapshot.exists and private_data.get("ownerId") != owner_id:
            skipped += 1
            continue

        private_update = {"ownerId": owner_id, "updatedAt": now}
        ownership_url = private_data.get("ownershipDocumentUrl")
        if not ownership_url:
            ownership_url = listing.get("ownershipDocumentUrl") or listing.get("verificationDocUrl")
        if isinstance(ownership_url, str) and ownership_url:
            private_update["ownershipDocumentUrl"] = ownership_url

        government_id_url = private_data.get("governmentIdUrl") or listing.get("governmentIdUrl")
        if isinstance(government_id_url, str) and government_id_url:
            private_update["governmentIdUrl"] = government_id_url

        migrated += 1
        if not apply:
            continue

        batch.set(private_ref, private_update, merge=True)
        batch.update(listing_snapshot.reference, {field: firestore.DELETE_FIELD for field in legacy_fields})
        pending_writes += 2
        if pending_writes >= BATCH_WRITE_LIMIT:
            batch.commit()
            batch = db.batch()
            pending_writes = 0

    if apply and pending_writes:
        batch.commit()

    return {"scanned": scanned, "migrated": migrated, "skipped": skipped, "applied": int(apply)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write changes; without this flag only report a dry run")
    args = parser.parse_args()

    result = migrate_verification_documents(get_db(), apply=args.apply)
    mode = "Applied" if args.apply else "Dry run"
    print(f"{mode}: scanned={result['scanned']} migrated={result['migrated']} skipped={result['skipped']}")
    if result["skipped"]:
        print("Listings with missing owners or conflicting private records need manual review.")


if __name__ == "__main__":
    main()