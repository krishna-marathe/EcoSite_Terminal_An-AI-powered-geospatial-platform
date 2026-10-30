"""Demo-authenticated ministry operations and facility-submission workflows."""
from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, Path, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute

from ..schemas.ministry_operations import (
    FacilityFreshnessRead,
    MinistryFacilitySummaryRead,
    MinistryFreshnessQueueRead,
    MinistryOverviewRead,
    MinistrySourceHealthRead,
    MinistryStateSummaryRead,
)
from ..schemas.public_facilities import ApiError, StateCode
from ..schemas.submission_workflow import (
    ReviewActionRequest,
    ReviewDecisionRead,
    ReviewQueueItem,
    ReviewQueueRead,
    ReviewResultRead,
    SubmissionCreate,
    SubmissionPatch,
    SubmissionRead,
    SubmissionTransition,
)
from ..services.ministry_operations import MinistryOperationsService
from ..services.ministry_sqlalchemy import MinistryStorageError
from ..services.submission_workflow import (
    FacilitySubmission,
    IncompleteSubmission,
    InvalidTransition,
    RevisionConflict,
    SubmissionDraft,
    SubmissionNotFound,
    SubmissionWorkflowService,
    WorkflowActor,
    WorkflowForbidden,
    WorkflowStorageError,
)
from .demo_identity import DemoAuthenticationError, ministry_actor, operator_actor


class RestrictedServiceUnavailable(RuntimeError):
    pass


def _request_id(request: Request) -> str:
    supplied = request.headers.get("x-request-id", "").strip()
    return supplied[:100] if supplied else f"req_{uuid4().hex}"


def _error(request: Request, status: int, code: str, message: str, details=None):
    value = ApiError.model_validate({
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
            "requestId": _request_id(request),
        }
    })
    return JSONResponse(status_code=status, content=value.model_dump(mode="json"))


class RestrictedContractRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def contract_handler(request: Request):
            try:
                return await handler(request)
            except RequestValidationError as exc:
                fields = [{
                    "path": ".".join(str(part) for part in item["loc"] if part not in {"query", "path", "body", "header"}),
                    "message": item["msg"],
                } for item in exc.errors()]
                return _error(request, 422, "validation_failed", "Request validation failed.", {"fields": fields})
            except DemoAuthenticationError as exc:
                return _error(request, exc.status_code, exc.code, exc.message)
            except SubmissionNotFound:
                return _error(request, 404, "submission_not_found", "Submission not found.")
            except WorkflowForbidden:
                return _error(request, 403, "access_denied", "Access to this workflow is denied.")
            except RevisionConflict:
                return _error(request, 409, "revision_conflict", "Submission changed; reload before retrying.")
            except IncompleteSubmission as exc:
                return _error(request, 409, "incomplete_submission", str(exc), {"fields": list(exc.fields)})
            except InvalidTransition as exc:
                return _error(request, 409, "invalid_transition", str(exc))
            except (WorkflowStorageError, MinistryStorageError, RestrictedServiceUnavailable):
                return _error(request, 503, "service_unavailable", "The restricted workflow service is unavailable.")
            except ValueError as exc:
                return _error(request, 400, "invalid_request", str(exc))

        return contract_handler


router = APIRouter(tags=["Restricted ministry and operator workflows"], route_class=RestrictedContractRoute)


def _ministry_service(request: Request) -> MinistryOperationsService:
    service = getattr(request.app.state, "ministry_operations_service", None)
    if service is None:
        raise RestrictedServiceUnavailable()
    return service


def _workflow_service(request: Request) -> SubmissionWorkflowService:
    service = getattr(request.app.state, "submission_workflow_service", None)
    if service is None:
        raise RestrictedServiceUnavailable()
    return service


def _freshness(item) -> FacilityFreshnessRead:
    return FacilityFreshnessRead(
        facilityId=item.facility_id,
        facilityName=item.facility_name,
        stateCode=item.state_code,
        metric=item.metric,
        status=item.status,
        observedAt=item.observed_at,
        ageSeconds=item.age_seconds,
        sourceId=item.source_id,
        reason=item.reason,
    )


