"""Sentinel-2 L2A pixel NDVI with scene-classification cloud masking.

The L2A scene *metadata* connector answers "is there usable imagery?". This
module answers the next question without lying about it: for one candidate
polygon, what is the median NDVI of the clear-sky pixels in the least cloudy
scene, and how much of the polygon was actually usable?

Access is deliberately split from the metadata search:

* Scene metadata comes from the Copernicus Data Space Ecosystem STAC API.
* Pixels come from the keyless mirror of the same ESA L2A product published as
  Cloud-Optimized GeoTIFFs on AWS (``sentinel-cogs``). Every asset on
  ``eodata.dataspace.copernicus.eu`` requires CDSE credentials
  (``HTTP 403`` without them), so the CDSE path cannot run unattended. The
  mirror serves the identical ESA product and needs no account, which keeps the
  run reproducible.

Only the window covering the candidate polygon plus buffer is read, through
HTTP range requests. No scene is downloaded in full and nothing national is
fetched.

Cloud masking uses the L2A Scene Classification Layer (SCL): vegetation and
bare-soil classes are kept, clouds, cirrus, shadow, snow and defective pixels are
counted and excluded. NDVI is never computed over water or nodata.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import numpy as np

from .base import ConnectorUnavailable
from .raster import buffer_geometry

METHOD = "s2_ndvi_cloud_masked_median"
PROCESSING_VERSION = "ndvi-1.0.0"
RESOLUTION = "10 m (NDVI bands), 20 m (SCL mask)"
EVIDENCE_CLASS = "REMOTE_SENSING_DERIVED"
DEFAULT_COG_SEARCH_URL = "https://earth-search.aws.element84.com/v1/search"
MAX_PIXELS = 4_000_000

#: SCL classes kept in the NDVI sample: 4 = vegetation, 5 = not vegetated.
VALID_SCL = (4, 5)
#: SCL classes excluded as cloud or cloud-affected: 1 defective, 3 shadow,
#: 8/9 cloud, 10 thin cirrus, 11 snow/ice.
CLOUD_SCL = (1, 3, 8, 9, 10, 11)
#: 0 = nodata, 2 = dark area, 6 = water, 7 = unclassified. Excluded but not
#: labelled as cloud, because conflating water with cloud would misreport the
#: mask.
OTHER_SCL = (0, 2, 6, 7)

REQUIRED_ASSETS = ("red", "nir", "scl")


@dataclass(frozen=True)
class ScenePixels:
    scene_id: str
    scene_datetime: str
    source_cloud_cover: float | None
    transform: Any
    crs: str
    red: np.ndarray
    nir: np.ndarray
    scl: np.ndarray


def cog_search_body(geometry: dict[str, Any], start: str, end: str, max_cloud: float, limit: int = 5) -> dict[str, Any]:
    """Find the clearest L2A scenes that carry the bands NDVI needs."""
    return {
        "collections": ["sentinel-2-l2a"],
        "intersects": geometry,
        "datetime": f"{start}/{end}",
        "query": {"eo:cloud_cover": {"lt": max_cloud}},
        "sortby": [{"field": "properties.eo:cloud_cover", "direction": "asc"}],
        "limit": max(1, limit),
    }


def scene_assets(feature: dict[str, Any]) -> dict[str, str] | None:
    """Return the red/NIR/SCL COG hrefs, or ``None`` when a band is missing.

    A scene without the classification layer cannot be cloud-masked, so it is not
    a usable NDVI scene.
    """
    assets = feature.get("assets")
    if not isinstance(assets, dict):
        return None
    resolved: dict[str, str] = {}
    for name in REQUIRED_ASSETS:
        asset = assets.get(name)
        href = asset.get("href") if isinstance(asset, dict) else None
        if not isinstance(href, str) or not href.startswith(("http://", "https://")):
            return None
        resolved[name] = href
    return resolved


def pick_scene(features: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Choose the clearest scene that has every required asset.

    Cloud cover is the primary key because a mask cannot recover a fully cloudy
    polygon. Ties are broken by the most recent acquisition so the NDVI is as
    current as the imagery allows.
    """
    candidates = [feature for feature in features if scene_assets(feature) is not None]
    if not candidates:
        return None

    def sort_key(feature: dict[str, Any]) -> tuple[float, str]:
        cloud = feature.get("properties", {}).get("eo:cloud_cover")
        try:
            cloud_value = float(cloud)
        except (TypeError, ValueError):
            cloud_value = float("inf")
        moment = feature.get("properties", {}).get("datetime") or ""
        return (cloud_value, str(moment))

    # Lower cloud first, then later acquisition: sorting ascending on cloud and
    # taking the max of the reversed timestamp group keeps both rules explicit.
    best_cloud = min(sort_key(feature)[0] for feature in candidates)
    newest = max(candidates, key=lambda feature: sort_key(feature)[1])
    if sort_key(newest)[0] == best_cloud:
        return newest
    return min(candidates, key=sort_key)


