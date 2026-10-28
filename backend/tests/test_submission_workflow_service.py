import unittest
from dataclasses import replace
from datetime import datetime, timezone

from backend.app.services.submission_workflow import *


NOW = datetime(2026, 10, 29, 10, 0, tzinfo=timezone.utc)


class Repository:
    def __init__(self): self.items = {}; self.publications = []
    def create(self, item, event): self.items[item.id] = item; return item
    def get(self, identifier): return self.items.get(identifier)
    def replace(self, item, expected_revision, event):
        if self.items[item.id].revision != expected_revision: raise RevisionConflict("conflict")
        self.items[item.id] = item; return item
    def review_and_publish(self, item, expected_revision, event, payload):
        self.replace(item, expected_revision, event)
        publication = None
        if payload is not None:
            publication = PublicationSnapshot(item.id, len(self.publications) + 1, dict(payload), event.actor_id, event.occurred_at)
            self.publications.append(publication)
        return ReviewResult(item, event, publication)
    def list_for_review(self, statuses, page, page_size):
        rows = [row for row in self.items.values() if row.status in statuses]
        return rows[(page-1)*page_size:page*page_size], len(rows)


class SubmissionWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.repo = Repository(); self.service = SubmissionWorkflowService(self.repo, lambda: NOW, lambda: "sub-1")
        self.operator = WorkflowActor("operator-user", "operator", "org-1")
        self.reviewer = WorkflowActor("reviewer", "ministry_reviewer")
        self.draft = SubmissionDraft("Campus", "org-1", "colocation", "IN-MH", "Mumbai", "Locality", {"type": "Point", "coordinates": [72.8, 19.1]})

    def test_full_approve_flow_keeps_exact_geometry_out_of_publication(self):
        item = self.service.create_draft(self.operator, self.draft)
        item = self.service.submit(self.operator, item.id, 1)
        result = self.service.review(self.reviewer, item.id, 2, "approve", "Reviewed", public_snapshot={"name": "Campus", "publicCoordinates": [72.8, 19.1]})
        self.assertEqual((result.submission.status, result.submission.revision), ("approved", 3))
        self.assertNotIn("exactGeometry", result.publication.payload)
        self.assertEqual(self.repo.items[item.id].exact_geometry["coordinates"], [72.8, 19.1])

    def test_information_request_revision_and_resubmission(self):
        item = self.service.submit(self.operator, self.service.create_draft(self.operator, self.draft).id, 1)
        result = self.service.review(self.reviewer, item.id, 2, "request_information", "Need capacity", ["capacityDisclosures"])
        revised = self.service.revise(self.operator, item.id, 3, {"capacity_disclosures": ({"value": 10},)})
        resubmitted = self.service.submit(self.operator, item.id, revised.revision)
        self.assertEqual(resubmitted.status, "resubmitted")

    def test_forbidden_role_revision_conflict_and_invalid_transition(self):
        item = self.service.create_draft(self.operator, self.draft)
        with self.assertRaises(WorkflowForbidden): self.service.get_for_operator(WorkflowActor("other", "operator", "org-2"), item.id)
        with self.assertRaises(RevisionConflict): self.service.submit(self.operator, item.id, 99)
        submitted = self.service.submit(self.operator, item.id, 1)
        with self.assertRaises(InvalidTransition): self.service.revise(self.operator, item.id, submitted.revision, {"city": "Pune"})

    def test_restricted_publication_fields_are_rejected(self):
        item = self.service.submit(self.operator, self.service.create_draft(self.operator, self.draft).id, 1)
        with self.assertRaises(ValueError):
            self.service.review(self.reviewer, item.id, 2, "approve", "Reviewed", public_snapshot={"name": "Campus", "exactGeometry": {}})

    def test_review_detail_is_ministry_only_and_not_found_is_generic(self):
        item = self.service.create_draft(self.operator, self.draft)
        self.assertEqual(self.service.get_for_review(self.reviewer, item.id).id, item.id)
        with self.assertRaises(WorkflowForbidden): self.service.get_for_review(self.operator, item.id)
        with self.assertRaises(SubmissionNotFound) as error: self.service.get_for_review(self.reviewer, "missing")
        self.assertEqual(str(error.exception), "Submission not found")


if __name__ == "__main__": unittest.main()
