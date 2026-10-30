import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app import db
from backend.app.models.public_registry import FacilityOperator, FacilitySource, FacilityVerification, PublicFacilityRecord, PublicFacilitySnapshot
from backend.app.models.registration import AuditEvent, OperatorOrganisation, PublicationSnapshot as PublicationRow, ReviewEvent, SubmissionExactGeometry
from backend.app.services.submission_sqlalchemy import SqlAlchemySubmissionRepository
from backend.app.services.prototype_publication import DuplicatePublicFacilityError, PrototypePublicationResolver
from backend.app.services.submission_workflow import SubmissionDraft, SubmissionWorkflowService, WorkflowActor
from backend.app.services.submission_workflow import RevisionConflict, WorkflowEvent


ROOT = Path(__file__).resolve().parents[2]
NOW = datetime(2026, 10, 29, 10, 0, tzinfo=timezone.utc)


def config(path):
    value = Config(str(ROOT / "backend" / "alembic.ini")); value.attributes["db_path"] = path; return value


class SubmissionPersistenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = self.enterContext(tempfile.TemporaryDirectory())
        self.path = Path(self.temp) / "workflow.db"
        command.upgrade(config(self.path), "head")
        self.engine = db.make_engine(self.path)
        self.addCleanup(self.engine.dispose)
        with Session(self.engine) as session, session.begin():
            session.add(OperatorOrganisation(id="org-1", name="Operator One", status="verified", created_at="2026-10-29T00:00:00Z", updated_at="2026-10-29T00:00:00Z"))
            session.add(FacilityOperator(id="seed-operator", name="Seed Operator", canonical_name="seed operator", created_at="2026-10-01T00:00:00Z", updated_at="2026-10-01T00:00:00Z")); session.flush()
            session.add(PublicFacilityRecord(
                id="seed-facility", operator_id="seed-operator", name="Seed Facility", ownership_category="private",
                facility_type="colocation", state_code="IN-MH", state_name="Maharashtra", city="Mumbai",
                locality="Seed", public_longitude=72.7, public_latitude=19.0, location_precision="locality",
                registry_version="seed-release", visibility="PUBLIC", temporal_class="STATIC_VERSIONED",
                created_at="2026-10-01T00:00:00Z", updated_at="2026-10-01T00:00:00Z",
            )); session.flush()
            session.add(FacilitySource(id="seed-source", facility_id="seed-facility", title="Seed", publisher="Seed Operator", url="https://example.test/seed", source_class="operator", retrieved_at="2026-10-01", evidence_class="DOCUMENTED", visibility="PUBLIC", created_at="2026-10-01T00:00:00Z")); session.flush()
            session.add(FacilityVerification(id="seed-verification", facility_id="seed-facility", source_id="seed-source", status="public_operator_confirmed", verified_at="2026-10-01", expires_at="2026-12-30", created_at="2026-10-01T00:00:00Z")); session.flush()
            session.add(PublicFacilitySnapshot(id="seed-snapshot", facility_id="seed-facility", verification_id="seed-verification", registry_version="seed-release", payload={"id": "seed-facility", "verification": {"verifiedAt": "2026-10-01", "expiresAt": "2026-12-30"}}, payload_sha256="0" * 64, approval_basis="reviewed_public_seed", approved_by="seed", approved_at="2026-10-01T00:00:00Z", is_current=True, visibility="PUBLIC", created_at="2026-10-01T00:00:00Z"))

        self.repository = SqlAlchemySubmissionRepository(lambda: Session(self.engine, expire_on_commit=False), PrototypePublicationResolver())
        self.service = SubmissionWorkflowService(self.repository, lambda: NOW, lambda: "submission-1")
        self.operator = WorkflowActor("operator-user", "operator", "org-1")
        self.reviewer = WorkflowActor("reviewer", "ministry_reviewer")

    def test_full_workflow_is_atomic_private_and_restart_persistent(self):
        item = self.service.create_draft(self.operator, SubmissionDraft(
            "Campus", "org-1", "colocation", "IN-MH", "Mumbai", "Locality",
            {"type": "Point", "coordinates": [72.889432, 19.112345]},
            ({"value": 10, "unit": "MW", "capacityType": "it_load", "scope": "campus"},),
            ({"evidenceType": "source_url", "title": "Operator disclosure", "reference": "https://example.test/campus"},),
        ))
        item = self.service.submit(self.operator, item.id, item.revision)
        result = self.service.review(self.reviewer, item.id, item.revision, "request_information", "Need capacity", ["capacityDisclosures"])
        item = self.service.revise(self.operator, item.id, result.submission.revision, {"capacity_disclosures": ({"value": 10, "unit": "MW", "capacityType": "it_load", "scope": "campus"},)})
        item = self.service.submit(self.operator, item.id, item.revision)
        approved = self.service.review(self.reviewer, item.id, item.revision, "approve", "Reviewed", public_snapshot={
            "id": "published-campus", "name": "Campus", "operator": "Operator One",
            "ownershipCategory": "private", "facilityType": "colocation", "stateCode": "IN-MH",
            "state": "Maharashtra", "city": "Mumbai", "locality": "Locality",
            "publicCoordinates": [72.8, 19.1], "locationPrecision": "locality", "capacityDisclosures": [],
            "verification": {"status": "public_operator_confirmed", "verifiedAt": "2026-10-29", "expiresAt": "2027-01-27",
                "source": {"title": "Reviewed operator evidence", "publisher": "Operator One", "url": "https://example.test/evidence", "sourceClass": "operator", "retrievedAt": "2026-10-29"}},
        })
        self.assertEqual(approved.submission.status, "approved")

        restarted = SqlAlchemySubmissionRepository(lambda: Session(self.engine, expire_on_commit=False), lambda *_: (_ for _ in ()).throw(AssertionError("not called")))
        persisted = restarted.get(item.id)
        self.assertEqual((persisted.status, persisted.revision), ("approved", 6))
        self.assertEqual(persisted.exact_geometry["coordinates"], [72.889432, 19.112345])
        with Session(self.engine) as session:
            public = session.scalar(select(PublicFacilitySnapshot).where(PublicFacilitySnapshot.is_current.is_(True)))
            self.assertNotIn("exactGeometry", public.payload)
            current_versions = set(session.scalars(select(PublicFacilitySnapshot.registry_version).where(PublicFacilitySnapshot.is_current.is_(True))))
            self.assertEqual(len(current_versions), 1)
            self.assertEqual(session.scalar(select(func.count()).select_from(PublicFacilitySnapshot).where(PublicFacilitySnapshot.is_current.is_(True))), 2)
            self.assertEqual(session.scalar(select(func.count()).select_from(PublicationRow)), 1)
            self.assertGreaterEqual(session.scalar(select(func.count()).select_from(AuditEvent)), 6)
            self.assertEqual(session.scalar(select(func.count()).select_from(ReviewEvent)), 2)

    def test_conflict_rolls_back_revision_and_audit(self):
        item = self.service.create_draft(self.operator, SubmissionDraft(
            "Campus", "org-1", "colocation", "IN-MH", "Mumbai", "Locality",
            {"type": "Point", "coordinates": [72.889432, 19.112345]},
            ({"value": 10, "unit": "MW", "capacityType": "it_load", "scope": "campus"},),
            ({"evidenceType": "source_url", "title": "Operator disclosure", "reference": "https://example.test/campus"},),
        ))
        stale = item
        self.service.submit(self.operator, item.id, 1)
        event = WorkflowEvent("revised", "operator-user", NOW, "draft", "draft")
        with self.assertRaises(RevisionConflict):
            self.repository.replace(stale, 1, event)
        with Session(self.engine) as session:
            self.assertEqual(session.scalar(select(func.count()).select_from(AuditEvent)), 2)
            self.assertEqual(self.repository.get(item.id).revision, 2)

    def test_resolver_rejects_existing_public_id_without_overwrite(self):
        submission = self.service.create_draft(self.operator, SubmissionDraft(
            "Campus", "org-1", "colocation", "IN-MH", "Mumbai", "Locality",
            {"type": "Point", "coordinates": [72.889432, 19.112345]},
            ({"value": 10, "unit": "MW", "capacityType": "it_load", "scope": "campus"},),
            ({"evidenceType": "source_url", "title": "Operator disclosure", "reference": "https://example.test/campus"},),
        ))
        payload = {
            "id": "duplicate", "name": "Campus", "operator": "Operator One",
            "ownershipCategory": "private", "facilityType": "colocation", "stateCode": "IN-MH",
            "state": "Maharashtra", "city": "Mumbai", "locality": "Locality",
            "publicCoordinates": [72.8, 19.1], "locationPrecision": "locality", "capacityDisclosures": [],
            "verification": {"status": "public_operator_confirmed", "verifiedAt": "2026-10-29", "expiresAt": "2027-01-27",
                "source": {"title": "Evidence", "publisher": "Operator One", "url": "https://example.test/evidence", "sourceClass": "operator", "retrievedAt": "2026-10-29"}},
        }
        resolver = PrototypePublicationResolver()
        with Session(self.engine) as session, session.begin(): resolver(session, submission, payload)
        with Session(self.engine) as session, session.begin():
            original_name = session.get(PublicFacilityRecord, "duplicate").name
            with self.assertRaises(DuplicatePublicFacilityError): resolver(session, submission, {**payload, "name": "Overwrite"})
        with Session(self.engine) as session:
            self.assertEqual(session.get(PublicFacilityRecord, "duplicate").name, original_name)


if __name__ == "__main__": unittest.main()
