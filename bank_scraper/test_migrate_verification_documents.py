import unittest

from firebase_admin import firestore

try:
    from .migrate_verification_documents import migrate_verification_documents
except ImportError:
    from migrate_verification_documents import migrate_verification_documents


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


class MigrateVerificationDocumentsTests(unittest.TestCase):
    def test_dry_run_does_not_change_public_or_private_records(self):
        database = FakeDatabase({
            "listing-1": {
                "ownerId": "owner-1",
                "verificationDocUrl": "https://example.test/ownership.pdf",
            },
        })

        result = migrate_verification_documents(database)

        self.assertEqual(result["migrated"], 1)
        self.assertIn("verificationDocUrl", database.documents["listings"]["listing-1"])
        self.assertEqual(database.documents["listingPrivate"], {})

    def test_apply_moves_urls_and_is_idempotent(self):
        database = FakeDatabase({
            "listing-1": {
                "ownerId": "owner-1",
                "ownershipDocumentUrl": "https://example.test/ownership.png",
                "governmentIdUrl": "https://example.test/id.png",
            },
        })

        first_result = migrate_verification_documents(database, apply=True)
        second_result = migrate_verification_documents(database, apply=True)

        self.assertEqual(first_result["migrated"], 1)
        self.assertEqual(second_result["migrated"], 0)
        self.assertNotIn("ownershipDocumentUrl", database.documents["listings"]["listing-1"])
        self.assertNotIn("governmentIdUrl", database.documents["listings"]["listing-1"])
        self.assertEqual(database.documents["listingPrivate"]["listing-1"]["ownershipDocumentUrl"], "https://example.test/ownership.png")
        self.assertEqual(database.documents["listingPrivate"]["listing-1"]["governmentIdUrl"], "https://example.test/id.png")

    def test_private_urls_take_precedence_over_legacy_public_urls(self):
        database = FakeDatabase(
            {
                "listing-1": {
                    "ownerId": "owner-1",
                    "verificationDocUrl": "https://example.test/old.pdf",
                },
            },
            {
                "listing-1": {
                    "ownerId": "owner-1",
                    "ownershipDocumentUrl": "https://example.test/current.pdf",
                },
            },
        )

        migrate_verification_documents(database, apply=True)

        self.assertEqual(database.documents["listingPrivate"]["listing-1"]["ownershipDocumentUrl"], "https://example.test/current.pdf")
        self.assertNotIn("verificationDocUrl", database.documents["listings"]["listing-1"])

    def test_conflicting_private_owner_is_skipped(self):
        database = FakeDatabase(
            {
                "listing-1": {
                    "ownerId": "owner-1",
                    "ownershipDocumentUrl": "https://example.test/ownership.pdf",
                },
            },
            {"listing-1": {"ownerId": "owner-2"}},
        )

        result = migrate_verification_documents(database, apply=True)

        self.assertEqual(result["skipped"], 1)
        self.assertIn("ownershipDocumentUrl", database.documents["listings"]["listing-1"])
        self.assertEqual(database.documents["listingPrivate"]["listing-1"]["ownerId"], "owner-2")


if __name__ == "__main__":
    unittest.main()