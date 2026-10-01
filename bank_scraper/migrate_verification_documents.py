"""Move legacy verification URLs out of public listing records.

Run without --apply first and back up Firestore before applying changes.
"""

from __future__ import annotations

import argparse
import os
import re
from datetime import datetime, timezone
from uuid import NAMESPACE_URL, uuid5
from urllib.parse import quote, unquote, urlparse

import requests

from firebase_admin import firestore

try:
    from .database import get_db
except ImportError:
    from database import get_db

PUBLIC_URL_FIELDS = ("ownershipDocumentUrl", "governmentIdUrl", "verificationDocUrl")
BATCH_WRITE_LIMIT = 400
DOCUMENT_KINDS = {
    "ownership": ("ownershipDocumentUrl", "verificationDocUrl"),
    "govId": ("governmentIdUrl",),
}


def parse_cloudinary_asset_url(
    url: str,
    listing_id: str,
    kind: str,
    expected_cloud_name: str | None = None,
) -> dict[str, str] | None:
    try:
        parsed = urlparse(url)
        path_parts = [unquote(part) for part in parsed.path.split("/") if part]
        upload_index = path_parts.index("upload")
    except (ValueError, TypeError):
        return None

    if parsed.hostname != "res.cloudinary.com" or len(path_parts) <= upload_index + 1:
        return None
    if len(path_parts) < 3 or (expected_cloud_name and path_parts[0] != expected_cloud_name):
        return None

    resource_type = path_parts[1]
    if resource_type not in {"image", "raw"}:
        return None
    asset_parts = path_parts[upload_index + 1:]
    if asset_parts and re.fullmatch(r"v\d+", asset_parts[0]):
        asset_parts = asset_parts[1:]
    if not asset_parts:
        return None

    asset_path = "/".join(asset_parts)
    filename = asset_parts[-1]
    if "." not in filename:
        return None
    public_id, format_name = asset_path.rsplit(".", 1)
    if not public_id or not re.fullmatch(r"[A-Za-z0-9]{1,10}", format_name):
        return None

    suffix = uuid5(NAMESPACE_URL, f"trusthome:{listing_id}:{kind}:{public_id}")
    return {
        "sourcePublicId": public_id,
        "publicId": f"trusthome_private_{listing_id}_{kind}_{suffix}",
        "format": format_name.lower(),
        "resourceType": resource_type,
    }


def rename_cloudinary_asset(asset: dict[str, str], cloud_name: str, api_key: str, api_secret: str) -> None:
    target_endpoint = (
        f"https://api.cloudinary.com/v1_1/{cloud_name}/resources/"
        f"{asset['resourceType']}/authenticated/{quote(asset['publicId'], safe='')}"
    )
    existing = requests.get(target_endpoint, auth=(api_key, api_secret), timeout=30)
    if existing.status_code == 200:
        return

    endpoint = (
        f"https://api.cloudinary.com/v1_1/{cloud_name}/resources/"
        f"{asset['resourceType']}/upload/{quote(asset['sourcePublicId'], safe='')}/rename"
    )
    response = requests.post(
        endpoint,
        auth=(api_key, api_secret),
        data={
            "to_public_id": asset["publicId"],
            "to_type": "authenticated",
            "invalidate": "true",
        },
        timeout=30,
    )
    if response.status_code != 200:
        existing = requests.get(target_endpoint, auth=(api_key, api_secret), timeout=30)
        if existing.status_code == 200:
            return
        raise RuntimeError(f"Cloudinary asset conversion failed with HTTP {response.status_code}.")


