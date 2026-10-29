"""Registry of the public and authority sources in the EcoSite roadmap.

This module is the machine-readable companion to ``docs/data/DATA_SOURCE_REGISTRY.csv``.
It follows the field set and maturity gates in ``roadmap.md`` section 9:

    Discovered -> Access tested -> Processing tested -> Validated -> Integrated

A portal link is not evidence of access. A source is only ``ACCESS_TESTED`` when a
request was actually made, ``PROCESSING_TESTED`` when a candidate polygon produced an
observation, and ``INTEGRATED`` when that observation is served through the API.

Priority follows ``roadmap.md`` section 8. P0 is JRC + SRTM, then Copernicus Sentinel-2,
then CGWB. CEA and the remaining P1 sources follow. This order deliberately differs
from an "everything at once" connector list.
"""
from __future__ import annotations

import sqlite3
from typing import Any

SEED_TIMESTAMP = "2026-10-27T00:00:00Z"

PRIORITIES = ("P0", "P1", "P2")
TEST_STATUSES = ("DISCOVERED", "ACCESS_TESTED", "PROCESSING_TESTED", "VALIDATED", "INTEGRATED")
RUNTIME_STATUSES = ("NOT_CONNECTED", "CONNECTED", "STALE", "SOURCE_UNAVAILABLE")
ACCESS_METHODS = ("download", "api", "stac", "wms", "report", "manual")
DATA_CATEGORIES = ("GIS", "OFFICIAL_ADMIN", "POLICY", "AUTHORITY", "DEVELOPER")

_DEFAULTS: dict[str, Any] = {
    "dataset_version": "unversioned",
    "data_category": "GIS",
    "priority": "P2",
    "access_method": "download",
    "authentication": "none",
    "licence_url": None,
    "attribution": "",
    "can_cache": True,
    "can_redistribute": False,
    "commercial_use": False,
    "temporal_resolution": "",
    "observation_period": "",
    "latest_release": "",
    "update_frequency": "",
    "join_key_or_geometry": "",
    "test_status": "DISCOVERED",
    "fallback": "",
    "owner": "Siddharth",
    "next_action": "",
    "runtime_status": "NOT_CONNECTED",
    "last_checked_at": SEED_TIMESTAMP,
    "last_success_at": None,
    "quality_notes": "",
}


def _source(**values: Any) -> dict[str, Any]:
    """Merge a source definition with the conservative registry defaults."""
    source = {**_DEFAULTS, **values}
    source.setdefault("created_at", SEED_TIMESTAMP)
    source.setdefault("updated_at", SEED_TIMESTAMP)
    missing = [
        key
        for key in ("id", "provider", "dataset_name", "base_url", "licence", "resolution", "coverage")
        if key not in source or (key != "base_url" and not source.get(key))
    ]
    if missing:
        raise ValueError(f"Data source is missing required fields: {', '.join(missing)}")
    return source


