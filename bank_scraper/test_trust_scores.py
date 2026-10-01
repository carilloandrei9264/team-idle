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

    def test_sale_listing_does_not_receive_a_rental_fairness_score(self):
        score, label = calculate_fairness(
            {"id": "sale-1", "listingPurpose": "sale", "city": "Cebu", "type": "Room", "price": 2500000, "floorArea": 20},
            [{"id": "rent-1", "city": "Cebu", "type": "Room", "price": 12000, "floorArea": 20}],
        )

        self.assertEqual(score, 0)
        self.assertEqual(label, "Not applicable")

    def test_sale_and_different_rental_periods_do_not_affect_rent_comparisons(self):
        listing = {
            "id": "rent-1", "listingPurpose": "rent", "rentalTerm": "long_term",
            "pricePeriod": "month", "city": "Cebu", "type": "Apartment", "price": 20000, "floorArea": 20,
        }
        comparables = [
            {"id": "rent-2", "listingPurpose": "rent", "pricePeriod": "month", "city": "Cebu", "type": "Apartment", "price": 20000, "floorArea": 20},
            {"id": "rent-short", "listingPurpose": "rent", "pricePeriod": "day", "city": "Cebu", "type": "Apartment", "price": 2000, "floorArea": 20},
            {"id": "sale-1", "listingPurpose": "sale", "pricePeriod": "total", "city": "Cebu", "type": "Apartment", "price": 60000, "floorArea": 20},
        ]

        score, label = calculate_fairness(listing, [listing, *comparables])

        self.assertEqual(score, 0.8)
        self.assertEqual(label, "At market")

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