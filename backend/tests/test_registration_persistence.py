"""Persistence, privacy and state-machine tests for registration/review."""

import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from uuid import uuid4

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app import db
from backend.app.models.environmental import MetricDefinition
from backend.app.models.public_registry import (
    FacilityOperator,
    FacilityVerification,
    PublicFacilityRecord,
    PublicFacilitySnapshot,
)
from backend.app.models.registration import (
    AuditEvent,
    FacilitySubmission,
    FacilitySubmissionRevision,
    OperatorOrganisation,
    PublicationSnapshot,
    ReviewEvent,
    SubmissionEvidence,
    SubmissionExactGeometry,
)
from backend.scripts.import_public_registry import import_public_registry


ROOT = Path(__file__).resolve().parents[2]
NOW = "2026-10-29T10:00:00Z"


def migration_config(path: Path) -> Config:
    config = Config(str(ROOT / "backend" / "alembic.ini"))
    config.attributes["db_path"] = path
    return config


def canonical_hash(payload: dict) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


class RegistrationPersistenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.path = self.temp / "registration.db"

    def migrate_and_seed(self):
        command.upgrade(migration_config(self.path), "head")
        import_public_registry(self.path)

    def create_private_draft(self, session: Session):
        public_operator_id = session.scalar(select(FacilityOperator.id).order_by(FacilityOperator.id).limit(1))
        organisation = OperatorOrganisation(
            id="org_synthetic_test", name="Synthetic Test Operator", registration_number="TEST-ONLY-001",
            facility_operator_id=public_operator_id, status="verified", created_at=NOW, updated_at=NOW,
        )
        session.add(organisation)
        session.flush()
        submission = FacilitySubmission(
            id="sub_synthetic_test", operator_organisation_id=organisation.id, status="draft",
            current_revision=1, assigned_reviewer_id=None, submitted_at=None, decided_at=None,
            created_at=NOW, updated_at=NOW,
        )
        session.add(submission)
        session.flush()
        revision = FacilitySubmissionRevision(
            id=str(uuid4()), submission_id=submission.id, revision=1, facility_name="Synthetic Private Campus",
            facility_type="colocation", ownership_category="private", state_code="IN-MH", city="Mumbai",
            locality="Synthetic locality", operational_since=2026, capacity_disclosures=[],
            actor_id="demo-operator", actor_role="operator", change_reason="Initial synthetic test draft",
            created_at=NOW,
        )
        session.add(revision)
        session.flush()
        geometry_payload = {"type": "Point", "coordinates": [72.889432, 19.112345]}
        geometry = SubmissionExactGeometry(
            id=str(uuid4()), revision_id=revision.id, geometry_type="Point", geometry_json=geometry_payload,
            geometry_sha256=canonical_hash(geometry_payload), visibility="OPERATOR_PRIVATE", created_at=NOW,
        )
        session.add(geometry)
        session.flush()
        return submission, revision, geometry

    def next_revision(self, session: Session, submission: FacilitySubmission, number: int, actor_role="operator"):
        revision = FacilitySubmissionRevision(
            id=str(uuid4()), submission_id=submission.id, revision=number, facility_name="Synthetic Private Campus",
            facility_type="colocation", ownership_category="private", state_code="IN-MH", city="Mumbai",
            locality="Synthetic locality", operational_since=2026,
            capacity_disclosures=[{"value": 16, "unit": "MW", "capacityType": "it_load", "scope": "phase 1"}],
            actor_id="demo-operator" if actor_role == "operator" else "demo-ministry-reviewer",
            actor_role=actor_role, change_reason=f"Synthetic revision {number}", created_at=NOW,
        )
        session.add(revision)
        session.flush()
        return revision

    def test_fresh_and_04b_upgrade_preserve_registry_and_environmental_schema(self):
        config = migration_config(self.path)
        command.upgrade(config, "04b_001")
        self.assertEqual(import_public_registry(self.path)["facilities"], 19)
        engine = db.make_engine(self.path)
        try:
            with Session(engine) as session, session.begin():
                session.add(MetricDefinition(
                    key="synthetic_upgrade_metric", display_name="Synthetic upgrade metric", family="test",
                    canonical_unit="index", value_kind="index", preferred_aggregation="latest",
                    default_range="24h", stale_after_seconds=3600, valid_min=0, valid_max=1,
                    description="Synthetic test only", created_at=NOW, updated_at=NOW,
                ))
        finally:
            engine.dispose()
        command.upgrade(config, "head")
        command.check(config)
        engine = db.make_engine(self.path)
        try:
            with Session(engine) as session:
                self.assertEqual(len(session.scalars(select(PublicFacilityRecord.id)).all()), 19)
                self.assertIsNotNone(session.get(MetricDefinition, "synthetic_upgrade_metric"))
                self.assertEqual(session.execute(text("SELECT version_num FROM alembic_version")).scalar(), "04c_001")
        finally:
            engine.dispose()

    def test_exact_geometry_is_physically_private_and_no_blob_columns_exist(self):
        self.migrate_and_seed()
        engine = db.make_engine(self.path)
        try:
            with engine.connect() as connection:
                schema = inspect(connection)
                for table in ("public_facilities", "public_facility_snapshots", "facility_submissions", "facility_submission_revisions"):
                    names = {column["name"].lower() for column in schema.get_columns(table)}
                    self.assertFalse(any("exact" in name or "geometry" in name for name in names), table)
                private_names = {column["name"] for column in schema.get_columns("submission_exact_geometries")}
                self.assertIn("geometry_json", private_names)
                evidence_types = {str(column["type"]).upper() for column in schema.get_columns("submission_evidence")}
                self.assertFalse(any("BLOB" in value for value in evidence_types))
            with Session(engine) as session, session.begin():
                _, _, geometry = self.create_private_draft(session)
                self.assertEqual(geometry.visibility, "OPERATOR_PRIVATE")
        finally:
            engine.dispose()

    def test_revision_state_machine_fk_integrity_and_append_only_history(self):
        self.migrate_and_seed()
        engine = db.make_engine(self.path)
        try:
            with Session(engine) as session, session.begin():
                submission, _, _ = self.create_private_draft(session)
                self.next_revision(session, submission, 2)
                submission.status = "submitted"
                submission.current_revision = 2
                submission.submitted_at = NOW
                submission.updated_at = NOW
                session.flush()
                self.assertEqual(submission.status, "submitted")

            with Session(engine) as session:
                revision1 = session.scalar(
                    select(FacilitySubmissionRevision).where(
                        FacilitySubmissionRevision.submission_id == "sub_synthetic_test",
                        FacilitySubmissionRevision.revision == 1,
                    )
                )
                with self.assertRaises(IntegrityError):
                    session.execute(text("UPDATE facility_submission_revisions SET facility_name='tampered' WHERE id=:id"), {"id": revision1.id})
                session.rollback()

            with Session(engine) as session:
                submission = session.get(FacilitySubmission, "sub_synthetic_test")
                self.assertEqual((submission.status, submission.current_revision), ("submitted", 2))
                self.next_revision(session, submission, 3)
                submission.status = "draft"
                submission.current_revision = 3
                with self.assertRaises(IntegrityError):
                    session.commit()
                session.rollback()

                session.add(SubmissionEvidence(
                    id=str(uuid4()), revision_id="00000000-0000-0000-0000-000000000000",
                    title="Invalid synthetic evidence", evidence_type="test", storage_path="test/evidence.pdf",
                    external_url=None, sha256="a" * 64, content_type="application/pdf", file_size_bytes=1,
                    issuer=None, issued_at=None, evidence_class="DECLARED", visibility="OPERATOR_PRIVATE",
                    created_at=NOW,
                ))
                with self.assertRaises(IntegrityError):
                    session.commit()
                session.rollback()

            with engine.connect() as connection:
                trigger_names = set(connection.scalars(text("SELECT name FROM sqlite_master WHERE type='trigger'")))
                for table in (
                    "facility_submission_revisions", "submission_exact_geometries", "submission_evidence",
                    "review_events", "publication_snapshots", "audit_events",
                ):
                    self.assertIn(f"trg_{table}_immutable_update", trigger_names)
                    self.assertIn(f"trg_{table}_immutable_delete", trigger_names)
        finally:
            engine.dispose()

    def test_publication_requires_matching_approved_transaction_and_is_immutable(self):
        self.migrate_and_seed()
        engine = db.make_engine(self.path)
        try:
            with Session(engine) as session, session.begin():
                submission, _, _ = self.create_private_draft(session)
                revision2 = self.next_revision(session, submission, 2)
                submission.status = "submitted"
                submission.current_revision = 2
                submission.submitted_at = NOW
                session.flush()
                revision3 = self.next_revision(session, submission, 3, actor_role="ministry_reviewer")
                submission.status = "approved"
                submission.current_revision = 3
                submission.decided_at = NOW
                session.flush()
                review = ReviewEvent(
                    id=str(uuid4()), submission_id=submission.id, revision_id=revision3.id, action="approve",
                    actor_id="demo-ministry-reviewer", actor_role="ministry_reviewer", from_status="submitted",
                    to_status="approved", reason="Synthetic approval test", requested_fields=[], created_at=NOW,
                )
                audit = AuditEvent(
                    id=str(uuid4()), submission_id=submission.id, actor_id="demo-ministry-reviewer",
                    actor_role="ministry_reviewer", action="submission.approved", entity_type="facility_submission",
                    entity_id=submission.id, request_id="synthetic-request", metadata_json={"synthetic": True},
                    occurred_at=NOW,
                )
                session.add_all([review, audit])
                session.flush()

                public_facility_id = session.scalar(select(PublicFacilityRecord.id).order_by(PublicFacilityRecord.id).limit(1))
                verification_id = session.scalar(
                    select(FacilityVerification.id).where(FacilityVerification.facility_id == public_facility_id).limit(1)
                )
                payload = {
                    "id": public_facility_id,
                    "name": "Synthetic approved public snapshot",
                    "publicCoordinates": [72.889, 19.112],
                    "locationPrecision": "locality",
                }
                payload_sha = canonical_hash(payload)
                public_snapshot = PublicFacilitySnapshot(
                    id=str(uuid4()), facility_id=public_facility_id, verification_id=verification_id,
                    registry_version="synthetic-ministry-review-v1", payload=payload, payload_sha256=payload_sha,
                    approval_basis="ministry_review", approved_by="demo-ministry-reviewer", approved_at=NOW,
                    is_current=True, visibility="PUBLIC", created_at=NOW,
                )
                session.add(public_snapshot)
                session.flush()
                publication = PublicationSnapshot(
                    id=str(uuid4()), submission_id=submission.id, revision_id=revision3.id,
                    review_event_id=review.id, public_facility_id=public_facility_id,
                    public_snapshot_id=public_snapshot.id, publication_version=1, payload_sha256=payload_sha,
                    published_by="demo-ministry-reviewer", published_at=NOW,
                )
                session.add(publication)
                session.flush()
                publication_id = publication.id

            with Session(engine) as session:
                saved = session.get(PublicationSnapshot, publication_id)
                self.assertEqual(saved.payload_sha256, payload_sha)
                with self.assertRaises(IntegrityError):
                    session.execute(text("UPDATE publication_snapshots SET published_by='tampered' WHERE id=:id"), {"id": publication_id})
                session.rollback()

            with Session(engine) as session:
                submission = session.get(FacilitySubmission, "sub_synthetic_test")
                revision = session.scalar(
                    select(FacilitySubmissionRevision).where(
                        FacilitySubmissionRevision.submission_id == submission.id,
                        FacilitySubmissionRevision.revision == 3,
                    )
                )
                seed_snapshot = session.scalar(
                    select(PublicFacilitySnapshot).where(PublicFacilitySnapshot.approval_basis == "reviewed_public_seed").limit(1)
                )
                review = session.scalar(select(ReviewEvent).where(ReviewEvent.action == "approve"))
                second_review = ReviewEvent(
                    id=str(uuid4()), submission_id=submission.id, revision_id=revision.id, action="approve",
                    actor_id="demo-ministry-reviewer", actor_role="ministry_reviewer", from_status="submitted",
                    to_status="approved", reason="Synthetic invalid publication test", requested_fields=[], created_at=NOW,
                )
                session.add(second_review)
                session.flush()
                session.add(PublicationSnapshot(
                    id=str(uuid4()), submission_id=submission.id, revision_id=revision.id,
                    review_event_id=second_review.id, public_facility_id=seed_snapshot.facility_id,
                    public_snapshot_id=seed_snapshot.id, publication_version=2,
                    payload_sha256=seed_snapshot.payload_sha256, published_by="demo-ministry-reviewer", published_at=NOW,
                ))
                with self.assertRaises(IntegrityError):
                    session.commit()
        finally:
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
