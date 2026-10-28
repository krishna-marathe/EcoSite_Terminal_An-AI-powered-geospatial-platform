import shutil
import tempfile
import unittest
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app import db
from backend.app.models.public_registry import PublicFacilitySnapshot
from backend.app.models.registration import OperatorOrganisation, SubmissionExactGeometry
from backend.app.routers.public_facilities import router as public_facilities_router
from backend.app.routers.restricted_workflows import router
from backend.app.services.ministry_operations import MinistryOperationsService
from backend.app.services.ministry_sqlalchemy import SqlAlchemyMinistryOperationsRepository
from backend.app.services.prototype_publication import build_prototype_submission_workflow
from backend.app.services.public_facilities import PublicFacilityService
from backend.app.services.public_facility_sqlalchemy import SqlAlchemyPublicFacilityRepository
from backend.app.services.submission_sqlalchemy import SqlAlchemySubmissionRepository
from backend.app.services.submission_workflow import SubmissionWorkflowService


ROOT = Path(__file__).resolve().parents[2]
OPERATOR_HEADERS = {"X-EcoSite-Demo-Actor": "demo-operator", "X-EcoSite-Demo-Role": "operator"}
MINISTRY_HEADERS = {"X-EcoSite-Demo-Actor": "demo-ministry-reviewer", "X-EcoSite-Demo-Role": "ministry_reviewer"}


def migration_config(path):
    config = Config(str(ROOT / "backend" / "alembic.ini"))
    config.attributes["db_path"] = path
    return config


def build_app(engine):
    app = FastAPI()
    session_factory = lambda: Session(engine, expire_on_commit=False)
    app.state.submission_workflow_service = build_prototype_submission_workflow(engine)
    app.state.ministry_operations_service = MinistryOperationsService(
        SqlAlchemyMinistryOperationsRepository(session_factory)
    )
    app.state.public_facility_service = PublicFacilityService(
        SqlAlchemyPublicFacilityRepository(session_factory)
    )
    app.include_router(router, prefix="/api/v1")
    app.include_router(public_facilities_router, prefix="/api/v1")
    return app


