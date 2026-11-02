"""Restore a JSONL Firestore backup; writes require the explicit --apply flag."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import datetime
from pathlib import Path

try:
    from .database import get_db
except ImportError:
    from database import get_db

TIMESTAMP_MARKER = "-_ts-_"
BATCH_WRITE_LIMIT = 400


def decode_value(value):
    if isinstance(value, dict):
        if set(value) == {TIMESTAMP_MARKER}:
            timestamp = value[TIMESTAMP_MARKER]
            if not isinstance(timestamp, str):
                raise ValueError("Invalid timestamp marker in backup.")
            try:
                return datetime.fromisoformat(timestamp)
            except ValueError as error:
                raise ValueError("Invalid timestamp marker in backup.") from error
        return {key: decode_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [decode_value(item) for item in value]
    return value


def read_record(line: str, line_number: int) -> tuple[str, str, dict]:
    try:
        record = json.loads(line)
    except json.JSONDecodeError as error:
        raise ValueError(f"Invalid JSON on backup line {line_number}.") from error
    if not isinstance(record, dict) or set(record) != {"c", "id", "d"}:
        raise ValueError(f"Invalid document record on backup line {line_number}.")
    collection, document_id, data = record["c"], record["id"], record["d"]
    if (not isinstance(collection, str) or not collection or "/" in collection
            or not isinstance(document_id, str) or not document_id or "/" in document_id
            or not isinstance(data, dict)):
        raise ValueError(f"Invalid document path or data on backup line {line_number}.")
    return collection, document_id, data


def inspect_backup(backup_path: Path) -> dict[str, int]:
    """Validate all records and timestamps before a restore can write anything."""
    counts = Counter()
    seen = set()
    with backup_path.open(encoding="utf-8") as backup_file:
        for line_number, line in enumerate(backup_file, start=1):
            if not line.strip():
                raise ValueError(f"Empty record on backup line {line_number}.")
            collection, document_id, data = read_record(line, line_number)
            identity = (collection, document_id)
            if identity in seen:
                raise ValueError(f"Duplicate document on backup line {line_number}.")
            seen.add(identity)
            decode_value(data)
            counts[collection] += 1
    if not seen:
        raise ValueError("Backup contains no document records.")
    return dict(counts)


def restore_backup(db, backup_path: Path, apply: bool = False) -> dict[str, int]:
    """Report counts by default; replace backed-up documents only with apply=True."""
    counts = inspect_backup(backup_path)
    if not apply:
        return counts

    batch = db.batch()
    pending_writes = 0
    with backup_path.open(encoding="utf-8") as backup_file:
        for line_number, line in enumerate(backup_file, start=1):
            collection, document_id, data = read_record(line, line_number)
            batch.set(db.collection(collection).document(document_id), decode_value(data))
            pending_writes += 1
            if pending_writes >= BATCH_WRITE_LIMIT:
                batch.commit()
                batch = db.batch()
                pending_writes = 0
    if pending_writes:
        batch.commit()
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("backup", type=Path, help="JSONL backup file")
    parser.add_argument("--apply", action="store_true", help="write the restore; default is dry-run")
    args = parser.parse_args()
    counts = restore_backup(get_db(), args.backup, apply=args.apply)
    mode = "Restored" if args.apply else "Dry run"
    for collection, count in sorted(counts.items()):
        print(f"{collection}: {count}")
    print(f"{mode}: {sum(counts.values())} documents")


if __name__ == "__main__":
    main()