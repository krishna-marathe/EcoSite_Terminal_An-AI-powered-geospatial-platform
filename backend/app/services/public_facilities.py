"""Persistence-neutral queries for the approved public facility registry.

The service deliberately knows nothing about FastAPI, Pydantic, SQLAlchemy or
SQLite.  API and database adapters can therefore change independently while
the publication, filtering and pagination rules remain testable in one place.
"""
from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Generic, Literal, Protocol, TypeVar


FacilityT = TypeVar("FacilityT")
Freshness = Literal["current"]


def _field(value: object, name: str) -> object:
    if isinstance(value, Mapping):
        return value[name]
    return getattr(value, name)


def _date_field(value: object, name: str) -> date:
    raw = _field(value, name)
    if isinstance(raw, date):
        return raw
    if isinstance(raw, str):
        return date.fromisoformat(raw)
    raise TypeError(f"{name} must be a date or ISO date string")


@dataclass(frozen=True)
class RegistrySnapshot(Generic[FacilityT]):
    registry_version: str
    scope: tuple[str, ...]
    facilities: tuple[FacilityT, ...]


class PublicFacilityRepository(Protocol, Generic[FacilityT]):
    def snapshot(self) -> RegistrySnapshot[FacilityT]: ...


@dataclass(frozen=True)
class FacilityFilters:
    state_code: str | None = None
    operator: str | None = None
    facility_type: str | None = None
    query: str | None = None
    freshness: Freshness = "current"


@dataclass(frozen=True)
class PageRequest:
    page: int = 1
    page_size: int = 50

    def __post_init__(self) -> None:
        if self.page < 1:
            raise ValueError("page must be at least 1")
        if not 1 <= self.page_size <= 100:
            raise ValueError("page_size must be between 1 and 100")


@dataclass(frozen=True)
class FacilityPage(Generic[FacilityT]):
    items: tuple[FacilityT, ...]
    page: int
    page_size: int
    total: int
    registry_version: str
    as_of: date


@dataclass(frozen=True)
class FacilitySummary:
    registry_version: str
    as_of: date
    operational_facility_count: int
    operator_count: int
    by_state: dict[str, int]
    capacity_aggregation: str = "disabled_mixed_measurement_boundaries"


class PublicFacilityNotFound(LookupError):
    """Non-disclosing missing, expired or unpublished facility result."""


class JsonRegistryRepository(Generic[FacilityT]):
    """Temporary JSON adapter; ``parser`` remains owned by the API/schema layer."""

    def __init__(self, path: Path, parser: Callable[[str], object]) -> None:
        self._path = path
        self._parser = parser

    def snapshot(self) -> RegistrySnapshot[FacilityT]:
        registry = self._parser(self._path.read_text(encoding="utf-8"))
        return RegistrySnapshot(
            registry_version=str(_field(registry, "registryVersion")),
            scope=tuple(str(code) for code in _field(registry, "scope")),  # type: ignore[arg-type]
            facilities=tuple(_field(registry, "facilities")),  # type: ignore[arg-type]
        )


class PublicFacilityService(Generic[FacilityT]):
    def __init__(
        self,
        repository: PublicFacilityRepository[FacilityT],
        today: Callable[[], date] = date.today,
    ) -> None:
        self._repository = repository
        self._today = today

    @staticmethod
    def is_publishable(facility: FacilityT, as_of: date) -> bool:
        verification = _field(facility, "verification")
        return (
            _date_field(verification, "verifiedAt")
            <= as_of
            <= _date_field(verification, "expiresAt")
        )

    def _current(self, snapshot: RegistrySnapshot[FacilityT], as_of: date) -> list[FacilityT]:
        return [facility for facility in snapshot.facilities if self.is_publishable(facility, as_of)]

    def list_facilities(
        self,
        filters: FacilityFilters = FacilityFilters(),
        pagination: PageRequest = PageRequest(),
    ) -> FacilityPage[FacilityT]:
        snapshot = self._repository.snapshot()
        as_of = self._today()
        records = self._current(snapshot, as_of)

        if filters.state_code:
            records = [item for item in records if _field(item, "stateCode") == filters.state_code]
        if filters.operator:
            operator = filters.operator.casefold()
            records = [item for item in records if str(_field(item, "operator")).casefold() == operator]
        if filters.facility_type:
            records = [item for item in records if _field(item, "facilityType") == filters.facility_type]
        if filters.query:
            query = filters.query.casefold()
            records = [
                item
                for item in records
                if query
                in " ".join(
                    str(_field(item, field))
                    for field in ("name", "operator", "city", "locality", "state")
                ).casefold()
            ]

        records.sort(
            key=lambda item: tuple(
                str(_field(item, field)).casefold()
                for field in ("state", "city", "operator", "name")
            )
        )
        total = len(records)
        start = (pagination.page - 1) * pagination.page_size
        items = tuple(records[start : start + pagination.page_size])
        return FacilityPage(
            items=items,
            page=pagination.page,
            page_size=pagination.page_size,
            total=total,
            registry_version=snapshot.registry_version,
            as_of=as_of,
        )

    def get_facility(self, facility_id: str) -> FacilityT:
        snapshot = self._repository.snapshot()
        as_of = self._today()
        facility = next(
            (item for item in snapshot.facilities if _field(item, "id") == facility_id),
            None,
        )
        if facility is None or not self.is_publishable(facility, as_of):
            raise PublicFacilityNotFound("Public facility not found")
        return facility

    def get_summary(self) -> FacilitySummary:
        snapshot = self._repository.snapshot()
        as_of = self._today()
        records = self._current(snapshot, as_of)
        by_state = {state_code: 0 for state_code in snapshot.scope}
        for facility in records:
            state_code = str(_field(facility, "stateCode"))
            by_state[state_code] = by_state.get(state_code, 0) + 1
        return FacilitySummary(
            registry_version=snapshot.registry_version,
            as_of=as_of,
            operational_facility_count=len(records),
            operator_count=len({str(_field(item, "operator")) for item in records}),
            by_state=by_state,
        )

