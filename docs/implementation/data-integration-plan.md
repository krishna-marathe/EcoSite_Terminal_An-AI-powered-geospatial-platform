# Data integration plan — from sources to a trustworthy score

Status: implementation plan.
Date: 2026-10-27.
Scope: **sustainability score dashboard only**.
Geographic scope: **Telangana, Maharashtra, Karnataka and Tamil Nadu only.**
Governing roadmap: [`roadmap.md`](../../roadmap.md). Build order, registry fields and
maturity gates follow it; see [roadmap-alignment.md](roadmap-alignment.md) for the
reconciliation and accepted trade-offs.
Source selection: [required-data-sources.md](required-data-sources.md).
Current-state map: [source-implementation-map.md](source-implementation-map.md).

---

## 1. The principle: data plane before connectors

Connecting twelve sources directly into the dashboard would produce twelve different
schemas, twelve different date formats, twelve different failure modes, and no way to tell
which number is trustworthy.

The correct order is:

```text
Source registry
      ↓
Connector (fetch + parse)
      ↓
Raw snapshot (immutable, hashed)
      ↓
Normalised observation (metric, unit, date, geometry, evidence class)
      ↓
Deterministic calculator (PUE, WUE, CUE, Scope 2, water balance, ERF, headroom)
      ↓
Sub-score + coverage + hard constraints
      ↓
API + dashboard
```

Each layer has one job. A connector never computes a score. A calculator never fetches
data. The score engine never invents a missing value.

That contract now exists, and the first connector (JRC) was written against it. Do not add
a connector that bypasses the registry, snapshot store or observation table.

---

## 2. Current state and blockers

| Item | State | Consequence |
| --- | --- | --- |
| Backend framework | FastAPI + SQLAlchemy + Alembic + SQLite | Good foundation; extend it, do not replace it |
| Geometry | Shapely + pyproj already installed | Spatial joins are possible without a new stack |
| Project/candidate/phase persistence | Implemented, revisioned | Use it as the anchor for observations |
| Environmental data | JRC water and Copernicus STAC scene metadata run end-to-end, store observations, and are displayed on the Projects page; SRTM is implemented but not live-verified | JRC and STAC are `PROCESSING_TESTED` / `CONNECTED` (on demand); SRTM is still `DISCOVERED` |
| Data-source metadata | Database-backed registry of 14 roadmap sources, plus `data/data-sources.json` and a CSV catalogue | Read by the Data Sources page; the Projects page reads stored observations |
| Geographic scope | Four-state ADM1 screening gate implemented | Candidate polygons outside TG/MH/KA/TN are rejected |
| Data-centre facilities | None seeded | No facility to attach operational KPIs to |
| Backend port | `8000` occupied by another service | Run the dev API on a free port such as `8010`; set `ECOSITE_API_PROXY_TARGET=http://127.0.0.1:8010` for the Vite dev server |
| Tests | 101 backend tests pass | Live connector runs are excluded from CI; fixtures only |

**Before integration:** run the backend on a free port (for example `8010`), set
`ECOSITE_API_PROXY_TARGET` to that origin (the Vite proxy target is configurable; see
`frontend/.env.example`), keep `VITE_API_BASE_URL=/api/v1`, and apply the reviewed Alembic
migrations. Confirm the app runs against the real backend, not a proxy fallback.

See [`docs/data/VERIFICATION.md`](../data/VERIFICATION.md) for the live JRC and STAC evidence,
the dashboard data-path check and the SRTM token blocker.

---

## 3. Target architecture

```text
backend/app/data/
  registry.py            # 14 roadmap sources: priority, licence, coverage, maturity
  models.py              # data_sources, ingestion_runs, raw_snapshots, observations
  schemas.py             # API contracts
  connectors/
    base.py              # Connector protocol: fetch, parse, normalise, validate
    raster.py            # shared windowing, buffering, proximity and terrain helpers
    jrc_gsw.py           # IMPLEMENTED: occurrence tiles -> water overlap/proximity
    srtm.py              # IMPLEMENTED: authenticated HGT tiles -> terrain statistics
    copernicus_stac.py   # IMPLEMENTED: CDSE STAC scene search and cloud summary (NDVI pending)
    cgwb.py              # PLANNED: assessment-unit polygons -> stress class
    cea_co2.py           # PLANNED: annual XLSX -> grid emission factor
  ingest.py              # orchestration, retries, idempotency, snapshot writes
  spatial.py             # PLANNED: polygon sampling, zonal statistics, basin joins
  units.py               # PLANNED: canonical units and rounding
  metrics/               # PLANNED
    energy.py            # PUE, Scope 2, CUE
    water.py             # WUE, water balance, peak-summer gap
    heat.py              # rejected heat, ERF, LST anomaly
    grid.py              # headroom, coverage
    community.py         # population, land change, protected areas
    circularity.py       # e-waste recovery
  score.py               # PLANNED: sub-scores, weights, coverage, hard constraints
backend/app/
  state_scope.py         # four-state ADM1 screening gate
  routers/
    data_sources.py      # registry, scope and recent-run API
    environmental.py     # local analysis trigger and stored observations
```

