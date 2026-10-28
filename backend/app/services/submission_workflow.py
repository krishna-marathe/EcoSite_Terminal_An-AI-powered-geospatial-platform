"""Operator submission and ministry review state machine."""
from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime, timezone
from typing import Any, Literal, Mapping, Protocol, Sequence
from uuid import uuid4

from shapely.geometry import Point

from ..state_scope import FOCUS_STATES, StateScopeUnavailable, load_focus_states


Role = Literal["operator", "ministry_reviewer"]
SubmissionStatus = Literal["draft", "submitted", "information_requested", "resubmitted", "approved", "rejected", "withdrawn"]
ReviewAction = Literal["request_information", "reject", "approve"]


class SubmissionNotFound(LookupError): pass
class WorkflowForbidden(PermissionError): pass
class RevisionConflict(RuntimeError): pass
class InvalidTransition(ValueError): pass
class IncompleteSubmission(InvalidTransition):
    def __init__(self, fields: Sequence[Mapping[str, str]]) -> None:
        super().__init__("Submission is incomplete and cannot enter ministry review")
        self.fields = tuple(fields)
class WorkflowStorageError(RuntimeError): pass


@dataclass(frozen=True)
class WorkflowActor:
    actor_id: str
    role: Role
    organisation_id: str | None = None


@dataclass(frozen=True)
class SubmissionDraft:
    facility_name: str
    operator_organisation_id: str
    facility_type: str
    state_code: str
    city: str
    locality: str
    exact_geometry: Mapping[str, Any]
    capacity_disclosures: tuple[Mapping[str, Any], ...] = ()
    evidence: tuple[Mapping[str, Any], ...] = ()
    ownership_category: str = "private"
    operational_since: int | None = None


@dataclass(frozen=True)
class FacilitySubmission:
    id: str
    status: SubmissionStatus
    revision: int
    facility_name: str
    operator_organisation_id: str
    facility_type: str
    state_code: str
    city: str
    locality: str
    exact_geometry: Mapping[str, Any]
    capacity_disclosures: tuple[Mapping[str, Any], ...]
    evidence: tuple[Mapping[str, Any], ...]
    created_at: datetime
    updated_at: datetime
    submitted_at: datetime | None = None
    assigned_reviewer_id: str | None = None
    ownership_category: str = "private"
    operational_since: int | None = None


@dataclass(frozen=True)
class WorkflowEvent:
    event_type: str
    actor_id: str
    occurred_at: datetime
    from_status: str | None
    to_status: str
    reason: str | None = None
    metadata: Mapping[str, Any] | None = None


@dataclass(frozen=True)
class PublicationSnapshot:
    submission_id: str
    version: int
    payload: Mapping[str, Any]
    approved_by: str
    approved_at: datetime
    public_facility_id: str | None = None


@dataclass(frozen=True)
class ReviewResult:
    submission: FacilitySubmission
    event: WorkflowEvent
    publication: PublicationSnapshot | None = None


class SubmissionRepository(Protocol):
    def create(self, submission: FacilitySubmission, event: WorkflowEvent) -> FacilitySubmission: ...
    def get(self, submission_id: str) -> FacilitySubmission | None: ...
    def replace(self, submission: FacilitySubmission, expected_revision: int, event: WorkflowEvent) -> FacilitySubmission: ...
    def review_and_publish(
        self, submission: FacilitySubmission, expected_revision: int, event: WorkflowEvent,
        publication_payload: Mapping[str, Any] | None,
    ) -> ReviewResult: ...
    def list_for_review(self, statuses: Sequence[str], page: int, page_size: int) -> tuple[Sequence[FacilitySubmission], int]: ...


