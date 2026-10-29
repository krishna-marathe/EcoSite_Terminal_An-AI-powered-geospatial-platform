# Data connector verification record

Status: live-verification log.
Date: 2026-10-29.
Product scope: **sustainability score dashboard only**.
Geographic scope: **Telangana, Maharashtra, Karnataka and Tamil Nadu only**.
Registry: [`data/data-sources.json`](../../data/data-sources.json),
[`docs/data/DATA_SOURCE_REGISTRY.csv`](DATA_SOURCE_REGISTRY.csv).
Plan: [`docs/implementation/data-integration-plan.md`](../implementation/data-integration-plan.md).

This file records what was actually exercised against a live source, with the request,
payload identity, parsed values and coverage. It exists so that a maturity claim
(`ACCESS_TESTED`, `PROCESSING_TESTED`, …) can be checked against evidence rather than
assertion. Fixture-only tests are **not** recorded here as live verification.

---

## 1. Maturity and runtime statuses

Two different questions are kept separate:

| Field | Question | Values |
| --- | --- | --- |
| `test_status` | Has this connector been proven to work at all? | `DISCOVERED` → `ACCESS_TESTED` → `PROCESSING_TESTED` → `VALIDATED` → `INTEGRATED` |
| `runtime_status` | Is this deployment currently using it? | `NOT_CONNECTED`, `CONNECTED`, `STALE`, `SOURCE_UNAVAILABLE` |

A connector can be `PROCESSING_TESTED` and still `NOT_CONNECTED` in a given deployment.
`jrc_gsw`, `copernicus_stac` and `nasa_srtmgl1` were each run on demand against a Pune
candidate in the seeded development database, which set their `runtime_status` to
`CONNECTED`; no refresh schedule exists. The Projects page can fetch a source on demand and
displays every stored observation with its provenance.

`VALIDATED` requires an independent check of the values. `INTEGRATED` requires the value to
be shown in the dashboard with provenance. Neither is claimed for any source: the dashboard
now displays JRC and STAC observations, but no independent validation has been performed.

---

## 2. JRC Global Surface Water — live verification (PASSED)

**Source:** `jrc_gsw` — European Commission Joint Research Centre, Global Surface Water v1.5
(1984–2024).
**Run:** `923cd07f-6868-46b6-ae46-31cc09c5c54a`.
**Started:** `2026-10-27T13:29:44.624041+00:00`.
**Finished:** `2026-10-27T13:29:53.198398+00:00`.
**Status:** `success`.

### 2.1 Request

`POST /api/v1/sites/{site_id}/environmental-analysis` with:

```json
{
  "sources": ["jrc_gsw"],
  "buffer_m": 1000,
  "max_tiles": 4
}
```

Candidate polygon (WGS84), declared as Maharashtra (`IN-MH`), district Pune:

```json
{
  "type": "Polygon",
  "coordinates": [[
    [73.840, 18.510],
    [73.860, 18.510],
    [73.860, 18.530],
    [73.840, 18.530],
    [73.840, 18.510]
  ]]
}
```

The site passed the four-state ADM1 screening gate with
`boundary_screening.state_scope.status = "inside_focus_state"`.

### 2.2 Tile selection

The connector selects only the tiles that intersect the polygon bounds:

```text
https://s3.waw4-1.cloudferro.com/swift/v1/global-surface-water/download2024/
Aggregated/VER1-5/occurrence/occurrence_70E_20N_v1_5_2024.tif
```

**Tile naming convention (verified, and the source of an earlier bug):** JRC names a
10° × 10° tile by its **west longitude** and its **north latitude**. Therefore
`occurrence_70E_20N_v1_5_2024.tif` covers **70–80°E and 10–20°N**. The first live attempt
used a south-west convention and fetched the `70E_10N` tile (0–10°N), which does not cover
Pune; that failure is why the convention is recorded here. SRTM uses the usual south-west
corner naming (`N18E073`), so the two connectors keep separate tile helpers.

