import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

try:
    from .backup_firestore import write_backup
    from .restore_firestore import restore_backup
except ImportError:
    from backup_firestore import write_backup
    from restore_firestore import restore_backup


class FakeSnapshot:
    def __init__(self, document_id, data):
        self.id = document_id
        self._data = data

    def to_dict(self):
        return self._data


class FakeCollection:
    def __init__(self, database, name):
        self.database = database
        self.id = name

    def stream(self):
        return [FakeSnapshot(document_id, data) for document_id, data in self.database.documents[self.id].items()]

    def document(self, document_id):
        return FakeReference(self.database, self.id, document_id)


class FakeReference:
    def __init__(self, database, collection, document_id):
        self.database = database
        self.collection = collection
        self.document_id = document_id


class FakeBatch:
    def __init__(self, database):
        self.database = database
        self.writes = []

    def set(self, reference, data):
        self.writes.append((reference, data))

    def commit(self):
        for reference, data in self.writes:
            self.database.documents.setdefault(reference.collection, {})[reference.document_id] = data
        self.writes.clear()


class FakeDatabase:
    def __init__(self, documents):
        self.documents = documents

    def collections(self):
        return [FakeCollection(self, name) for name in self.documents]

    def collection(self, name):
        return FakeCollection(self, name)

    def batch(self):
        return FakeBatch(self)


class FirestoreBackupTests(unittest.TestCase):
    def test_backup_and_restore_preserve_timestamps_and_dry_run_does_not_write(self):
        timestamp = datetime(2026, 10, 1, 12, 30, tzinfo=timezone.utc)
        source = FakeDatabase({"listings": {"one": {"createdAt": timestamp, "nested": [timestamp]}}})
        destination = FakeDatabase({})

        with tempfile.TemporaryDirectory() as directory:
            backup_path = Path(directory) / "backup.jsonl"
            self.assertEqual(write_backup(source, backup_path), {"listings": 1})
            record = json.loads(backup_path.read_text(encoding="utf-8"))
            self.assertEqual(record["d"]["createdAt"], {"-_ts-_": timestamp.isoformat()})

            self.assertEqual(restore_backup(destination, backup_path), {"listings": 1})
            self.assertEqual(destination.documents, {})

            self.assertEqual(restore_backup(destination, backup_path, apply=True), {"listings": 1})
            restored = destination.documents["listings"]["one"]
            self.assertEqual(restored["createdAt"], timestamp)
            self.assertEqual(restored["nested"], [timestamp])

    def test_restore_validates_entire_backup_before_writing(self):
        valid_record = {"c": "listings", "id": "one", "d": {"value": 1}}
        destination = FakeDatabase({})

        with tempfile.TemporaryDirectory() as directory:
            backup_path = Path(directory) / "bad-backup.jsonl"
            backup_path.write_text(json.dumps(valid_record) + "\nnot-json\n", encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "Invalid JSON"):
                restore_backup(destination, backup_path, apply=True)

        self.assertEqual(destination.documents, {})

    def test_backup_refuses_to_overwrite_an_existing_file(self):
        database = FakeDatabase({})

        with tempfile.TemporaryDirectory() as directory:
            backup_path = Path(directory) / "backup.jsonl"
            backup_path.write_text("keep this backup", encoding="utf-8")

            with self.assertRaises(FileExistsError):
                write_backup(database, backup_path)

            self.assertEqual(backup_path.read_text(encoding="utf-8"), "keep this backup")


if __name__ == "__main__":
    unittest.main()