Do not put connector code in `main.py`. `main.py` should only wire routers.

---

## 4. Canonical data contract

Every observation must answer the same questions:

| Field | Meaning | Example |
| --- | --- | --- |
| `metric_key` | Stable machine name | `energy.pue` |
| `value` | Numeric value | `1.32` |
| `unit` | Canonical unit | `ratio` |
| `observed_at` | When the phenomenon was observed | `2025-03-31` |
| `published_at` | When the source published it | `2025-06-30` |
| `retrieved_at` | When we fetched it | `2026-10-27T12:00:00Z` |
| `spatial_resolution` | Source resolution | `assessment_unit` |
| `temporal_resolution` | Source cadence | `annual` |
| `coverage_fraction` | Share of the polygon covered by valid data | `0.87` |
| `evidence_class` | Authority of the evidence | `official_geospatial` |
| `data_status` | Honesty label | `observed` |
| `method` | How the value was derived | `zonal_majority` |
| `method_version` | Reproducibility | `v1` |
| `uncertainty` | Absolute or relative uncertainty, if known | `±0.05` |
| `source_id` | Registry key | `cgwb_assessment` |
| `raw_snapshot_id` | Immutable payload reference | `snap_...` |

### 4.1 Evidence classes

Use the same vocabulary everywhere:

`measured` · `authority_verified` · `declared` · `documented` · `official_geospatial` ·
`remote_sensing` · `modelled` · `crowd_sourced` · `synthetic` · `unavailable`

### 4.2 Metric keys for the six sub-scores

| Sub-score | Metric keys |
| --- | --- |
| Energy & carbon | `energy.it_mw`, `energy.facility_mw`, `energy.annual_mwh`, `energy.pue`, `energy.re_share_pct`, `energy.scope1_tco2e`, `energy.scope2_tco2e`, `energy.cue_kgco2e_per_kwh`, `climate.cooling_degree_days` |
| Water | `water.withdrawal_kld`, `water.consumption_kld`, `water.wue_l_per_kwh`, `water.peak_summer_kld`, `water.recycled_share_pct`, `water.basin_stress_class`, `water.groundwater_level_m`, `water.rainfall_mm` |
| Heat | `heat.rejected_mw`, `heat.erf_pct`, `heat.reuse_mw`, `heat.lst_anomaly_c`, `heat.air_temp_max_c`, `heat.wet_bulb_max_c` |
| Grid | `grid.sanctioned_mw`, `grid.contract_demand_mw`, `grid.headroom_pct`, `grid.backup_mw`, `grid.distance_to_substation_km` |
| Community & land | `land.area_ha`, `land.vegetation_change_ha`, `land.built_change_ha`, `land.protected_area_overlap_ha`, `land.flood_overlap_pct`, `land.slope_pct`, `community.population_5km`, `community.population_15km`, `community.pm25_ug_m3` |
| Circularity | `circularity.ewaste_recovery_pct`, `circularity.embodied_tco2e`, `circularity.asset_retired_kg` |

### 4.3 Canonical units and display precision

| Quantity | Unit | Display precision |
| --- | --- | --- |
| Power | MW | 1 decimal |
| Energy | MWh | 1 decimal |
| Water flow | KLD | 1 decimal |
| Water intensity | L/kWh | 2 decimals |
| PUE | ratio | 2 decimals |
| CUE | kgCO2e/kWh | 3 decimals |
| Emissions | tCO2e | 1 decimal |
| Area | ha | 1 decimal |
| Distance | km | 1 decimal |
| Temperature | °C | 1 decimal |
| Population | persons | integer |
| Share | % | 1 decimal |

Store the raw value and unit. Round only at the display boundary. Never show more
precision than the source supports.