### 2.3 Payload identity

| Property | Value |
| --- | --- |
| HTTP status | `200` |
| Bytes | `44,348,023` |
| SHA-256 | `18f33dbea8e0456ea647c6b600c4ebc1cb941f0f03b37ed1e99b02296d3b8cbe` |
| Raw snapshot | `jrc_gsw/2026-10-27/923cd07f-…-00-occurrence_70E_20N_v1_5_2024.tif.gz` |
| Snapshot SHA-256 | Same as the downloaded bytes (hash of the uncompressed payload) |
| Dataset version | `GSW v1.5 (1984-2024)` |
| Period | `1984-01-01` to `2024-12-31` |
| Resolution | `30 m (Landsat-derived)` |
| Processing version | `1.0.0` |

### 2.4 Parsed observations

Zonal statistics over the polygon with a 1,000 m buffer and a 1% water-occurrence threshold:

| Indicator | Value | Unit | Coverage |
| --- | --- | --- | --- |
| `historical_water_occurrence_overlap_fraction` | `0.02078125` | fraction | `1.0` |
| `historical_water_occurrence_mean_percent` | `0.49203125` | % | `1.0` |
| `historical_water_occurrence_max_percent` | `68.0` | % | `1.0` |
| `historical_water_valid_pixel_fraction` | `1.0` | fraction | `1.0` |
| `nearest_mapped_water_distance_m` | `0.0` | m | `1.0` |

Pixel accounting recorded in `quality_flags`:

| Field | Value |
| --- | --- |
| `inside_pixels` | `6,400` |
| `valid_pixels` | `6,400` |
| `wet_pixels` (≥ 1% occurrence) | `133` |
| `nodata_pixels` | `0` |
| `buffer_m` | `1,000` |
| `water_threshold_percent` | `1.0` |
| Geometry hash | `8c9230f4405a8a534f6b661fc69d75f40fc38e85ce6496e6cf26b2c66cbef128` |

All five observations were stored with `status = AVAILABLE`, evidence class
`REMOTE_SENSING_DERIVED`, method `zonal_occurrence_statistics`, and full valid-pixel
coverage. Re-running the same request produced no duplicate observations (idempotent
upsert on the dedupe key).

### 2.5 What this proves — and what it does not

**Proves:** the connector can select the correct tile, fetch it, parse the GeoTIFF, compute
occurrence overlap, mean/max occurrence, proximity and valid-pixel coverage, and persist
reproducible observations with a hashed raw snapshot.

**Does not prove:**

- Flood risk. Historical water occurrence is not a flood return-period probability.
- That small or ephemeral water bodies were detected; 30 m Landsat resolution misses them.
- That the values are independently correct. This is `PROCESSING_TESTED`, not `VALIDATED`.
- That refreshes are scheduled. In the seeded dev database `runtime_status` is
  `NOT_CONNECTED`; the transient live run marked it `CONNECTED` only for that run.
  The Projects page displays the stored observations and can fetch them on demand.

---

## 3. Copernicus Sentinel-2 STAC — live verification (PASSED)

**Source:** `copernicus_stac` — ESA / Copernicus Data Space Ecosystem, Sentinel-2
Level-2A scene catalogue via STAC.
**Run:** `033dba92-a517-417d-b7de-af5f02325c23`.
**Started:** `2026-10-27T13:54:19.833136+00:00`.
**Finished:** `2026-10-27T13:54:23.048360+00:00`.
**Status:** `success`.

### 3.1 Request

`POST /api/v1/sites/{site_id}/environmental-analysis` with:

```json
{
  "sources": ["copernicus_stac"],
  "max_pages": 3
}
```

The same Pune polygon as §2.1 was used, declared as Maharashtra (`IN-MH`).

