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
SELF_BOOKING_THRESHOLD = 3
SELF_BOOKING_WINDOW_DAYS = 30


def recompute_trust_scores():
    db = get_db()
    listings = [
        {"id": item.id, **item.to_dict()}
        for item in db.collection("listings").where("verificationStatus", "==", "verified").stream()
    ]
    completed = [{"id": item.id, **item.to_dict()} for item in db.collection("bookings").where("status", "==", "Completed").stream()]
    ratings = [item.to_dict() for item in db.collection("ratings").stream()]
    completed_by_listing = group_by(completed, "listingId")
    ratings_by_listing = group_by(ratings, "listingId")
    self_booking_patterns = detect_self_booking_patterns(completed)
    flagged_booking_ids = {
        booking_id
        for pattern in self_booking_patterns
        for booking_id in pattern["booking_ids"]
    }
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
            "manualReviewRequired": any(item.get("id") in flagged_booking_ids for item in listing_bookings),
            "selfBookingPatternCount": sum(
                1 for pattern in self_booking_patterns
                if any(item.get("id") in pattern["booking_ids"] for item in listing_bookings)
            ),
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
        return 0, "Insufficient data"

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
        return 0, "Insufficient data"

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


def detect_self_booking_patterns(bookings, threshold=SELF_BOOKING_THRESHOLD, window_days=SELF_BOOKING_WINDOW_DAYS):
    grouped = {}
    for booking in bookings:
        if booking.get("status") != "Completed" or not booking.get("renterId") or not booking.get("ownerId"):
            continue
        booking_date = as_datetime(booking.get("endDate") or booking.get("createdAt"))
        if booking_date is None:
            continue
        key = (booking["renterId"], booking["ownerId"])
        grouped.setdefault(key, []).append((booking, booking_date))

    patterns = []
    window = window_days * 24 * 60 * 60
    for key, entries in grouped.items():
        entries.sort(key=lambda item: item[1])
        largest_window = []
        for index, (_, start) in enumerate(entries):
            candidate = [item for item in entries[index:] if (item[1] - start).total_seconds() <= window]
            if len(candidate) > len(largest_window):
                largest_window = candidate
        if len(largest_window) >= threshold:
            patterns.append({
                "key": f"{key[0]}:{key[1]}",
                "booking_ids": [booking.get("id") for booking, _ in largest_window if booking.get("id")],
                "count": len(largest_window),
            })
    return patterns


def as_datetime(value):
    if isinstance(value, datetime):
        return value
    if hasattr(value, "to_datetime"):
        return value.to_datetime()
    if hasattr(value, "timestamp"):
        return datetime.fromtimestamp(value.timestamp(), timezone.utc)
    return None


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
