"""Restore the seven full-run CSVs and check their original SHA-256 digests."""
import gzip
import hashlib
import json
import shutil
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parent
expected = json.loads((root / "analysis/verification.json").read_text(encoding="utf-8"))["sha256"]
for name, digest in expected.items():
    csv = root / "results" / name
    with gzip.open(str(csv) + ".gz", "rb") as src, tempfile.NamedTemporaryFile(dir=csv.parent, delete=False) as dst:
        tmp = Path(dst.name)
        shutil.copyfileobj(src, dst)
    try:
        with tmp.open("rb") as f:
            if hashlib.file_digest(f, "sha256").hexdigest() != digest:
                raise ValueError(f"Integrity check failed for {name}")
        tmp.replace(csv)
        print(f"Verified {name}")
    finally:
        tmp.unlink(missing_ok=True)