The connector sends a `POST` to
`https://catalogue.dataspace.copernicus.eu/stac/search` with the collection
`sentinel-2-l2a`, the candidate polygon as `intersects`, a 365-day window and a page limit of
100. It follows the STAC `next` link when one is returned. The search does **not** apply a
server-side cloud filter, so the cloud distribution and usable-scene fraction are computed
locally.

### 3.2 Payload identity

| Property | Value |
| --- | --- |
| HTTP status | `200` |
| Bytes | `6,285,681` |
| SHA-256 | `f643d10ce6b005940c10c81beeaf51e6c118aaf948be0afcecb20c0f7d7b1e3d` |
| Pages | `1` |
| Scenes returned | `90` |
| Raw snapshot | `copernicus_stac/2026-10-27/033dba92-…-00-stac-search-01.json.gz` |
| Dataset version | `Sentinel-2 L2A (rolling)` |
| Parser version | `1.0.0` |

The page limit is 100 and 90 scenes were returned, so no `next` link was present. Pagination
itself is covered by a fixture test rather than this live run.

### 3.3 Parsed observations

| Indicator | Value | Unit | Status |
| --- | --- | --- | --- |
| `sentinel2_scene_count` | `90.0` | scenes | `AVAILABLE` |
| `sentinel2_usable_scene_count` | `51.0` | scenes | `AVAILABLE` |
| `sentinel2_usable_scene_fraction` | `0.5666666666666667` | fraction | `AVAILABLE` |
| `sentinel2_cloud_cover_median_percent` | `13.9` | % | `AVAILABLE` |
| `sentinel2_cloud_cover_min_percent` | `0.0` | % | `AVAILABLE` |
| `sentinel2_latest_scene_age_days` | `2.350819573425926` | days | `AVAILABLE` |
| `sentinel2_scene_date_span_days` | `360.0002314814815` | days | `AVAILABLE` |

- Scene period: `2025-10-30` to `2026-10-25`.
- Latest scene observed at: `2026-10-25T05:29:09.024000+00:00`.
- "Usable" means `eo:cloud_cover` at or below the 20% threshold; 51 of 90 scenes qualified.
- `coverage_fraction` is `null` for every record. Scene metadata does not establish the
  fraction of the polygon covered by valid pixels, and the connector does not pretend it does.
- Quality flags record `search_datetime` (the exact request window), `server_cloud_filter: false`,
  `max_cloud_percent: 20`, `lookback_days: 365`, `scenes_without_cloud_cover: 0`,
  `scenes_without_datetime: 0` and the
  latest/earliest scene IDs.
- If a search returns no scenes, `sentinel2_scene_count` is `0.0` with status `AVAILABLE`, and
  `period_start`/`period_end` are taken from the search window. The absence is therefore tied to
  a reproducible interval rather than to a missing date.

### 3.4 What this proves — and what it does not

**Proves:** the connector can search the anonymous STAC API for a candidate polygon, follow
pagination, deduplicate scenes, and persist reproducible scene-availability and cloud-cover
statistics with a hashed raw snapshot.

**Does not prove:**

- That pixels can be downloaded or that NDVI can be computed. Asset download requires a CDSE
  account and was not attempted.
- Land cover, vegetation condition or legal land use. Scene metadata is not a measurement.
- That the polygon is cloud-free. A low-cloud scene can still have cloud over the site; only
  pixel-level cloud masking answers that.
- Independent correctness. This is `PROCESSING_TESTED`, not `VALIDATED`.
- That scene metadata has been validated against an independent source. The Projects page now
  displays the stored scene statistics with provenance, but `VALIDATED`/`INTEGRATED` still
  require an independent check first.

---

## 4. NASA SRTMGL1 — live verification (PASSED)

**Source:** `nasa_srtmgl1` — NASA Shuttle Radar Topography Mission Global 1 arc-second
(SRTMGL1 v003).
**Run:** `91ea76f9-054c-4a53-be9e-81199b7c7b1c`.
**Retrieved:** `2026-10-29T00:20:26+00:00`.
**Status:** `success`; registry advanced to `PROCESSING_TESTED` / `CONNECTED`.

