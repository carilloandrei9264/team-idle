import unittest

from scraper import is_valid_listing, metrobank_item_to_listing, validate_listings


class ScraperValidationTests(unittest.TestCase):
    def test_reference_number_and_meaningful_price_are_required(self):
        self.assertTrue(is_valid_listing({"reference_no": "MB-100", "price": 12000}))
        self.assertFalse(is_valid_listing({"reference_no": "MB-100", "price": 1}))
        self.assertFalse(is_valid_listing({"reference_no": "MB-100", "price": "PHP 1"}))
        self.assertFalse(is_valid_listing({"reference_no": "MB-100", "price": "not disclosed"}))
        self.assertFalse(is_valid_listing({"reference_no": "MB-100", "price": None}))
        self.assertFalse(is_valid_listing({"reference_no": "MB-100", "price": 0}))
        self.assertFalse(is_valid_listing({"reference_no": "MB-100", "price": -100}))
        self.assertFalse(is_valid_listing({"reference_no": "  ", "price": 12000}))
        self.assertFalse(is_valid_listing({"title": "Missing identity"}))
        self.assertFalse(is_valid_listing(None))

    def test_generic_metrobank_title_uses_category_and_city(self):
        listing = metrobank_item_to_listing({
            "propAcctNo": "MB-100",
            "propCategory": "Residential",
            "propType": "Real Estate",
            "city": "Cabuyao",
            "province": "Laguna",
            "price": 12000,
        })
        self.assertEqual(listing["title"], "Residential property in Cabuyao")

    def test_specific_metrobank_property_type_is_preserved(self):
        listing = metrobank_item_to_listing({
            "propAcctNo": "MB-101",
            "propCategory": "Residential",
            "propType": "Apartment",
            "city": "Cabuyao",
            "province": "Laguna",
            "price": 12000,
        })
        self.assertEqual(listing["title"], "Residential Apartment")

    def test_generic_metrobank_property_type_suffix_is_removed(self):
        listing = metrobank_item_to_listing({
            "propAcctNo": "MB-102",
            "propCategory": "Commercial",
            "propType": "Commercial Real Estate",
            "city": "Mandaluyong City",
            "province": "Metro Manila",
            "price": 12000,
        })
        self.assertEqual(listing["title"], "Commercial property in Mandaluyong City")

    def test_malformed_rows_are_removed(self):
        listings = validate_listings([
            {"reference_no": "MB-100", "title": "Valid", "price": 12000},
            {"reference_no": "", "title": "Invalid", "price": 12000},
            {"reference_no": "MB-101", "title": "Sentinel price", "price": 1},
            None,
        ])
        self.assertEqual(listings, [{"reference_no": "MB-100", "title": "Valid", "price": 12000}])

    def test_empty_valid_result_fails_closed(self):
        with self.assertRaisesRegex(RuntimeError, "catalog was left unchanged"):
            validate_listings([{"title": "No reference"}, None])


if __name__ == "__main__":
    unittest.main()