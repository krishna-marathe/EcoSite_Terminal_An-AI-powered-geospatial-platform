"""SQLAlchemy adapter for approved public-facility snapshots.

There is intentionally no JSON fallback here.  A database or schema failure is
an operational error and must not be hidden by serving a different data source.
"""
from __future__ import annotations

from collections.abc import Callable
from copy import deepcopy

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..models.public_registry import PublicFacilitySnapshot, STATE_CODES
from .public_facilities import RegistrySnapshot


class PublicRegistryDataError(RuntimeError):
    pass


class SqlAlchemyPublicFacilityRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def snapshot(self) -> RegistrySnapshot[dict]:
        try:
            with self._session_factory() as session:
                rows = session.scalars(
                    select(PublicFacilitySnapshot)
                    .where(
                        PublicFacilitySnapshot.is_current.is_(True),
                        PublicFacilitySnapshot.visibility == "PUBLIC",
                    )
                    .order_by(PublicFacilitySnapshot.facility_id)
                ).all()
        except SQLAlchemyError as error:
            raise PublicRegistryDataError("Public registry storage is unavailable") from error

        versions = {row.registry_version for row in rows}
        if len(versions) > 1:
            raise PublicRegistryDataError("Current public snapshots have inconsistent registry versions")
        registry_version = next(iter(versions), "unpublished")
        return RegistrySnapshot(
            registry_version=registry_version,
            scope=tuple(STATE_CODES),
            facilities=tuple(deepcopy(row.payload) for row in rows),
        )

