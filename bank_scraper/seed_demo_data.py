"""Seed synthetic TrustHome demo data for local or Firebase testing.

This script never requires real IDs, ownership papers, or real user accounts.
It writes deterministic demo-* documents with Firebase Admin SDK credentials.
Run it repeatedly to refresh the same demo records without duplicating them.
"""

import argparse
from datetime import datetime, timedelta, timezone

try:
    from .database import get_db
    from .trust_scores import recompute_trust_scores
except ImportError:
    from database import get_db
    from trust_scores import recompute_trust_scores

DEMO_IMAGE = "https://placehold.co/1200x900/e8eef7/1e40af?text=TrustHome+Demo+Property"
DEMO_DOCUMENT = "https://placehold.co/1200x900/fef3c7/92400e?text=Synthetic+Demo+Document"
NOW = datetime.now(timezone.utc)

USERS = {
    "demo-owner-01": {"name": "Demo Owner One", "email": "owner.one@example.test", "role": "user", "status": "suspended"},
    "demo-owner-02": {"name": "Demo Owner Two", "email": "owner.two@example.test", "role": "user", "status": "active"},
    "demo-renter-01": {"name": "Demo Renter One", "email": "renter.one@example.test", "role": "user", "status": "active"},
    "demo-renter-02": {"name": "Demo Renter Two", "email": "renter.two@example.test", "role": "user", "status": "active"},
    "demo-admin": {"name": "Demo Admin", "email": "admin@example.test", "role": "admin", "status": "active"},
}

LISTINGS = [
    ("demo-listing-01", "demo-owner-01", "Bright Makati studio near transit", "Makati", "Condo", 28000, 28, "verified"),
    ("demo-listing-02", "demo-owner-01", "Quiet Makati one-bedroom", "Makati", "Condo", 32000, 34, "verified"),
    ("demo-listing-03", "demo-owner-02", "Family home in Cabuyao", "Cabuyao", "House", 18500, 82, "verified"),
    ("demo-listing-04", "demo-owner-02", "Laguna garden apartment", "Cabuyao", "Apartment", 14500, 58, "verified"),
    ("demo-listing-05", "demo-owner-01", "Cebu city room with workspace", "Cebu City", "Room", 11000, 24, "verified"),
    ("demo-listing-06", "demo-owner-02", "Davao starter apartment", "Davao City", "Apartment", 12500, 42, "verified"),
    ("demo-listing-07", "demo-owner-01", "Pasig two-bedroom home", "Pasig", "House", 36000, 76, "verified"),
    ("demo-listing-08", "demo-owner-02", "Quezon City compact condo", "Quezon City", "Condo", 22000, 30, "verified"),
    ("demo-listing-09", "demo-owner-01", "Makati listing awaiting review", "Makati", "Condo", 30000, 31, "pending"),
    ("demo-listing-10", "demo-owner-02", "Cebu listing awaiting review", "Cebu City", "Apartment", 16000, 45, "pending"),
]

BANK_PROPERTIES = [
    ("MTB-DEMO-0001", "Antipolo residential lot", "Antipolo, Rizal", 1850000, 120, 120),
    ("MTB-DEMO-0002", "Cavite townhouse", "Dasmarinas, Cavite", 2650000, 72, 48),
    ("MTB-DEMO-0003", "Laguna commercial parcel", "Sta. Rosa, Laguna", 6200000, 240, 240),
    ("MTB-DEMO-0004", "Cebu city condominium", "Cebu City, Cebu", 3400000, 38, 38),
    ("MTB-DEMO-0005", "Davao family home", "Davao City, Davao del Sur", 4100000, 96, 80),
]


def build_listing(listing_id, owner_id, title, city, property_type, price, floor_area, status):
    return {
        "ownerId": owner_id,
        "ownerName": USERS[owner_id]["name"],
        "title": title,
        "description": "Synthetic demo listing for testing TrustHome workflows. Not a real property offer.",
        "type": property_type,
        "city": city,
        "price": price,
        "pricePeriod": "month",
        "floorArea": floor_area,
        "lotArea": floor_area + 20,
        "verificationStatus": status,
        "verificationDocUrl": DEMO_DOCUMENT if status == "verified" else None,
        "photoUrls": [DEMO_IMAGE.replace("Property", listing_id)],
        "createdAt": NOW - timedelta(days=30 - int(listing_id[-2:])),
        "updatedAt": NOW,
        "verifiedAt": NOW - timedelta(days=20) if status == "verified" else None,
    }


def seed_collection(db, collection_name, documents):
    for document_id, data in documents.items():
        db.collection(collection_name).document(document_id).set(data, merge=True)
    print(f"Seeded {len(documents)} {collection_name} documents.")