### 4.1 Request

`POST /api/v1/sites/{site_id}/environmental-analysis` with:

```json
{
  "sources": ["nasa_srtmgl1"],
  "buffer_m": 500,
  "max_tiles": 2
}
```

Candidate `83bee74e-1291-417e-875c-52938613f7d3` ("Pune dashboard verification"), the same
467.50 ha polygon used in §2 and §3, declared as Maharashtra (`IN-MH`), district Pune,
`geometry_hash` `8c9230f4…cbef128`. The request came from `127.0.0.1`; the endpoint is
local-only.

### 4.2 Payload identity

| Field | Value |
| --- | --- |
| Tile file | `N18E073.SRTMGL1.hgt.zip` (south-west corner 18°N, 73°E) |
| URL | `https://data.lpdaac.earthdatacloud.nasa.gov/lp-prod-protected/SRTMGL1.003/N18E073.SRTMGL1.hgt/N18E073.SRTMGL1.hgt.zip` |
| Auth | Earthdata bearer token in `ECOSITE_EARTHDATA_TOKEN` (not in version control) |
| HTTP status | `200` after the LP DAAC `303` redirect to its CloudFront distribution |
| Content type | `binary/octet-stream` |
| Bytes | `12,646,090` |
| SHA-256 | `b81a85f6a92905fa5bb4291c6e44627a749be036d4ca641be5cc9b1eed302d1a` |
| Dataset version | `SRTMGL1 v003`, period `2000-02-11` to `2000-02-22` |
| Resolution / method | `30 m (1 arc-second)` / `zonal_dem_statistics`, parser `1.0.0` |

### 4.3 Stored observations (7, all `AVAILABLE`)

| Indicator | Value | Unit | `coverage_fraction` |
| --- | --- | --- | --- |
| `terrain_elevation_mean_m` | 559.10 | m | 1.0 |
| `terrain_elevation_min_m` | 533 | m | 1.0 |
| `terrain_elevation_max_m` | 574 | m | 1.0 |
| `terrain_relief_m` | 41 | m | 1.0 |
| `terrain_slope_mean_deg` | 3.07 | deg | 1.0 |
| `terrain_slope_max_deg` | 15.21 | deg | 1.0 |
| `terrain_void_pixel_fraction` | 0 | fraction | 1.0 |

Void accounting: 5,184 of 5,184 pixels inside the polygon plus buffer were valid; there were
no `-32768` voids. Nothing was interpolated across a gap.

**Does not prove:**

- That the elevation values are independently correct. This is `PROCESSING_TESTED`, not
  `VALIDATED`.
- Ground truth at the site. SRTM is a 2000 radar surface model at 30 m; it is screening
  terrain context, not a site survey, and not a hydrological or geotechnical study.
- That the polygon is free of canopy/built bias. SRTM measures a reflective surface, not bare
  earth, and a single lush or built-up tile can read several metres high.
- Any refresh schedule. The run was on demand; there is none.

### 4.4 Reproducing

Set `ECOSITE_EARTHDATA_TOKEN` (the backend also reads it from `backend/.env`), start the
local API and repeat the §4.1 request. The connector, tile selection and HGT parser are
additionally covered by fixture tests: big-endian `int16` decoding, `-32768` void handling
and 3601 × 3601 / 1201 × 1201 tile sizes. A re-run upserts on the dedupe key, so repeating
the request does not duplicate observations.

---

## 5. Other sources

| Source | `test_status` | Evidence |
| --- | --- | --- |
| All other registry sources | `DISCOVERED` | Metadata only. No live access or processing run. |

No source may claim `PROCESSING_TESTED` on the strength of a fixture test alone. JRC and
Copernicus STAC have live evidence in §2 and §3; SRTM has live evidence in §4.

