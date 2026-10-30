from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models.commitments import PowerCommitment, WaterCommitment
from backend.app.models.evidence import Assertion, EvidenceArtifact
from backend.app.models.phases import ProjectPhase
from backend.app.models.projects import Project, utc_timestamp
from backend.app.models.sites import CandidateSite
from backend.app.routers.projects import find_project, get_session, local_only
from backend.app.schemas.commitments import (
    PhaseReadinessSummary,
    PowerCommitmentCreate,
    PowerCommitmentListResponse,
    PowerCommitmentRead,
    PowerCommitmentUpdate,
    ProjectReadinessReport,
    WaterCommitmentCreate,
    WaterCommitmentListResponse,
    WaterCommitmentRead,
    WaterCommitmentUpdate,
)
from backend.app.services.readiness_engine import calculate_project_readiness


router = APIRouter(prefix="/projects", tags=["Resource Commitments & Readiness"], dependencies=[Depends(local_only)])


def resolve_commitment_verification_state(
    session: Session,
    project_id: str,
    evidence_artifact_id: Optional[str | UUID],
    assertion_id: Optional[str | UUID],
    client_state: Optional[str] = None,
    client_is_synthetic: bool = False,
) -> tuple[str, bool]:
    """Inspect referenced Assertion and EvidenceArtifact in the database to derive
    the true verification_state and is_synthetic flag. Never trusts client_state alone.
    Returns:
        (verification_state, is_synthetic)
    """
    is_synthetic = bool(client_is_synthetic)
    evidence_artifact = None
    if evidence_artifact_id:
        evidence_artifact = session.get(EvidenceArtifact, str(evidence_artifact_id))
        if evidence_artifact and evidence_artifact.synthetic_demo:
            is_synthetic = True

    if assertion_id:
        assertion = session.get(Assertion, str(assertion_id))
        if assertion and assertion.project_id == str(project_id):
            # Check for synthetic demo artifact links
            for link in assertion.artifact_links:
                if link.artifact and link.artifact.synthetic_demo:
                    is_synthetic = True

            # If assertion status is CONFLICTING, EXPIRED, SUPERSEDED or DECLARED:
            if assertion.status in ("CONFLICTING", "EXPIRED", "SUPERSEDED"):
                return ("UNVERIFIED", is_synthetic)

            # If assertion is VERIFIED_WITHIN_SCOPE, inspect reviews
            if assertion.status == "VERIFIED_WITHIN_SCOPE":
                # Simulated reviews produce SIMULATED verification only
                has_independent_approval = False
                has_simulated = False
                for r in assertion.reviews:
                    if r.is_simulated or r.review_status == "SIMULATED_VERIFICATION":
                        has_simulated = True
                    elif r.review_status == "APPROVED" and not r.is_simulated:
                        has_independent_approval = True

                if is_synthetic or has_simulated or assertion.verification_method == "SIMULATED_REVIEW":
                    return ("SIMULATED", is_synthetic)
                elif has_independent_approval and assertion.verification_method == "INDEPENDENT_REVIEW":
                    return ("VERIFIED", is_synthetic)
                else:
                    return ("DOCUMENTED", is_synthetic)
            elif assertion.status == "DOCUMENTED":
                return ("SIMULATED" if is_synthetic else "DOCUMENTED", is_synthetic)
            else:
                return ("UNVERIFIED", is_synthetic)

    if evidence_artifact and evidence_artifact.project_id == str(project_id):
        return ("SIMULATED" if is_synthetic else "DOCUMENTED", is_synthetic)

    # When no DB assertion or artifact is referenced:
    # A client cannot claim "VERIFIED" without underlying verified assertion.
    if client_state == "VERIFIED":
        return ("UNVERIFIED", is_synthetic)
    if client_state == "SIMULATED" or is_synthetic:
        return ("SIMULATED", is_synthetic)
    if client_state == "DOCUMENTED":
        return ("DOCUMENTED", is_synthetic)

    return ("UNVERIFIED", is_synthetic)