def build_bookings():
    return {
        "demo-booking-01": {
            "listingId": "demo-listing-01", "listingTitle": LISTINGS[0][2], "ownerId": "demo-owner-01",
            "renterId": "demo-renter-01", "status": "Completed", "startDate": NOW - timedelta(days=120),
            "endDate": NOW - timedelta(days=90), "createdAt": NOW - timedelta(days=150), "updatedAt": NOW,
        },
        "demo-booking-02": {
            "listingId": "demo-listing-01", "listingTitle": LISTINGS[0][2], "ownerId": "demo-owner-01",
            "renterId": "demo-renter-02", "status": "Completed", "startDate": NOW - timedelta(days=70),
            "endDate": NOW - timedelta(days=40), "createdAt": NOW - timedelta(days=100), "updatedAt": NOW,
        },
        "demo-booking-03": {
            "listingId": "demo-listing-02", "listingTitle": LISTINGS[1][2], "ownerId": "demo-owner-01",
            "renterId": "demo-renter-01", "status": "Completed", "startDate": NOW - timedelta(days=210),
            "endDate": NOW - timedelta(days=180), "createdAt": NOW - timedelta(days=240), "updatedAt": NOW,
        },
        "demo-booking-04": {
            "listingId": "demo-listing-03", "listingTitle": LISTINGS[2][2], "ownerId": "demo-owner-02",
            "renterId": "demo-renter-02", "status": "Completed", "startDate": NOW - timedelta(days=45),
            "endDate": NOW - timedelta(days=15), "createdAt": NOW - timedelta(days=80), "updatedAt": NOW,
        },
        "demo-booking-05": {
            "listingId": "demo-listing-04", "listingTitle": LISTINGS[3][2], "ownerId": "demo-owner-02",
            "renterId": "demo-renter-01", "status": "Confirmed", "startDate": NOW + timedelta(days=10),
            "endDate": NOW + timedelta(days=40), "createdAt": NOW - timedelta(days=3), "updatedAt": NOW,
        },
        "demo-booking-06": {
            "listingId": "demo-listing-05", "listingTitle": LISTINGS[4][2], "ownerId": "demo-owner-01",
            "renterId": "demo-renter-02", "status": "Pending", "startDate": NOW + timedelta(days=20),
            "endDate": NOW + timedelta(days=50), "createdAt": NOW - timedelta(days=1), "updatedAt": NOW,
        },
    }


def build_ratings():
    return {
        "demo-rating-01": {"bookingId": "demo-booking-01", "listingId": "demo-listing-01", "rateeId": "demo-owner-01", "reviewerId": "demo-renter-01", "score": 5, "comment": "The listing matched the description and the owner communicated clearly.", "createdAt": NOW - timedelta(days=80)},
        "demo-rating-02": {"bookingId": "demo-booking-02", "listingId": "demo-listing-01", "rateeId": "demo-owner-01", "reviewerId": "demo-renter-02", "score": 4, "comment": "Good location and a smooth handover.", "createdAt": NOW - timedelta(days=35)},
        "demo-rating-03": {"bookingId": "demo-booking-03", "listingId": "demo-listing-02", "rateeId": "demo-owner-01", "reviewerId": "demo-renter-01", "score": 4, "comment": "Comfortable stay with responsive support.", "createdAt": NOW - timedelta(days=175)},
        "demo-rating-04": {"bookingId": "demo-booking-04", "listingId": "demo-listing-03", "rateeId": "demo-owner-02", "reviewerId": "demo-renter-02", "score": 5, "comment": "A well-maintained family home.", "createdAt": NOW - timedelta(days=10)},
    }


def build_disputes():
    return {
        "demo-dispute-founded": {
            "bookingId": "demo-booking-01", "raisedBy": "demo-renter-01", "ownerId": "demo-owner-01",
            "reason": "Synthetic founded dispute for the accountability demo.", "status": "Founded",
            "resolutionNotes": "Demo-only record: owner suspended for testing the public accountability flag.",
            "resolvedAt": NOW - timedelta(days=20), "createdAt": NOW - timedelta(days=25),
        },
        "demo-dispute-open": {
            "bookingId": "demo-booking-04", "raisedBy": "demo-renter-02", "ownerId": "demo-owner-02",
            "reason": "Synthetic open dispute for the admin review queue.", "status": "Open",
            "createdAt": NOW - timedelta(days=2),
        },
    }


def build_bank_properties():
    return {
        f"metrobank_{reference}": {
            "bank": "metrobank", "referenceNo": reference, "title": title, "location": location,
            "price": price, "floorArea": floor_area, "lotArea": lot_area,
            "listingUrl": "https://www.metrobank.com.ph/assets-for-sale/properties",
            "imageUrl": DEMO_IMAGE.replace("Property", reference), "status": "active",
            "firstSeen": NOW - timedelta(days=14), "lastSeen": NOW,
        }
        for reference, title, location, price, floor_area, lot_area in BANK_PROPERTIES
    }


def main(dry_run=False):
    documents = {
        "users": USERS,
        "listings": {item[0]: build_listing(*item) for item in LISTINGS},
        "bookings": build_bookings(),
        "ratings": build_ratings(),
        "disputes": build_disputes(),
        "bankProperties": build_bank_properties(),
    }
    if dry_run:
        for collection_name, collection_documents in documents.items():
            print(f"Would seed {len(collection_documents)} {collection_name} documents.")
        print("Would recompute trust scores for verified listings.")
        return

    db = get_db()
    for collection_name, collection_documents in documents.items():
        seed_collection(db, collection_name, collection_documents)
    recompute_trust_scores()
    print("Demo seed complete. All records are synthetic and safe for testing.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed synthetic TrustHome demo data.")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be written without connecting to Firebase")
    args = parser.parse_args()
    main(dry_run=args.dry_run)
