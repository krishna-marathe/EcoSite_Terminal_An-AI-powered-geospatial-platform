"""Polygon validation and WGS84 geodesic measurements; no remote GIS calls."""
import hashlib
import json
import math
import os
from functools import lru_cache
from pathlib import Path

from pyproj import Geod, Transformer
from shapely import normalize, to_wkb
from shapely.geometry import shape, mapping
from shapely.geometry.polygon import orient
from shapely.ops import transform

from .state_scope import state_scope

GEOD = Geod(ellps="WGS84")
MAX_VERTICES = 2000
BOUNDARY_DIR = Path(__file__).resolve().parents[1] / "data" / "boundaries"
REVIEW_METRES = 5000


class BoundaryReviewRequired(ValueError):
    pass


class BoundaryUnavailable(Exception):
    pass


def validate_polygon(value):
    if not isinstance(value, dict) or set(value) != {"type", "coordinates"} or value["type"] != "Polygon":
        raise ValueError("Supply a WGS84 GeoJSON Polygon geometry with type and coordinates only.")
    rings = value["coordinates"]
    if not isinstance(rings, list) or not 1 <= len(rings) <= 11:
        raise ValueError("A Polygon needs an exterior ring and at most 10 holes.")
    vertices = 0
    for ring in rings:
        if not isinstance(ring, list) or len(ring) < 4 or ring[0] != ring[-1]:
            raise ValueError("Every ring must have at least four positions and be explicitly closed.")
        vertices += len(ring)
        if vertices > MAX_VERTICES:
            raise ValueError("Polygon exceeds the 2000-position limit.")
        for position in ring:
            if not isinstance(position, (list, tuple)) or len(position) != 2:
                raise ValueError("Use two-dimensional longitude/latitude positions.")
            if any(type(n) not in (int, float) or not math.isfinite(n) for n in position):
                raise ValueError("Coordinates must be finite numbers.")
            if not -180 <= position[0] <= 180 or not -90 <= position[1] <= 90:
                raise ValueError("Coordinates exceed WGS84 longitude/latitude bounds.")
    polygon = shape(value)
    if polygon.is_empty or not polygon.is_valid or polygon.area <= 0:
        raise ValueError("Polygon is empty, degenerate, self-intersecting or has invalid holes.")
    return polygon


@lru_cache(maxsize=2)
def load_boundary(path, digest):
    try:
        raw = Path(path).read_bytes()
        if hashlib.sha256(raw).hexdigest() != digest:
            raise ValueError("Boundary checksum mismatch")
        document = json.loads(raw)
        if document.get("type") == "FeatureCollection":
            if len(document["features"]) != 1:
                raise ValueError("Expected one national boundary feature")
            document = document["features"][0]["geometry"]
        boundary = shape(document)
        if boundary.geom_type not in ("Polygon", "MultiPolygon") or boundary.is_empty or not boundary.is_valid:
            raise ValueError("Invalid boundary")
        return boundary
    except (OSError, ValueError, TypeError, KeyError):
        raise BoundaryUnavailable("The approved India screening boundary is unavailable.") from None


@lru_cache(maxsize=1)
def bundled_metadata():
    try:
        data = json.loads((BOUNDARY_DIR / "IND-ADM0-manifest.json").read_text(encoding="utf-8"))
        if data["boundaryISO"] != "IND" or data["boundaryType"] != "ADM0" or data["version"] != "9469f09" or data["sha256"] != "77fb5cb03be9970e638fa38d1bd6a377ea7e158b4dfd1a511067925442233443":
            raise ValueError("Unexpected boundary release")
        if not data["boundaryLicense"] or not data["boundarySource"]:
            raise ValueError("Missing attribution")
        return data
    except (OSError, ValueError, KeyError):
        raise BoundaryUnavailable("Bundled boundary provenance is unavailable.") from None


def boundary_settings():
    if not any(key.startswith("ECOSITE_INDIA_BOUNDARY_") for key in os.environ):
        data = bundled_metadata()
        return str(BOUNDARY_DIR / data["file"]), data["sha256"], "geoBoundaries gbOpen IND ADM0 " + data["version"] + " (screening only)"

    path = os.getenv("ECOSITE_INDIA_BOUNDARY_PATH", "")
    digest = os.getenv("ECOSITE_INDIA_BOUNDARY_SHA256", "")
    source = os.getenv("ECOSITE_INDIA_BOUNDARY_SOURCE", "")
    if not path or len(digest) != 64 or not source.strip():
        raise BoundaryUnavailable("Configure an approved India boundary path, checksum and source before saving polygons.")
    return path, digest, source


def measure_polygon(value, state_code=None):
    polygon = validate_polygon(value)
    path, digest, source = boundary_settings()
    boundary = load_boundary(path, digest)
    centre = polygon.representative_point()
    projection = Transformer.from_crs("EPSG:4326", f"+proj=aeqd +lat_0={centre.y} +lon_0={centre.x} +datum=WGS84 +units=m", always_xy=True)
    projected_boundary = transform(projection.transform, boundary)
    projected_polygon = transform(projection.transform, polygon)
    near = projected_polygon.distance(projected_boundary.boundary) <= REVIEW_METRES
    if not boundary.covers(polygon):
        if near or boundary.intersects(polygon):
            raise BoundaryReviewRequired("Boundary review required: polygon crosses or is near the screening boundary. Consult Survey of India; no polygon was saved.")
        raise ValueError("Polygon is outside the India screening dataset; this is not a legal boundary determination.")
    data = bundled_metadata() if digest == "77fb5cb03be9970e638fa38d1bd6a377ea7e158b4dfd1a511067925442233443" else None
    screening = {"status": "review_required" if near or data is None else "inside_screening_boundary",
                 "review_band_metres": REVIEW_METRES, "screening_only": True,
                 "version": data["version"] if data else "custom-unverified",
                 "licence": data["boundaryLicense"] if data else "unspecified",
                 "source_url": data["downloadURL"] if data else None}
    if state_code is not None:
        screening["state_scope"] = state_scope(polygon, state_code)

    area_ha = abs(GEOD.geometry_area_perimeter(orient(polygon, sign=1.0))[0]) / 10000
    if not math.isfinite(area_ha) or area_ha <= 0:
        raise ValueError("Polygon has no measurable WGS84 area.")
    canonical = normalize(polygon)
    return dict(geometry=mapping(canonical), area_ha=area_ha,
                geometry_hash=hashlib.sha256(to_wkb(canonical, byte_order=1, output_dimension=2)).hexdigest(),
                boundary_sha256=digest, boundary_source=source, boundary_screening=screening)