def _validate_scope_references(
    session: Session,
    project_id: str,
    scope_type: str,
    site_id: Optional[UUID],
    phase_id: Optional[UUID],
    evidence_artifact_id: Optional[UUID],
    assertion_id: Optional[UUID],
):
    """Ensure site, phase, artifact and assertion belong to this project and are active,

    and validate scope consistency.
    """
    if scope_type == "PHASE":
        if phase_id is None:
            raise HTTPException(
                422,
                detail={
                    "code": "phase_id_required",
                    "message": "Commitment with scope_type 'PHASE' must specify a valid phase_id.",
                },
            )
    elif scope_type == "CAMPUS":
        if phase_id is not None:
            raise HTTPException(
                422,
                detail={
                    "code": "ambiguous_scope",
                    "message": "Commitment with scope_type 'CAMPUS' cannot specify a phase_id. Set scope_type to 'PHASE' or omit phase_id.",
                },
            )
    elif scope_type == "SITE":
        if site_id is None:
            raise HTTPException(
                422,
                detail={
                    "code": "site_id_required",
                    "message": "Commitment with scope_type 'SITE' must specify a valid site_id.",
                },
            )

    if site_id is not None:
        site = session.get(CandidateSite, str(site_id))
        if site is None or site.project_id != project_id or site.status != "active":
            raise HTTPException(404, detail={"code": "site_not_found", "message": f"Candidate site '{site_id}' not found in project."})

    if phase_id is not None:
        phase = session.get(ProjectPhase, str(phase_id))
        if phase is None or phase.project_id != project_id or phase.status != "active":
            raise HTTPException(404, detail={"code": "phase_not_found", "message": f"Project phase '{phase_id}' not found in project."})

    if evidence_artifact_id is not None:
        art = session.get(EvidenceArtifact, str(evidence_artifact_id))
        if art is None or art.project_id != project_id:
            raise HTTPException(404, detail={"code": "artifact_not_found", "message": f"Evidence artifact '{evidence_artifact_id}' not found in project."})
        if site_id is not None and art.site_id is not None and art.site_id != str(site_id):
            raise HTTPException(422, detail={"code": "evidence_scope_mismatch", "message": f"Evidence artifact is bound to site '{art.site_id}', not '{site_id}'."})

    if assertion_id is not None:
        ass = session.get(Assertion, str(assertion_id))
        if ass is None or ass.project_id != project_id:
            raise HTTPException(404, detail={"code": "assertion_not_found", "message": f"Assertion '{assertion_id}' not found in project."})
        if site_id is not None and ass.site_id is not None and ass.site_id != str(site_id):
            raise HTTPException(422, detail={"code": "assertion_scope_mismatch", "message": f"Assertion is bound to site '{ass.site_id}', not '{site_id}'."})
        if scope_type == "CAMPUS" and ass.phase_id is not None:
            raise HTTPException(422, detail={"code": "assertion_scope_mismatch", "message": "Commitment with scope_type 'CAMPUS' cannot link to a phase-scoped assertion."})
        if phase_id is not None and ass.phase_id is not None and ass.phase_id != str(phase_id):
            raise HTTPException(422, detail={"code": "assertion_scope_mismatch", "message": f"Assertion is bound to phase '{ass.phase_id}', not '{phase_id}'."})


# --- Power Commitments ---

