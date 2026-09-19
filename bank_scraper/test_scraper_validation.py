import unittest

from scraper import is_valid_listing, validate_listings


class ScraperValidationTests(unittest.TestCase):
    def test_reference_number_is_required(self):
        self.assertTrue(is_valid_listing({"reference_no": "MB-100"}))
        self.assertFalse(is_valid_listing({"reference_no": "  "}))
        self.assertFalse(is_valid_listing({"title": "Missing identity"}))
        self.assertFalse(is_valid_listing(None))

    def test_malformed_rows_are_removed(self):
        listings = validate_listings([
            {"reference_no": "MB-100", "title": "Valid"},
            {"reference_no": "", "title": "Invalid"},
            None,
        ])
        self.assertEqual(listings, [{"reference_no": "MB-100", "title": "Valid"}])

    def test_empty_valid_result_fails_closed(self):
        with self.assertRaisesRegex(RuntimeError, "catalog was left unchanged"):
            validate_listings([{"title": "No reference"}, None])


if __name__ == "__main__":
    unittest.main()