"""Deterministically import the reviewed public facility seed into SQLite.

The command requires an explicit database path so it cannot silently mutate the
default/live database. Run Alembic to `04a_001` before importing.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import date
from pathlib import Path
from uuid import UUID, uuid5

from sqlalchemy import delete, func, select, text, update
from sqlalchemy.orm import Session

from backend.app import db
from backend.app.models.public_registry import (
    CAPACITY_TYPES,
    CAPACITY_UNITS,
    FACILITY_TYPES,
    LOCATION_PRECISIONS,
    OWNERSHIP_CATEGORIES,
    SOURCE_CLASSES,
    STATE_CODES,
    VERIFICATION_STATUSES,
    FacilityCapacityDisclosure,
    FacilityAlias,
    FacilityOperator,
    FacilitySource,
    FacilityVerification,
    PublicFacilityRecord,
    PublicFacilitySnapshot,
)


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SEED = ROOT / "data" / "public_data_centres.json"
ID_NAMESPACE = UUID("f13d17e0-b28e-4e1a-a920-fc10e66891ce")


class RegistryImportError(ValueError):
    pass


def deterministic_id(kind: str, value: str) -> str:
    return str(uuid5(ID_NAMESPACE, f"{kind}:{value}"))


def canonical_text(value: str) -> str:
    return " ".join(value.split()).casefold()


def canonical_payload(value: dict) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def seed_timestamp(day: str) -> str:
    return f"{day}T00:00:00Z"


def load_and_validate_seed(path: Path) -> dict:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload.get("registryVersion"), str) or not payload["registryVersion"].strip():
        raise RegistryImportError("registryVersion is required")
    if set(payload.get("scope", [])) != set(STATE_CODES):
        raise RegistryImportError("Seed scope must contain exactly the four supported states")
    facilities = payload.get("facilities")
    if not isinstance(facilities, list) or not facilities:
        raise RegistryImportError("facilities must be a non-empty list")
    ids = [record.get("id") for record in facilities]
    if any(not isinstance(value, str) or not value for value in ids) or len(ids) != len(set(ids)):
        raise RegistryImportError("Facility IDs must be non-empty and unique")

    canonical_facilities: set[tuple[str, str, str, str]] = set()
    canonical_aliases: dict[str, str] = {}
    for record in facilities:
        if record.get("ownershipCategory") not in OWNERSHIP_CATEGORIES:
            raise RegistryImportError(f"Invalid ownership category for {record['id']}")
        if record.get("facilityType") not in FACILITY_TYPES:
            raise RegistryImportError(f"Invalid facility type for {record['id']}")
        if record.get("stateCode") not in STATE_CODES:
            raise RegistryImportError(f"Invalid state code for {record['id']}")
        if record.get("locationPrecision") not in LOCATION_PRECISIONS:
            raise RegistryImportError(f"Invalid location precision for {record['id']}")
        coordinates = record.get("publicCoordinates")
        if not isinstance(coordinates, list) or len(coordinates) != 2:
            raise RegistryImportError(f"Invalid public coordinates for {record['id']}")
        longitude, latitude = coordinates
        if not isinstance(longitude, (int, float)) or not isinstance(latitude, (int, float)):
            raise RegistryImportError(f"Non-numeric public coordinates for {record['id']}")
        if not -180 <= longitude <= 180 or not -90 <= latitude <= 90:
            raise RegistryImportError(f"Out-of-range public coordinates for {record['id']}")
        if "exactGeometry" in record or "restrictedGeometry" in record:
            raise RegistryImportError(f"Restricted geometry is forbidden in public seed {record['id']}")

        facility_key = (
            canonical_text(record.get("operator", "")), canonical_text(record.get("name", "")),
            record.get("stateCode", ""), canonical_text(record.get("city", "")),
        )
        if not all(facility_key) or facility_key in canonical_facilities:
            raise RegistryImportError(f"Duplicate canonical facility for {record['id']}")
        canonical_facilities.add(facility_key)

        for alias in record.get("aliases", []):
            if not isinstance(alias, dict) or alias.get("aliasType") not in {"former_name", "operator_name", "campus_name", "other"}:
                raise RegistryImportError(f"Invalid alias for {record['id']}")
            normalized = canonical_text(alias.get("alias", ""))
            if not normalized:
                raise RegistryImportError(f"Empty alias for {record['id']}")
            owner = canonical_aliases.get(normalized)
            if owner is not None and owner != record["id"]:
                raise RegistryImportError(f"Alias {alias['alias']!r} is assigned to multiple facilities")
            canonical_aliases[normalized] = record["id"]

        for capacity in record.get("capacityDisclosures", []):
            if not isinstance(capacity.get("value"), (int, float)) or capacity["value"] <= 0:
                raise RegistryImportError(f"Invalid capacity value for {record['id']}")
            if capacity.get("unit") not in CAPACITY_UNITS or capacity.get("capacityType") not in CAPACITY_TYPES:
                raise RegistryImportError(f"Invalid capacity contract for {record['id']}")
            if not isinstance(capacity.get("scope"), str) or not capacity["scope"].strip():
                raise RegistryImportError(f"Capacity scope is required for {record['id']}")

        verification = record.get("verification", {})
        if verification.get("status") not in VERIFICATION_STATUSES:
            raise RegistryImportError(f"Invalid verification status for {record['id']}")
        try:
            verified_at = date.fromisoformat(verification["verifiedAt"])
            expires_at = date.fromisoformat(verification["expiresAt"])
        except (KeyError, TypeError, ValueError) as exc:
            raise RegistryImportError(f"Invalid verification dates for {record['id']}") from exc
        window = (expires_at - verified_at).days
        if window < 1 or window > 90:
            raise RegistryImportError(f"Verification window must be 1-90 days for {record['id']}")
        sources = [verification.get("source", {})] + verification.get("supportingSources", [])
        if not all(isinstance(source, dict) for source in sources):
            raise RegistryImportError(f"Invalid supporting sources for {record['id']}")
        source_keys: set[tuple[str, str]] = set()
        for source in sources:
            if source.get("sourceClass") not in SOURCE_CLASSES:
                raise RegistryImportError(f"Invalid source class for {record['id']}")
            for key in ("title", "publisher", "url", "retrievedAt"):
                if not isinstance(source.get(key), str) or not source[key].strip():
                    raise RegistryImportError(f"Source {key} is required for {record['id']}")
            try:
                date.fromisoformat(source["retrievedAt"])
            except ValueError as exc:
                raise RegistryImportError(f"Invalid source retrieval date for {record['id']}") from exc
            source_key = (source["url"], source["retrievedAt"])
            if source_key in source_keys:
                raise RegistryImportError(f"Duplicate source retrieval for {record['id']}")
            source_keys.add(source_key)
    return payload


def _set_fields(record, values: dict) -> None:
    for key, value in values.items():
        setattr(record, key, value)


def _upsert(session: Session, model, identifier: str, values: dict):
    record = session.get(model, identifier)
    if record is None:
        record = model(id=identifier, **values)
        session.add(record)
    else:
        _set_fields(record, values)
    return record


def import_public_registry(database_path: Path, seed_path: Path = DEFAULT_SEED) -> dict[str, int]:
    database_path = database_path.expanduser().resolve()
    seed = load_and_validate_seed(seed_path.expanduser().resolve())
    registry_version = seed["registryVersion"]
    engine = db.make_engine(database_path)
    try:
        with engine.connect() as connection:
            revision = connection.scalar(text("SELECT version_num FROM alembic_version"))
            if revision not in {"04a_001", "04b_001", "04c_001"}:
                raise RegistryImportError(
                    f"Database schema is {revision or 'unmigrated'}; expected a reviewed public-registry schema"
                )

        with Session(engine, expire_on_commit=False) as session, session.begin():
            incoming_ids = {facility["id"] for facility in seed["facilities"]}
            current_ministry_ids = set(session.scalars(
                select(PublicFacilitySnapshot.facility_id).where(
                    PublicFacilitySnapshot.is_current.is_(True),
                    PublicFacilitySnapshot.approval_basis == "ministry_review",
                    PublicFacilitySnapshot.facility_id.in_(incoming_ids),
                )
            ))
            if current_ministry_ids:
                raise RegistryImportError(
                    "Seed import cannot supersede current ministry-reviewed facilities: "
                    + ", ".join(sorted(current_ministry_ids))
                )

            omitted_seed_ids = set(session.scalars(
                select(PublicFacilitySnapshot.facility_id).where(
                    PublicFacilitySnapshot.is_current.is_(True),
                    PublicFacilitySnapshot.approval_basis == "reviewed_public_seed",
                    PublicFacilitySnapshot.facility_id.not_in(incoming_ids),
                )
            ))
            session.execute(
                update(PublicFacilitySnapshot)
                .where(
                    PublicFacilitySnapshot.is_current.is_(True),
                    PublicFacilitySnapshot.approval_basis == "reviewed_public_seed",
                    PublicFacilitySnapshot.facility_id.not_in(incoming_ids),
                )
                .values(is_current=False)
            )
            if omitted_seed_ids:
                session.execute(delete(FacilityCapacityDisclosure).where(FacilityCapacityDisclosure.facility_id.in_(omitted_seed_ids)))
                session.execute(delete(FacilityAlias).where(FacilityAlias.facility_id.in_(omitted_seed_ids)))

            for facility in seed["facilities"]:
                verification = facility["verification"]
                source = verification["source"]
                stable_time = seed_timestamp(verification["verifiedAt"])

                operator_canonical = canonical_text(facility["operator"])
                operator_id = deterministic_id("operator", operator_canonical)
                _upsert(
                    session,
                    FacilityOperator,
                    operator_id,
                    {
                        "name": facility["operator"],
                        "canonical_name": operator_canonical,
                        "created_at": stable_time,
                        "updated_at": stable_time,
                    },
                )

                longitude, latitude = facility["publicCoordinates"]
                _upsert(
                    session,
                    PublicFacilityRecord,
                    facility["id"],
                    {
                        "operator_id": operator_id,
                        "name": facility["name"],
                        "ownership_category": facility["ownershipCategory"],
                        "facility_type": facility["facilityType"],
                        "state_code": facility["stateCode"],
                        "state_name": facility["state"],
                        "city": facility["city"],
                        "locality": facility["locality"],
                        "public_longitude": float(longitude),
                        "public_latitude": float(latitude),
                        "location_precision": facility["locationPrecision"],
                        "operational_since": facility.get("operationalSince"),
                        "registry_version": registry_version,
                        "visibility": "PUBLIC",
                        "temporal_class": "STATIC_VERSIONED",
                        "created_at": stable_time,
                        "updated_at": stable_time,
                    },
                )
                session.flush()

                # These normalized tables represent the current reviewed record;
                # immutable historical values remain in snapshot payloads.
                session.execute(delete(FacilityCapacityDisclosure).where(FacilityCapacityDisclosure.facility_id == facility["id"]))
                session.execute(delete(FacilityAlias).where(FacilityAlias.facility_id == facility["id"]))
                session.flush()

                for alias in facility.get("aliases", []):
                    normalized_alias = canonical_text(alias["alias"])
                    session.add(FacilityAlias(
                        id=deterministic_id("alias", f"{facility['id']}:{normalized_alias}"),
                        facility_id=facility["id"], alias=alias["alias"],
                        normalized_alias=normalized_alias, alias_type=alias["aliasType"],
                        created_at=stable_time,
                    ))

                for ordinal, capacity in enumerate(facility.get("capacityDisclosures", [])):
                    capacity_id = deterministic_id("capacity", f"{facility['id']}:{ordinal}")
                    _upsert(
                        session,
                        FacilityCapacityDisclosure,
                        capacity_id,
                        {
                            "facility_id": facility["id"],
                            "ordinal": ordinal,
                            "value": float(capacity["value"]),
                            "unit": capacity["unit"],
                            "capacity_type": capacity["capacityType"],
                            "scope": capacity["scope"],
                            "visibility": "PUBLIC",
                            "temporal_class": "STATIC_VERSIONED",
                            "created_at": stable_time,
                        },
                    )

                source_id = ""
                for source_index, source_value in enumerate([source] + verification.get("supportingSources", [])):
                    source_key = f"{facility['id']}:{source_value['url']}:{source_value['retrievedAt']}"
                    imported_source_id = deterministic_id("source", source_key)
                    _upsert(
                        session,
                        FacilitySource,
                        imported_source_id,
                        {
                            "facility_id": facility["id"],
                            "title": source_value["title"],
                            "publisher": source_value["publisher"],
                            "url": source_value["url"],
                            "source_class": source_value["sourceClass"],
                            "retrieved_at": source_value["retrievedAt"],
                            "evidence_class": "DOCUMENTED",
                            "visibility": "PUBLIC",
                            "created_at": stable_time,
                        },
                    )
                    if source_index == 0:
                        source_id = imported_source_id
                session.flush()

                verification_key = f"{facility['id']}:{source_id}:{verification['verifiedAt']}:{verification['expiresAt']}"
                verification_id = deterministic_id("verification", verification_key)
                _upsert(
                    session,
                    FacilityVerification,
                    verification_id,
                    {
                        "facility_id": facility["id"],
                        "source_id": source_id,
                        "status": verification["status"],
                        "verified_at": verification["verifiedAt"],
                        "expires_at": verification["expiresAt"],
                        "created_at": stable_time,
                    },
                )
                session.flush()

                snapshot_payload = dict(facility)
                snapshot_payload.pop("aliases", None)
                snapshot_payload["verification"] = dict(verification)
                snapshot_payload["verification"].pop("supportingSources", None)
                snapshot_json = canonical_payload(snapshot_payload)
                snapshot_hash = hashlib.sha256(snapshot_json.encode("utf-8")).hexdigest()
                snapshot_id = deterministic_id("snapshot", f"{facility['id']}:{registry_version}")
                existing_snapshot = session.get(PublicFacilitySnapshot, snapshot_id)
                if existing_snapshot is not None and existing_snapshot.payload_sha256 != snapshot_hash:
                    raise RegistryImportError(
                        f"Immutable snapshot conflict for {facility['id']} at registry version {registry_version}"
                    )
                session.execute(
                    update(PublicFacilitySnapshot)
                    .where(
                        PublicFacilitySnapshot.facility_id == facility["id"],
                        PublicFacilitySnapshot.id != snapshot_id,
                        PublicFacilitySnapshot.approval_basis == "reviewed_public_seed",
                    )
                    .values(is_current=False)
                )
                if existing_snapshot is None:
                    session.add(
                        PublicFacilitySnapshot(
                            id=snapshot_id,
                            facility_id=facility["id"],
                            verification_id=verification_id,
                            registry_version=registry_version,
                            payload=json.loads(snapshot_json),
                            payload_sha256=snapshot_hash,
                            approval_basis="reviewed_public_seed",
                            approved_by="reviewed-public-seed-import",
                            approved_at=stable_time,
                            is_current=True,
                            visibility="PUBLIC",
                            created_at=stable_time,
                        )
                    )
                else:
                    existing_snapshot.is_current = True

        with Session(engine) as session:
            return {
                "operators": session.scalar(select(func.count()).select_from(FacilityOperator)) or 0,
                "facilities": session.scalar(select(func.count()).select_from(PublicFacilityRecord)) or 0,
                "capacities": session.scalar(select(func.count()).select_from(FacilityCapacityDisclosure)) or 0,
                "sources": session.scalar(select(func.count()).select_from(FacilitySource)) or 0,
                "verifications": session.scalar(select(func.count()).select_from(FacilityVerification)) or 0,
                "snapshots": session.scalar(select(func.count()).select_from(PublicFacilitySnapshot)) or 0,
            }
    finally:
        engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", required=True, type=Path, help="Explicit migrated SQLite database path")
    parser.add_argument("--seed", type=Path, default=DEFAULT_SEED, help="Reviewed public registry JSON")
    args = parser.parse_args()
    print(json.dumps(import_public_registry(args.db, args.seed), sort_keys=True))


if __name__ == "__main__":
    main()
