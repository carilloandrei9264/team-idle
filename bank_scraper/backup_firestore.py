"""Write a JSONL backup of every top-level Firestore collection."""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

try:
    from .database import get_db
except ImportError:
    from database import get_db

TIMESTAMP_MARKER = "-_ts-_"


def encode_value(value):
    if isinstance(value, datetime):
        return {TIMESTAMP_MARKER: value.isoformat()}
    raise TypeError(f"Unsupported Firestore value for JSON backup: {type(value).__name__}")


def write_backup(db, output_path: Path) -> dict[str, int]:
    """Write documents atomically and return the number saved per collection."""
    counts = {}
    temporary_path = output_path.with_name(output_path.name + ".tmp")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists() or temporary_path.exists():
        raise FileExistsError("Backup output already exists; choose a new path.")

    try:
        with temporary_path.open("x", encoding="utf-8", newline="\n") as backup_file:
            for collection in sorted(db.collections(), key=lambda item: item.id):
                count = 0
                for snapshot in collection.stream():
                    record = {"c": collection.id, "id": snapshot.id, "d": snapshot.to_dict()}
                    backup_file.write(json.dumps(record, default=encode_value, ensure_ascii=False) + "\n")
                    count += 1
                counts[collection.id] = count
        temporary_path.replace(output_path)
    except Exception:
        temporary_path.unlink(missing_ok=True)
        raise

    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path.home() / "TrustHomeBackups" / f"backup-{datetime.now():%Y%m%d-%H%M%S}.jsonl",
        help="private local destination (default: timestamped file under the home directory)",
    )
    args = parser.parse_args()
    counts = write_backup(get_db(), args.output)
    for collection, count in sorted(counts.items()):
        print(f"{collection}: {count}")
    print(f"Backup written: {args.output}")
    print("Store this personal-data file in a private, access-controlled location.")


if __name__ == "__main__":
    main()