import unittest

from firebase_admin import firestore

try:
    from .migrate_verification_documents import migrate_verification_documents, parse_cloudinary_asset_url
except ImportError:
    from migrate_verification_documents import migrate_verification_documents, parse_cloudinary_asset_url


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
                    document = documents.setdefault(reference.id, {})
                    for key, value in values.items():
                        if value is firestore.DELETE_FIELD:
                            document.pop(key, None)
                        else:
                            document[key] = value
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
    @staticmethod
    def asset_migrator(_asset):
        return None

    def test_dry_run_does_not_change_public_or_private_records(self):
        database = FakeDatabase({
            "listing-1": {
                "ownerId": "owner-1",
                "verificationDocUrl": "https://res.cloudinary.com/demo/raw/upload/v123/trusthome/listings/listing-1/ownership.pdf",
            },
        })

        result = migrate_verification_documents(database)

        self.assertEqual(result["migrated"], 0)
        self.assertEqual(result["would_migrate"], 1)
        self.assertIn("verificationDocUrl", database.documents["listings"]["listing-1"])
        self.assertEqual(database.documents["listingPrivate"], {})

    def test_apply_moves_urls_and_is_idempotent(self):
        database = FakeDatabase({
            "listing-1": {
                "ownerId": "owner-1",
                "ownershipDocumentUrl": "https://res.cloudinary.com/demo/image/upload/v123/trusthome/listings/listing-1/ownership.png",
                "governmentIdUrl": "https://res.cloudinary.com/demo/image/upload/v123/trusthome/listings/listing-1/id.png",
            },
        })

        first_result = migrate_verification_documents(database, apply=True, asset_migrator=self.asset_migrator)
        second_result = migrate_verification_documents(database, apply=True, asset_migrator=self.asset_migrator)

        self.assertEqual(first_result["migrated"], 2)
        self.assertEqual(second_result["migrated"], 0)
        self.assertNotIn("ownershipDocumentUrl", database.documents["listings"]["listing-1"])
        self.assertNotIn("governmentIdUrl", database.documents["listings"]["listing-1"])
        self.assertTrue(database.documents["listingPrivate"]["listing-1"]["documents"]["ownership"]["publicId"].startswith(
            "trusthome_private_listing-1_ownership_"))
        self.assertEqual(database.documents["listingPrivate"]["listing-1"]["documents"]["ownership"]["format"], "png")
        self.assertEqual(database.documents["listingPrivate"]["listing-1"]["documents"]["ownership"]["resourceType"], "image")
        self.assertTrue(database.documents["listingPrivate"]["listing-1"]["documents"]["govId"]["publicId"].startswith(
            "trusthome_private_listing-1_govId_"))
        self.assertEqual(database.documents["listingPrivate"]["listing-1"]["documents"]["govId"]["format"], "png")
        self.assertEqual(database.documents["listingPrivate"]["listing-1"]["documents"]["govId"]["resourceType"], "image")

    def test_private_urls_take_precedence_over_legacy_public_urls(self):
        database = FakeDatabase(
            {
                "listing-1": {
                    "ownerId": "owner-1",
                    "verificationDocUrl": "https://res.cloudinary.com/demo/raw/upload/v123/trusthome/listings/listing-1/old.pdf",
                },
            },
            {
                "listing-1": {
                    "ownerId": "owner-1",
                    "ownershipDocumentUrl": "https://res.cloudinary.com/demo/raw/upload/v123/trusthome/listings/listing-1/current.pdf",
                },
            },
        )

        migrate_verification_documents(database, apply=True, asset_migrator=self.asset_migrator)

        asset = database.documents["listingPrivate"]["listing-1"]["documents"]["ownership"]
        self.assertTrue(asset["publicId"].startswith("trusthome_private_listing-1_ownership_"))
        self.assertEqual(asset["format"], "pdf")
        self.assertEqual(asset["resourceType"], "raw")
        self.assertNotIn("verificationDocUrl", database.documents["listings"]["listing-1"])

    def test_duplicate_private_and_public_url_removes_every_legacy_field(self):
        document_url = "https://res.cloudinary.com/demo/raw/upload/v123/trusthome/listings/listing-1/ownership.pdf"
        database = FakeDatabase(
            {
                "listing-1": {
                    "ownerId": "owner-1",
                    "verificationDocUrl": document_url,
                },
            },
            {
                "listing-1": {
                    "ownerId": "owner-1",
                    "ownershipDocumentUrl": document_url,
                },
            },
        )

        result = migrate_verification_documents(database, apply=True, asset_migrator=self.asset_migrator)

        self.assertEqual(result["migrated"], 1)
        self.assertNotIn("verificationDocUrl", database.documents["listings"]["listing-1"])
        self.assertNotIn("ownershipDocumentUrl", database.documents["listingPrivate"]["listing-1"])
        self.assertIn("ownership", database.documents["listingPrivate"]["listing-1"]["documents"])

    def test_conflicting_private_owner_is_skipped(self):
        database = FakeDatabase(
            {
                "listing-1": {
                    "ownerId": "owner-1",
                    "ownershipDocumentUrl": "https://res.cloudinary.com/demo/raw/upload/v123/trusthome/listings/listing-1/ownership.pdf",
                },
            },
            {"listing-1": {"ownerId": "owner-2"}},
        )

        result = migrate_verification_documents(database, apply=True, asset_migrator=self.asset_migrator)

        self.assertEqual(result["skipped"], 1)
        self.assertIn("ownershipDocumentUrl", database.documents["listings"]["listing-1"])
        self.assertEqual(database.documents["listingPrivate"]["listing-1"]["ownerId"], "owner-2")

    def test_cloudinary_url_parser_handles_versions_folders_and_cloud_allowlist(self):
        asset = parse_cloudinary_asset_url(
            "https://res.cloudinary.com/demo/raw/upload/v123/trusthome/listings/one/title.pdf",
            "listing-1",
            "ownership",
            "demo",
        )
        self.assertEqual(asset["sourcePublicId"], "trusthome/listings/one/title")
        self.assertEqual(asset["format"], "pdf")
        self.assertEqual(asset["resourceType"], "raw")
        self.assertTrue(asset["publicId"].startswith("trusthome_private_listing-1_ownership_"))
        self.assertIsNone(parse_cloudinary_asset_url("https://example.test/document.pdf", "listing-1", "ownership"))
        self.assertIsNone(parse_cloudinary_asset_url(
            "https://res.cloudinary.com/other/image/upload/photo.jpg", "listing-1", "ownership", "demo"
        ))


if __name__ == "__main__":
    unittest.main()