---

## 5. Database schema

Add one migration, `03a_001_data_plane.py`. Keep the existing project/site/phase tables.

### 5.1 `data_sources`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PK | `cea_co2`, `nasa_power`, `cgwb_assessment` |
| `provider` | TEXT | Central Electricity Authority |
| `dataset_name` | TEXT | CO2 Baseline Database |
| `dataset_version` | TEXT | `v22.0` |
| `access_method` | TEXT | `download`, `api`, `stac`, `manual` |
| `base_url` | TEXT | Official URL |
| `licence` | TEXT | `CC BY 4.0`, `GODL`, `non-commercial` |
| `licence_url` | TEXT | |
| `can_cache` | BOOLEAN | |
| `can_redistribute` | BOOLEAN | |
| `commercial_use` | BOOLEAN | |
| `spatial_resolution` | TEXT | |
| `temporal_resolution` | TEXT | |
| `coverage` | TEXT | |
| `update_frequency` | TEXT | |
| `last_checked_at` | TEXT | UTC ISO-8601 |
| `last_success_at` | TEXT | UTC ISO-8601 |
| `status` | TEXT | `connected`, `stale`, `unavailable`, `catalogue_only` |
| `quality_notes` | TEXT | Precision and caveats |

### 5.2 `ingestion_runs`

`id`, `source_id`, `started_at`, `finished_at`, `status` (`success`, `partial`, `failed`),
`http_status`, `bytes`, `sha256`, `parser_version`, `error`.

### 5.3 `raw_snapshots`

`id`, `source_id`, `run_id`, `path`, `sha256`, `content_type`, `fetched_at`, `expires_at`.

Store payloads as gzipped files under `backend/data/raw/{source_id}/{date}/`, not as BLOBs
in SQLite. The database stores the hash and path.

### 5.4 `observations`

`id`, `source_id`, `site_id` (nullable), `facility_id` (nullable), `geometry_hash`,
`metric_key`, `value`, `unit`, `observed_at`, `published_at`, `retrieved_at`,
`spatial_resolution`, `temporal_resolution`, `coverage_fraction`, `evidence_class`,
`data_status`, `method`, `method_version`, `uncertainty`, `raw_snapshot_id`, `created_at`.

Unique index: `(source_id, site_id, metric_key, observed_at, method_version)`.
This makes ingestion idempotent.

### 5.5 `authority_evidence`

For declared and verified inputs:

`id`, `site_id`, `field`, `value`, `unit`, `evidence_status` (`declared`, `documented`,
`verified`, `expired`, `superseded`, `conflicting`, `missing`), `issuer`, `reference`,
`issued_at`, `valid_until`, `file_sha256`, `verified_at`, `verified_by`, `notes`.

This is where DISCOM sanctions, water allocations, PUE/WUE/CUE design values, asset
registers and zoning records live. Do not force them into `observations`.

### 5.6 `metric_results`

`id`, `site_id`, `metric_key`, `value`, `unit`, `status`, `inputs_json`, `method`,
`method_version`, `calculated_at`, `score_run_id`.

### 5.7 `score_runs`

`id`, `site_id`, `score_version`, `weights_json`, `sub_scores_json`, `coverage`,
`hard_constraints_json`, `calculated_at`.

---

## 6. Connector contract

Every connector implements the same four operations:

```python
class Connector(Protocol):
    source_id: str

    def fetch(self, request: FetchRequest) -> RawPayload: ...
    def parse(self, payload: RawPayload) -> list[ParsedRecord]: ...
    def normalise(self, records: list[ParsedRecord]) -> list[Observation]: ...
    def validate(self, observations: list[Observation]) -> ValidationReport: ...
```

Rules:

- **Fetch** has an explicit timeout, retry count and user-agent. It never retries a 4xx.
- **Parse** is pure: bytes in, records out. It is tested against a checked-in fixture.
- **Normalise** converts to canonical units and attaches `source_id`, dates, resolution
  and evidence class.
- **Validate** checks ranges, units, required fields and coverage. A failed validation
  writes `partial` or `failed`; it does not write a plausible-looking value.
- A connector cannot write to `metric_results` or `score_runs`.
- A connector cannot call another connector.

### 6.1 Failure behaviour