def _window_for(dataset: Any, buffered_bounds: tuple[float, float, float, float]) -> Any:
    from pyproj import Transformer
    from rasterio.windows import Window, from_bounds

    transformer = Transformer.from_crs("EPSG:4326", dataset.crs, always_xy=True)
    xs, ys = transformer.transform(
        [buffered_bounds[0], buffered_bounds[2]],
        [buffered_bounds[1], buffered_bounds[3]],
    )
    window = from_bounds(min(xs), min(ys), max(xs), max(ys), transform=dataset.transform)
    window = window.round_offsets().round_lengths()
    window = window.intersection(Window(0, 0, dataset.width, dataset.height))
    if window.width <= 0 or window.height <= 0:
        raise ConnectorUnavailable("Candidate polygon is outside the Sentinel-2 scene extent.")
    return window


def read_scene_pixels(
    feature: dict[str, Any],
    geometry: dict[str, Any],
    buffer_m: float,
    *,
    timeout_s: float = 120.0,
) -> dict[str, tuple[np.ndarray, Any, str]]:
    """Read only the polygon window of the red, NIR and SCL bands.

    Returns arrays keyed by band with their transform and CRS. The SCL band is
    resampled to the 10 m red grid with nearest-neighbour, because resampling a
    class layer any other way would fabricate classes.
    """
    import rasterio
    from rasterio.enums import Resampling
    from shapely.geometry import shape

    assets = scene_assets(feature)
    if assets is None:
        raise ConnectorUnavailable("Scene is missing the red, NIR or SCL asset required for NDVI.")
    polygon = shape(geometry)
    if polygon.is_empty or not polygon.is_valid:
        raise ConnectorUnavailable("Candidate polygon is invalid.")
    pre_buffered = buffer_geometry(polygon, max(0.0, buffer_m))
    bounds = pre_buffered.bounds

    read: dict[str, tuple[np.ndarray, Any, str]] = {}
    reference_shape: tuple[int, int] | None = None
    reference_transform: Any = None
    reference_crs = ""
    for name in ("red", "nir", "scl"):
        # rasterio reads COGs over HTTPS with range requests; only the window is
        # transferred.
        with rasterio.open(assets[name]) as dataset:
            if dataset.crs is None:
                raise ConnectorUnavailable(f"Sentinel-2 {name} band has no CRS.")
            window = _window_for(dataset, bounds)
            if reference_shape is None:
                if int(window.width) * int(window.height) > MAX_PIXELS:
                    raise ConnectorUnavailable(
                        "Candidate polygon plus buffer is too large for pixel-level NDVI; "
                        f"reduce the buffer so the window stays under {MAX_PIXELS} pixels."
                    )
                data = dataset.read(1, window=window)
                reference_shape = data.shape
                reference_transform = dataset.window_transform(window)
                reference_crs = str(dataset.crs)
            else:
                data = dataset.read(
                    1,
                    window=window,
                    out_shape=reference_shape,
                    resampling=Resampling.nearest,
                )
            read[name] = (data, reference_transform, reference_crs)
    return read