@router.post("/{project_id}/power-commitments", response_model=PowerCommitmentRead, status_code=201)
def create_power_commitment(
    project_id: UUID,
    body: PowerCommitmentCreate,
    session: Session = Depends(get_session),
):
    project = find_project(session, project_id)
    if project.status != "active":
        raise HTTPException(404, detail={"code": "project_archived", "message": "Cannot add commitments to archived project."})

    _validate_scope_references(
        session=session,
        project_id=str(project_id),
        scope_type=body.scope_type,
        site_id=body.site_id,
        phase_id=body.phase_id,
        evidence_artifact_id=body.evidence_artifact_id,
        assertion_id=body.assertion_id,
    )

    data = body.model_dump()
    data["project_id"] = str(project_id)
    if data.get("site_id"):
        data["site_id"] = str(data["site_id"])
    if data.get("phase_id"):
        data["phase_id"] = str(data["phase_id"])
    if data.get("evidence_artifact_id"):
        data["evidence_artifact_id"] = str(data["evidence_artifact_id"])
    if data.get("assertion_id"):
        data["assertion_id"] = str(data["assertion_id"])

    # Never trust client verification_state alone: resolve against actual DB evidence
    ver_state, is_synth = resolve_commitment_verification_state(
        session=session,
        project_id=str(project_id),
        evidence_artifact_id=data.get("evidence_artifact_id"),
        assertion_id=data.get("assertion_id"),
        client_state=body.verification_state,
        client_is_synthetic=bool(body.is_synthetic),
    )
    data["verification_state"] = ver_state
    data["is_synthetic"] = is_synth

    commitment = PowerCommitment(**data)
    session.add(commitment)
    session.flush()
    return commitment



@router.get("/{project_id}/power-commitments", response_model=PowerCommitmentListResponse)
def list_power_commitments(
    project_id: UUID,
    site_id: Optional[UUID] = None,
    phase_id: Optional[UUID] = None,
    status: Optional[str] = None,
    session: Session = Depends(get_session),
):
    find_project(session, project_id)
    query = select(PowerCommitment).filter(
        PowerCommitment.project_id == str(project_id),
        PowerCommitment.status_record == "active",
    )
    if site_id:
        query = query.filter(PowerCommitment.site_id == str(site_id))
    if phase_id:
        query = query.filter(PowerCommitment.phase_id == str(phase_id))
    if status:
        query = query.filter(PowerCommitment.status == status)

    query = query.order_by(PowerCommitment.created_at.desc())
    items = list(session.scalars(query).all())
    return PowerCommitmentListResponse(total=len(items), items=items)


@router.get("/{project_id}/power-commitments/{commitment_id}", response_model=PowerCommitmentRead)
def get_power_commitment(
    project_id: UUID,
    commitment_id: UUID,
    session: Session = Depends(get_session),
):
    find_project(session, project_id)
    pc = session.get(PowerCommitment, str(commitment_id))
    if pc is None or pc.project_id != str(project_id) or pc.status_record != "active":
        raise HTTPException(404, detail={"code": "commitment_not_found", "message": "Power commitment not found."})
    return pc


@router.patch("/{project_id}/power-commitments/{commitment_id}", response_model=PowerCommitmentRead)
def update_power_commitment(
    project_id: UUID,
    commitment_id: UUID,
    body: PowerCommitmentUpdate,
    session: Session = Depends(get_session),
):
    find_project(session, project_id)
    pc = session.get(PowerCommitment, str(commitment_id))
    if pc is None or pc.project_id != str(project_id) or pc.status_record != "active":
        raise HTTPException(404, detail={"code": "commitment_not_found", "message": "Power commitment not found."})

    if pc.revision != body.expected_revision:
        raise HTTPException(
            409,
            detail={
                "code": "stale_revision",
                "message": f"Expected revision {body.expected_revision} but commitment is at revision {pc.revision}.",
                "current_revision": pc.revision,
            },
        )

    updates = body.model_dump(exclude_unset=True, exclude={"expected_revision"})
    for field, value in updates.items():
        setattr(pc, field, value)

    # Re-verify evidence trust barrier: never trust client verification_state alone
    ver_state, is_synth = resolve_commitment_verification_state(
        session=session,
        project_id=str(project_id),
        evidence_artifact_id=pc.evidence_artifact_id,
        assertion_id=pc.assertion_id,
        client_state=pc.verification_state,
        client_is_synthetic=bool(pc.is_synthetic),
    )
    pc.verification_state = ver_state
    pc.is_synthetic = is_synth

    pc.revision += 1
    pc.updated_at = utc_timestamp()
    session.flush()
    return pc


