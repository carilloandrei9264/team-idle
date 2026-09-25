import unittest
from datetime import datetime, timezone

try:
    from .trust_scores import calculate_fairness, detect_self_booking_patterns
except ImportError:
    from trust_scores import calculate_fairness, detect_self_booking_patterns


class TrustScoreTests(unittest.TestCase):
    def test_fairness_returns_insufficient_data_without_comparables(self):
        score, label = calculate_fairness(
            {"id": "listing-1", "city": "Cebu", "type": "Room", "price": 12000, "floorArea": 20},
            [],
        )

        self.assertEqual(score, 0)
        self.assertEqual(label, "Insufficient data")

    def test_self_booking_pattern_requires_three_completed_bookings(self):
        bookings = [
            {
                "id": f"booking-{index}",
                "status": "Completed",
                "renterId": "renter-1",
                "ownerId": "owner-1",
                "endDate": datetime(2026, 9, day, tzinfo=timezone.utc),
            }
            for index, day in enumerate([1, 8, 29])
        ]

        patterns = detect_self_booking_patterns(bookings)

        self.assertEqual(len(patterns), 1)
        self.assertEqual(patterns[0]["count"], 3)
        self.assertEqual(patterns[0]["booking_ids"], ["booking-0", "booking-1", "booking-2"])

    def test_pending_bookings_do_not_trigger_self_booking_flag(self):
        bookings = [
            {"status": "Pending", "renterId": "renter-1", "ownerId": "owner-1", "createdAt": datetime.now(timezone.utc)}
            for _ in range(3)
        ]

        self.assertEqual(detect_self_booking_patterns(bookings), [])


if __name__ == "__main__":
    unittest.main()