DATA_SOURCES: list[dict[str, Any]] = [
    # ------------------------------------------------------------------ P0
    _source(
        id="jrc_gsw",
        provider="European Commission Joint Research Centre",
        dataset_name="Global Surface Water (GSW)",
        dataset_version="GSW v1.5 (1984-2024)",
        data_category="GIS",
        priority="P0",
        access_method="download",
        authentication="none for the JRC download portal; an Earth Engine account is needed for the Earth Engine mirror",
        base_url="https://global-surface-water.appspot.com/download",
        exact_endpoint=(
            "https://s3.waw4-1.cloudferro.com/swift/v1/global-surface-water/download2024/"
            "Aggregated/VER1-5/occurrence/occurrence_{west_lon}E_{north_lat}N_v1_5_2024.tif"
        ),
        licence="JRC open data; free with attribution. Confirm the current release terms before redistribution.",
        licence_url="https://global-surface-water.appspot.com/",
        attribution="European Commission Joint Research Centre, Global Surface Water",
        can_cache=True,
        can_redistribute=True,
        commercial_use=True,
        resolution="30 m Landsat-derived raster",
        temporal_resolution="Monthly and annual composites",
        coverage="Global",
        observation_period="1984-01-01 to 2024-12-31",
        latest_release="v1.5 (1984-2024)",
        update_frequency="Periodic versioned releases",
        join_key_or_geometry="Raster sample by candidate polygon and configurable buffer",
        test_status="PROCESSING_TESTED",
        runtime_status="NOT_CONNECTED",
        last_checked_at="2026-10-27T13:29:53Z",
        last_success_at="2026-10-27T13:29:53Z",
        fallback="JRC GSW via Earth Engine; NRSC flood atlas for India-specific corroboration",
        next_action="Keep the verified tile path and add a scheduled refresh check; the connector is not yet shown in the dashboard UI.",
        quality_notes=(
            "Historical water occurrence is not a flood return-period probability. Landsat resolution misses small or ephemeral water bodies. "
            "Store the release version and report valid-pixel coverage instead of extrapolating. "
            "Live verification 2026-10-27: occurrence_70E_20N_v1_5_2024.tif (44,348,023 bytes, HTTP 200) produced five observations "
            "for a Pune polygon with 100% valid-pixel coverage, 2.08% occurrence overlap, 0.49% mean occurrence, 68% maximum "
            "occurrence and 0 m to the nearest mapped water pixel. Tile labels are west longitude and north latitude."
        ),
    ),
    _source(
        id="nasa_srtmgl1",
        provider="NASA / USGS, distributed by LP DAAC",
        dataset_name="Shuttle Radar Topography Mission Global 1 arc second (SRTMGL1)",
        dataset_version="v003",
        data_category="GIS",
        priority="P0",
        access_method="download",
        authentication="NASA Earthdata login / Earthdata token",
        base_url="https://lpdaac.usgs.gov/products/srtmgl1v003/",
        exact_endpoint="https://e4ftl01.cr.usgs.gov/MEASURES/SRTMGL1.003/2000.02.11/",
        licence="NASA open data; no restrictions on use, access or download",
        licence_url="https://www.earthdata.nasa.gov/engage/open-data-services-and-software/data-and-information-policy",
        attribution="NASA/USGS SRTM",
        can_cache=True,
        can_redistribute=True,
        commercial_use=True,
        resolution="30 m (1 arc-second)",
        temporal_resolution="Static",
        coverage="Global land between 60 degrees north and 56 degrees south",
        observation_period="2000-02-11 to 2000-02-22",
        latest_release="v003",
        update_frequency="Static",
        join_key_or_geometry="Raster tile request by candidate polygon bounds plus buffer",
        test_status="PROCESSING_TESTED",
        runtime_status="NOT_CONNECTED",
        last_checked_at="2026-10-29T00:20:26Z",
        last_success_at="2026-10-29T00:20:26Z",
        fallback="Copernicus DEM GLO-30 via CDSE; manual tile upload",
        next_action="Add independent validation of the elevation and slope values; keep the source on demand and label it screening terrain context.",
        quality_notes=(
            "Screening-level elevation, not a detailed site survey or hydrological model. SRTM has voids in steep terrain. "
            "Report the void fraction and do not interpolate across large gaps without labelling the method. "
            "Live verification 2026-10-29: an authenticated request for the Pune candidate returned tile N18E073 "
            "(HTTP 200 after the LP DAAC 303 redirect, 12,646,090 bytes, SHA-256 b81a85f6...) and stored seven observations: "
            "mean elevation 559.10 m, relief 41 m, mean slope 3.07 degrees, mean slope max 15.21 degrees, "
            "5,184 of 5,184 pixels valid and no voids. Run on demand only; no refresh schedule exists."
        ),
    ),
    _source(
        id="copernicus_stac",
        provider="ESA / Copernicus Data Space Ecosystem",
        dataset_name="Sentinel-2 Level-2A scene catalogue via STAC",
        dataset_version="sentinel-2-l2a collection (rolling)",
        data_category="GIS",
        priority="P0",
        access_method="stac",
        authentication="Anonymous STAC search confirmed; downloading assets requires a CDSE account",
        base_url="https://catalogue.dataspace.copernicus.eu/stac",
        exact_endpoint="https://catalogue.dataspace.copernicus.eu/stac/search",
        licence="Copernicus open data; free, full and open",
        licence_url="https://dataspace.copernicus.eu/terms-and-conditions",
        attribution="Contains modified Copernicus Sentinel data",
        can_cache=True,
        can_redistribute=True,
        commercial_use=True,
        resolution="10 m, 20 m and 60 m bands",
        temporal_resolution="Approximately 5-day revisit",
        coverage="Global",
        observation_period="2015-06-23 to present",
        latest_release="Rolling",
        update_frequency="Continuous",
        join_key_or_geometry="STAC search by candidate polygon, date range and maximum cloud cover",
        test_status="PROCESSING_TESTED",
        runtime_status="NOT_CONNECTED",
        last_checked_at="2026-10-27T13:54:23Z",
        last_success_at="2026-10-27T13:54:23Z",
        fallback="Copernicus Open Access Hub; cached scene metadata",
        next_action="Add authenticated asset download, cloud masking and median NDVI; scene metadata alone is not a land-cover measurement.",
        quality_notes=(
            "Scene discovery is not a land-cover measurement. NDVI indicates vegetation condition; it does not establish legal land use. "
            "Always show the observation date, cloud cover and valid-pixel fraction. "
            "Live verification 2026-10-27: anonymous POST to the CDSE STAC search for a Pune polygon returned 90 Sentinel-2 L2A scenes "
            "over 2025-10-30 to 2026-10-25 (HTTP 200, 6,285,681 bytes, SHA-256 f643d10c...). Median cloud cover was 13.9%, minimum 0%, "
            "and 51 of 90 scenes (56.7%) were at or below the 20% threshold. Only scene metadata was read; no pixels or NDVI were processed."
        ),
    ),
    _source(
        id="cgwb_assessment",
        provider="Central Ground Water Board, Ministry of Jal Shakti",
        dataset_name="Dynamic Ground Water Resource Assessment of India",
        dataset_version="2025",
        data_category="OFFICIAL_ADMIN",
        priority="P0",
        access_method="download",
        authentication="none",
        base_url="https://cgwb.gov.in/en/ground-water-resource-assessment",
        exact_endpoint="Official assessment report and assessment-unit GIS layers (record the release URL at ingestion)",
        licence="Government of India publication; confirm GODL/NDSAP before redistribution",
        licence_url="https://www.meity.gov.in/static/uploads/2024/02/Gazette-Notification_OpenDataLicense_13.02.2017.pdf",
        attribution="CGWB Dynamic Ground Water Resource Assessment",
        can_cache=True,
        can_redistribute=False,
        commercial_use=True,
        resolution="Assessment unit (block/tehsil)",
        temporal_resolution="Annual",
        coverage="India",
        observation_period="Financial year 2024-25",
        latest_release="2025",
        update_frequency="Annual",
        join_key_or_geometry="Point-in-polygon join to assessment-unit boundaries",
        test_status="DISCOVERED",
        fallback="NWDP station context; India-WRIS; manual assessment report",
        next_action="Obtain assessment-unit boundaries, match a test polygon and store the category, publication year and boundary version.",
        quality_notes=(
            "An assessment-unit groundwater category is not a project water entitlement or allocation. "
            "Boundaries and categories may lag local conditions; never convert the class into available KLD."
        ),
    ),
    _source(
        id="developer_evidence",
        provider="Project developer, consultant or engineer (project-specific)",
        dataset_name="Design basis, resource requirements and asset register",
        dataset_version="Per document revision",
        data_category="DEVELOPER",
        priority="P0",
        access_method="manual",
        authentication="Authenticated developer workspace; local-only in the MVP",
        base_url=None,
        exact_endpoint=None,
        licence="Private project evidence; do not redistribute",
        licence_url=None,
        attribution="Document issuer",
        can_cache=False,
        can_redistribute=False,
        commercial_use=False,
        resolution="Project, site and phase",
        temporal_resolution="Per design revision",
        coverage="Project-specific",
        observation_period="Per document revision",
        latest_release="Not applicable",
        update_frequency="On revision",
        join_key_or_geometry="site_id + phase + document reference",
        test_status="DISCOVERED",
        fallback="Explicit UNKNOWN or UNAVAILABLE; never a synthetic value",
        owner="Krishna",
        next_action=(
            "Capture design PUE, WUE and CUE measurement boundary, peak-summer water demand, "
            "backup generation, internal reuse and the asset register as declared evidence."
        ),
        quality_notes=(
            "Declared design values are not measured performance. Keep the measurement boundary, revision and validity. "
            "Never mix design, declared and operating values in one number, and never replace a missing value with a default."
        ),
    ),
    # ------------------------------------------------------------------ P1
    _source(
        id="nwdp",
        provider="National Water Informatics Centre",
        dataset_name="National Water Data Portal station observations",
        dataset_version="2026",
        data_category="OFFICIAL_ADMIN",
        priority="P1",
        access_method="api",
        authentication="Varies by resource; some resources are public downloads",
        base_url="https://nwdp.nwic.gov.in/",
        exact_endpoint="Per-dataset CSV/API endpoint (record the exact resource URL at ingestion)",
        licence="Per-resource; some resources display 'No License Provided'",
        licence_url=None,
        attribution="As required by each resource",
        can_cache=False,
        can_redistribute=False,
        commercial_use=False,
        resolution="Station level",
        temporal_resolution="Hourly to daily, depending on the resource",
        coverage="India; station coverage varies",
        observation_period="Per station",
        latest_release="Rolling",
        update_frequency="Varies by resource",
        join_key_or_geometry="Nearest station, with distance and station metadata recorded",
        test_status="DISCOVERED",
        fallback="CGWB assessment-unit context; manual station export",
        next_action="Test one groundwater-level resource and record its licence, station distance and coverage before caching anything.",
        quality_notes=(
            "Station context is not a site measurement. Do not cache or redistribute a resource whose licence is not stated. "
            "Report the distance from the candidate polygon to the station."
        ),
    ),
    _source(
        id="bhuvan",
        provider="ISRO / National Remote Sensing Centre",
        dataset_name="Bhuvan thematic WMS/WMTS layers (flood, land use)",
        dataset_version="Rolling",
        data_category="GIS",
        priority="P1",
        access_method="wms",
        authentication="None stated; service access was not runtime-validated in the source audit",
        base_url="https://bhuvan.nrsc.gov.in/",
        exact_endpoint="Bhuvan WMS/WMTS endpoints (verify the current endpoint before use)",
        licence="Government of India; verify the terms of each thematic layer",
        licence_url=None,
        attribution="ISRO/NRSC Bhuvan",
        can_cache=True,
        can_redistribute=False,
        commercial_use=False,
        resolution="Varies by layer; commonly 1:50,000 to 1:250,000",
        temporal_resolution="Varies by layer",
        coverage="India",
        observation_period="Varies by layer",
        latest_release="Rolling",
        update_frequency="Varies by layer",
        join_key_or_geometry="WMS/WMTS request by candidate polygon bounding box",
        test_status="DISCOVERED",
        fallback="Copernicus Sentinel-2 and JRC GSW",
        next_action="Validate one WMS/WMTS layer against a test polygon before relying on it.",
        quality_notes=(
            "Corroboration only. A rendered WMS image is not analysis-ready data. Record the layer name, service version and layer date."
        ),
    ),
    _source(
        id="cpcb_aqi",
        provider="Central Pollution Control Board / Open Government Data Platform",
        dataset_name="Ambient air quality station observations",
        dataset_version="Rolling",
        data_category="OFFICIAL_ADMIN",
        priority="P1",
        access_method="api",
        authentication="data.gov.in API key",
        base_url="https://data.gov.in/catalog/real-time-air-quality-index",
        exact_endpoint="https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69",
        licence="GODL / NDSAP",
        licence_url="https://www.meity.gov.in/static/uploads/2024/02/Gazette-Notification_OpenDataLicense_13.02.2017.pdf",
        attribution="CPCB / Data.gov.in",
        can_cache=True,
        can_redistribute=True,
        commercial_use=True,
        resolution="Station level",
        temporal_resolution="Hourly to daily",
        coverage="India; station network varies",
        observation_period="Rolling",
        latest_release="Rolling",
        update_frequency="Hourly to daily",
        join_key_or_geometry="Nearest station, with distance and averaging period recorded",
        test_status="DISCOVERED",
        fallback="OpenAQ with provider-specific licences; explicit unavailable state",
        next_action="Confirm API key access, retrieve one station record and record station distance and averaging period.",
        quality_notes=(
            "A nearby monitor is not a site baseline. Station representativeness and averaging period must be shown. "
            "Do not present a station value as a project measurement."
        ),
    ),
    _source(
        id="cea_power",
        provider="Central Electricity Authority, Ministry of Power",
        dataset_name="CEA power-sector reports and CO2 Baseline Database",
        dataset_version="CO2 Baseline Database v22.0; operational reports rolling",
        data_category="OFFICIAL_ADMIN",
        priority="P1",
        access_method="download",
        authentication="none",
        base_url="https://cea.nic.in/",
        exact_endpoint="https://cea.nic.in/cdm-co2-baseline-view?mappingId=234&lang=en",
        licence="Government of India publication; confirm GODL/NDSAP before redistribution",
        licence_url="https://www.meity.gov.in/static/uploads/2024/02/Gazette-Notification_OpenDataLicense_13.02.2017.pdf",
        attribution="Central Electricity Authority",
        can_cache=True,
        can_redistribute=False,
        commercial_use=True,
        resolution="National, regional and state aggregates",
        temporal_resolution="Annual for the CO2 baseline; daily to annual for operational reports",
        coverage="India",
        observation_period="Latest published financial year",
        latest_release="CO2 Baseline Database v22.0",
        update_frequency="Annual for the CO2 baseline; varies for operational reports",
        join_key_or_geometry="Region/state mapping; not a site geometry join",
        test_status="DISCOVERED",
        fallback="State utility evidence (manual); explicit unavailable carbon factor",
        next_action="Parse the CO2 baseline workbook into year-by-region factors before using any power-system aggregate.",
        quality_notes=(
            "Regional capacity and generation are not site-level grid headroom. The CO2 factor is an annual weighted average, "
            "not nodal or hourly. Use the factor for the year electricity was consumed."
        ),
    ),
    _source(
        id="census_2011",
        provider="Office of the Registrar General & Census Commissioner, India",
        dataset_name="Census of India 2011 population aggregates",
        dataset_version="2011",
        data_category="OFFICIAL_ADMIN",
        priority="P1",
        access_method="download",
        authentication="none",
        base_url="https://censusindia.gov.in/",
        exact_endpoint="https://censusindia.gov.in/nada/index.php/catalog",
        licence="GODL / NDSAP",
        licence_url="https://www.meity.gov.in/static/uploads/2024/02/Gazette-Notification_OpenDataLicense_13.02.2017.pdf",
        attribution="Census of India 2011",
        can_cache=True,
        can_redistribute=True,
        commercial_use=True,
        resolution="District, village and town aggregates",
        temporal_resolution="Decennial",
        coverage="India",
        observation_period="2011",
        latest_release="2011",
        update_frequency="Decennial",
        join_key_or_geometry="Administrative-boundary join",
        test_status="DISCOVERED",
        fallback="WorldPop modelled population, labelled as modelled and dated",
        next_action="Join a test polygon to its district/village aggregates and label the value as 2011, never 2026.",
        quality_notes=(
            "Published 2011 aggregates must not be presented as current population. Boundary changes complicate joins. "
            "Keep the census year visible wherever the value is shown."
        ),
    ),
    _source(
        id="osm_overpass",
        provider="OpenStreetMap contributors",
        dataset_name="OpenStreetMap extracts via the Overpass API",
        dataset_version="Rolling",
        data_category="GIS",
        priority="P1",
        access_method="api",
        authentication="none; the public Overpass usage policy applies",
        base_url="https://www.openstreetmap.org/",
        exact_endpoint="https://overpass-api.de/api/interpreter",
        licence="ODbL 1.0",
        licence_url="https://opendatacommons.org/licenses/odbl/1-0/",
        attribution="(c) OpenStreetMap contributors",
        can_cache=True,
        can_redistribute=True,
        commercial_use=True,
        resolution="Feature level; completeness varies",
        temporal_resolution="Rolling snapshot",
        coverage="Global",
        observation_period="Snapshot timestamp",
        latest_release="Rolling",
        update_frequency="Continuous",
        join_key_or_geometry="Buffer query around the candidate polygon",
        test_status="DISCOVERED",
        fallback="GridFinder for predicted network context; manual utility records",
        next_action="Query roads and receptors within a configurable buffer and store the snapshot timestamp.",
        quality_notes=(
            "Crowd-sourced; completeness varies. Proximity to a substation is not grid capacity or a connection sanction. "
            "Never convert distance into available MW."
        ),
    ),
    # ------------------------------------------------------------------ P2
    _source(
        id="imd_weather",
        provider="India Meteorological Department, Pune",
        dataset_name="IMD gridded rainfall and station weather observations",
        dataset_version="Rainfall 1901-2024; station weather rolling",
        data_category="OFFICIAL_ADMIN",
        priority="P2",
        access_method="download",
        authentication="The portal returned HTTP 401 anonymously in the source audit; the access route must be confirmed",
        base_url="https://www.imdpune.gov.in/cmpg/Griddata/Rainfall_25_NetCDF.html",
        exact_endpoint="NetCDF rainfall download and station weather endpoints (confirm the current URLs before ingestion)",
        licence="Government of India publication; redistribution terms unverified",
        licence_url=None,
        attribution="India Meteorological Department",
        can_cache=True,
        can_redistribute=False,
        commercial_use=False,
        resolution="0.25 degree rainfall grid; station-level weather",
        temporal_resolution="Daily",
        coverage="India",
        observation_period="Rainfall 1901-2024; station weather rolling",
        latest_release="2024 rainfall; rolling station weather",
        update_frequency="Annual for gridded rainfall; daily for station weather",
        join_key_or_geometry="Containing grid cell for rainfall; nearest station for weather, with distance",
        test_status="DISCOVERED",
        fallback="NASA POWER reanalysis (modelled, clearly labelled); manual IMD data request",
        next_action="Resolve authenticated access and verify redistribution terms before ingestion.",
        quality_notes=(
            "Gridded rainfall is interpolated from station observations, not a site gauge. Station weather is not a site measurement. "
            "Show the grid resolution or station distance and the observation period. Derive wet-bulb only with a documented method."
        ),
    ),
    _source(
        id="nrsc_flood",
        provider="National Remote Sensing Centre, ISRO",
        dataset_name="Flood Affected Area Atlas",
        dataset_version="1998-2022",
        data_category="OFFICIAL_ADMIN",
        priority="P2",
        access_method="download",
        authentication="none stated",
        base_url="https://nrsc.gov.in/",
        exact_endpoint="Atlas PDFs and maps; machine-readable geometry not confirmed",
        licence="Government of India; verify reuse terms",
        licence_url=None,
        attribution="NRSC Flood Affected Area Atlas",
        can_cache=True,
        can_redistribute=False,
        commercial_use=False,
        resolution="Atlas map scale; varies",
        temporal_resolution="Event-based",
        coverage="India",
        observation_period="1998-2022",
        latest_release="2022 atlas",
        update_frequency="Periodic",
        join_key_or_geometry="Spatial overlay where machine-readable geometry exists",
        test_status="DISCOVERED",
        fallback="JRC GSW historical occurrence; local drainage study",
        next_action="Confirm whether machine-readable geometry exists before promising a flood-overlap indicator.",
        quality_notes=(
            "Historical flood occurrence is not a return-period probability. Atlas geometry may be unavailable; "
            "never infer exposure from a rendered map without a stated method."
        ),
    ),
    _source(
        id="state_utility_evidence",
        provider="DISCOM, STU and water authority (project-specific)",
        dataset_name="Sanctions, allocations and connection commitments",
        dataset_version="Per document",
        data_category="AUTHORITY",
        priority="P2",
        access_method="manual",
        authentication="Authorised reviewer or document upload",
        base_url=None,
        exact_endpoint=None,
        licence="Private project evidence; do not redistribute",
        licence_url=None,
        attribution="Document issuer",
        can_cache=False,
        can_redistribute=False,
        commercial_use=False,
        resolution="Project, site and phase",
        temporal_resolution="Per document validity period",
        coverage="Project-specific",
        observation_period="Per document",
        latest_release="Not applicable",
        update_frequency="On issue or revision",
        join_key_or_geometry="site_id + phase + document reference",
        test_status="DISCOVERED",
        fallback="NO_OFFICIAL_EVIDENCE_AVAILABLE finding",
        owner="Krishna",
        next_action="Model as authority evidence with issuer, reference and validity; do not build it as a public connector.",
        quality_notes=(
            "Never infer spare grid capacity or water allocation from proximity or public aggregates. "
            "A sanction for one site or phase must not be counted at another."
        ),
    ),
]