The bundled `/api/v1/data-sources/environmental` payload (CGWB, CPCB, CEA and water-tariff
context) is reference material, not a connector output. Top-level provenance remains
`UNVERIFIED_REFERENCE_VALUES` with `used_in_scoring: false`, because the CGWB, CPCB, terrain
and water-tariff sections have no stored source table, page or station code.

The CEA section is the exception. Its `provenance.verification_status` is
`VERIFIED_AGAINST_BUNDLED_SOURCE`: the national weighted average (`0.675`), operating margin
(`0.963`), build margin (`0.446`) and combined margin (`0.705`) were read from
`data/official_documents/cea_co2_baseline_v22.xlsx` (SHA-256
`f2341efe03d2fce4177a4a7090b8a946a5ac5ae32b41d784882d0226f2eb4860`), worksheet `Results`,
cells `AA14`–`AA17`, FY 2025-26 including imports. The dashboard cites the worksheet and cells
and shows a "Verified · CEA v22.0" badge.

The previous `regional_grid_factors` block was removed. CEA v22.0 publishes one unified Indian
grid (the five regional grids merged in December 2013), and the regional numbers were not
traceable to the workbook. Only the national factors are shown. If a national factor is
missing, the card renders "Unavailable"; it never shows zero. The values remain reference
context and are not yet used in any score.

---

## 6. Dashboard data path — live verification (PASSED)

**Purpose:** prove that the observations displayed by the Projects page come from the same
local API and carry the same provenance, instead of demo fixtures.

**Candidate:** `Pune dashboard verification`, `83bee74e-1291-417e-875c-52938613f7d3`,
Maharashtra (`IN-MH`), geometry hash
`8c9230f4405a8a534f6b661fc69d75f40fc38e85ce6496e6cf26b2c66cbef128`.

**Run:** `POST /api/v1/sites/{site_id}/environmental-analysis` with
`{"sources": ["jrc_gsw", "copernicus_stac"], "buffer_m": 1000}` returned HTTP `200`.

| Source | Run | Result | Observations |
| --- | --- | --- | --- |
| `jrc_gsw` | `ca816e69-b4a9-4831-a11d-b383ce387bf4` | `success` | 5 |
| `copernicus_stac` | `4467df62-f250-4f95-94c7-dd5a254acad2` | `success` | 7 |

`GET /api/v1/sites/{site_id}/observations` then returned 12 records. JRC values matched the
earlier live run (2.08% overlap, 0.49% mean, 68% maximum, 100% valid-pixel coverage, 0 m to
nearest mapped water). STAC returned 90 scenes, 51 usable (56.7%), median cloud 13.9% and
latest-scene age 2.36 days. Both sources set `runtime_status = CONNECTED` in the development
database; SRTM remained `DISCOVERED` / `NOT_CONNECTED`.

**Proves:** the observation endpoints used by the dashboard return the stored values, nulls
stay null (`coverage_fraction` is `null` for STAC), and the per-source run result is preserved.

**Dev-proxy check:** the backend ran on `127.0.0.1:8010` and Vite on `127.0.0.1:5187` with
`ECOSITE_API_PROXY_TARGET=http://127.0.0.1:8010`. `GET http://127.0.0.1:5187/api/v1/data-sources?priority=P0`
returned `application/json` with the five P0 sources, and
`GET /api/v1/sites/{site_id}/observations` through the same proxy returned the 12 stored
observations above. The hardcoded port-8000 proxy is gone, so an unrelated service on 8000
can no longer answer the dashboard's API calls.

**Does not prove:** that the rendered table is visually correct (covered by the frontend
component tests), that the values are independently correct (`VALIDATED`), or that a refresh
schedule exists.

---

## 7. Four-state boundary verification

The geographic gate uses a pinned geoBoundaries ADM1 screening layer, not a state-code
allowlist alone.

