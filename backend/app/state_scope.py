"""Four-state geographic scope for candidate sites.

The product is deliberately limited to Telangana, Maharashtra, Karnataka and
Tamil Nadu. This module verifies a candidate polygon against a pinned ADM1
screening boundary. It is not a legal boundary determination.
"""
from __future__ import annotations

import hashlib
import json
from functools import lru_cache
from pathlib import Path

from pyproj import Transformer
from shapely import make_valid
from shapely.geometry import shape
from shapely.ops import transform, unary_union

BOUNDARY_DIR = Path(__file__).resolve().parents[1] / "data" / "boundaries"
MANIFEST_PATH = BOUNDARY_DIR / "IND-ADM1-4states-manifest.json"
STATE_REVIEW_METRES = 1000.0

FOCUS_STATES: dict[str, str] = {
    "IN-TG": "Telangana",
    "IN-MH": "Maharashtra",
    "IN-KA": "Karnataka",
    "IN-TN": "Tamil Nadu",
}


class StateScopeError(ValueError):
    """The polygon is outside the four-state scope or the declared state."""


class StateScopeUnavailable(Exception):
    """The pinned four-state boundary is missing or does not match its manifest."""


@lru_cache(maxsize=1)
def bundled_manifest() -> dict:
    try:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        if manifest["boundaryISO"] != "IND" or manifest["boundaryType"] != "ADM1":
            raise ValueError("Unexpected boundary type")
        if manifest["version"] != "9469f09" or manifest["featureCount"] != 4:
            raise ValueError("Unexpected boundary release")
        if set(manifest["states"]) != set(FOCUS_STATES):
            raise ValueError("Unexpected state list")
        if not manifest["boundaryLicense"] or not manifest["boundarySource"]:
            raise ValueError("Missing attribution")
        return manifest
    except (OSError, ValueError, KeyError, TypeError):
        raise StateScopeUnavailable("The pinned four-state screening boundary is unavailable.") from None


@lru_cache(maxsize=1)
def load_focus_states():
    manifest = bundled_manifest()
    path = BOUNDARY_DIR / manifest["file"]
    try:
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != manifest["sha256"]:
            raise ValueError("Boundary checksum mismatch")
        document = json.loads(raw)
        features = document["features"]
        if len(features) != 4:
            raise ValueError("Expected four state features")
        states = {}
        for feature in features:
            code = feature["properties"]["state_code"]
            if code not in FOCUS_STATES:
                raise ValueError(f"Unexpected state {code}")
            geometry = shape(feature["geometry"])
            if geometry.is_empty or not geometry.is_valid:
                geometry = make_valid(geometry)
            states[code] = geometry
        return states
    except (OSError, ValueError, KeyError, TypeError):
        raise StateScopeUnavailable("The pinned four-state screening boundary is unavailable.") from None


@lru_cache(maxsize=1)
def focus_union():
    return unary_union(list(load_focus_states().values()))


def scope_payload() -> dict:
    """Describe the geographic scope for the API and the dataset catalogue."""
    manifest = bundled_manifest()
    return {
        "states": dict(FOCUS_STATES),
        "boundary_version": manifest["version"],
        "boundary_sha256": manifest["sha256"],
        "screening_only": True,
        "note": (
            "Candidate sites must lie inside Telangana, Maharashtra, Karnataka or Tamil Nadu. "
            "The ADM1 boundary is a screening dataset, not a legal determination."
        ),
    }


def state_scope(polygon, state_code: str) -> dict:
    """Validate the polygon against the declared focus state.

    Raises ``StateScopeError`` when the polygon is outside all four states, sits
    in a different focus state, or crosses a state boundary. A polygon within the
    review band of the state boundary is accepted but marked ``review_required``.
    """
    if state_code not in FOCUS_STATES:
        raise StateScopeError(
            f"{state_code} is outside the product scope. Use one of "
            f"{', '.join(FOCUS_STATES)}."
        )
    states = load_focus_states()
    declared = states[state_code]
    if not declared.buffer(1e-7).covers(polygon):
        if not focus_union().covers(polygon):
            raise StateScopeError(
                "Candidate polygon is outside the four-state scope "
                "(Telangana, Maharashtra, Karnataka, Tamil Nadu)."
            )
        declared_overlap = declared.intersection(polygon).area
        if declared_overlap <= 1e-12:
            containing = [
                FOCUS_STATES[code]
                for code, geometry in states.items()
                if geometry.intersection(polygon).area > 1e-12
            ]
            if containing:
                raise StateScopeError(
                    f"Candidate polygon lies in {', '.join(containing)}, "
                    f"not the declared {FOCUS_STATES[state_code]}."
                )
        overlaps = [
            code
            for code, geometry in states.items()
            if code != state_code and geometry.intersection(polygon).area > 1e-12
        ]
        if overlaps:
            names = ", ".join(FOCUS_STATES[code] for code in overlaps)
            raise StateScopeError(
                f"Candidate polygon crosses the {FOCUS_STATES[state_code]} boundary "
                f"into {names}. Split the polygon by state before saving it."
            )
        raise StateScopeError(
            f"Candidate polygon is not fully inside {FOCUS_STATES[state_code]}."
        )

    centre = polygon.representative_point()
    projection = Transformer.from_crs(
        "EPSG:4326",
        f"+proj=aeqd +lat_0={centre.y} +lon_0={centre.x} +datum=WGS84 +units=m",
        always_xy=True,
    )
    projected_polygon = transform(projection.transform, polygon)
    projected_state = transform(projection.transform, declared)
    near = projected_polygon.distance(projected_state.boundary) <= STATE_REVIEW_METRES

    manifest = bundled_manifest()
    return {
        "state_code": state_code,
        "state_name": FOCUS_STATES[state_code],
        "status": "review_required" if near else "inside_focus_state",
        "review_band_metres": STATE_REVIEW_METRES,
        "screening_only": True,
        "version": manifest["version"],
        "licence": manifest["boundaryLicense"],
        "source_url": manifest["boundarySourceURL"],
        "boundary_sha256": manifest["sha256"],
    }