def _state(item) -> MinistryStateSummaryRead:
    return MinistryStateSummaryRead(
        stateCode=item.state_code,
        facilityCount=item.facility_count,
        currentFacilityCount=item.current_facility_count,
        staleFacilityCount=item.stale_facility_count,
        unavailableFacilityCount=item.unavailable_facility_count,
    )


def _source(item) -> MinistrySourceHealthRead:
    return MinistrySourceHealthRead(
        sourceId=item.source_id,
        provider=item.provider,
        status=item.status,
        lastCheckedAt=item.last_checked_at,
        lastSuccessAt=item.last_success_at,
        staleFacilityCount=item.stale_facility_count,
        failedRunCount=item.failed_run_count,
    )


def _overview(service: MinistryOperationsService, queue_limit: int):
    return service.overview(queue_limit)


@router.get("/ministry/operations/overview", response_model=MinistryOverviewRead)
def ministry_overview(
    request: Request,
    queue_limit: int = Query(default=100, alias="queueLimit", ge=1, le=500),
    _actor: WorkflowActor = Depends(ministry_actor),
):
    result = _overview(_ministry_service(request), queue_limit)
    return MinistryOverviewRead(
        generatedAt=result.generated_at,
        facilityCount=result.facility_count,
        states=[_state(item) for item in result.states],
        sourceHealth=[_source(item) for item in result.source_health],
        freshnessQueue=[_freshness(item) for item in result.freshness_queue],
    )


@router.get("/ministry/operations/source-health", response_model=list[MinistrySourceHealthRead])
def ministry_source_health(request: Request, _actor: WorkflowActor = Depends(ministry_actor)):
    return [_source(item) for item in _overview(_ministry_service(request), 100).source_health]


@router.get("/ministry/operations/freshness", response_model=MinistryFreshnessQueueRead)
def ministry_freshness(
    request: Request,
    limit: int = Query(default=100, ge=1, le=500),
    _actor: WorkflowActor = Depends(ministry_actor),
):
    result = _overview(_ministry_service(request), limit)
    items = [_freshness(item) for item in result.freshness_queue]
    return MinistryFreshnessQueueRead(generatedAt=result.generated_at, items=items, total=len(items))


@router.get("/ministry/operations/states/{state_code}", response_model=MinistryStateSummaryRead)
def ministry_state_summary(
    request: Request,
    state_code: StateCode,
    _actor: WorkflowActor = Depends(ministry_actor),
):
    result = _overview(_ministry_service(request), 100)
    item = next((row for row in result.states if row.state_code == state_code), None)
    if item is None:
        raise ValueError("State summary is unavailable")
    return _state(item)


@router.get("/ministry/operations/facilities/{facility_id}", response_model=MinistryFacilitySummaryRead)
def ministry_facility_summary(
    request: Request,
    facility_id: str = Path(min_length=3, max_length=100),
    _actor: WorkflowActor = Depends(ministry_actor),
):
    result = _overview(_ministry_service(request), 500)
    rows = [row for row in result.freshness_queue if row.facility_id == facility_id]
    if not rows:
        raise ValueError("Facility operational summary is unavailable")
    return MinistryFacilitySummaryRead(
        generatedAt=result.generated_at,
        facilityId=facility_id,
        facilityName=rows[0].facility_name,
        stateCode=rows[0].state_code,
        metrics=[_freshness(item) for item in rows],
    )


def _submission(value: FacilitySubmission) -> SubmissionRead:
    return SubmissionRead(
        id=value.id,
        status=value.status,
        revision=value.revision,
        facilityName=value.facility_name,
        operatorOrganisationId=value.operator_organisation_id,
        facilityType=value.facility_type,
        stateCode=value.state_code,
        city=value.city,
        locality=value.locality,
        exactGeometry=value.exact_geometry,
        capacityDisclosures=list(value.capacity_disclosures),
        evidence=list(value.evidence),
        createdAt=value.created_at,
        updatedAt=value.updated_at,
        submittedAt=value.submitted_at,
        assignedReviewerId=value.assigned_reviewer_id,
    )


