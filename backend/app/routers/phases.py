from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..models.phases import ProjectPhase
from ..models.projects import utc_timestamp
from ..schemas.phases import PhaseCreate, PhasePatch, PhaseRead
from .projects import find_project, get_session, local_only

router = APIRouter(prefix="/projects/{project_id}/phases", tags=["Local development phases"], dependencies=[Depends(local_only)])

def active_project(session, project_id):
    if find_project(session, project_id).status != "active":
        raise HTTPException(409, detail={"code":"project_archived", "message":"Restore the project before changing phases."})

def find_phase(session, project_id, phase_id):
    phase = session.get(ProjectPhase, str(phase_id))
    if phase is None or phase.project_id != str(project_id):
        raise HTTPException(404, detail={"code":"phase_not_found", "message":"Phase not found in this project."})
    return phase

def validate_timeline(session, project_id, values, phase_id=None, status="active"):
    phases = session.scalars(select(ProjectPhase).where(ProjectPhase.project_id == str(project_id))).all()
    if any(p.id != phase_id and p.sequence == values["sequence"] for p in phases):
        raise HTTPException(409, detail={"code":"phase_sequence_conflict", "message":"Sequence is already used, including archived phases."})
    if status != "active":
        return
    rows = [{key:getattr(p,key) for key in ("sequence","commissioning_date","cumulative_it_mw","cumulative_facility_peak_mw")} for p in phases if p.status == "active" and p.id != phase_id]
    rows.append(values)
    rows.sort(key=lambda p:p["sequence"])
    for earlier,later in zip(rows,rows[1:]):
        if any(earlier[key] >= later[key] for key in ("commissioning_date","cumulative_it_mw","cumulative_facility_peak_mw")):
            raise HTTPException(422, detail={"code":"phase_order_invalid", "message":"Active phases must have strictly increasing dates, cumulative IT MW and cumulative facility peak MW in sequence order."})

@router.get("", response_model=list[PhaseRead])
def list_phases(project_id: UUID, include_archived: bool=False, session: Session=Depends(get_session)):
    find_project(session,project_id)
    query=select(ProjectPhase).where(ProjectPhase.project_id == str(project_id))
    if not include_archived: query=query.where(ProjectPhase.status == "active")
    return session.scalars(query.order_by(ProjectPhase.sequence)).all()

@router.get("/{phase_id}", response_model=PhaseRead)
def read_phase(project_id: UUID, phase_id: UUID, session: Session=Depends(get_session)):
    return find_phase(session,project_id,phase_id)

@router.post("", response_model=PhaseRead, status_code=201)
def create_phase(project_id: UUID, body: PhaseCreate, session: Session=Depends(get_session)):
    session.connection(execution_options={"sqlite_immediate":True})
    active_project(session,project_id)
    values=body.model_dump()
    validate_timeline(session,project_id,values)
    phase=ProjectPhase(project_id=str(project_id),**values)
    session.add(phase)
    session.flush()
    return phase

@router.patch("/{phase_id}", response_model=PhaseRead)
def patch_phase(project_id: UUID, phase_id: UUID, body: PhasePatch, session: Session=Depends(get_session)):
    session.connection(execution_options={"sqlite_immediate":True})
    active_project(session,project_id)
    phase=find_phase(session,project_id,phase_id)
    if phase.revision != body.expected_revision:
        raise HTTPException(409, detail={"code":"revision_conflict", "message":"Phase changed. Reload before retrying."})
    changes=body.model_dump(exclude_unset=True,exclude={"expected_revision"})
    values={key:getattr(phase,key) for key in PhaseCreate.model_fields}
    values.update({key:value for key,value in changes.items() if key != "status"})
    try: values=PhaseCreate.model_validate(values).model_dump()
    except ValidationError:
        raise HTTPException(422, detail={"code":"phase_fields_invalid", "message":"Facility MW must be at least IT MW and peak water at least average water."}) from None
    validate_timeline(session,project_id,values,phase.id,changes.get("status",phase.status))
    for key,value in changes.items(): setattr(phase,key,value)
    phase.revision += 1
    phase.updated_at=utc_timestamp()
    session.flush()
    return phase

@router.delete("/{phase_id}", response_model=PhaseRead)
def archive_phase(project_id: UUID, phase_id: UUID, expected_revision:int=Query(gt=0), session: Session=Depends(get_session)):
    return patch_phase(project_id,phase_id,PhasePatch(expected_revision=expected_revision,status="archived"),session)
