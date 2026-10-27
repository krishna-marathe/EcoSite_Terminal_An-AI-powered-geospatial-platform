from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..domain.evidence.audit import audit_project_evidence
from ..models.evidence import Assertion, AssertionEvidenceLink, AssertionReview, EvidenceArtifact
from ..models.phases import ProjectPhase
from ..models.projects import utc_timestamp
from ..models.sites import CandidateSite
from ..schemas.evidence import (
    AssertionCreate,
    AssertionEvidenceLinkRead,
    AssertionPatch,
    AssertionRead,
    AssertionReviewCreate,
    AssertionReviewRead,
    EvidenceArtifactCreate,
    EvidenceArtifactPatch,
    EvidenceArtifactRead,
    EvidenceAuditReport,
)
from .projects import find_project, get_session, local_only

router = APIRouter(tags=["Evidence Foundation"], dependencies=[Depends(local_only)])


def active_project(session: Session, project_id: UUID | str):
    project = find_project(session, project_id)
    if project.status != "active":
        raise HTTPException(409, detail={"code": "project_archived", "message": "Restore the project before modifying evidence."})
    return project


def validate_site_scope(session: Session, project_id: str, site_id: UUID | str | None):
    if site_id is None:
        return None
    site = session.get(CandidateSite, str(site_id))
    if site is None or site.project_id != str(project_id):
        raise HTTPException(422, detail={"code": "site_scope_mismatch", "message": "Site does not belong to the specified project."})
    return site


def validate_phase_scope(session: Session, project_id: str, phase_id: UUID | str | None):
    if phase_id is None:
        return None
    phase = session.get(ProjectPhase, str(phase_id))
    if phase is None or phase.project_id != str(project_id):
        raise HTTPException(422, detail={"code": "phase_scope_mismatch", "message": "Phase does not belong to the specified project."})
    return phase


def find_artifact(session: Session, artifact_id: UUID | str) -> EvidenceArtifact:
    artifact = session.get(EvidenceArtifact, str(artifact_id))
    if artifact is None:
        raise HTTPException(404, detail={"code": "artifact_not_found", "message": "Evidence artifact not found."})
    return artifact


def find_assertion_with_details(session: Session, assertion_id: UUID | str) -> Assertion:
    assertion = session.scalar(
        select(Assertion)
        .where(Assertion.id == str(assertion_id))
        .options(
            selectinload(Assertion.artifact_links).selectinload(AssertionEvidenceLink.artifact),
            selectinload(Assertion.reviews),
        )
    )
    if assertion is None:
        raise HTTPException(404, detail={"code": "assertion_not_found", "message": "Assertion not found."})
    return assertion


def serialize_assertion(assertion: Assertion) -> AssertionRead:
    links = []
    for link in assertion.artifact_links:
        if link.artifact:
            links.append(
                AssertionEvidenceLinkRead(
                    artifact_id=link.artifact_id,
                    filename=link.artifact.filename,
                    document_type=link.artifact.document_type,
                    page_number=link.page_number,
                    sha256=link.artifact.sha256,
                    synthetic_demo=link.artifact.synthetic_demo,
                )
            )
    reviews = [
        AssertionReviewRead(
            id=r.id,
            assertion_id=r.assertion_id,
            reviewer_id=r.reviewer_id,
            review_status=r.review_status,
            is_simulated=r.is_simulated,
            notes=r.notes,
            reviewed_at=r.reviewed_at,
        )
        for r in assertion.reviews
    ]
    return AssertionRead(
        id=assertion.id,
        project_id=assertion.project_id,
        site_id=assertion.site_id,
        phase_id=assertion.phase_id,
        field_key=assertion.field_key,
        value=assertion.value,
        numeric_value=assertion.numeric_value,
        unit=assertion.unit,
        scope_type=assertion.scope_type,
        scope_detail=assertion.scope_detail,
        status=assertion.status,
        verification_method=assertion.verification_method,
        asserted_by=assertion.asserted_by,
        asserted_at=assertion.asserted_at,
        effective_from=assertion.effective_from,
        effective_to=assertion.effective_to,
        supersedes_assertion_id=assertion.supersedes_assertion_id,
        status_record=assertion.status_record,
        revision=assertion.revision,
        evidence_links=links,
        reviews=reviews,
    )


# --- Evidence Artifacts Endpoints ---

@router.post("/projects/{project_id}/evidence", response_model=EvidenceArtifactRead, status_code=201)
def register_evidence_artifact(project_id: UUID, body: EvidenceArtifactCreate, session: Session = Depends(get_session)):
    session.connection(execution_options={"sqlite_immediate": True})
    active_project(session, project_id)
    validate_site_scope(session, str(project_id), body.site_id)

    data = body.model_dump()
    if data.get("site_id") is not None:
        data["site_id"] = str(data["site_id"])

    artifact = EvidenceArtifact(
        project_id=str(project_id),
        **data,
    )
    session.add(artifact)
    session.flush()
    return artifact


