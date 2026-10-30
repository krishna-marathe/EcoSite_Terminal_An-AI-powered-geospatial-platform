"""Safe prototype mapping from an approved submission to new public facts."""
from __future__ import annotations

import json
from datetime import date
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from ..models.public_registry import (
    CAPACITY_TYPES, CAPACITY_UNITS, FACILITY_TYPES, LOCATION_PRECISIONS,
    OWNERSHIP_CATEGORIES, SOURCE_CLASSES, STATE_CODES, VERIFICATION_STATUSES,
    FacilityCapacityDisclosure, FacilityOperator, FacilitySource,
    FacilityVerification, PublicFacilityRecord,
)
from .submission_sqlalchemy import SqlAlchemySubmissionRepository
from .submission_workflow import FacilitySubmission, SubmissionWorkflowService


class PublicationValidationError(ValueError): pass
class DuplicatePublicFacilityError(PublicationValidationError): pass


def _required(payload, key):
    value = payload.get(key)
    if value is None or (isinstance(value, str) and not value.strip()):
        raise PublicationValidationError(f"Public snapshot requires {key}")
    return value


class PrototypePublicationResolver:
    """Create new public rows only; existing public facts are never updated."""

    def __call__(self, session: Session, submission: FacilitySubmission, payload):
        forbidden = {"exactGeometry", "exact_geometry", "restrictedGeometry", "contact", "evidence"}
        if forbidden.intersection(payload):
            raise PublicationValidationError("Public snapshot contains restricted fields")
        facility_id = str(_required(payload, "id"))
        if session.get(PublicFacilityRecord, facility_id) is not None:
            raise DuplicatePublicFacilityError("Public facility ID already exists")

        operator_name = str(_required(payload, "operator")).strip()
        ownership = str(_required(payload, "ownershipCategory"))
        facility_type = str(_required(payload, "facilityType"))
        state_code = str(_required(payload, "stateCode"))
        precision = str(_required(payload, "locationPrecision"))
        if ownership not in OWNERSHIP_CATEGORIES or facility_type not in FACILITY_TYPES:
            raise PublicationValidationError("Invalid public facility classification")
        if state_code not in STATE_CODES or precision not in LOCATION_PRECISIONS:
            raise PublicationValidationError("Invalid public location classification")
        coordinates = _required(payload, "publicCoordinates")
        if not isinstance(coordinates, (list, tuple)) or len(coordinates) != 2:
            raise PublicationValidationError("Public coordinates must be [longitude, latitude]")
        longitude, latitude = coordinates
        if not isinstance(longitude, (int, float)) or not isinstance(latitude, (int, float)) or not (-180 <= longitude <= 180 and -90 <= latitude <= 90):
            raise PublicationValidationError("Public coordinates are invalid")

        verification = _required(payload, "verification")
        source = _required(verification, "source")
        status = str(_required(verification, "status"))
        source_class = str(_required(source, "sourceClass"))
        if status not in VERIFICATION_STATUSES or source_class not in SOURCE_CLASSES:
            raise PublicationValidationError("Invalid verification or source class")
        try:
            verified_at = date.fromisoformat(str(_required(verification, "verifiedAt")))
            expires_at = date.fromisoformat(str(_required(verification, "expiresAt")))
            retrieved_at = date.fromisoformat(str(_required(source, "retrievedAt")))
        except ValueError as error:
            raise PublicationValidationError("Verification dates are invalid") from error
        if not 1 <= (expires_at - verified_at).days <= 90:
            raise PublicationValidationError("Verification window must be 1-90 days")

        capacities = payload.get("capacityDisclosures", [])
        if not isinstance(capacities, list):
            raise PublicationValidationError("Capacity disclosures must be a list")
        for capacity in capacities:
            if not isinstance(capacity.get("value"), (int, float)) or capacity["value"] <= 0:
                raise PublicationValidationError("Capacity value must be positive")
            if capacity.get("unit") not in CAPACITY_UNITS or capacity.get("capacityType") not in CAPACITY_TYPES:
                raise PublicationValidationError("Capacity unit or type is invalid")
            if not str(capacity.get("scope", "")).strip():
                raise PublicationValidationError("Capacity scope is required")

        canonical_name = " ".join(operator_name.split()).casefold()
        operator = session.scalar(select(FacilityOperator).where(FacilityOperator.canonical_name == canonical_name))
        if operator is None:
            operator = FacilityOperator(
                id=str(uuid4()), name=operator_name, canonical_name=canonical_name,
                created_at=submission.updated_at.isoformat(), updated_at=submission.updated_at.isoformat(),
            )
            session.add(operator); session.flush()
        record = PublicFacilityRecord(
            id=facility_id, operator_id=operator.id, name=str(_required(payload, "name")),
            ownership_category=ownership, facility_type=facility_type, state_code=state_code,
            state_name=str(_required(payload, "state")), city=str(_required(payload, "city")),
            locality=str(_required(payload, "locality")), public_longitude=float(longitude),
            public_latitude=float(latitude), location_precision=precision,
            operational_since=payload.get("operationalSince"),
            registry_version=f"ministry-{submission.updated_at.isoformat()}", visibility="PUBLIC",
            temporal_class="STATIC_VERSIONED", created_at=submission.updated_at.isoformat(),
            updated_at=submission.updated_at.isoformat(),
        )
        session.add(record); session.flush()
        for ordinal, capacity in enumerate(capacities):
            session.add(FacilityCapacityDisclosure(
                id=str(uuid4()), facility_id=facility_id, ordinal=ordinal,
                value=float(capacity["value"]), unit=capacity["unit"],
                capacity_type=capacity["capacityType"], scope=capacity["scope"],
                visibility="PUBLIC", temporal_class="STATIC_VERSIONED",
                created_at=submission.updated_at.isoformat(),
            ))
        source_id = str(uuid4())
        session.add(FacilitySource(
            id=source_id, facility_id=facility_id, title=str(_required(source, "title")),
            publisher=str(_required(source, "publisher")), url=str(_required(source, "url")),
            source_class=source_class, retrieved_at=retrieved_at.isoformat(),
            evidence_class="DOCUMENTED", visibility="PUBLIC",
            created_at=submission.updated_at.isoformat(),
        )); session.flush()
        verification_id = str(uuid4())
        session.add(FacilityVerification(
            id=verification_id, facility_id=facility_id, source_id=source_id, status=status,
            verified_at=verified_at.isoformat(), expires_at=expires_at.isoformat(),
            created_at=submission.updated_at.isoformat(),
        )); session.flush()
        # Canonical serialization is required now; the repository hashes this
        # exact payload and the DB trigger verifies the same hash on linkage.
        json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        return facility_id, verification_id


def build_prototype_submission_workflow(engine: Engine, **service_kwargs) -> SubmissionWorkflowService:
    repository = SqlAlchemySubmissionRepository(
        lambda: Session(engine, expire_on_commit=False), PrototypePublicationResolver()
    )
    return SubmissionWorkflowService(repository, **service_kwargs)

