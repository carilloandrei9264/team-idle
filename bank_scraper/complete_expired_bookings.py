"""Mark confirmed bookings as completed when their end date has passed.

This keeps the v0.2 booking lifecycle working without requiring billing-enabled
Firebase Functions. It is designed to be run from GitHub Actions or a local
cron/scheduler job before recomputing trust scores.
"""

from datetime import datetime, timezone

try:
    from .database import get_db
except ImportError:
    from database import get_db


def booking_is_expired(booking, now=None):
    if not booking or not booking.get("endDate"):
        return False

    now = now or datetime.now(timezone.utc)
    end_date = booking.get("endDate")

    if hasattr(end_date, "timestamp"):
        end_ts = end_date.timestamp()
        return now.timestamp() >= end_ts

    if isinstance(end_date, str):
        try:
            end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            return now >= end_dt.astimezone(timezone.utc)
        except ValueError:
            return False

    return False


def complete_expired_bookings():
    db = get_db()
    now = datetime.now(timezone.utc)
    snapshot = db.collection("bookings").where("status", "==", "Confirmed").stream()

    updated = 0
    for booking_doc in snapshot:
        booking = booking_doc.to_dict()
        if booking_is_expired(booking, now):
            booking_doc.reference.update({
                "status": "Completed",
                "completedAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc),
            })
            updated += 1

    print(f"Completed {updated} expired bookings.")
    return updated


if __name__ == "__main__":
    complete_expired_bookings()