@router.get("/projects/{project_id}/evidence", response_model=list[EvidenceArtifactRead])
def list_evidence_artifacts(
    project_id: UUID,
    site_id: UUID | None = None,
    document_type: str | None = None,
    include_archived: bool = False,
    session: Session = Depends(get_session),
):
    find_project(session, project_id)
    query = select(EvidenceArtifact).where(EvidenceArtifact.project_id == str(project_id))
    if site_id is not None:
        query = query.where(EvidenceArtifact.site_id == str(site_id))
    if document_type is not None:
        query = query.where(EvidenceArtifact.document_type == document_type)
    if not include_archived:
        query = query.where(EvidenceArtifact.status == "active")
    return session.scalars(query.order_by(EvidenceArtifact.uploaded_at.desc())).all()


@router.get("/evidence/{artifact_id}", response_model=EvidenceArtifactRead)
def get_evidence_artifact(artifact_id: UUID, session: Session = Depends(get_session)):
    return find_artifact(session, artifact_id)


@router.patch("/evidence/{artifact_id}", response_model=EvidenceArtifactRead)
def patch_evidence_artifact(artifact_id: UUID, body: EvidenceArtifactPatch, session: Session = Depends(get_session)):
    session.connection(execution_options={"sqlite_immediate": True})
    artifact = find_artifact(session, artifact_id)

    if artifact.revision != body.expected_revision:
        raise HTTPException(
            409,
            detail={
                "code": "revision_conflict",
                "message": f"Expected revision {body.expected_revision} does not match current revision {artifact.revision}.",
            },
        )

    if body.site_id is not None:
        validate_site_scope(session, artifact.project_id, body.site_id)
        artifact.site_id = str(body.site_id)

    update_data = body.model_dump(exclude_unset=True, exclude={"expected_revision", "site_id"})
    for field, value in update_data.items():
        setattr(artifact, field, value)

    artifact.revision += 1
    session.flush()
    return artifact


# --- Assertions Endpoints ---

@router.post("/projects/{project_id}/assertions", response_model=AssertionRead, status_code=201)
def create_assertion(project_id: UUID, body: AssertionCreate, session: Session = Depends(get_session)):
    session.connection(execution_options={"sqlite_immediate": True})
    active_project(session, project_id)
    validate_site_scope(session, str(project_id), body.site_id)
    validate_phase_scope(session, str(project_id), body.phase_id)

    # Validate linked artifacts
    artifact_link_objs = []
    if body.evidence_links:
        for link in body.evidence_links:
            art = session.get(EvidenceArtifact, str(link.artifact_id))
            if art is None or art.project_id != str(project_id):
                raise HTTPException(
                    422,
                    detail={
                        "code": "invalid_artifact_link",
                        "message": f"Artifact {link.artifact_id} not found in this project.",
                    },
                )
            artifact_link_objs.append(
                AssertionEvidenceLink(
                    artifact_id=str(link.artifact_id),
                    page_number=link.page_number,
                )
            )

    data = body.model_dump(exclude={"evidence_links"})
    if data.get("site_id") is not None:
        data["site_id"] = str(data["site_id"])
    if data.get("phase_id") is not None:
        data["phase_id"] = str(data["phase_id"])
    if data.get("supersedes_assertion_id") is not None:
        old_id = str(data["supersedes_assertion_id"])
        old_assertion = session.get(Assertion, old_id)
        if old_assertion is None or old_assertion.project_id != str(project_id):
            raise HTTPException(422, detail={"code": "supersedes_invalid", "message": "Superseded assertion not found in this project."})
        old_assertion.status = "SUPERSEDED"
        old_assertion.revision += 1
        data["supersedes_assertion_id"] = old_id

    # If linked to artifacts and status was DECLARED, automatically graduate to DOCUMENTED
    if artifact_link_objs and data["status"] == "DECLARED":
        data["status"] = "DOCUMENTED"

    assertion = Assertion(
        project_id=str(project_id),
        **data,
    )
    for l_obj in artifact_link_objs:
        assertion.artifact_links.append(l_obj)

    session.add(assertion)
    session.flush()

    return serialize_assertion(find_assertion_with_details(session, assertion.id))


