"""SQLAlchemy adapter for the private registration/review state machine."""
from __future__ import annotations

import hashlib
import json
from collections.abc import Callable, Mapping, Sequence
from datetime import datetime
from typing import Protocol
from uuid import uuid4

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from ..models.public_registry import PublicFacilitySnapshot
from ..models.registration import (
    AuditEvent, FacilitySubmission as SubmissionRow,
    FacilitySubmissionRevision, PublicationSnapshot as PublicationRow,
    ReviewEvent, SubmissionEvidence, SubmissionExactGeometry,
)
from .submission_workflow import (
    FacilitySubmission, PublicationSnapshot, ReviewResult, RevisionConflict,
    SubmissionRepository, WorkflowEvent, WorkflowStorageError,
)


class PublicationResolver(Protocol):
    def __call__(
        self, session: Session, submission: FacilitySubmission, payload: Mapping[str, object],
    ) -> tuple[str, str]:
        """Return reviewed ``(public_facility_id, verification_id)``.

        Implementations own evidence mapping. They must not mutate an existing
        public-source fact merely because an operator submission was approved.
        """


def _iso(value: datetime | None) -> str | None:
    return value.isoformat().replace("+00:00", "Z") if value else None


def _dt(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value.replace("Z", "+00:00")) if value else None


def _canonical(value: Mapping[str, object]) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