| Property | Value |
| --- | --- |
| Boundary ID | `IND-ADM1-1811400` |
| Release | geoBoundaries `gbOpen` IND ADM1, version `9469f09` |
| States | Telangana (`IN-TG`), Maharashtra (`IN-MH`), Karnataka (`IN-KA`), Tamil Nadu (`IN-TN`) |
| File | `backend/data/boundaries/IND-ADM1-4states.geojson` |
| Bytes | `1,779,109` |
| SHA-256 | `23f24817e39caf965f33b988b2272899daf40650ebf8b854f36f2dcd192a5cba` |
| Licence | CC BY 2.5 IN |
| Feature count | `4` |

Verified behaviour:

| Polygon | Declared state | Result |
| --- | --- | --- |
| Pune (18.51–18.53°N, 73.84–73.86°E) | `IN-MH` | accepted, `inside_focus_state` |
| Hyderabad (17.35–17.37°N, 78.45–78.47°E) | `IN-TG` | accepted, `inside_focus_state` |
| Bengaluru (12.96–12.98°N, 77.58–77.60°E) | `IN-KA` | accepted, `inside_focus_state` |
| Chennai (13.00–13.02°N, 80.20–80.22°E) | `IN-TN` | accepted, `inside_focus_state` |
| Pune polygon | `IN-KA` | rejected: lies in Maharashtra, not the declared state |
| Gujarat polygon (23.00–23.02°N, 72.50–72.52°E) | `IN-MH` | rejected: outside the four-state scope |
| Polygon crossing 74.4–74.6°E, 16.4–16.6°N | `IN-MH` | rejected: crosses into Karnataka |

The boundary is a **screening** dataset, not a legal determination. A site within 1 km of a
state boundary is accepted but marked `review_required`. See
[`backend/data/boundaries/README.md`](../../backend/data/boundaries/README.md).

---

## 8. Reproducing the checks

Unit and fixture tests (no network):

```powershell
backend\.venv\Scripts\python.exe -m unittest discover -s backend\tests -p "test_*.py"
```

Live connector runs are not part of the unit suite. They need network access, and SRTM also
needs `ECOSITE_EARTHDATA_TOKEN`. Raw payloads are written under
`backend/data/raw/{source_id}/{date}/` (override with `ECOSITE_RAW_DIR`); the database stores
only the path and hash.

Relevant environment variables (see `backend/.env.example`):

| Variable | Purpose |
| --- | --- |
| `ECOSITE_EARTHDATA_TOKEN` | Earthdata bearer token for SRTM |
| `ECOSITE_JRC_GSW_BASE_URL` | Override the JRC tile base URL |
| `ECOSITE_SRTM_BASE_URL` | Override the SRTM tile base URL |
| `ECOSITE_JRC_WATER_THRESHOLD` | Occurrence threshold in percent (default `1`) |
| `ECOSITE_STAC_SEARCH_URL` | Override the Copernicus STAC search endpoint |
| `ECOSITE_STAC_LOOKBACK_DAYS` | STAC search window in days (default `365`) |
| `ECOSITE_STAC_MAX_CLOUD` | Usable-scene cloud threshold in percent (default `20`) |
| `ECOSITE_RAW_DIR` | Raw snapshot directory |

---

## 9. Verification checklist for the next connector

Before recording a live pass here, confirm all of the following:

1. The request and the exact endpoint/tile are recorded.
2. The response status, byte count and SHA-256 are recorded.
3. The dataset version and observation period are recorded.
4. Every stored value, unit and `coverage_fraction` is listed.
5. Nodata/void accounting is listed, not hidden.
6. The candidate polygon is inside the four focus states and passed the ADM1 gate.
7. A re-run does not duplicate observations.
8. Limitations are stated, and the maturity claim does not exceed the evidence.
9. Every reference value is traced to a specific cell, page or station code, or removed.
   Do not carry a regional factor when the publisher reports a single unified grid.