| Situation | Behaviour |
| --- | --- |
| Source returns 5xx / timeout | `ingestion_runs.status = failed`; keep last good observation; mark it `stale` |
| Source returns 4xx | Fail without retry; surface the status |
| Payload schema changed | Fail validation; do not guess columns |
| Geometry outside source coverage | Write `unavailable` with reason `outside_coverage` |
| Partial station/raster coverage | Write the value with `coverage_fraction`; do not silently extrapolate |
| Licence forbids commercial use | API refuses to serve the observation in commercial mode |

**Never substitute synthetic data for a failed real source.** Synthetic data is a separate
mode and must be labelled at the record level.

---

## 7. API contract

Add these endpoints:

| Endpoint | State | Purpose |
| --- | --- | --- |
| `GET /api/v1/data-sources` | Implemented | Registry with status, licence, coverage, last checked, plus the four-state scope |
| `GET /api/v1/data-sources?priority=P0` | Implemented | Filtered view; totals still cover the whole registry |
| `GET /api/v1/data-sources/{source_id}` | Implemented | One source, including recent ingestion runs |
| `GET /api/v1/data-sources/scope` | Implemented | Four focus states, boundary version and checksum |
| `POST /api/v1/sites/{site_id}/environmental-analysis` | Implemented, local-only | Trigger per-source ingestion for a candidate polygon |
| `GET /api/v1/sites/{site_id}/observations` | Implemented | Normalised observations for a candidate polygon |
| `GET /api/v1/sites/{site_id}/metrics` | Planned | Calculated metrics with status and inputs |
| `GET /api/v1/sites/{site_id}/score` | Planned | Sub-scores, weights, coverage, hard constraints |
| `GET /api/v1/sites/{site_id}/coverage` | Planned | Which required inputs are present, stale, or missing |

Response rules:

- Every value includes `unit`, `observed_at`, `data_status`, `evidence_class`,
  `source_id`, `spatial_resolution` and `coverage_fraction`.
- Missing values are `null` with `status: "unavailable"` and a reason. They are never `0`.
- A score response always includes `coverage`, `weights`, `score_version` and
  `calculation_version`.
- A hard constraint failure returns a status, not a reduced score.

---

## 8. Frontend contract

Replace the static provenance catalogue with API-driven source status.

1. **Source badge** — provider, dataset, version, observation date, last checked,
   licence, status. No confidence score unless it is calculated.
2. **Coverage meter** — per sub-score: available / stale / missing / outside coverage.
3. **Metric tile** — value, unit, evidence class, date, source, "why this number".
4. **Unavailable state** — explicit reason, not a green placeholder.
5. **Demo mode** — still available, but every synthetic record is labelled synthetic and
   cannot be confused with a connected source.

The existing `provenance.ts` should become a fallback for demo mode only. Live mode reads
the registry.

---

## 9. Integration waves

### Wave 0 — environment and contract (mostly delivered)

- Run the backend on a free port and point the Vite proxy at it — **configurable now.** Set
  `ECOSITE_API_PROXY_TARGET` (for example `http://127.0.0.1:8010`) because port `8000` is
  occupied by another service. A live browser pass is still outstanding.
- Apply migrations and confirm the app uses the real API — migrations are applied. The
  Projects page now reads observations and can run the implemented connectors; the Data
  Sources page reads the registry.
- Add the data-plane migration and registry — **done.**
- Define metric keys, units, evidence classes and rounding in one module — evidence classes
  and units exist in the observation contract; the shared `units.py` / `metrics/` module is
  still pending.
- Add fixture-based connector tests — **done.**

**Gate (partly met):** the data plane, registry and observation tables exist; 101 backend
tests pass. The four-state ADM1 scope gate was added in the same wave. The Projects page
reads observations and the Data Sources page reads the registry, but independent validation
(`VALIDATED`) is still pending, so no source claims `INTEGRATED`.

### Wave 1 — P0 raster foundations (JRC delivered; SRTM blocked)

Roadmap order: JRC first, then SRTM. Both are candidate-tile operations, not India-wide
downloads.

1. **JRC Global Surface Water** — *delivered.* Only the intersecting tile is fetched; the
   connector computes occurrence overlap, mean/max occurrence, proximity and valid-pixel
   coverage, and stores the release version. A live Pune run on 2026-10-27 produced five
   observations from `occurrence_70E_20N_v1_5_2024.tif`. Status: `PROCESSING_TESTED` /
   `NOT_CONNECTED`. See [`docs/data/VERIFICATION.md`](../data/VERIFICATION.md).
