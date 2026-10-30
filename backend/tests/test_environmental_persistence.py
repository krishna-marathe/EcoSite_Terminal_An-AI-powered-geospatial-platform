"""Database-only tests for the synthetic environmental persistence contract."""

import tempfile
import unittest
from pathlib import Path
from uuid import uuid4

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app import db
from backend.app.data.models import DataSource, IngestionRun, RawSnapshot
from backend.app.models.environmental import (
    EnvironmentalObservation,
    EnvironmentalRollup,
    FacilityStationLink,
    MetricDefinition,
    MonitoringStation,
)
from backend.app.models.public_registry import PublicFacilityRecord
from backend.scripts.import_public_registry import import_public_registry


ROOT = Path(__file__).resolve().parents[2]
SYNTHETIC_SOURCE_ID = "synthetic_environment_test_only"
SYNTHETIC_TIME = "2026-10-29T08:00:00Z"


def migration_config(path: Path) -> Config:
    config = Config(str(ROOT / "backend" / "alembic.ini"))
    config.attributes["db_path"] = path
    return config


def synthetic_source() -> DataSource:
    return DataSource(
        id=SYNTHETIC_SOURCE_ID,
        provider="SYNTHETIC TEST PROVIDER - NOT REAL DATA",
        dataset_name="Synthetic environmental persistence fixture",
        dataset_version="test-v1",
        data_category="AUTHORITY",
        priority="P2",
        access_method="manual",
        authentication="test fixture only",
        base_url=None,
        exact_endpoint=None,
        licence="Synthetic test fixture; not for publication",
        licence_url=None,
        attribution="SYNTHETIC TEST ONLY",
        can_cache=True,
        can_redistribute=False,
        commercial_use=False,
        resolution="Synthetic point",
        temporal_resolution="Synthetic hourly",
        coverage="Tests only",
        observation_period="Synthetic",
        latest_release="test-v1",
        update_frequency="Never",
        join_key_or_geometry="Synthetic station ID",
        test_status="VALIDATED",
        fallback="None",
        owner="Test suite",
        next_action="Delete with disposable database",
        runtime_status="NOT_CONNECTED",
        last_checked_at=None,
        last_success_at=None,
        quality_notes="SYNTHETIC_DEMO test fixture; never real or public",
        created_at=SYNTHETIC_TIME,
        updated_at=SYNTHETIC_TIME,
    )


class EnvironmentalPersistenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.path = self.temp / "environmental.db"

    def test_fresh_database_reaches_environmental_head_with_required_indexes(self):
        config = migration_config(self.path)
        command.upgrade(config, "head")
        command.check(config)
        engine = db.make_engine(self.path)
        try:
            with engine.connect() as connection:
                schema = inspect(connection)
                self.assertEqual(connection.exec_driver_sql("SELECT version_num FROM alembic_version").scalar(), db.SCHEMA_REVISION)
                for table in (
                    "metric_definitions", "monitoring_stations", "facility_station_links",
                    "environmental_observations", "environmental_rollups",
                ):
                    self.assertIn(table, schema.get_table_names())
                observation_indexes = {item["name"] for item in schema.get_indexes("environmental_observations")}
                self.assertIn("ix_environmental_observations_station_metric_time", observation_indexes)
                self.assertIn("ix_environmental_observations_facility_metric_time", observation_indexes)
                self.assertIn("ix_environmental_observations_source_retrieved", observation_indexes)
                rollup_indexes = {item["name"] for item in schema.get_indexes("environmental_rollups")}
                self.assertIn("ix_environmental_rollups_metric_bucket_interval", rollup_indexes)
                self.assertIn("ix_environmental_rollups_station_metric_bucket", rollup_indexes)
        finally:
            engine.dispose()

    def test_upgrade_from_public_registry_preserves_all_19_facilities(self):
        config = migration_config(self.path)
        command.upgrade(config, "04a_001")
        imported = import_public_registry(self.path)
        self.assertEqual(imported["facilities"], 19)
        command.upgrade(config, "head")
        engine = db.make_engine(self.path)
        try:
            with Session(engine) as session:
                self.assertEqual(len(session.scalars(select(PublicFacilityRecord.id)).all()), 19)
                self.assertEqual(session.scalar(select(MetricDefinition.key).limit(1)), None)
        finally:
            engine.dispose()

    def test_synthetic_round_trip_reuses_provenance_and_preserves_units_times_quality(self):
        command.upgrade(migration_config(self.path), "head")
        import_public_registry(self.path)
        engine = db.make_engine(self.path)
        try:
            with Session(engine) as session, session.begin():
                source = synthetic_source()
                session.add(source)
                metric = MetricDefinition(
                    key="pm25", display_name="PM2.5", family="air_quality", canonical_unit="ug/m3",
                    value_kind="numeric", preferred_aggregation="mean", default_range="24h",
                    stale_after_seconds=7200, valid_min=0, valid_max=2000,
                    description="Synthetic test metric", created_at=SYNTHETIC_TIME, updated_at=SYNTHETIC_TIME,
                )
                station = MonitoringStation(
                    id="synthetic-station-001", source_id=SYNTHETIC_SOURCE_ID, native_station_id="TEST-001",
                    name="Synthetic Station 001", provider="SYNTHETIC TEST PROVIDER - NOT REAL DATA",
                    state_code="IN-MH", district="Synthetic District", locality="Synthetic Locality",
                    public_longitude=72.9, public_latitude=19.1, station_type="synthetic_test_station",
                    measured_metrics=["pm25"], status="ACTIVE", first_seen_at=SYNTHETIC_TIME,
                    last_seen_at=SYNTHETIC_TIME, metadata_json={"synthetic": True}, visibility="PUBLIC",
                    created_at=SYNTHETIC_TIME, updated_at=SYNTHETIC_TIME,
                )
                session.add_all([metric, station])
                session.flush()
                facility_id = session.scalar(select(PublicFacilityRecord.id).order_by(PublicFacilityRecord.id).limit(1))
                link = FacilityStationLink(
                    id=str(uuid4()), facility_id=facility_id, station_id=station.id, metric_key=metric.key,
                    distance_km=2.4, selection_method="nearest_eligible", effective_at="2026-10-01T00:00:00Z",
                    expires_at=None, is_primary=True, processing_version="synthetic-test-v1",
                    selection_metadata={"synthetic": True}, created_at=SYNTHETIC_TIME,
                )
                run = IngestionRun(
                    id=str(uuid4()), source_id=SYNTHETIC_SOURCE_ID, started_at="2026-10-29T08:35:00Z",
                    finished_at="2026-10-29T08:36:00Z", status="success", http_status=None, bytes=123,
                    sha256="a" * 64, parser_version="synthetic-test-v1", error=None,
                )
                snapshot = RawSnapshot(
                    id=str(uuid4()), source_id=SYNTHETIC_SOURCE_ID, run_id=run.id,
                    path="synthetic/test-only.json", sha256="b" * 64, content_type="application/json",
                    fetched_at="2026-10-29T08:35:30Z", expires_at=None,
                )
                session.add_all([link, run, snapshot])
                session.flush()
                observation = EnvironmentalObservation(
                    id=str(uuid4()), source_id=SYNTHETIC_SOURCE_ID, station_id=station.id,
                    facility_id=None, metric_key=metric.key, ingestion_run_id=run.id, raw_snapshot_id=snapshot.id,
                    value=41.2, category_value=None, canonical_unit="ug/m3", original_value=0.0412,
                    original_category_value=None, original_unit="mg/m3", status="AVAILABLE",
                    quality="preliminary", evidence_class="MEASURED", temporal_class="NEAR_REAL_TIME",
                    visibility="PUBLIC", observed_at="2026-10-29T08:00:00Z",
                    published_at="2026-10-29T08:30:00Z", retrieved_at="2026-10-29T08:35:30Z",
                    quality_flags=["synthetic_test_only"], missing_reason=None,
                    provider_dedupe_key="TEST-001:pm25:2026-10-29T08:00:00Z", created_at=SYNTHETIC_TIME,
                )
                rollup = EnvironmentalRollup(
                    id=str(uuid4()), source_id=SYNTHETIC_SOURCE_ID, station_id=station.id, metric_key=metric.key,
                    interval="hour", bucket_start="2026-10-29T08:00:00Z", bucket_end="2026-10-29T09:00:00Z",
                    value=41.2, minimum=41.2, maximum=41.2, total=41.2, latest=41.2,
                    category_latest=None, canonical_unit="ug/m3", status="AVAILABLE", quality="preliminary",
                    sample_count=1, valid_sample_count=1, expected_sample_count=1, coverage_fraction=1.0,
                    quality_flags=["synthetic_test_only"], processing_version="synthetic-test-v1",
                    generated_at="2026-10-29T09:00:01Z",
                )
                session.add_all([observation, rollup])

            with Session(engine) as session:
                saved = session.scalar(select(EnvironmentalObservation))
                self.assertEqual((saved.canonical_unit, saved.original_unit), ("ug/m3", "mg/m3"))
                self.assertEqual((saved.value, saved.original_value), (41.2, 0.0412))
                self.assertEqual(
                    (saved.observed_at, saved.published_at, saved.retrieved_at),
                    ("2026-10-29T08:00:00Z", "2026-10-29T08:30:00Z", "2026-10-29T08:35:30Z"),
                )
                self.assertEqual((saved.status, saved.quality), ("AVAILABLE", "preliminary"))
                self.assertIsNotNone(saved.ingestion_run_id)
                self.assertIsNotNone(saved.raw_snapshot_id)
                saved_link = session.scalar(select(FacilityStationLink))
                self.assertEqual((saved_link.distance_km, saved_link.selection_method), (2.4, "nearest_eligible"))
                saved_rollup = session.scalar(select(EnvironmentalRollup))
                self.assertEqual((saved_rollup.value, saved_rollup.coverage_fraction), (41.2, 1.0))
        finally:
            engine.dispose()

    def test_provider_dedupe_key_is_unique_per_source(self):
        command.upgrade(migration_config(self.path), "head")
        engine = db.make_engine(self.path)
        try:
            with Session(engine) as session, session.begin():
                session.add(synthetic_source())
                session.add(MetricDefinition(
                    key="temperature", display_name="Temperature", family="weather", canonical_unit="degC",
                    value_kind="numeric", preferred_aggregation="min_max_mean", default_range="24h",
                    stale_after_seconds=7200, valid_min=-80, valid_max=70, description="Synthetic test metric",
                    created_at=SYNTHETIC_TIME, updated_at=SYNTHETIC_TIME,
                ))
                session.add(MonitoringStation(
                    id="synthetic-station-dedupe", source_id=SYNTHETIC_SOURCE_ID, native_station_id="TEST-D",
                    name="Synthetic Dedupe Station", provider="SYNTHETIC TEST PROVIDER - NOT REAL DATA",
                    state_code=None, district=None, locality=None, public_longitude=77.0, public_latitude=13.0,
                    station_type="synthetic_test_station", measured_metrics=["temperature"], status="ACTIVE",
                    first_seen_at=None, last_seen_at=None, metadata_json={"synthetic": True}, visibility="PUBLIC",
                    created_at=SYNTHETIC_TIME, updated_at=SYNTHETIC_TIME,
                ))
            common = dict(
                source_id=SYNTHETIC_SOURCE_ID, station_id="synthetic-station-dedupe", facility_id=None,
                metric_key="temperature", ingestion_run_id=None, raw_snapshot_id=None, value=29.0,
                category_value=None, canonical_unit="degC", original_value=29.0,
                original_category_value=None, original_unit="degC", status="AVAILABLE", quality="unknown",
                evidence_class="MEASURED", temporal_class="NEAR_REAL_TIME", visibility="PUBLIC",
                observed_at=SYNTHETIC_TIME, published_at=None, retrieved_at=SYNTHETIC_TIME,
                quality_flags=["synthetic_test_only"], missing_reason=None, provider_dedupe_key="same-key",
                created_at=SYNTHETIC_TIME,
            )
            with Session(engine) as session:
                session.add(EnvironmentalObservation(id=str(uuid4()), **common))
                session.commit()
                session.add(EnvironmentalObservation(id=str(uuid4()), **common))
                with self.assertRaises(IntegrityError):
                    session.commit()
        finally:
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
