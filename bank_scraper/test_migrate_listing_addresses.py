import unittest

from firebase_admin import firestore

try:
    from .migrate_listing_addresses import migrate_listing_addresses
except ImportError:
    from migrate_listing_addresses import migrate_listing_addresses


class FakeSnapshot:
    def __init__(self, doc_id, data, reference=None):
        self.id = doc_id
        self._data = data
        self.reference = reference
        self.exists = data is not None

    def to_dict(self):
        return self._data


class FakeReference:
    def __init__(self, database, collection_name, doc_id):
        self.database = database
        self.collection_name = collection_name
        self.id = doc_id

    def get(self):
        data = self.database.documents[self.collection_name].get(self.id)
        return FakeSnapshot(self.id, data)


class FakeCollection:
    def __init__(self, database, name):
        self.database = database
        self.name = name

    def stream(self):
        return [
            FakeSnapshot(doc_id, data, FakeReference(self.database, self.name, doc_id))
            for doc_id, data in self.database.documents[self.name].items()
        ]

    def document(self, doc_id):
        return FakeReference(self.database, self.name, doc_id)


class FakeBatch:
    def __init__(self, database):
        self.database = database
        self.operations = []

    def set(self, reference, values, **options):
        self.operations.append(("set", reference, values, options.get("merge", False)))

    def update(self, reference, values):
        self.operations.append(("update", reference, values, False))

    def commit(self):
        for operation, reference, values, merge in self.operations:
            documents = self.database.documents[reference.collection_name]
            if operation == "set":
                if merge:
                    documents.setdefault(reference.id, {}).update(values)
                else:
                    documents[reference.id] = dict(values)
            else:
                for key, value in values.items():
                    if value is firestore.DELETE_FIELD:
                        documents[reference.id].pop(key, None)
                    else:
                        documents[reference.id][key] = value
        self.operations.clear()


class FakeDatabase:
    def __init__(self, listings, private_listings=None):
        self.documents = {
            "listings": listings,
            "listingPrivate": private_listings or {},
        }

    def collection(self, name):
        return FakeCollection(self, name)

    def batch(self):
        return FakeBatch(self)


class MigrateListingAddressesTests(unittest.TestCase):
    def test_dry_run_does_not_change_public_or_private_documents(self):
        database = FakeDatabase({"listing-1": {"ownerId": "owner-1", "address": "Exact address"}})

        result = migrate_listing_addresses(database)

        self.assertEqual(result["migrated"], 1)
        self.assertIn("address", database.documents["listings"]["listing-1"])
        self.assertEqual(database.documents["listingPrivate"], {})

    def test_apply_moves_address_and_can_be_repeated(self):
        database = FakeDatabase({"listing-1": {"ownerId": "owner-1", "address": "Exact address"}})

        first_result = migrate_listing_addresses(database, apply=True)
        second_result = migrate_listing_addresses(database, apply=True)

        self.assertEqual(first_result["migrated"], 1)
        self.assertEqual(second_result["migrated"], 0)
        self.assertNotIn("address", database.documents["listings"]["listing-1"])
        self.assertEqual(database.documents["listingPrivate"]["listing-1"]["address"], "Exact address")

    def test_existing_private_address_is_preserved(self):
        database = FakeDatabase(
            {"listing-1": {"ownerId": "owner-1", "address": "Old public address"}},
            {"listing-1": {"ownerId": "owner-1", "address": "Current private address"}},
        )

        migrate_listing_addresses(database, apply=True)

        self.assertEqual(database.documents["listingPrivate"]["listing-1"]["address"], "Current private address")
        self.assertNotIn("address", database.documents["listings"]["listing-1"])

    def test_private_owner_record_is_created_when_listing_has_no_address(self):
        database = FakeDatabase({"listing-1": {"ownerId": "owner-1", "title": "Legacy listing"}})

        result = migrate_listing_addresses(database, apply=True)

        self.assertEqual(result["migrated"], 1)
        self.assertEqual(database.documents["listingPrivate"]["listing-1"]["ownerId"], "owner-1")
        self.assertNotIn("address", database.documents["listingPrivate"]["listing-1"])
        self.assertNotIn("address", database.documents["listings"]["listing-1"])

    def test_conflicting_private_owner_is_left_for_manual_review(self):
        database = FakeDatabase(
            {"listing-1": {"ownerId": "owner-1", "address": "Exact address"}},
            {"listing-1": {"ownerId": "owner-2", "address": "Other address"}},
        )

        result = migrate_listing_addresses(database, apply=True)

        self.assertEqual(result["skipped"], 1)
        self.assertEqual(database.documents["listings"]["listing-1"]["address"], "Exact address")
        self.assertEqual(database.documents["listingPrivate"]["listing-1"]["address"], "Other address")


if __name__ == "__main__":
    unittest.main()