2. **NASA SRTMGL1** — *implemented, not verified.* The connector performs an authenticated
   tile request and computes elevation, slope, relief and void fraction, but no Earthdata
   token was available for a live run. Status: `DISCOVERED` / `NOT_CONNECTED`.

**Gate:** a real Indian candidate polygon has a historical-water observation and a terrain
observation, each with value, unit, dataset version, period, coverage, method and
processing version. Half of this gate is met (JRC); SRTM is not.

### Wave 2 — land and groundwater context (next)

3. **Copernicus STAC / Sentinel-2** — *scene metadata delivered.* A live Pune search on
   2026-10-27 returned 90 scenes and stored seven observations (count, usable fraction,
   cloud median/min, latest-scene age, date span). Next: authenticated asset download,
   pixel-level cloud masking and median NDVI. Scene metadata is not land cover.
4. **CGWB assessment** — assessment-unit boundaries, groundwater category and publication
   year.

**Gate:** the land module lists available scenes without downloading pixels (met), and the
water module shows an assessment-unit category with its boundary version (not met). NDVI is
not available until authenticated asset processing is verified.

### Wave 3 — P1 context (planned)

5. **NWDP** — nearest groundwater/rainfall station, with distance and licence.
6. **Bhuvan WMS/WMTS** — one validated thematic layer for corroboration.
7. **CPCB / Data.gov AQI** — nearest monitored station, with averaging period.
8. **CEA** — regional power-system context and the annual CO2 factor for Scope 2/CUE.
9. **Census 2011** — administrative population aggregates, labelled 2011.
10. **OpenStreetMap / Overpass** — roads and receptors within a buffer.

**Gate:** carbon, grid context, population and air-quality context are available with
source, date, resolution and licence; no proximity is converted into capacity.

### Wave 4 — P2 and authority evidence (planned)

11. **IMD rainfall** — resolve authenticated access and redistribution terms first.
12. **NRSC flood atlas** — only if machine-readable geometry is confirmed.
13. **Authority evidence** — DISCOM sanction, water allocation, PUE/WUE/CUE boundary and
    asset register, stored as declared/verified evidence rather than public observations.

**Gate:** the score is complete across all six sub-scores, with coverage, conflicts and hard
constraints visible. Any missing input remains `SOURCE_UNAVAILABLE`, not zero.

---

## 10. Accuracy and precision rules

These are non-negotiable.

1. **One source of record per metric.** If two sources disagree, store both and show a
   conflict; do not average silently.
2. **Observation date is mandatory.** A value without a date is not a fact.
3. **Resolution is mandatory.** Show `assessment_unit`, `1 km`, `100 m`, `station`, etc.
4. **Coverage is mandatory for spatial measurements.** A station 80 km away is not a site
   measurement. Metadata-only observations set `coverage_fraction = null` and must not imply
   pixel coverage.
5. **Units are canonical.** Convert at ingestion, store the original unit in the snapshot.
6. **No false precision.** Do not show PUE to four decimals from a declared design value.
7. **No silent substitution.** A failed source becomes `unavailable`, not a synthetic
   green value.
8. **No score without breakdown.** Always show sub-scores, weights, coverage and version.
9. **No aggregate override.** A high score cannot override a hard constraint or a missing
   critical input.
10. **Reproducibility.** Every metric result must be recomputable from
    `source_id + dataset_version + observation_date + geometry_hash + method_version`.

### 10.1 What each source can and cannot prove

| Source | Can support | Cannot support |
| --- | --- | --- |
| CEA CO2 | Annual/regional Scope 2 | Hourly or nodal carbon |
| CGWB | Basin stress class | Water allocation |
| Aqueduct | Catchment risk | Parcel water availability |
| Sentinel-2 | Land-cover change | Legal land use |
| WorldPop | Modelled population exposure | Census count |
| WDPA | Protected-area screening | Legal prohibition |
| OSM / GridFinder | Proximity | Grid headroom |
| NASA POWER / ERA5 | Climate normals | Site measurement |
| IMD gridded | Grid-cell rainfall | Gauge record |
| CPCB | Station air quality | Site baseline |
| MODIS LST | Surface temperature | Air temperature |
| NRSC flood | Historical overlap | Return-period probability |
| JRC GSW | Historical surface-water occurrence | Flood return period or current water availability |
| SRTMGL1 | 30 m terrain, slope and void screening | Site survey, legal datum or drainage design |
| Sentinel-2 STAC | Scene availability and cloud cover | Land cover, NDVI or legal land use until pixels are processed |
| CPCB EPR | Aggregate recovery | Facility recovery |

