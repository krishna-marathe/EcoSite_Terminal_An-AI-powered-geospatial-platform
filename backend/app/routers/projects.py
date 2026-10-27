from ipaddress import ip_address
from urllib.parse import urlsplit
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from .. import db
from ..models.projects import Project, utc_timestamp
from ..schemas.projects import ProjectCreate, ProjectPage, ProjectPatch, ProjectRead


def local_only(request: Request):
    def loopback(host):
        try:
            return ip_address(host).is_loopback
        except ValueError:
            return host == "localhost"

    origin = request.headers.get("origin")
    try:
        host = urlsplit("http://" + request.headers.get("host", "")).hostname or ""
    except ValueError:
        host = ""
    # Host and Origin checks also reject DNS rebinding/cross-site browser writes.
    allowed_origin = not origin or origin in request.app.state.project_origins or (bool(host) and origin == str(request.base_url).rstrip("/"))
    if not request.client or not loopback(request.client.host) or not loopback(host) or not allowed_origin:
        raise HTTPException(403, detail={"code": "local_only", "message": "Projects are a local single-user MVP; remote access is disabled."})


def get_session():
    try:
        with db.project_session(db.DB_PATH) as session:
            yield session
    except db.SchemaNotReady:
        raise HTTPException(503, detail={"code": "schema_not_ready", "message": "Project schema is unavailable. Run the documented Alembic upgrade."}) from None
    except IntegrityError as error:
        if "candidate_limit" in str(error.orig):
            raise HTTPException(409, detail={"code": "candidate_limit", "message": "A project may have at most three active candidates."}) from None
        raise HTTPException(503, detail={"code": "database_unavailable", "message": "Candidate storage rejected the transaction."}) from None
    except SQLAlchemyError:
        raise HTTPException(503, detail={"code": "database_unavailable", "message": "Project storage is unavailable; retry after checking the local database."}) from None


router = APIRouter(prefix="/projects", tags=["Local projects"], dependencies=[Depends(local_only)])


def find_project(session, project_id):
    project = session.get(Project, str(project_id))
    if project is None:
        raise HTTPException(404, detail={"code": "project_not_found", "message": "Project not found."})
    return project


@router.post("", response_model=ProjectRead, status_code=201)
def create_project(body: ProjectCreate, session: Session = Depends(get_session)):
    project = Project(**body.model_dump())
    session.add(project)
    session.flush()
    return project


@router.get("", response_model=ProjectPage)
def list_projects(include_archived: bool = False, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=100), session: Session = Depends(get_session)):
    criteria = [] if include_archived else [Project.status == "active"]
    items = session.scalars(select(Project).where(*criteria).order_by(Project.created_at, Project.id).offset((page - 1) * page_size).limit(page_size)).all()
    total = session.scalar(select(func.count()).select_from(Project).where(*criteria))
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/{project_id}", response_model=ProjectRead)
def read_project(project_id: UUID, session: Session = Depends(get_session)):
    return find_project(session, project_id)


def revise(session, project_id, revision, changes):
    result = session.execute(update(Project).where(Project.id == str(project_id), Project.revision == revision)
                             .values(**changes, revision=Project.revision + 1, updated_at=utc_timestamp()))
    if result.rowcount == 0:
        find_project(session, project_id)
        raise HTTPException(409, detail={"code": "revision_conflict", "message": "Project changed. Reload it before retrying."})
    return find_project(session, project_id)


@router.patch("/{project_id}", response_model=ProjectRead)
def patch_project(project_id: UUID, body: ProjectPatch, session: Session = Depends(get_session)):
    return revise(session, project_id, body.expected_revision, body.model_dump(exclude_unset=True, exclude={"expected_revision"}))


@router.delete("/{project_id}", response_model=ProjectRead)
def archive_project(project_id: UUID, expected_revision: int = Query(ge=1), session: Session = Depends(get_session)):
    return revise(session, project_id, expected_revision, {"status": "archived"})