@router.get("/projects/{project_id}/assertions", response_model=list[AssertionRead])
def list_assertions(
    project_id: UUID,
    site_id: UUID | None = None,
    phase_id: UUID | None = None,
    field_key: str | None = None,
    status: str | None = None,
    include_archived: bool = False,
    session: Session = Depends(get_session),
):
    find_project(session, project_id)
    query = (
        select(Assertion)
        .where(Assertion.project_id == str(project_id))
        .options(
            selectinload(Assertion.artifact_links).selectinload(AssertionEvidenceLink.artifact),
            selectinload(Assertion.reviews),
        )
    )
    if site_id is not None:
        query = query.where(Assertion.site_id == str(site_id))
    if phase_id is not None:
        query = query.where(Assertion.phase_id == str(phase_id))
    if field_key is not None:
        query = query.where(Assertion.field_key == field_key)
    if status is not None:
        query = query.where(Assertion.status == status)
    if not include_archived:
        query = query.where(Assertion.status_record == "active")

    assertions = session.scalars(query.order_by(Assertion.asserted_at.desc())).all()
    return [serialize_assertion(a) for a in assertions]


@router.get("/assertions/{assertion_id}", response_model=AssertionRead)
def get_assertion(assertion_id: UUID, session: Session = Depends(get_session)):
    return serialize_assertion(find_assertion_with_details(session, assertion_id))


@router.patch("/assertions/{assertion_id}", response_model=AssertionRead)
def patch_assertion(assertion_id: UUID, body: AssertionPatch, session: Session = Depends(get_session)):
    session.connection(execution_options={"sqlite_immediate": True})
    assertion = find_assertion_with_details(session, assertion_id)

    if assertion.revision != body.expected_revision:
        raise HTTPException(
            409,
            detail={
                "code": "revision_conflict",
                "message": f"Expected revision {body.expected_revision} does not match current revision {assertion.revision}.",
            },
        )

    if body.supersedes_assertion_id is not None:
        old_id = str(body.supersedes_assertion_id)
        old_assertion = session.get(Assertion, old_id)
        if old_assertion is None or old_assertion.project_id != assertion.project_id:
            raise HTTPException(422, detail={"code": "supersedes_invalid", "message": "Superseded assertion not found in this project."})
        old_assertion.status = "SUPERSEDED"
        old_assertion.revision += 1
        assertion.supersedes_assertion_id = old_id

    # Handle evidence links update if provided
    if body.evidence_links is not None:
        assertion.artifact_links.clear()
        for link in body.evidence_links:
            art = session.get(EvidenceArtifact, str(link.artifact_id))
            if art is None or art.project_id != assertion.project_id:
                raise HTTPException(422, detail={"code": "invalid_artifact_link", "message": f"Artifact {link.artifact_id} not found in this project."})
            assertion.artifact_links.append(
                AssertionEvidenceLink(
                    artifact_id=str(link.artifact_id),
                    page_number=link.page_number,
                )
            )

    update_data = body.model_dump(exclude_unset=True, exclude={"expected_revision", "supersedes_assertion_id", "evidence_links"})
    for field, value in update_data.items():
        setattr(assertion, field, value)

    assertion.revision += 1
    session.flush()
    return serialize_assertion(find_assertion_with_details(session, assertion.id))


@router.post("/assertions/{assertion_id}/reviews", response_model=AssertionRead)
def review_assertion(assertion_id: UUID, body: AssertionReviewCreate, session: Session = Depends(get_session)):
    session.connection(execution_options={"sqlite_immediate": True})
    assertion = find_assertion_with_details(session, assertion_id)

    review = AssertionReview(
        assertion_id=assertion.id,
        reviewer_id=body.reviewer_id,
        review_status=body.review_status,
        is_simulated=body.is_simulated,
        notes=body.notes,
        reviewed_at=utc_timestamp(),
    )
    assertion.reviews.append(review)

    # Deterministic status resolution
    if body.review_status in ("APPROVED", "SIMULATED_VERIFICATION"):
        assertion.status = "VERIFIED_WITHIN_SCOPE"
        assertion.verification_method = "SIMULATED_REVIEW" if body.is_simulated else "INDEPENDENT_REVIEW"
    elif body.review_status == "FLAGGED_CONFLICT":
        assertion.status = "CONFLICTING"
    elif body.review_status == "REJECTED":
        assertion.status = "DECLARED"

    assertion.revision += 1
    session.flush()
    return serialize_assertion(assertion)


# --- Audit Endpoint ---

@router.get("/projects/{project_id}/evidence-audit", response_model=EvidenceAuditReport)
def get_project_evidence_audit(
    project_id: UUID,
    comparative_mode: bool = Query(default=False, description="Enforce strict blockers for comparative assertions"),
    session: Session = Depends(get_session),
):
    find_project(session, project_id)
    return audit_project_evidence(session, str(project_id), comparative_mode=comparative_mode)