@router.post("/operator/facility-submissions", response_model=SubmissionRead, status_code=201)
def create_submission(
    request: Request,
    body: SubmissionCreate,
    actor: WorkflowActor = Depends(operator_actor),
):
    draft = SubmissionDraft(
        body.facilityName,
        body.operatorOrganisationId,
        body.facilityType,
        body.stateCode,
        body.city,
        body.locality,
        body.exactGeometry.model_dump(mode="json"),
        tuple(item.model_dump(mode="json") for item in body.capacityDisclosures),
        tuple(item.model_dump(mode="json") for item in body.evidence),
    )
    return _submission(_workflow_service(request).create_draft(actor, draft))


@router.get("/operator/facility-submissions/{submission_id}", response_model=SubmissionRead)
def operator_submission(
    request: Request,
    submission_id: str,
    actor: WorkflowActor = Depends(operator_actor),
):
    return _submission(_workflow_service(request).get_for_operator(actor, submission_id))


@router.patch("/operator/facility-submissions/{submission_id}", response_model=SubmissionRead)
def revise_submission(
    request: Request,
    body: SubmissionPatch,
    submission_id: str,
    actor: WorkflowActor = Depends(operator_actor),
):
    names = {
        "facilityName": "facility_name",
        "facilityType": "facility_type",
        "stateCode": "state_code",
        "city": "city",
        "locality": "locality",
        "exactGeometry": "exact_geometry",
        "capacityDisclosures": "capacity_disclosures",
        "evidence": "evidence",
    }
    raw = body.model_dump(mode="json", exclude_unset=True, exclude={"expectedRevision"})
    changes = {names[key]: tuple(value) if key in {"capacityDisclosures", "evidence"} else value for key, value in raw.items()}
    return _submission(_workflow_service(request).revise(actor, submission_id, body.expectedRevision, changes))


@router.post("/operator/facility-submissions/{submission_id}/submit", response_model=SubmissionRead)
def submit_submission(
    request: Request,
    body: SubmissionTransition,
    submission_id: str,
    actor: WorkflowActor = Depends(operator_actor),
):
    return _submission(_workflow_service(request).submit(actor, submission_id, body.expectedRevision))


@router.get("/ministry/facility-submissions", response_model=ReviewQueueRead)
def ministry_review_queue(
    request: Request,
    status: list[str] = Query(default=["submitted", "resubmitted"]),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, alias="pageSize", ge=1, le=100),
    actor: WorkflowActor = Depends(ministry_actor),
):
    items, total = _workflow_service(request).review_queue(actor, tuple(status), page, page_size)
    return ReviewQueueRead(
        items=[ReviewQueueItem(
            id=item.id,
            status=item.status,
            revision=item.revision,
            facilityName=item.facility_name,
            operatorOrganisationId=item.operator_organisation_id,
            stateCode=item.state_code,
            city=item.city,
            submittedAt=item.submitted_at,
            assignedReviewerId=item.assigned_reviewer_id,
        ) for item in items],
        page=page,
        pageSize=page_size,
        total=total,
    )


@router.get("/ministry/facility-submissions/{submission_id}", response_model=SubmissionRead)
def ministry_review_detail(
    request: Request,
    submission_id: str,
    actor: WorkflowActor = Depends(ministry_actor),
):
    return _submission(_workflow_service(request).get_for_review(actor, submission_id))


@router.post("/ministry/facility-submissions/{submission_id}/actions", response_model=ReviewResultRead)
def ministry_review_action(
    request: Request,
    body: ReviewActionRequest,
    submission_id: str,
    actor: WorkflowActor = Depends(ministry_actor),
):
    result = _workflow_service(request).review(
        actor,
        submission_id,
        body.expectedRevision,
        body.action,
        body.reason,
        body.requestedFields,
        body.publicSnapshot.model_dump(mode="json") if body.publicSnapshot else None,
    )
    publication = result.publication
    published_id = publication.public_facility_id if publication else None
    return ReviewResultRead(
        submissionId=result.submission.id,
        status=result.submission.status,
        revision=result.submission.revision,
        decision=ReviewDecisionRead(
            action=result.event.event_type,
            reason=result.event.reason,
            decidedAt=result.event.occurred_at,
            decidedBy=result.event.actor_id,
        ),
        publishedFacilityId=published_id,
        publicSnapshotVersion=publication.version if publication else None,
    )