DATA_SOURCE_IDS = frozenset(source["id"] for source in DATA_SOURCES)

_INSERT_COLUMNS = (
    "id", "provider", "dataset_name", "dataset_version", "data_category", "priority",
    "access_method", "authentication", "base_url", "exact_endpoint", "licence",
    "licence_url", "attribution", "can_cache", "can_redistribute", "commercial_use",
    "resolution", "temporal_resolution", "coverage", "observation_period",
    "latest_release", "update_frequency", "join_key_or_geometry", "test_status",
    "fallback", "owner", "next_action", "runtime_status", "last_checked_at",
    "last_success_at", "quality_notes", "created_at", "updated_at",
)


def seed_data_sources(connection: sqlite3.Connection) -> int:
    """Insert any missing registry rows. Existing rows are never overwritten."""
    if not connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='data_sources'"
    ).fetchone():
        return 0
    placeholders = ", ".join("?" for _ in _INSERT_COLUMNS)
    statement = (
        f"INSERT OR IGNORE INTO data_sources ({', '.join(_INSERT_COLUMNS)}) "
        f"VALUES ({placeholders})"
    )
    inserted = 0
    for source in DATA_SOURCES:
        cursor = connection.execute(statement, tuple(source[column] for column in _INSERT_COLUMNS))
        inserted += cursor.rowcount
    return inserted
