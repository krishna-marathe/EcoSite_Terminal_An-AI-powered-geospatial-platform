"""Raster helpers shared by the JRC and SRTM connectors.

Everything here is deterministic and works on a candidate polygon plus a
configurable buffer. No helper downloads a national archive or writes a score.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.features import geometry_mask
from rasterio.windows import Window, from_bounds
from shapely.geometry import MultiPoint, mapping, shape
from shapely.ops import transform as shapely_transform

from .base import ConnectorUnavailable


@dataclass(frozen=True)
class ZonalRaster:
    data: np.ndarray
    transform: rasterio.Affine
    inside: np.ndarray
    valid: np.ndarray


def _aeqd_transformers(polygon):
    centre = polygon.representative_point()
    forward = Transformer.from_crs(
        "EPSG:4326",
        f"+proj=aeqd +lat_0={centre.y} +lon_0={centre.x} +datum=WGS84 +units=m",
        always_xy=True,
    )
    inverse = Transformer.from_crs(
        f"+proj=aeqd +lat_0={centre.y} +lon_0={centre.x} +datum=WGS84 +units=m",
        "EPSG:4326",
        always_xy=True,
    )
    return forward, inverse


def buffer_geometry(polygon, buffer_m: float):
    if buffer_m <= 0:
        return polygon
    forward, inverse = _aeqd_transformers(polygon)
    projected = shapely_transform(forward.transform, polygon)
    buffered = projected.buffer(buffer_m)
    return shapely_transform(inverse.transform, buffered)


def read_zonal_window(
    src: rasterio.DatasetReader,
    geometry: dict,
    buffer_m: float,
    nodata: float | int | None = None,
) -> ZonalRaster:
    """Read only the window covering the polygon plus buffer.

    ``inside`` marks pixels inside the candidate polygon. ``valid`` additionally
    excludes the source's nodata value. The distinction is required so coverage
    is reported against the polygon, not against the buffered window.
    """
    polygon = shape(geometry)
    if polygon.is_empty or not polygon.is_valid:
        raise ConnectorUnavailable("Candidate polygon is invalid.")
    buffered = buffer_geometry(polygon, max(0.0, buffer_m))
    window = from_bounds(*buffered.bounds, transform=src.transform).round_offsets().round_lengths()
    window = window.intersection(Window(0, 0, src.width, src.height))
    if window.width <= 0 or window.height <= 0:
        raise ConnectorUnavailable("Candidate polygon is outside the source tile.")

    missing_value = src.nodata if nodata is None else nodata
    fill_value = 0 if missing_value is None else missing_value
    data = src.read(1, window=window, boundless=True, fill_value=fill_value)
    window_transform = src.window_transform(window)
    inside = geometry_mask(
        [mapping(polygon)],
        out_shape=data.shape,
        transform=window_transform,
        invert=True,
        all_touched=False,
    )
    if inside.sum() == 0:
        raise ConnectorUnavailable("Candidate polygon covers no pixels in the source tile.")
    valid = inside if missing_value is None else inside & (data != missing_value)
    return ZonalRaster(data=data, transform=window_transform, inside=inside, valid=valid)


def nearest_pixel_distance(
    data: np.ndarray,
    transform: rasterio.Affine,
    pixel_mask: np.ndarray,
    polygon,
) -> float | None:
    """Distance in metres from the polygon to the nearest selected pixel centre.

    A selected pixel inside the polygon yields 0 m, which is the honest answer to
    "how far is the nearest mapped water from this site?".
    """
    rows, cols = np.where(pixel_mask)
    if rows.size == 0:
        return None
    xs, ys = rasterio.transform.xy(transform, rows, cols)
    forward, _ = _aeqd_transformers(polygon)
    points = MultiPoint(list(zip(xs, ys)))
    projected_points = shapely_transform(forward.transform, points)
    projected_polygon = shapely_transform(forward.transform, polygon)
    distance = projected_points.distance(projected_polygon)
    return float(distance)


def terrain_statistics(
    data: np.ndarray,
    transform: rasterio.Affine,
    inside: np.ndarray,
    valid: np.ndarray,
    latitude: float,
) -> dict:
    """Elevation, relief and screening slope for the valid pixels in a polygon."""
    inside_count = int(inside.sum())
    valid_inside = inside & valid
    valid_count = int(valid_inside.sum())
    if inside_count == 0:
        raise ConnectorUnavailable("Candidate polygon covers no pixels in the DEM tile.")

    elevations = data[valid_inside].astype("float64")
    result = {
        "inside_pixels": inside_count,
        "valid_pixels": valid_count,
        "void_pixels": inside_count - valid_count,
        "elevation_mean_m": None,
        "elevation_min_m": None,
        "elevation_max_m": None,
        "relief_m": None,
        "slope_mean_deg": None,
        "slope_max_deg": None,
        "slope_pixels": 0,
    }
    if valid_count:
        result["elevation_mean_m"] = float(np.mean(elevations))
        result["elevation_min_m"] = float(np.min(elevations))
        result["elevation_max_m"] = float(np.max(elevations))
        result["relief_m"] = float(np.max(elevations) - np.min(elevations))

    if data.shape[0] < 2 or data.shape[1] < 2 or valid_count == 0:
        return result

    # SRTM pixels are angular. Convert the local spacing to metres at the site
    # latitude so slope is not distorted by longitude convergence.
    dy_m = abs(transform.e) * 110540.0
    dx_m = abs(transform.a) * 111320.0 * math.cos(math.radians(latitude))
    if dx_m <= 0 or dy_m <= 0:
        return result

    dem = data.astype("float64", copy=True)
    dem[~valid] = np.nan
    dz_dy, dz_dx = np.gradient(dem, dy_m, dx_m)
    slope = np.degrees(np.arctan(np.hypot(dz_dx, dz_dy)))
    slope_valid = inside & valid & np.isfinite(slope)
    slope_pixels = int(slope_valid.sum())
    result["slope_pixels"] = slope_pixels
    if slope_pixels:
        result["slope_mean_deg"] = float(np.mean(slope[slope_valid]))
        result["slope_max_deg"] = float(np.max(slope[slope_valid]))
    return result
