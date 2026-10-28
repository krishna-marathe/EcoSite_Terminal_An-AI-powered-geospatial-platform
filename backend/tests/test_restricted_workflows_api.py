import unittest
from dataclasses import replace
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.routers.restricted_workflows import router
from backend.app.services.ministry_operations import (
    FacilityFreshness,
    MinistryOperationsService,
    MinistrySourceHealth,
    MinistryStateSummary,
)
from backend.app.services.submission_workflow import (
    PublicationSnapshot,
    ReviewResult,
    SubmissionNotFound,
    SubmissionWorkflowService,
    WorkflowForbidden,
)


NOW = datetime(2026, 10, 29, 12, 0, tzinfo=timezone.utc)
OPERATOR_HEADERS = {
    "X-EcoSite-Demo-Actor": "demo-operator",
    "X-EcoSite-Demo-Role": "operator",
}
MINISTRY_HEADERS = {
    "X-EcoSite-Demo-Actor": "demo-ministry-reviewer",
    "X-EcoSite-Demo-Role": "ministry_reviewer",
}


class MinistryRepository:
    def state_summaries(self):
        return [MinistryStateSummary("IN-MH", 8, 0, 0, 8)]

    def source_health(self):
        return [MinistrySourceHealth("cpcb_caaqms", "CPCB", "NOT_CONNECTED", None, None, 0, 0)]

    def facility_freshness(self):
        return [FacilityFreshness("facility-1", "Facility 1", "IN-MH", "pm25", "not_covered", None, None, None, "no station")]


class WorkflowRepository:
    def __init__(self):
        self.rows = {}
        self.events = []
        self.publications = []

    def create(self, submission, event):
        self.rows[submission.id] = submission
        self.events.append(event)
        return submission

    def get(self, submission_id):
        return self.rows.get(submission_id)

    def replace(self, submission, expected_revision, event):
        self.rows[submission.id] = submission
        self.events.append(event)
        return submission

    def review_and_publish(self, submission, expected_revision, event, publication_payload):
        self.rows[submission.id] = submission
        self.events.append(event)
        publication = None
        if publication_payload is not None:
            payload = {"id": "published-facility-1", **dict(publication_payload)}
            publication = PublicationSnapshot(
                submission.id,
                1,
                payload,
                event.actor_id,
                event.occurred_at,
                public_facility_id="published-facility-1",
            )
            self.publications.append(publication)
        return ReviewResult(submission, event, publication)

    def list_for_review(self, statuses, page, page_size):
        values = [row for row in self.rows.values() if row.status in statuses]
        start = (page - 1) * page_size
        return values[start:start + page_size], len(values)


class WorkflowFacade:
    def __init__(self, service, repository):
        self.service = service
        self.repository = repository

    def __getattr__(self, name):
        return getattr(self.service, name)

    def get_for_review(self, actor, submission_id):
        if actor.role != "ministry_reviewer":
            raise WorkflowForbidden("Ministry reviewer role is required")
        value = self.repository.get(submission_id)
        if value is None:
            raise SubmissionNotFound("Submission not found")
        return value


