"""Regenerate the dataset catalogue from the source registry.

Outputs:
  data/data-sources.json
  docs/data/DATA_SOURCE_REGISTRY.csv

Run from anywhere:
  backend/.venv/Scripts/python.exe backend/scripts/export_catalogue.py
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.data.registry import DATA_SOURCES, RUNTIME_STATUSES, TEST_STATUSES  # noqa: E402
from backend.app.state_scope import scope_payload  # noqa: E402

COLUMNS = [
    ("source_id", "id"),
    ("dataset_name", "dataset_name"),
    ("provider", "provider"),
    ("data_category", "data_category"),
    ("priority", "priority"),
    ("product_scope", None),
    ("official_url", "base_url"),
    ("exact_endpoint", "exact_endpoint"),
    ("access_method", "access_method"),
    ("authentication", "authentication"),
    ("license", "licence"),
    ("attribution", "attribution"),
    ("redistribution_allowed", "can_redistribute"),
    ("commercial_use", "commercial_use"),
    ("coverage", "coverage"),
    ("resolution", "resolution"),
    ("observation_period", "observation_period"),
    ("latest_release", "latest_release"),
    ("join_key_or_geometry", "join_key_or_geometry"),
    ("test_status", "test_status"),
    ("fallback", "fallback"),
    ("owner", "owner"),
    ("next_action", "next_action"),
    ("quality_notes", "quality_notes"),
]


def main() -> None:
    scope = scope_payload()
    payload = {
        "registry_version": "2026-10-27",
        "generated_from": "backend/app/data/registry.py",
        "generated_by": "backend/scripts/export_catalogue.py",
        "scope": scope,
        "note": (
            "Catalogue of every source required by the dashboard. The product is limited to "
            "Telangana, Maharashtra, Karnataka and Tamil Nadu. A source is PROCESSING_TESTED only "
            "after a real candidate polygon produced an observation. JRC and Copernicus STAC "
            "passed live processing tests on 2026-10-27. SRTM remains DISCOVERED because no "
            "Earthdata token was available for a live run. No source is VALIDATED or INTEGRATED."
        ),
        "maturity_gates": list(TEST_STATUSES),
        "runtime_statuses": list(RUNTIME_STATUSES),
        "source_count": len(DATA_SOURCES),
        "sources": DATA_SOURCES,
    }
    json_path = ROOT / "data" / "data-sources.json"
    json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    scope_text = "; ".join(f"{name} ({code})" for code, name in scope["states"].items())
    csv_path = ROOT / "docs" / "data" / "DATA_SOURCE_REGISTRY.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow([name for name, _ in COLUMNS])
        for source in DATA_SOURCES:
            writer.writerow(
                [scope_text if key is None else (source[key] if source[key] is not None else "") for _, key in COLUMNS]
            )

    print(f"wrote {json_path.relative_to(ROOT)} and {csv_path.relative_to(ROOT)}")
    print(f"sources={len(DATA_SOURCES)} scope={scope_text}")


if __name__ == "__main__":
    main()
