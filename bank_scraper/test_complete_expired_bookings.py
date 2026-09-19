import unittest
from datetime import datetime, timedelta, timezone

from complete_expired_bookings import booking_is_expired


class CompleteExpiredBookingsTests(unittest.TestCase):
    def test_booking_is_expired_after_end_date(self):
        now = datetime.now(timezone.utc)
        expired_booking = {"endDate": now - timedelta(days=2)}
        self.assertTrue(booking_is_expired(expired_booking, now))

    def test_booking_is_not_expired_before_end_date(self):
        now = datetime.now(timezone.utc)
        future_booking = {"endDate": now + timedelta(days=2)}
        self.assertFalse(booking_is_expired(future_booking, now))

    def test_booking_without_end_date_is_not_expired(self):
        now = datetime.now(timezone.utc)
        missing_end_booking = {}
        self.assertFalse(booking_is_expired(missing_end_booking, now))


if __name__ == "__main__":
    unittest.main()