@router.delete("/{project_id}/power-commitments/{commitment_id}", response_model=PowerCommitmentRead)
def archive_power_commitment(
    project_id: UUID,
    commitment_id: UUID,
    expected_revision: Optional[int] = Query(default=None),
    session: Session = Depends(get_session),
):
    find_project(session, project_id)
    pc = session.get(PowerCommitment, str(commitment_id))
    if pc is None or pc.project_id != str(project_id) or pc.status_record != "active":
        raise HTTPException(404, detail={"code": "commitment_not_found", "message": "Power commitment not found."})

    if expected_revision is not None and pc.revision != expected_revision:
        raise HTTPException(
            409,
            detail={
                "code": "stale_revision",
                "message": f"Expected revision {expected_revision} but commitment is at revision {pc.revision}.",
            },
        )

    pc.status_record = "archived"
    pc.revision += 1
    pc.updated_at = utc_timestamp()
    session.flush()
    return pc


# --- Water Commitments ---

@router.post("/{project_id}/water-commitments", response_model=WaterCommitmentRead, status_code=201)
def create_water_commitment(
    project_id: UUID,
    body: WaterCommitmentCreate,
    session: Session = Depends(get_session),
):
    project = find_project(session, project_id)
    if project.status != "active":
        raise HTTPException(404, detail={"code": "project_archived", "message": "Cannot add commitments to archived project."})

    _validate_scope_references(
        session=session,
        project_id=str(project_id),
        scope_type=body.scope_type,
        site_id=body.site_id,
        phase_id=body.phase_id,
        evidence_artifact_id=body.evidence_artifact_id,
        assertion_id=body.assertion_id,
    )

    data = body.model_dump()
    data["project_id"] = str(project_id)
    if data.get("site_id"):
        data["site_id"] = str(data["site_id"])
    if data.get("phase_id"):
        data["phase_id"] = str(data["phase_id"])
    if data.get("evidence_artifact_id"):
        data["evidence_artifact_id"] = str(data["evidence_artifact_id"])
    if data.get("assertion_id"):
        data["assertion_id"] = str(data["assertion_id"])

    # Never trust client verification_state alone: resolve against actual DB evidence
    ver_state, is_synth = resolve_commitment_verification_state(
        session=session,
        project_id=str(project_id),
        evidence_artifact_id=data.get("evidence_artifact_id"),
        assertion_id=data.get("assertion_id"),
        client_state=body.verification_state,
        client_is_synthetic=bool(body.is_synthetic),
    )
    data["verification_state"] = ver_state
    data["is_synthetic"] = is_synth

    commitment = WaterCommitment(**data)
    session.add(commitment)
    session.flush()
    return commitment


@router.get("/{project_id}/water-commitments", response_model=WaterCommitmentListResponse)
def list_water_commitments(
    project_id: UUID,
    site_id: Optional[UUID] = None,
    phase_id: Optional[UUID] = None,
    status: Optional[str] = None,
    session: Session = Depends(get_session),
):
    find_project(session, project_id)
    query = select(WaterCommitment).filter(
        WaterCommitment.project_id == str(project_id),
        WaterCommitment.status_record == "active",
    )
    if site_id:
        query = query.filter(WaterCommitment.site_id == str(site_id))
    if phase_id:
        query = query.filter(WaterCommitment.phase_id == str(phase_id))
    if status:
        query = query.filter(WaterCommitment.status == status)

    query = query.order_by(WaterCommitment.created_at.desc())
    items = list(session.scalars(query).all())
    return WaterCommitmentListResponse(total=len(items), items=items)