class RestrictedWorkflowPersistenceApiTests(unittest.TestCase):
    def test_copied_live_db_upgrade_restart_and_private_geometry(self):
        with tempfile.TemporaryDirectory() as directory:
            copied = Path(directory) / "workflow-copy.db"
            shutil.copy2(db.DB_PATH, copied)
            command.upgrade(migration_config(copied), "head")
            engine = db.make_engine(copied)
            try:
                with Session(engine) as session, session.begin():
                    session.add(OperatorOrganisation(
                        id="org-demo-operator",
                        name="Demo Operator",
                        status="verified",
                        created_at="2026-10-29T00:00:00Z",
                        updated_at="2026-10-29T00:00:00Z",
                    ))

                client = TestClient(build_app(engine))
                draft = {
                    "facilityName": "Persisted Mumbai Campus",
                    "operatorOrganisationId": "org-demo-operator",
                    "facilityType": "colocation",
                    "stateCode": "IN-MH",
                    "city": "Mumbai",
                    "locality": "Chandivali",
                    "exactGeometry": {"type": "Point", "coordinates": [72.889432, 19.112345]},
                }
                created = client.post("/api/v1/operator/facility-submissions", json=draft, headers=OPERATOR_HEADERS)
                self.assertEqual(created.status_code, 201)
                submission_id = created.json()["id"]

                revised = client.patch(
                    f"/api/v1/operator/facility-submissions/{submission_id}",
                    json={"expectedRevision": 1, "locality": "Powai"},
                    headers=OPERATOR_HEADERS,
                )
                self.assertEqual(revised.status_code, 200)
                submitted = client.post(
                    f"/api/v1/operator/facility-submissions/{submission_id}/submit",
                    json={"expectedRevision": 2},
                    headers=OPERATOR_HEADERS,
                )
                self.assertEqual(submitted.json()["status"], "submitted")

                queue = client.get("/api/v1/ministry/facility-submissions", headers=MINISTRY_HEADERS)
                self.assertEqual(queue.status_code, 200)
                self.assertNotIn("exactGeometry", queue.json()["items"][0])
                detail = client.get(f"/api/v1/ministry/facility-submissions/{submission_id}", headers=MINISTRY_HEADERS)
                self.assertEqual(detail.json()["exactGeometry"]["coordinates"], [72.889432, 19.112345])

                requested = client.post(
                    f"/api/v1/ministry/facility-submissions/{submission_id}/actions",
                    json={
                        "expectedRevision": 3,
                        "action": "request_information",
                        "reason": "Provide capacity evidence.",
                        "requestedFields": ["capacityDisclosures"],
                    },
                    headers=MINISTRY_HEADERS,
                )
                self.assertEqual((requested.status_code, requested.json()["status"]), (200, "information_requested"))

                revised_again = client.patch(
                    f"/api/v1/operator/facility-submissions/{submission_id}",
                    json={
                        "expectedRevision": 4,
                        "capacityDisclosures": [
                            {"value": 10, "unit": "MW", "capacityType": "it_load", "scope": "campus"}
                        ],
                    },
                    headers=OPERATOR_HEADERS,
                )
                self.assertEqual(revised_again.status_code, 200)
                resubmitted = client.post(
                    f"/api/v1/operator/facility-submissions/{submission_id}/submit",
                    json={"expectedRevision": 5},
                    headers=OPERATOR_HEADERS,
                )
                self.assertEqual(resubmitted.json()["status"], "resubmitted")
                approved = client.post(
                    f"/api/v1/ministry/facility-submissions/{submission_id}/actions",
                    json={
                        "expectedRevision": 6,
                        "action": "approve",
                        "reason": "Evidence reviewed for prototype publication.",
                        "publicSnapshot": {
                            "id": "persisted-mumbai-campus",
                            "name": "Persisted Mumbai Campus",
                            "operator": "Demo Operator",
                            "ownershipCategory": "private",
                            "facilityType": "colocation",
                            "stateCode": "IN-MH",
                            "state": "Maharashtra",
                            "city": "Mumbai",
                            "locality": "Powai",
                            "publicCoordinates": [72.889, 19.112],
                            "locationPrecision": "locality",
                            "operationalSince": 2026,
                            "capacityDisclosures": [
                                {"value": 10, "unit": "MW", "capacityType": "it_load", "scope": "campus"}
                            ],
                            "verification": {
                                "status": "government_verified",
                                "verifiedAt": "2026-10-29",
                                "expiresAt": "2027-01-27",
                                "source": {
                                    "title": "Reviewed operator submission",
                                    "publisher": "EcoSite Ministry Reviewer",
                                    "url": "https://example.gov.in/reviews/persisted-campus",
                                    "sourceClass": "government",
                                    "retrievedAt": "2026-10-29"
                                }
                            }
                        },
                    },
                    headers=MINISTRY_HEADERS,
                )
                self.assertEqual(approved.status_code, 200)
                self.assertEqual(approved.json()["publishedFacilityId"], "persisted-mumbai-campus")

                restarted_client = TestClient(build_app(engine))
                persisted = restarted_client.get(
                    f"/api/v1/operator/facility-submissions/{submission_id}",
                    headers=OPERATOR_HEADERS,
                )
                self.assertEqual((persisted.status_code, persisted.json()["revision"]), (200, 7))
                self.assertEqual(persisted.json()["locality"], "Powai")

                public = restarted_client.get("/api/v1/public-facilities/persisted-mumbai-campus")
                self.assertEqual(public.status_code, 200)
                self.assertNotIn("exactGeometry", public.json())
                self.assertNotIn("evidence", public.json())

                overview = restarted_client.get("/api/v1/ministry/operations/overview", headers=MINISTRY_HEADERS)
                self.assertEqual(overview.status_code, 200)
                self.assertGreaterEqual(overview.json()["facilityCount"], 19)

                with Session(engine) as session:
                    exact_count = session.scalar(select(func.count()).select_from(SubmissionExactGeometry))
                    versions = set(session.scalars(select(PublicFacilitySnapshot.registry_version).where(PublicFacilitySnapshot.is_current.is_(True))).all())
                    current_count = session.scalar(select(func.count()).select_from(PublicFacilitySnapshot).where(PublicFacilitySnapshot.is_current.is_(True)))
                self.assertEqual(exact_count, 7)
                self.assertEqual(len(versions), 1)
                self.assertEqual(current_count, 20)
            finally:
                engine.dispose()


if __name__ == "__main__":
    unittest.main()
