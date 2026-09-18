"""Recompute public trust-score cache without Cloud Functions or billing.

This job uses the Firebase Admin SDK from the same trusted environment as the
bank scraper. It reads private bookings and ratings, then writes only the
public trustScores collection.
"""

from datetime import datetime, timezone

try:
    from .database import get_db
except ImportError:
    from database import get_db

WEIGHTS = {"booking": 0.4, "rating": 0.4, "fairness": 0.2}
BATCH_SIZE = 450


def recompute_trust_scores():
    db = get_db()
    listings = [
        {"id": item.id, **item.to_dict()}
        for item in db.collection("listings").where("verificationStatus", "==", "verified").stream()
    ]
    completed = [item.to_dict() for item in db.collection("bookings").where("status", "==", "Completed").stream()]
    ratings = [item.to_dict() for item in db.collection("ratings").stream()]
    completed_by_listing = group_by(completed, "listingId")
    ratings_by_listing = group_by(ratings, "listingId")
    now = datetime.now(timezone.utc)
    writes = []

    for listing in listings:
        listing_id = listing["id"]
        listing_bookings = completed_by_listing.get(listing_id, [])
        listing_ratings = ratings_by_listing.get(listing_id, [])
        average_rating = (
            sum(float(rating.get("score", 0)) for rating in listing_ratings) / len(listing_ratings)
            if listing_ratings else 0
        )
        fairness_score, fairness_label = calculate_fairness(listing, listings)
        booking_score = clamp(sum(booking_weight(item, now) for item in listing_bookings) / 5)
        rating_score = clamp(average_rating / 5)
        score = clamp(
            booking_score * WEIGHTS["booking"]
            + rating_score * WEIGHTS["rating"]
            + fairness_score * WEIGHTS["fairness"]
        )
        writes.append((listing_id, {
            "listingId": listing_id,
            "score": score,
            "completedBookingsCount": len(listing_bookings),
            "avgRating": average_rating,
            "priceFairnessLabel": fairness_label,
            "computedAt": now,
        }))

    for start in range(0, len(writes), BATCH_SIZE):
        batch = db.batch()
        for listing_id, score in writes[start:start + BATCH_SIZE]:
            batch.set(db.collection("trustScores").document(listing_id), score)
        batch.commit()

    print(f"Recomputed {len(writes)} trust scores.")


def calculate_fairness(listing, listings):
    listing_area = float(listing.get("floorArea") or 0)
    listing_price = float(listing.get("price") or 0)
    if listing_area <= 0 or listing_price <= 0:
        return 0.5, "Not enough data"

    comparable_prices = []
    for candidate in listings:
        candidate_area = float(candidate.get("floorArea") or 0)
        candidate_price = float(candidate.get("price") or 0)
        if candidate["id"] == listing["id"] or candidate_area <= 0 or candidate_price <= 0:
            continue
        if candidate.get("city") != listing.get("city") or candidate.get("type") != listing.get("type"):
            continue
        if abs(candidate_area - listing_area) / listing_area <= 0.2:
            comparable_prices.append(candidate_price / candidate_area)

    if not comparable_prices:
        return 0.5, "Not enough data"

    comparable_prices.sort()
    median = comparable_prices[len(comparable_prices) // 2]
    delta = (listing_price / listing_area - median) / median
    if delta > 0.15:
        return 0.3, "Above market"
    if delta < -0.15:
        return 1, "Below market"
    return 0.8, "At market"


def booking_weight(booking, now):
    end_date = booking.get("endDate")
    if not hasattr(end_date, "timestamp"):
        return 0
    months_ago = (now.timestamp() - end_date.timestamp()) / (60 * 60 * 24 * 30)
    return 1 if months_ago <= 6 else 0.5


def group_by(items, key):
    groups = {}
    for item in items:
        value = item.get(key)
        if value:
            groups.setdefault(value, []).append(item)
    return groups


def clamp(value):
    return min(1, max(0, float(value or 0)))


if __name__ == "__main__":
    recompute_trust_scores()