@router.get("/{project_id}/water-commitments/{commitment_id}", response_model=WaterCommitmentRead)
def get_water_commitment(
    project_id: UUID,
    commitment_id: UUID,
    session: Session = Depends(get_session),
):
    find_project(session, project_id)
    wc = session.get(WaterCommitment, str(commitment_id))
    if wc is None or wc.project_id != str(project_id) or wc.status_record != "active":
        raise HTTPException(404, detail={"code": "commitment_not_found", "message": "Water commitment not found."})
    return wc


@router.patch("/{project_id}/water-commitments/{commitment_id}", response_model=WaterCommitmentRead)
def update_water_commitment(
    project_id: UUID,
    commitment_id: UUID,
    body: WaterCommitmentUpdate,
    session: Session = Depends(get_session),
):
    find_project(session, project_id)
    wc = session.get(WaterCommitment, str(commitment_id))
    if wc is None or wc.project_id != str(project_id) or wc.status_record != "active":
        raise HTTPException(404, detail={"code": "commitment_not_found", "message": "Water commitment not found."})

    if wc.revision != body.expected_revision:
        raise HTTPException(
            409,
            detail={
                "code": "stale_revision",
                "message": f"Expected revision {body.expected_revision} but commitment is at revision {wc.revision}.",
                "current_revision": wc.revision,
            },
        )

    updates = body.model_dump(exclude_unset=True, exclude={"expected_revision"})
    for field, value in updates.items():
        setattr(wc, field, value)

    # Re-verify evidence trust barrier: never trust client verification_state alone
    ver_state, is_synth = resolve_commitment_verification_state(
        session=session,
        project_id=str(project_id),
        evidence_artifact_id=wc.evidence_artifact_id,
        assertion_id=wc.assertion_id,
        client_state=wc.verification_state,
        client_is_synthetic=bool(wc.is_synthetic),
    )
    wc.verification_state = ver_state
    wc.is_synthetic = is_synth

    wc.revision += 1
    wc.updated_at = utc_timestamp()
    session.flush()
    return wc


@router.delete("/{project_id}/water-commitments/{commitment_id}", response_model=WaterCommitmentRead)
def archive_water_commitment(
    project_id: UUID,
    commitment_id: UUID,
    expected_revision: Optional[int] = Query(default=None),
    session: Session = Depends(get_session),
):
    find_project(session, project_id)
    wc = session.get(WaterCommitment, str(commitment_id))
    if wc is None or wc.project_id != str(project_id) or wc.status_record != "active":
        raise HTTPException(404, detail={"code": "commitment_not_found", "message": "Water commitment not found."})

    if expected_revision is not None and wc.revision != expected_revision:
        raise HTTPException(
            409,
            detail={
                "code": "stale_revision",
                "message": f"Expected revision {expected_revision} but commitment is at revision {wc.revision}.",
            },
        )

    wc.status_record = "archived"
    wc.revision += 1
    wc.updated_at = utc_timestamp()
    session.flush()
    return wc


# --- Readiness Calculations ---

@router.get("/{project_id}/phase-readiness", response_model=ProjectReadinessReport)
def get_project_phase_readiness(
    project_id: UUID,
    site_id: Optional[UUID] = None,
    session: Session = Depends(get_session),
):
    """Calculate and expose deterministic phase-wise power and water readiness."""
    find_project(session, project_id)
    return calculate_project_readiness(
        session=session,
        project_id=str(project_id),
        site_id=str(site_id) if site_id else None,
    )


@router.get("/{project_id}/phases/{phase_id}/readiness", response_model=PhaseReadinessSummary)
def get_single_phase_readiness(
    project_id: UUID,
    phase_id: UUID,
    session: Session = Depends(get_session),
):
    """Retrieve deterministic readiness metrics for a specific project phase."""
    find_project(session, project_id)
    report = calculate_project_readiness(session=session, project_id=str(project_id))
    for phase_summary in report.phases:
        if phase_summary.phase_id == str(phase_id):
            return phase_summary

    raise HTTPException(404, detail={"code": "phase_not_found", "message": f"Phase '{phase_id}' not found in project readiness report."})