def ndvi_statistics(
    red: np.ndarray,
    nir: np.ndarray,
    scl: np.ndarray,
    transform: Any,
    geometry: dict[str, Any],
    crs: str = "EPSG:4326",
) -> dict[str, Any]:
    """Cloud-masked NDVI statistics for the pixels inside the polygon.

    ``coverage_fraction`` is measured against the candidate polygon, not the
    buffered window, so a sparse or partly cloudy polygon cannot look complete.

    L2A pixels are in the scene's UTM zone while candidate polygons are stored in
    lon/lat, so the polygon is reprojected before masking. Masking a lon/lat
    polygon against a UTM transform silently selects nothing.
    """
    from rasterio.features import geometry_mask
    from shapely.geometry import shape
    from shapely.ops import transform as shapely_transform

    if not (red.shape == nir.shape == scl.shape):
        raise ConnectorUnavailable("Sentinel-2 bands are not on a common grid.")

    polygon = shape(geometry)
    if str(crs) and str(crs).upper() not in {"EPSG:4326", "OGC:CRS84"}:
        from pyproj import Transformer

        transformer = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
        polygon = shapely_transform(transformer.transform, polygon)

    inside = geometry_mask(
        [polygon.__geo_interface__],
        out_shape=red.shape,
        transform=transform,
        invert=True,
        all_touched=False,
    )
    inside_count = int(inside.sum())
    if inside_count == 0:
        raise ConnectorUnavailable("Candidate polygon covers no Sentinel-2 pixels.")

    red_f = red.astype("float32", copy=False)
    nir_f = nir.astype("float32", copy=False)
    denominator = nir_f + red_f
    with np.errstate(divide="ignore", invalid="ignore"):
        ndvi = np.where(denominator > 0, (nir_f - red_f) / denominator, np.nan)

    has_reflectance = (red > 0) & (nir > 0)
    clear = np.isin(scl, VALID_SCL)
    cloud = np.isin(scl, CLOUD_SCL)
    other = np.isin(scl, OTHER_SCL)

    valid = inside & clear & has_reflectance & np.isfinite(ndvi)
    cloud_masked = inside & cloud
    other_excluded = inside & other
    unresolved = inside & ~valid & ~cloud_masked & ~other_excluded

    valid_count = int(valid.sum())
    stats: dict[str, Any] = {
        "inside_pixels": inside_count,
        "valid_pixels": valid_count,
        "coverage_fraction": valid_count / inside_count,
        "cloud_masked_pixels": int(cloud_masked.sum()),
        "cloud_masked_fraction": float(cloud_masked.sum()) / inside_count,
        "other_excluded_pixels": int(other_excluded.sum()),
        "other_excluded_fraction": float(other_excluded.sum()) / inside_count,
        "unresolved_pixels": int(unresolved.sum()),
        "ndvi_median": None,
        "ndvi_mean": None,
        "ndvi_p10": None,
        "ndvi_p90": None,
    }
    if valid_count:
        sample = ndvi[valid]
        stats["ndvi_median"] = float(np.median(sample))
        stats["ndvi_mean"] = float(np.mean(sample))
        stats["ndvi_p10"] = float(np.percentile(sample, 10))
        stats["ndvi_p90"] = float(np.percentile(sample, 90))
    return stats


def scene_period(feature: dict[str, Any]) -> tuple[str | None, str | None]:
    value = feature.get("properties", {}).get("datetime")
    if not isinstance(value, str) or not value.strip():
        return None, None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None, None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.date().isoformat(), parsed.isoformat()


def window_geotiff_bytes(array: np.ndarray, transform: Any, crs: str) -> bytes:
    """Serialise a window to an in-memory GeoTIFF so it can be snapshotted."""
    import rasterio
    from rasterio.io import MemoryFile

    with MemoryFile() as memory:
        with memory.open(
            driver="GTiff",
            height=array.shape[0],
            width=array.shape[1],
            count=1,
            dtype=array.dtype,
            crs=crs,
            transform=transform,
            compress="deflate",
        ) as dataset:
            dataset.write(array, 1)
        return memory.read()


def read_window_geotiff(content: bytes) -> tuple[np.ndarray, Any, str]:
    """Decode a snapshotted window payload back into an array."""
    import rasterio
    from rasterio.io import MemoryFile

    with MemoryFile(content) as memory:
        with memory.open() as dataset:
            return dataset.read(1), dataset.transform, str(dataset.crs)