---

## 11. Testing strategy

| Test type | What it proves |
| --- | --- |
| Registry test | Every source has provider, licence, resolution, coverage and status |
| Parser fixture test | A checked-in payload parses deterministically |
| Unit test | Conversion and rounding are correct |
| Validation test | Out-of-range and missing fields fail loudly |
| Idempotency test | Re-running a connector does not duplicate observations |
| Failure test | Timeout/5xx/4xx produce `failed`/`stale`, never synthetic values |
| Spatial test | A known polygon yields the expected basin, stress class and land-cover shares |
| Calculator test | Hand-calculated PUE, WUE, CUE, Scope 2, headroom and water gap |
| Score test | Weights sum to 1; missing data lowers coverage, not the score |
| Contract test | API always returns unit, date, status, source and coverage |
| Licence test | Restricted sources are refused in commercial mode |

Use recorded fixtures for CI. Do not call live APIs in the unit suite. Keep one optional
"live smoke test" that is excluded by default.

---

## 12. Delivered and next sprint

### Delivered

- Data-plane migration `03a_001_data_plane.py`, models, schemas and registry.
- 14-source roadmap registry, JSON catalogue and CSV.
- JRC connector with a live Pune verification (five observations).
- Copernicus STAC scene-metadata connector with a live Pune search (90 scenes, seven
  observations).
- SRTM connector with fixture tests; the live run is blocked on an Earthdata token.
- Ingestion orchestration with hashed snapshots, idempotent observations and failure states.
- Four-state ADM1 screening gate on create, patch and analysis.
- Registry, scope, environmental-analysis and observation endpoints.
- 101 backend tests passing.

### Next sprint

1. Obtain `ECOSITE_EARTHDATA_TOKEN`, run SRTM on the Pune polygon, record the evidence in
   [`docs/data/VERIFICATION.md`](../data/VERIFICATION.md), and advance the source to
   `PROCESSING_TESTED` only if the run succeeds.
2. Copernicus STAC: authenticated asset download, pixel-level cloud masking and median NDVI.
3. CGWB assessment-unit join and groundwater category.
4. Dashboard wiring: replace static provenance with registry status and show stored
   observations with their coverage.
5. Add a refresh/health check so `runtime_status` reflects the deployment rather than a
   single ad-hoc run.

**Acceptance:** the Pune candidate shows a JRC water value and an SRTM terrain value, each
with source, dataset version, period, resolution, evidence class and coverage. No unconnected
source is displayed as `observed`, and Scope 2/CUE remain `SOURCE_UNAVAILABLE` until the P1
CEA connector lands.

---

## 13. What not to do

- Do not write twelve connectors before the data plane exists.
- Do not let connectors write scores.
- Do not store raw payloads only in memory.
- Do not use `0` for missing data.
- Do not show a confidence score that is not calculated.
- Do not mix design, declared and measured PUE/WUE/CUE in one number.
- Do not treat public context as authority evidence.
- Do not make Google Earth Engine the only access path.
- Do not use WDPA commercially without permission.
- Do not add more map layers before the metric pipeline works.

---

## 14. Bottom line

The data plane is built and two connectors are proven. The next thing to do is **finish the
P0 pair, add NDVI, and wire the results into the dashboard**, not connect all fourteen
sources at once.

The sequence is:

1. ~~canonical contract and source registry~~ — done;
2. ~~raw snapshot + ingestion run + observation tables~~ — done;
3. ~~connector protocol and fixture tests~~ — done;
4. ~~JRC Global Surface Water end-to-end~~ — done, live-verified;
5. ~~Copernicus STAC scene metadata end-to-end~~ — done, live-verified;
6. NASA SRTMGL1 end-to-end — implemented, waiting on an Earthdata token;
7. Sentinel-2 NDVI from authenticated assets — next;
8. ~~API-driven provenance and coverage in the UI~~ — done, Projects page;
9. then CGWB and the remaining sources in roadmap waves.

That sequence gives you accurate, precise, reproducible numbers — and it makes every later
connector a small, testable addition rather than a rewrite. Until a source is shown in the
dashboard with its provenance, it is not `INTEGRATED`, regardless of how well the connector
works in isolation. Display is necessary but not sufficient: `VALIDATED` still requires an
independent check of the values.