def migrate_verification_documents(db, apply: bool = False, asset_migrator=None) -> dict[str, int]:
    listings = db.collection("listings")
    private_listings = db.collection("listingPrivate")
    batch = db.batch()
    pending_writes = 0
    scanned = 0
    migrated = 0
    would_migrate = 0
    skipped = 0
    errors = 0
    now = datetime.now(timezone.utc)
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    if apply and asset_migrator is None:
        api_key = os.getenv("CLOUDINARY_API_KEY", "")
        api_secret = os.getenv("CLOUDINARY_API_SECRET", "")
        if not cloud_name or not api_key or not api_secret:
            raise RuntimeError("CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are required with --apply.")
        asset_migrator = lambda asset: rename_cloudinary_asset(asset, cloud_name, api_key, api_secret)

    for listing_snapshot in listings.stream():
        scanned += 1
        listing = listing_snapshot.to_dict() or {}
        owner_id = listing.get("ownerId")
        legacy_fields = [field for field in PUBLIC_URL_FIELDS if field in listing]
        if not isinstance(owner_id, str) or not owner_id:
            skipped += 1
            continue

        private_ref = private_listings.document(listing_snapshot.id)
        private_snapshot = private_ref.get()
        private_data = private_snapshot.to_dict() or {}
        private_legacy_fields = [field for field in ("ownershipDocumentUrl", "governmentIdUrl") if field in private_data]
        if not legacy_fields and not private_legacy_fields:
            continue
        if private_snapshot.exists and private_data.get("ownerId") != owner_id:
            skipped += 1
            continue

        document_assets = dict(private_data.get("documents") or {})
        listing_fields_to_delete = set()
        private_fields_to_delete = set()
        changed = False
        for kind, candidates in DOCUMENT_KINDS.items():
            candidate_urls = []
            for field in candidates:
                if private_data.get(field):
                    candidate_urls.append(("private", field, private_data[field]))
                if listing.get(field):
                    candidate_urls.append(("listing", field, listing[field]))

            seen_urls = set()
            migrated_urls = set()
            converted_assets = []
            for source, field, source_url in candidate_urls:
                if source_url in seen_urls:
                    if source_url in migrated_urls:
                        if source == "private":
                            private_fields_to_delete.add(field)
                        else:
                            listing_fields_to_delete.add(field)
                    continue
                seen_urls.add(source_url)
                asset = parse_cloudinary_asset_url(source_url, listing_snapshot.id, kind, cloud_name or None)
                if not asset:
                    errors += 1
                    continue
                if not apply:
                    would_migrate += 1
                    continue
                try:
                    asset_migrator(asset)
                except Exception:
                    errors += 1
                    continue

                migrated += 1
                migrated_urls.add(source_url)
                converted_assets.append(asset)
                changed = True
                if source == "private":
                    private_fields_to_delete.add(field)
                else:
                    listing_fields_to_delete.add(field)

            if converted_assets and not document_assets.get(kind):
                asset = converted_assets[0]
                document_assets[kind] = {
                    "publicId": asset["publicId"],
                    "format": asset["format"],
                    "resourceType": asset["resourceType"],
                }

        if not apply or not changed:
            continue

        private_update = {"ownerId": owner_id, "documents": document_assets, "updatedAt": now}
        private_update.update({field: firestore.DELETE_FIELD for field in private_fields_to_delete})
        batch.set(private_ref, private_update, merge=True)
        listing_update = {field: firestore.DELETE_FIELD for field in listing_fields_to_delete}
        if listing_update:
            batch.update(listing_snapshot.reference, listing_update)
            pending_writes += 1
        pending_writes += 1
        if pending_writes >= BATCH_WRITE_LIMIT:
            batch.commit()
            batch = db.batch()
            pending_writes = 0

    if apply and pending_writes:
        batch.commit()

    return {
        "scanned": scanned,
        "migrated": migrated,
        "would_migrate": would_migrate,
        "skipped": skipped,
        "errors": errors,
        "applied": int(apply),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write changes; without this flag only report a dry run")
    args = parser.parse_args()

    result = migrate_verification_documents(get_db(), apply=args.apply)
    mode = "Applied" if args.apply else "Dry run"
    print(f"{mode}: scanned={result['scanned']} migrated={result['migrated']} would_migrate={result['would_migrate']} skipped={result['skipped']} errors={result['errors']}")
    if result["skipped"]:
        print("Listings with missing owners or conflicting private records need manual review.")


if __name__ == "__main__":
    main()