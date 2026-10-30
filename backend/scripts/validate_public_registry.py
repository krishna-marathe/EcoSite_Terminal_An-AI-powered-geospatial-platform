"""Validate the public data-centre seed without mutating it.

The validator is intentionally stricter than the API parser and emits stable,
field-addressed diagnostics suitable for collection review and CI. Geographic
checks use the repository's pinned four-state screening boundary; they are not
legal boundary determinations.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from shapely.geometry import Point

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.state_scope import FOCUS_STATES, StateScopeUnavailable, load_focus_states  # noqa: E402

DEFAULT_REGISTRY = ROOT / "data" / "public_data_centres.json"
CAPACITY_TYPES = {"it_load", "total_power", "power_capacity", "power_capacity_unspecified"}
CAPACITY_UNITS = {"MW", "MVA"}
CAPACITY_SCOPES = {"facility", "combined_facilities", "live_phase", "phase_1", "design_minimum", "campus_design"}
FACILITY_TYPES = {"colocation", "hyperscale", "enterprise", "edge", "government", "other"}
LOCATION_PRECISIONS = {"locality", "district"}
OPERATIONAL_EVIDENCE_STATUSES = {"government_verified", "public_operator_confirmed", "credible_public_report"}
SOURCE_CLASSES = {"government", "operator", "operator_factsheet", "filing", "certification", "news", "industry_publication", "directory"}
SHA256_RE = re.compile(r"^[a-f0-9]{64}$")


@dataclass(frozen=True)
class Diagnostic:
    severity: str
    code: str
    path: str
    message: str


def _canonical(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").casefold()).strip()


def _parse_date(value: Any, path: str, diagnostics: list[Diagnostic]) -> date | None:
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        diagnostics.append(Diagnostic("error", "invalid_date", path, "Use an ISO-8601 calendar date (YYYY-MM-DD)."))
        return None


def _sources(facility: dict[str, Any]) -> list[dict[str, Any]]:
    verification = facility.get("verification") or {}
    values = verification.get("sources")
    if isinstance(values, list):
        return [item for item in values if isinstance(item, dict)]
    source = verification.get("source")
    return [source] if isinstance(source, dict) else []


def validate_registry(document: Any, *, as_of: date | None = None) -> list[Diagnostic]:
    as_of = as_of or date.today()
    diagnostics: list[Diagnostic] = []
    if not isinstance(document, dict):
        return [Diagnostic("error", "invalid_document", "$", "Registry root must be a JSON object.")]

    scope = document.get("scope")
    if not isinstance(scope, list) or set(scope) != set(FOCUS_STATES) or len(scope) != len(FOCUS_STATES):
        diagnostics.append(Diagnostic("error", "invalid_scope", "scope", "Scope must contain each supported state code exactly once."))
    if not str(document.get("registryVersion") or "").strip():
        diagnostics.append(Diagnostic("error", "missing_registry_version", "registryVersion", "A non-empty immutable registry version is required."))
    facilities = document.get("facilities")
    if not isinstance(facilities, list) or not facilities:
        diagnostics.append(Diagnostic("error", "invalid_facilities", "facilities", "Facilities must be a non-empty list."))
        return diagnostics

    try:
        boundaries = load_focus_states()
    except StateScopeUnavailable:
        boundaries = {}
        diagnostics.append(Diagnostic("error", "boundary_unavailable", "facilities", "Pinned state boundaries could not be verified."))

    seen_ids: dict[str, int] = {}
    seen_canonical: dict[tuple[str, str], int] = {}
    seen_aliases: dict[tuple[str, str], int] = {}
    for index, facility in enumerate(facilities):
        base = f"facilities[{index}]"
        if not isinstance(facility, dict):
            diagnostics.append(Diagnostic("error", "invalid_facility", base, "Facility must be an object."))
            continue
        facility_id = str(facility.get("id") or "").strip()
        if not facility_id:
            diagnostics.append(Diagnostic("error", "missing_id", f"{base}.id", "Facility ID is required."))
        elif facility_id in seen_ids:
            diagnostics.append(Diagnostic("error", "duplicate_id", f"{base}.id", f"Duplicates facilities[{seen_ids[facility_id]}].id."))
        else:
            seen_ids[facility_id] = index

        operator = str(facility.get("operator") or "").strip()
        name = str(facility.get("name") or "").strip()
        if not operator:
            diagnostics.append(Diagnostic("error", "missing_operator", f"{base}.operator", "Operator is required."))
        if not name:
            diagnostics.append(Diagnostic("error", "missing_name", f"{base}.name", "Facility name is required."))
        canonical = (_canonical(operator), _canonical(name))
        if all(canonical):
            if canonical in seen_canonical:
                diagnostics.append(Diagnostic("error", "duplicate_canonical_facility", base, f"Canonical operator/name duplicates facilities[{seen_canonical[canonical]}]."))
            else:
                seen_canonical[canonical] = index
        for alias_index, alias in enumerate(facility.get("aliases") or []):
            alias_key = (_canonical(operator), _canonical(alias))
            alias_path = f"{base}.aliases[{alias_index}]"
            if not alias_key[1]:
                diagnostics.append(Diagnostic("error", "invalid_alias", alias_path, "Alias must be non-empty."))
            elif alias_key == canonical or alias_key in seen_aliases or alias_key in seen_canonical:
                diagnostics.append(Diagnostic("error", "duplicate_alias", alias_path, "Alias duplicates a canonical name or another alias for this operator."))
            else:
                seen_aliases[alias_key] = index

        if facility.get("facilityType") not in FACILITY_TYPES:
            diagnostics.append(Diagnostic("error", "invalid_facility_type", f"{base}.facilityType", "Use a controlled data-centre facility type."))
        state_code = facility.get("stateCode")
        expected_state = FOCUS_STATES.get(str(state_code))
        if expected_state is None:
            diagnostics.append(Diagnostic("error", "invalid_state_code", f"{base}.stateCode", "State must be one of the four supported state codes."))
        elif facility.get("state") != expected_state:
            diagnostics.append(Diagnostic("error", "state_name_mismatch", f"{base}.state", f"Expected {expected_state!r} for {state_code}."))
        if facility.get("locationPrecision") not in LOCATION_PRECISIONS:
            diagnostics.append(Diagnostic("error", "invalid_location_precision", f"{base}.locationPrecision", "Only generalized locality or district precision is public."))

        coordinates = facility.get("publicCoordinates")
        if not (isinstance(coordinates, list) and len(coordinates) == 2 and all(isinstance(value, (int, float)) and not isinstance(value, bool) for value in coordinates)):
            diagnostics.append(Diagnostic("error", "invalid_coordinates", f"{base}.publicCoordinates", "Coordinates must be [longitude, latitude] numbers."))
        elif expected_state and state_code in boundaries:
            point = Point(float(coordinates[0]), float(coordinates[1]))
            if not boundaries[state_code].buffer(1e-7).covers(point):
                diagnostics.append(Diagnostic("error", "coordinates_outside_state", f"{base}.publicCoordinates", "Generalized point is outside the declared pinned state boundary."))

        operational_since = facility.get("operationalSince")
        if operational_since is not None and (not isinstance(operational_since, int) or isinstance(operational_since, bool) or operational_since > as_of.year or operational_since < 1990):
            diagnostics.append(Diagnostic("error", "invalid_operational_since", f"{base}.operationalSince", "Operational year must be between 1990 and the validation year."))

        capacities = facility.get("capacityDisclosures")
        if not isinstance(capacities, list):
            diagnostics.append(Diagnostic("error", "invalid_capacities", f"{base}.capacityDisclosures", "Capacity disclosures must be a list."))
        else:
            for capacity_index, capacity in enumerate(capacities):
                path = f"{base}.capacityDisclosures[{capacity_index}]"
                if not isinstance(capacity, dict):
                    diagnostics.append(Diagnostic("error", "invalid_capacity", path, "Capacity disclosure must be an object.")); continue
                if not isinstance(capacity.get("value"), (int, float)) or isinstance(capacity.get("value"), bool) or capacity.get("value", 0) <= 0:
                    diagnostics.append(Diagnostic("error", "invalid_capacity_value", f"{path}.value", "Capacity must be a positive number."))
                if capacity.get("unit") not in CAPACITY_UNITS:
                    diagnostics.append(Diagnostic("error", "invalid_capacity_unit", f"{path}.unit", "Use MW or MVA without conversion."))
                if capacity.get("capacityType") not in CAPACITY_TYPES:
                    diagnostics.append(Diagnostic("error", "invalid_capacity_type", f"{path}.capacityType", "Use a controlled measurement boundary."))
                if capacity.get("scope") not in CAPACITY_SCOPES:
                    diagnostics.append(Diagnostic("error", "invalid_capacity_scope", f"{path}.scope", "Use a controlled facility/phase/campus scope."))

        verification = facility.get("verification")
        if not isinstance(verification, dict):
            diagnostics.append(Diagnostic("error", "missing_verification", f"{base}.verification", "Verification metadata is required.")); continue
        if verification.get("status") not in OPERATIONAL_EVIDENCE_STATUSES:
            diagnostics.append(Diagnostic("error", "invalid_operational_evidence", f"{base}.verification.status", "An accepted operating-status evidence class is required."))
        verified = _parse_date(verification.get("verifiedAt"), f"{base}.verification.verifiedAt", diagnostics)
        expires = _parse_date(verification.get("expiresAt"), f"{base}.verification.expiresAt", diagnostics)
        if verified and expires and (expires < verified or (expires - verified).days > 90):
            diagnostics.append(Diagnostic("error", "invalid_verification_window", f"{base}.verification.expiresAt", "Verification expiry must be 0-90 days after verification."))

        sources = _sources(facility)
        if not sources:
            diagnostics.append(Diagnostic("error", "missing_source", f"{base}.verification.source", "At least one traceable source is required."))
        for source_index, source in enumerate(sources):
            source_path = f"{base}.verification.sources[{source_index}]" if "sources" in verification else f"{base}.verification.source"
            parsed = urlparse(str(source.get("url") or ""))
            if parsed.scheme != "https" or not parsed.netloc:
                diagnostics.append(Diagnostic("error", "invalid_source_url", f"{source_path}.url", "Source URL must be absolute HTTPS."))
            if source.get("sourceClass") not in SOURCE_CLASSES:
                diagnostics.append(Diagnostic("error", "invalid_source_class", f"{source_path}.sourceClass", "Use a controlled source class."))
            if not str(source.get("title") or "").strip() or not str(source.get("publisher") or "").strip():
                diagnostics.append(Diagnostic("error", "missing_source_identity", source_path, "Source title and publisher are required."))
            retrieved = _parse_date(source.get("retrievedAt"), f"{source_path}.retrievedAt", diagnostics)
            if retrieved and verified and retrieved > verified:
                diagnostics.append(Diagnostic("error", "source_retrieved_after_verification", f"{source_path}.retrievedAt", "Source must be retrieved no later than the verification date."))
            content_hash = source.get("contentSha256")
            archive_url = source.get("archiveUrl")
            if content_hash is not None and not SHA256_RE.fullmatch(str(content_hash)):
                diagnostics.append(Diagnostic("error", "invalid_source_hash", f"{source_path}.contentSha256", "Content hash must be lowercase SHA-256."))
            if archive_url is not None:
                archive = urlparse(str(archive_url))
                if archive.scheme != "https" or not archive.netloc:
                    diagnostics.append(Diagnostic("error", "invalid_archive_url", f"{source_path}.archiveUrl", "Archive URL must be absolute HTTPS."))
            if content_hash is None and archive_url is None:
                diagnostics.append(Diagnostic("warning", "source_capture_missing", source_path, "Add contentSha256 or archiveUrl for reproducible source capture."))
    return diagnostics


def validate_path(path: Path, *, as_of: date | None = None) -> list[Diagnostic]:
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return [Diagnostic("error", "unreadable_registry", "$", f"Registry could not be read: {error}")]
    return validate_registry(document, as_of=as_of)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", nargs="?", type=Path, default=DEFAULT_REGISTRY)
    parser.add_argument("--as-of", type=date.fromisoformat, default=date.today())
    parser.add_argument("--json", action="store_true", help="Emit a machine-readable JSON report.")
    args = parser.parse_args(argv)
    diagnostics = validate_path(args.path, as_of=args.as_of)
    errors = sum(item.severity == "error" for item in diagnostics)
    warnings = sum(item.severity == "warning" for item in diagnostics)
    if args.json:
        print(json.dumps({"valid": errors == 0, "errors": errors, "warnings": warnings, "diagnostics": [asdict(item) for item in diagnostics]}, indent=2))
    else:
        for item in diagnostics:
            print(f"{item.severity.upper()} {item.code} {item.path}: {item.message}")
        print(f"Registry validation: {errors} error(s), {warnings} warning(s).")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