class SqlAlchemySubmissionRepository(SubmissionRepository):
    def __init__(self, session_factory: Callable[[], Session], publication_resolver: PublicationResolver) -> None:
        self._session_factory = session_factory
        self._publication_resolver = publication_resolver

    @staticmethod
    def _insert_revision(session: Session, submission: FacilitySubmission, event: WorkflowEvent) -> FacilitySubmissionRevision:
        revision = FacilitySubmissionRevision(
            id=str(uuid4()), submission_id=submission.id, revision=submission.revision,
            facility_name=submission.facility_name, facility_type=submission.facility_type,
            ownership_category=submission.ownership_category, state_code=submission.state_code,
            city=submission.city, locality=submission.locality,
            operational_since=submission.operational_since,
            capacity_disclosures=list(submission.capacity_disclosures), actor_id=event.actor_id,
            actor_role="ministry_reviewer" if event.event_type in ("approve", "reject", "request_information") else "operator",
            change_reason=event.reason, created_at=_iso(event.occurred_at),
        )
        session.add(revision)
        geometry = dict(submission.exact_geometry)
        session.add(SubmissionExactGeometry(
            id=str(uuid4()), revision_id=revision.id, geometry_type=str(geometry.get("type")),
            geometry_json=geometry, geometry_sha256=hashlib.sha256(_canonical(geometry)).hexdigest(),
            visibility="OPERATOR_PRIVATE", created_at=_iso(event.occurred_at),
        ))
        for item in submission.evidence:
            evidence_type = str(item.get("evidenceType", "other"))
            reference = item.get("reference")
            session.add(SubmissionEvidence(
                id=str(uuid4()), revision_id=revision.id, title=str(item.get("title", "Evidence")),
                evidence_type=evidence_type,
                storage_path=reference if evidence_type == "document_reference" else item.get("storagePath"),
                external_url=reference if evidence_type == "source_url" else item.get("externalUrl"),
                sha256=item.get("fileSha256") or item.get("sha256"), content_type=item.get("contentType"),
                file_size_bytes=item.get("fileSizeBytes"), issuer=item.get("issuer"),
                issued_at=item.get("issuedAt"), evidence_class=str(item.get("evidenceClass", "DECLARED")),
                visibility=str(item.get("visibility", "OPERATOR_PRIVATE")),
                created_at=_iso(event.occurred_at),
            ))
        return revision

    @staticmethod
    def _audit(session: Session, submission_id: str, event: WorkflowEvent) -> None:
        session.add(AuditEvent(
            id=str(uuid4()), submission_id=submission_id, actor_id=event.actor_id,
            actor_role="ministry_reviewer" if event.event_type in ("approve", "reject", "request_information") else "operator",
            action=event.event_type, entity_type="facility_submission", entity_id=submission_id,
            request_id=None, metadata_json=dict(event.metadata or {}), occurred_at=_iso(event.occurred_at),
        ))

    def create(self, submission: FacilitySubmission, event: WorkflowEvent) -> FacilitySubmission:
        try:
            with self._session_factory() as session, session.begin():
                session.add(SubmissionRow(
                    id=submission.id, operator_organisation_id=submission.operator_organisation_id,
                    status=submission.status, current_revision=submission.revision,
                    assigned_reviewer_id=None, submitted_at=None, decided_at=None,
                    created_at=_iso(submission.created_at), updated_at=_iso(submission.updated_at),
                ))
                session.flush()
                self._insert_revision(session, submission, event)
                session.flush()
                self._audit(session, submission.id, event)
            return submission
        except SQLAlchemyError as error:
            raise WorkflowStorageError("Submission storage is unavailable") from error

    def _domain(self, session: Session, header: SubmissionRow) -> FacilitySubmission:
        revision = session.scalar(select(FacilitySubmissionRevision).where(
            FacilitySubmissionRevision.submission_id == header.id,
            FacilitySubmissionRevision.revision == header.current_revision,
        ))
        geometry = session.scalar(select(SubmissionExactGeometry).where(SubmissionExactGeometry.revision_id == revision.id))
        evidence = session.scalars(select(SubmissionEvidence).where(SubmissionEvidence.revision_id == revision.id)).all()
        return FacilitySubmission(
            header.id, header.status, header.current_revision, revision.facility_name,
            header.operator_organisation_id, revision.facility_type, revision.state_code,
            revision.city, revision.locality, dict(geometry.geometry_json),
            tuple(revision.capacity_disclosures), tuple({
                "title": item.title, "evidenceType": item.evidence_type,
                "reference": item.external_url or item.storage_path,
                "fileSha256": item.sha256,
            } for item in evidence), _dt(header.created_at), _dt(header.updated_at),
            _dt(header.submitted_at), header.assigned_reviewer_id,
            revision.ownership_category, revision.operational_since,
        )

    def get(self, submission_id: str) -> FacilitySubmission | None:
        try:
            with self._session_factory() as session:
                header = session.get(SubmissionRow, submission_id)
                return None if header is None else self._domain(session, header)
        except SQLAlchemyError as error:
            raise WorkflowStorageError("Submission storage is unavailable") from error

    def _replace_in(self, session: Session, submission: FacilitySubmission, expected_revision: int, event: WorkflowEvent):
        revision = self._insert_revision(session, submission, event)
        session.flush()
        values = {
            "status": submission.status, "current_revision": submission.revision,
            "assigned_reviewer_id": submission.assigned_reviewer_id,
            "submitted_at": _iso(submission.submitted_at), "updated_at": _iso(submission.updated_at),
            "decided_at": _iso(event.occurred_at) if submission.status in ("approved", "rejected") else None,
        }
        result = session.execute(update(SubmissionRow).where(
            SubmissionRow.id == submission.id, SubmissionRow.current_revision == expected_revision,
        ).values(**values))
        if result.rowcount != 1:
            raise RevisionConflict("Submission changed; reload before retrying")
        self._audit(session, submission.id, event)
        return revision

    def replace(self, submission: FacilitySubmission, expected_revision: int, event: WorkflowEvent) -> FacilitySubmission:
        try:
            with self._session_factory() as session, session.begin():
                self._replace_in(session, submission, expected_revision, event)
            return submission
        except RevisionConflict:
            raise
        except IntegrityError as error:
            raise RevisionConflict("Submission changed; reload before retrying") from error
        except SQLAlchemyError as error:
            raise WorkflowStorageError("Submission storage is unavailable") from error

    def review_and_publish(self, submission, expected_revision, event, publication_payload):
        try:
            with self._session_factory() as session, session.begin():
                revision = self._replace_in(session, submission, expected_revision, event)
                review = ReviewEvent(
                    id=str(uuid4()), submission_id=submission.id, revision_id=revision.id,
                    action=event.event_type, actor_id=event.actor_id, actor_role="ministry_reviewer",
                    from_status=event.from_status, to_status=event.to_status, reason=event.reason,
                    requested_fields=list((event.metadata or {}).get("requestedFields", ())),
                    created_at=_iso(event.occurred_at),
                )
                session.add(review)
                session.flush()
                publication = None
                if publication_payload is not None:
                    facility_id, verification_id = self._publication_resolver(session, submission, publication_payload)
                    session.flush()
                    payload_hash = hashlib.sha256(_canonical(publication_payload)).hexdigest()
                    release_version = f"ministry-{_iso(event.occurred_at)}"
                    version = (session.scalar(select(func.max(PublicationRow.publication_version)).where(
                        PublicationRow.submission_id == submission.id
                    )) or 0) + 1
                    existing_release = session.scalars(select(PublicFacilitySnapshot).where(
                        PublicFacilitySnapshot.is_current.is_(True)
                    )).all()
                    session.execute(update(PublicFacilitySnapshot).where(
                        PublicFacilitySnapshot.is_current.is_(True),
                    ).values(is_current=False))
                    # Prior payloads remain immutable. A new release receives
                    # cloned snapshot rows so every current row has one coherent
                    # registry version after publication.
                    for previous in existing_release:
                        session.add(PublicFacilitySnapshot(
                            id=str(uuid4()), facility_id=previous.facility_id,
                            verification_id=previous.verification_id,
                            registry_version=release_version, payload=dict(previous.payload),
                            payload_sha256=previous.payload_sha256,
                            approval_basis=previous.approval_basis,
                            approved_by=previous.approved_by, approved_at=previous.approved_at,
                            is_current=True, visibility=previous.visibility,
                            created_at=_iso(event.occurred_at),
                        ))
                    public_snapshot = PublicFacilitySnapshot(
                        id=str(uuid4()), facility_id=facility_id, verification_id=verification_id,
                        registry_version=release_version, payload=dict(publication_payload),
                        payload_sha256=payload_hash, approval_basis="ministry_review",
                        approved_by=event.actor_id, approved_at=_iso(event.occurred_at),
                        is_current=True, visibility="PUBLIC", created_at=_iso(event.occurred_at),
                    )
                    session.add(public_snapshot)
                    session.flush()
                    session.add(PublicationRow(
                        id=str(uuid4()), submission_id=submission.id, revision_id=revision.id,
                        review_event_id=review.id, public_facility_id=facility_id,
                        public_snapshot_id=public_snapshot.id, publication_version=version,
                        payload_sha256=payload_hash, published_by=event.actor_id,
                        published_at=_iso(event.occurred_at),
                    ))
                    publication = PublicationSnapshot(
                        submission.id, version, dict(publication_payload), event.actor_id,
                        event.occurred_at, public_facility_id=facility_id,
                    )
            return ReviewResult(submission, event, publication)
        except RevisionConflict:
            raise
        except IntegrityError as error:
            raise RevisionConflict("Submission changed or publication evidence is inconsistent") from error
        except SQLAlchemyError as error:
            raise WorkflowStorageError("Submission storage is unavailable") from error

    def list_for_review(self, statuses: Sequence[str], page: int, page_size: int):
        try:
            with self._session_factory() as session:
                statement = select(SubmissionRow).where(SubmissionRow.status.in_(statuses))
                total = session.scalar(select(func.count()).select_from(statement.subquery())) or 0
                rows = session.scalars(statement.order_by(SubmissionRow.submitted_at, SubmissionRow.id).offset((page - 1) * page_size).limit(page_size)).all()
                return tuple(self._domain(session, row) for row in rows), total
        except SQLAlchemyError as error:
            raise WorkflowStorageError("Submission storage is unavailable") from error

