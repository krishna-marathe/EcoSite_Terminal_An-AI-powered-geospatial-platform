import unittest
from dataclasses import dataclass

from sqlalchemy.exc import OperationalError

from backend.app.services.public_facility_sqlalchemy import (
    PublicRegistryDataError,
    SqlAlchemyPublicFacilityRepository,
)


@dataclass
class Snapshot:
    facility_id: str
    registry_version: str
    payload: dict


class Result:
    def __init__(self, rows):
        self.rows = rows

    def all(self):
        return self.rows


class Session:
    def __init__(self, rows):
        self.rows = rows

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return None

    def scalars(self, _statement):
        return Result(self.rows)


class FailingSession(Session):
    def scalars(self, _statement):
        raise OperationalError("SELECT secret", {}, Exception("database unavailable"))


class SqlAlchemyPublicFacilityRepositoryTests(unittest.TestCase):
    def test_returns_copied_approved_snapshot_payloads(self):
        payload = {"id": "facility-1", "verification": {"verifiedAt": "2026-10-01", "expiresAt": "2026-12-01"}}
        repository = SqlAlchemyPublicFacilityRepository(lambda: Session([Snapshot("facility-1", "v1", payload)]))
        result = repository.snapshot()
        self.assertEqual(result.registry_version, "v1")
        self.assertEqual(result.facilities[0]["id"], "facility-1")
        result.facilities[0]["id"] = "changed"
        self.assertEqual(payload["id"], "facility-1")

    def test_inconsistent_current_versions_fail_without_fallback(self):
        rows = [Snapshot("a", "v1", {"id": "a"}), Snapshot("b", "v2", {"id": "b"})]
        repository = SqlAlchemyPublicFacilityRepository(lambda: Session(rows))
        with self.assertRaises(PublicRegistryDataError):
            repository.snapshot()

    def test_empty_database_is_explicitly_unpublished(self):
        result = SqlAlchemyPublicFacilityRepository(lambda: Session([])).snapshot()
        self.assertEqual(result.registry_version, "unpublished")
        self.assertEqual(result.facilities, ())

    def test_storage_errors_are_wrapped_without_sql_details(self):
        repository = SqlAlchemyPublicFacilityRepository(lambda: FailingSession([]))
        with self.assertRaises(PublicRegistryDataError) as error:
            repository.snapshot()
        self.assertEqual(str(error.exception), "Public registry storage is unavailable")
        self.assertNotIn("SELECT", str(error.exception))


if __name__ == "__main__":
    unittest.main()
