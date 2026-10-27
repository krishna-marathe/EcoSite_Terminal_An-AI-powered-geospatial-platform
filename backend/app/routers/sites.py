from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..geometry import BoundaryUnavailable, BoundaryReviewRequired, measure_polygon
from ..models.projects import utc_timestamp
from ..models.sites import CandidateSite
from ..schemas.sites import SiteCreate, SitePatch, SiteRead
from ..state_scope import StateScopeError, StateScopeUnavailable
from .projects import find_project, get_session, local_only

router = APIRouter(tags=["Local candidate polygons"], dependencies=[Depends(local_only)])


def measurements(geometry, state_code):
    try:
        return measure_polygon(geometry, state_code)
    except StateScopeUnavailable:
        raise HTTPException(503, detail={"code": "state_scope_unavailable", "message": "The four-state screening boundary is unavailable; no polygon was saved."}) from None
    except StateScopeError as error:
        raise HTTPException(422, detail={"code": "state_scope", "message": str(error)}) from None
    except BoundaryUnavailable:
        raise HTTPException(503, detail={"code": "boundary_unavailable", "message": "Approved India screening boundary is unavailable; no polygon was saved."}) from None
    except BoundaryReviewRequired as error:
        raise HTTPException(422, detail={"code": "boundary_review_required", "message": str(error)}) from None
    except ValueError as error:
        raise HTTPException(422, detail={"code": "invalid_geometry", "message": str(error)}) from None


def site_or_404(session, site_id, project_id=None):
    site = session.get(CandidateSite, str(site_id))
    if site is None or (project_id is not None and site.project_id != str(project_id)):
        raise HTTPException(404, detail={"code": "site_not_found", "message": "Candidate site not found."})
    return site


def active_project(session, project_id):
    project = find_project(session, project_id)
    if project.status != "active":
        raise HTTPException(409, detail={"code": "project_archived", "message": "Restore the project before changing its candidates."})


@router.post("/projects/{project_id}/sites", response_model=SiteRead, status_code=201)
def create_site(project_id: UUID, body: SiteCreate, session: Session = Depends(get_session)):
    measured = measurements(body.geometry, body.state_code)
    # Acquire the SQLite write lock before any parent/limit reads.
    session.connection(execution_options={"sqlite_immediate": True})
    active_project(session, project_id)
    site = CandidateSite(project_id=str(project_id), **body.model_dump(exclude={"geometry"}), **measured)
    session.add(site)
    session.flush()
    return site


@router.get("/projects/{project_id}/sites", response_model=list[SiteRead])
def list_sites(project_id: UUID, include_archived: bool = False, session: Session = Depends(get_session)):
    find_project(session, project_id)
    statement = select(CandidateSite).where(CandidateSite.project_id == str(project_id))
    if not include_archived:
        statement = statement.where(CandidateSite.status == "active")
    return session.scalars(statement.order_by(CandidateSite.created_at, CandidateSite.id)).all()


@router.get("/sites/{site_id}", response_model=SiteRead)
@router.get("/projects/{project_id}/sites/{site_id}", response_model=SiteRead)
def read_site(site_id: UUID, project_id: UUID | None = None, session: Session = Depends(get_session)):
    return site_or_404(session, site_id, project_id)


@router.patch("/sites/{site_id}", response_model=SiteRead)
@router.patch("/projects/{project_id}/sites/{site_id}", response_model=SiteRead)
def patch_site(site_id: UUID, body: SitePatch, project_id: UUID | None = None, session: Session = Depends(get_session)):
    changes = body.model_dump(exclude_unset=True, exclude={"expected_revision"})
    session.connection(execution_options={"sqlite_immediate": True})
    site = site_or_404(session, site_id, project_id)
    active_project(session, site.project_id)
    if site.revision != body.expected_revision:
        raise HTTPException(409, detail={"code": "revision_conflict", "message": "Candidate changed. Reload before retrying."})
    if "geometry" in changes or "state_code" in changes:
        geometry = changes.get("geometry", site.geometry)
        state_code = changes.get("state_code", site.state_code)
        measured = measurements(geometry, state_code)
        changes.pop("geometry", None)
        changes.update(measured)
    for key, value in changes.items():
        setattr(site, key, value)
    site.revision += 1
    site.updated_at = utc_timestamp()
    session.flush()
    return site


@router.delete("/sites/{site_id}", response_model=SiteRead)
@router.delete("/projects/{project_id}/sites/{site_id}", response_model=SiteRead)
def archive_site(site_id: UUID, expected_revision: int = Query(ge=1), project_id: UUID | None = None, session: Session = Depends(get_session)):
    return patch_site(site_id, SitePatch(expected_revision=expected_revision, status="archived"), project_id, session)
