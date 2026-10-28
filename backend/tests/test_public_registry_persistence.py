"""Database parity and idempotency tests for the normalized public registry."""

import hashlib
import json
import shutil
import tempfile
import unittest
from datetime import date
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from backend.app import db
from backend.app.models.public_registry import (
    FacilityCapacityDisclosure,
    FacilityOperator,
    FacilitySource,
    FacilityVerification,
    PublicFacilityRecord,
    PublicFacilitySnapshot,
)
from backend.scripts.import_public_registry import canonical_payload, import_public_registry


ROOT = Path(__file__).resolve().parents[2]
SEED_PATH = ROOT / "data" / "public_data_centres.json"


def migration_config(path: Path) -> Config:
    config = Config(str(ROOT / "backend" / "alembic.ini"))
    config.attributes["db_path"] = path
    return config


class PublicRegistryPersistenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.path = self.temp / "registry.db"
        command.upgrade(migration_config(self.path), "head")
        self.seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))

    def test_import_has_exact_seed_parity_and_preserves_nested_contracts(self):
        expected_capacities = sum(len(record["capacityDisclosures"]) for record in self.seed["facilities"])
        stats = import_public_registry(self.path)
        self.assertEqual(
            stats,
            {
                "operators": len({record["operator"] for record in self.seed["facilities"]}),
                "facilities": 19,
                "capacities": expected_capacities,
                "sources": 19,
                "verifications": 19,
                "snapshots": 19,
            },
        )

        engine = db.make_engine(self.path)
        try:
            with Session(engine) as session:
                for expected in self.seed["facilities"]:
                    facility = session.get(PublicFacilityRecord, expected["id"])
                    self.assertIsNotNone(facility)
                    operator = session.get(FacilityOperator, facility.operator_id)
                    self.assertEqual(operator.name, expected["operator"])
                    self.assertEqual(
                        (
                            facility.name, facility.ownership_category, facility.facility_type,
                            facility.state_code, facility.state_name, facility.city, facility.locality,
                            facility.public_longitude, facility.public_latitude, facility.location_precision,
                            facility.operational_since, facility.registry_version,
                        ),
                        (
                            expected["name"], expected["ownershipCategory"], expected["facilityType"],
                            expected["stateCode"], expected["state"], expected["city"], expected["locality"],
                            float(expected["publicCoordinates"][0]), float(expected["publicCoordinates"][1]),
                            expected["locationPrecision"], expected.get("operationalSince"), self.seed["registryVersion"],
                        ),
                    )

                    capacities = session.scalars(
                        select(FacilityCapacityDisclosure)
                        .where(FacilityCapacityDisclosure.facility_id == expected["id"])
                        .order_by(FacilityCapacityDisclosure.ordinal)
                    ).all()
                    self.assertEqual(
                        [(row.value, row.unit, row.capacity_type, row.scope) for row in capacities],
                        [
                            (float(item["value"]), item["unit"], item["capacityType"], item["scope"])
                            for item in expected["capacityDisclosures"]
                        ],
                    )

                    verification = session.scalar(
                        select(FacilityVerification).where(FacilityVerification.facility_id == expected["id"])
                    )
                    source = session.get(FacilitySource, verification.source_id)
                    expected_verification = expected["verification"]
                    expected_source = expected_verification["source"]
                    self.assertEqual(
                        (verification.status, verification.verified_at, verification.expires_at),
                        (expected_verification["status"], expected_verification["verifiedAt"], expected_verification["expiresAt"]),
                    )
                    self.assertEqual(
                        (source.title, source.publisher, source.url, source.source_class, source.retrieved_at),
                        (
                            expected_source["title"], expected_source["publisher"], expected_source["url"],
                            expected_source["sourceClass"], expected_source["retrievedAt"],
                        ),
                    )
                    self.assertEqual(source.evidence_class, "DOCUMENTED")

                    snapshot = session.scalar(
                        select(PublicFacilitySnapshot).where(
                            PublicFacilitySnapshot.facility_id == expected["id"],
                            PublicFacilitySnapshot.is_current.is_(True),
                        )
                    )
                    self.assertEqual(snapshot.payload, expected)
                    self.assertEqual(
                        snapshot.payload_sha256,
                        hashlib.sha256(canonical_payload(expected).encode("utf-8")).hexdigest(),
                    )
                    self.assertEqual(snapshot.approval_basis, "reviewed_public_seed")
        finally:
            engine.dispose()

    def test_verification_windows_are_at_most_90_days(self):
        import_public_registry(self.path)
        engine = db.make_engine(self.path)
        try:
            with Session(engine) as session:
                rows = session.scalars(select(FacilityVerification)).all()
                self.assertEqual(len(rows), 19)
                for row in rows:
                    days = (date.fromisoformat(row.expires_at) - date.fromisoformat(row.verified_at)).days
                    self.assertGreaterEqual(days, 1)
                    self.assertLessEqual(days, 90)
        finally:
            engine.dispose()

    def test_public_schema_and_snapshots_have_no_restricted_geometry(self):
        import_public_registry(self.path)
        engine = db.make_engine(self.path)
        try:
            with engine.connect() as connection:
                column_names = {column["name"] for column in inspect(connection).get_columns("public_facilities")}
                self.assertIn("public_longitude", column_names)
                self.assertIn("public_latitude", column_names)
                self.assertFalse(any("exact" in name or "restricted" in name for name in column_names))
            with Session(engine) as session:
                for payload in session.scalars(select(PublicFacilitySnapshot.payload)):
                    self.assertIn("publicCoordinates", payload)
                    self.assertNotIn("exactGeometry", payload)
                    self.assertNotIn("restrictedGeometry", payload)
        finally:
            engine.dispose()

    def test_repeated_import_on_copied_database_is_idempotent(self):
        first = import_public_registry(self.path)
        copied = self.temp / "registry-copy.db"
        shutil.copy2(self.path, copied)

        engine = db.make_engine(copied)
        try:
            with Session(engine) as session:
                ids_before = {
                    "facilities": tuple(session.scalars(select(PublicFacilityRecord.id).order_by(PublicFacilityRecord.id))),
                    "capacities": tuple(session.scalars(select(FacilityCapacityDisclosure.id).order_by(FacilityCapacityDisclosure.id))),
                    "sources": tuple(session.scalars(select(FacilitySource.id).order_by(FacilitySource.id))),
                    "verifications": tuple(session.scalars(select(FacilityVerification.id).order_by(FacilityVerification.id))),
                    "snapshots": tuple(session.scalars(select(PublicFacilitySnapshot.id).order_by(PublicFacilitySnapshot.id))),
                }
        finally:
            engine.dispose()

        second = import_public_registry(copied)
        self.assertEqual(second, first)
        engine = db.make_engine(copied)
        try:
            with Session(engine) as session:
                ids_after = {
                    "facilities": tuple(session.scalars(select(PublicFacilityRecord.id).order_by(PublicFacilityRecord.id))),
                    "capacities": tuple(session.scalars(select(FacilityCapacityDisclosure.id).order_by(FacilityCapacityDisclosure.id))),
                    "sources": tuple(session.scalars(select(FacilitySource.id).order_by(FacilitySource.id))),
                    "verifications": tuple(session.scalars(select(FacilityVerification.id).order_by(FacilityVerification.id))),
                    "snapshots": tuple(session.scalars(select(PublicFacilitySnapshot.id).order_by(PublicFacilitySnapshot.id))),
                }
                self.assertEqual(ids_after, ids_before)
        finally:
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