class SubmissionWorkflowService:
    def __init__(self, repository: SubmissionRepository, clock=lambda: datetime.now(timezone.utc), id_factory=lambda: str(uuid4())) -> None:
        self._repository = repository
        self._clock = clock
        self._id_factory = id_factory

    @staticmethod
    def _operator(actor: WorkflowActor, organisation_id: str) -> None:
        if actor.role != "operator" or actor.organisation_id != organisation_id:
            raise WorkflowForbidden("Operator cannot access this submission")

    @staticmethod
    def _reviewer(actor: WorkflowActor) -> None:
        if actor.role != "ministry_reviewer":
            raise WorkflowForbidden("Ministry reviewer role is required")

    def create_draft(self, actor: WorkflowActor, draft: SubmissionDraft) -> FacilitySubmission:
        self._operator(actor, draft.operator_organisation_id)
        now = self._clock()
        submission = FacilitySubmission(
            self._id_factory(), "draft", 1, draft.facility_name, draft.operator_organisation_id,
            draft.facility_type, draft.state_code, draft.city, draft.locality,
            dict(draft.exact_geometry), tuple(draft.capacity_disclosures), tuple(draft.evidence), now, now,
            ownership_category=draft.ownership_category,
            operational_since=draft.operational_since,
        )
        event = WorkflowEvent("created", actor.actor_id, now, None, "draft")
        return self._repository.create(submission, event)

    def get_for_operator(self, actor: WorkflowActor, submission_id: str) -> FacilitySubmission:
        submission = self._repository.get(submission_id)
        if submission is None:
            raise SubmissionNotFound("Submission not found")
        self._operator(actor, submission.operator_organisation_id)
        return submission

    def revise(self, actor: WorkflowActor, submission_id: str, expected_revision: int, changes: Mapping[str, Any]) -> FacilitySubmission:
        current = self.get_for_operator(actor, submission_id)
        if current.revision != expected_revision:
            raise RevisionConflict("Submission changed; reload before retrying")
        if current.status not in ("draft", "information_requested"):
            raise InvalidTransition("Only draft or information-requested submissions can be revised")
        allowed = {"facility_name", "facility_type", "state_code", "city", "locality", "exact_geometry", "capacity_disclosures", "evidence"}
        if not changes or set(changes) - allowed:
            raise ValueError("Revision contains no supported fields")
        now = self._clock()
        updated = replace(current, **changes, revision=current.revision + 1, updated_at=now)
        event = WorkflowEvent("revised", actor.actor_id, now, current.status, current.status, metadata={"fields": sorted(changes)})
        return self._repository.replace(updated, expected_revision, event)

    def submit(self, actor: WorkflowActor, submission_id: str, expected_revision: int) -> FacilitySubmission:
        current = self.get_for_operator(actor, submission_id)
        if current.revision != expected_revision:
            raise RevisionConflict("Submission changed; reload before retrying")
        transitions = {"draft": "submitted", "information_requested": "resubmitted"}
        if current.status not in transitions:
            raise InvalidTransition("Submission cannot enter review from its current status")
        missing: list[Mapping[str, str]] = []
        for field, value in (
            ("facilityName", current.facility_name), ("facilityType", current.facility_type),
            ("stateCode", current.state_code), ("city", current.city), ("locality", current.locality),
        ):
            if not str(value).strip():
                missing.append({"path": field, "message": "This field is required before submission."})
        geometry = current.exact_geometry
        coordinates = geometry.get("coordinates") if isinstance(geometry, Mapping) else None
        if geometry.get("type") != "Point" or not isinstance(coordinates, (list, tuple)) or len(coordinates) != 2:
            missing.append({"path": "exactGeometry", "message": "A restricted point location is required before submission."})
        elif current.state_code not in FOCUS_STATES:
            missing.append({"path": "stateCode", "message": "Select one of the four supported states."})
        else:
            try:
                point = Point(float(coordinates[0]), float(coordinates[1]))
                if not load_focus_states()[current.state_code].buffer(1e-7).covers(point):
                    missing.append({"path": "exactGeometry", "message": "The point must lie inside the declared supported state."})
            except (StateScopeUnavailable, TypeError, ValueError):
                missing.append({"path": "exactGeometry", "message": "The restricted point could not be verified against the supported states."})
        if not current.capacity_disclosures:
            missing.append({"path": "capacityDisclosures", "message": "Add at least one typed capacity disclosure."})
        if not current.evidence:
            missing.append({"path": "evidence", "message": "Add at least one traceable evidence reference."})
        if missing:
            raise IncompleteSubmission(missing)
        now = self._clock()
        status = transitions[current.status]
        updated = replace(current, status=status, revision=current.revision + 1, updated_at=now, submitted_at=now)
        event = WorkflowEvent("submitted", actor.actor_id, now, current.status, status)
        return self._repository.replace(updated, expected_revision, event)

    def review_queue(self, actor: WorkflowActor, statuses=("submitted", "resubmitted"), page=1, page_size=50):
        self._reviewer(actor)
        if page < 1 or not 1 <= page_size <= 100:
            raise ValueError("Invalid pagination")
        return self._repository.list_for_review(statuses, page, page_size)

    def get_for_review(self, actor: WorkflowActor, submission_id: str) -> FacilitySubmission:
        self._reviewer(actor)
        submission = self._repository.get(submission_id)
        if submission is None:
            raise SubmissionNotFound("Submission not found")
        return submission

    def review(
        self, actor: WorkflowActor, submission_id: str, expected_revision: int,
        action: ReviewAction, reason: str, requested_fields: Sequence[str] = (),
        public_snapshot: Mapping[str, Any] | None = None,
    ) -> ReviewResult:
        self._reviewer(actor)
        current = self._repository.get(submission_id)
        if current is None:
            raise SubmissionNotFound("Submission not found")
        if current.revision != expected_revision:
            raise RevisionConflict("Submission changed; reload before retrying")
        if current.status not in ("submitted", "resubmitted"):
            raise InvalidTransition("Submission is not awaiting ministry review")
        if not reason.strip():
            raise ValueError("A review reason is required")
        if action == "request_information":
            if not requested_fields:
                raise ValueError("Requested fields are required")
            target = "information_requested"
        elif action == "reject":
            target = "rejected"
        elif action == "approve":
            if public_snapshot is None:
                raise ValueError("Approval requires a proposed public snapshot")
            forbidden = {"exactGeometry", "exact_geometry", "restrictedGeometry", "evidence", "contact"}
            if forbidden.intersection(public_snapshot):
                raise ValueError("Public snapshot contains restricted fields")
            target = "approved"
        else:
            raise ValueError("Unsupported review action")
        now = self._clock()
        updated = replace(current, status=target, revision=current.revision + 1, updated_at=now, assigned_reviewer_id=actor.actor_id)
        event = WorkflowEvent(action, actor.actor_id, now, current.status, target, reason, {"requestedFields": tuple(requested_fields)})
        # Repository must atomically append audit/review history and create a new
        # immutable publication snapshot. It must never update public-source facts.
        return self._repository.review_and_publish(updated, expected_revision, event, public_snapshot if action == "approve" else None)