class RestrictedWorkflowApiTests(unittest.TestCase):
    def setUp(self):
        self.repo = WorkflowRepository()
        workflow = SubmissionWorkflowService(self.repo, clock=lambda: NOW, id_factory=lambda: "sub-1")
        app = FastAPI()
        app.state.ministry_operations_service = MinistryOperationsService(MinistryRepository(), clock=lambda: NOW)
        app.state.submission_workflow_service = WorkflowFacade(workflow, self.repo)
        app.include_router(router, prefix="/api/v1")
        self.client = TestClient(app)

    @staticmethod
    def draft():
        return {
            "facilityName": "Example Mumbai Campus",
            "operatorOrganisationId": "org-demo-operator",
            "facilityType": "colocation",
            "stateCode": "IN-MH",
            "city": "Mumbai",
            "locality": "Chandivali",
            "exactGeometry": {"type": "Point", "coordinates": [72.889432, 19.112345]},
        }

    def create_and_submit(self):
        created = self.client.post("/api/v1/operator/facility-submissions", json=self.draft(), headers=OPERATOR_HEADERS)
        self.assertEqual(created.status_code, 201)
        submitted = self.client.post(
            "/api/v1/operator/facility-submissions/sub-1/submit",
            json={"expectedRevision": 1},
            headers=OPERATOR_HEADERS,
        )
        self.assertEqual(submitted.status_code, 200)
        return submitted.json()

    def test_demo_identity_fails_closed_and_enforces_roles(self):
        missing = self.client.get("/api/v1/ministry/operations/overview")
        self.assertEqual(missing.status_code, 401)
        self.assertEqual(missing.json()["error"]["code"], "authentication_required")

        denied = self.client.get("/api/v1/ministry/operations/overview", headers=OPERATOR_HEADERS)
        self.assertEqual(denied.status_code, 403)
        self.assertEqual(denied.json()["error"]["code"], "access_denied")

    def test_ministry_overview_and_drilldowns_are_restricted(self):
        overview = self.client.get("/api/v1/ministry/operations/overview", headers=MINISTRY_HEADERS)
        self.assertEqual(overview.status_code, 200)
        self.assertEqual(overview.json()["facilityCount"], 8)
        self.assertEqual(overview.json()["freshnessQueue"][0]["status"], "not_covered")
        facility = self.client.get("/api/v1/ministry/operations/facilities/facility-1", headers=MINISTRY_HEADERS)
        self.assertEqual(facility.status_code, 200)

    def test_operator_create_read_revise_submit_and_conflict(self):
        created = self.client.post("/api/v1/operator/facility-submissions", json=self.draft(), headers=OPERATOR_HEADERS)
        self.assertEqual(created.status_code, 201)
        self.assertIn("exactGeometry", created.json())

        conflict = self.client.patch(
            "/api/v1/operator/facility-submissions/sub-1",
            json={"expectedRevision": 99, "locality": "Powai"},
            headers=OPERATOR_HEADERS,
        )
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(conflict.json()["error"]["code"], "revision_conflict")

        revised = self.client.patch(
            "/api/v1/operator/facility-submissions/sub-1",
            json={"expectedRevision": 1, "locality": "Powai"},
            headers=OPERATOR_HEADERS,
        )
        self.assertEqual((revised.status_code, revised.json()["revision"]), (200, 2))
        submitted = self.client.post(
            "/api/v1/operator/facility-submissions/sub-1/submit",
            json={"expectedRevision": 2},
            headers=OPERATOR_HEADERS,
        )
        self.assertEqual(submitted.json()["status"], "submitted")

    def test_ministry_queue_detail_and_atomic_publication_contract(self):
        submission = self.create_and_submit()
        queue = self.client.get("/api/v1/ministry/facility-submissions", headers=MINISTRY_HEADERS)
        self.assertEqual(queue.status_code, 200)
        self.assertEqual(queue.json()["total"], 1)
        self.assertNotIn("exactGeometry", queue.json()["items"][0])

        detail = self.client.get("/api/v1/ministry/facility-submissions/sub-1", headers=MINISTRY_HEADERS)
        self.assertEqual(detail.status_code, 200)
        self.assertIn("exactGeometry", detail.json())

        action = {
            "expectedRevision": submission["revision"],
            "action": "approve",
            "reason": "Evidence reviewed for prototype publication.",
            "publicSnapshot": {
                "id": "example-mumbai-campus",
                "name": "Example Mumbai Campus",
                "operator": "Example Operator",
                "ownershipCategory": "private",
                "facilityType": "colocation",
                "stateCode": "IN-MH",
                "state": "Maharashtra",
                "city": "Mumbai",
                "locality": "Chandivali",
                "publicCoordinates": [72.889, 19.112],
                "locationPrecision": "locality",
                "operationalSince": 2026,
                "capacityDisclosures": [],
                "verification": {
                    "status": "government_verified",
                    "verifiedAt": "2026-10-29",
                    "expiresAt": "2027-01-27",
                    "source": {
                        "title": "Reviewed operator submission",
                        "publisher": "EcoSite Ministry Reviewer",
                        "url": "https://example.gov.in/reviews/sub-1",
                        "sourceClass": "government",
                        "retrievedAt": "2026-10-29"
                    }
                },
            },
        }
        approved = self.client.post(
            "/api/v1/ministry/facility-submissions/sub-1/actions",
            json=action,
            headers=MINISTRY_HEADERS,
        )
        self.assertEqual(approved.status_code, 200)
        self.assertEqual(approved.json()["publishedFacilityId"], "published-facility-1")
        public_payload = self.repo.publications[0].payload
        self.assertNotIn("exactGeometry", public_payload)
        self.assertNotIn("evidence", public_payload)

    def test_approval_schema_rejects_restricted_public_fields(self):
        submission = self.create_and_submit()
        action = {
            "expectedRevision": submission["revision"],
            "action": "approve",
            "reason": "Attempted unsafe publication",
            "publicSnapshot": {
                "id": "unsafe-campus",
                "name": "Unsafe",
                "operator": "Example",
                "ownershipCategory": "private",
                "facilityType": "colocation",
                "stateCode": "IN-MH",
                "state": "Maharashtra",
                "city": "Mumbai",
                "locality": "Generalized",
                "publicCoordinates": [72.8, 19.1],
                "locationPrecision": "locality",
                "capacityDisclosures": [],
                "verification": {
                    "status": "government_verified",
                    "verifiedAt": "2026-10-29",
                    "expiresAt": "2027-01-27",
                    "source": {
                        "title": "Reviewed operator submission",
                        "publisher": "EcoSite Ministry Reviewer",
                        "url": "https://example.gov.in/reviews/sub-1",
                        "sourceClass": "government",
                        "retrievedAt": "2026-10-29"
                    }
                },
                "exactGeometry": {"type": "Point", "coordinates": [72.8, 19.1]},
            },
        }
        response = self.client.post(
            "/api/v1/ministry/facility-submissions/sub-1/actions",
            json=action,
            headers=MINISTRY_HEADERS,
        )
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "validation_failed")


if __name__ == "__main__":
    unittest.main()
