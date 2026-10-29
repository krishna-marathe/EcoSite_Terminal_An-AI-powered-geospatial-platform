# Roadmap alignment — data sources and implementation order

Status: reconciliation record. Date: 2026-10-27.
Governing document: [`roadmap.md`](../../roadmap.md), sections 8–9 and Phase D.
Product scope: **sustainability score dashboard only** (unchanged).

The user directed that `roadmap.md` governs the data sources and the plan. This note records
what that changes, what it does not change, and what is now implemented.

---

## 1. What the roadmap governs

| Area | Adopted from `roadmap.md` |
| --- | --- |
| Source priority | P0: JRC Global Surface Water, NASA SRTMGL1, Copernicus STAC (Sentinel-2), CGWB assessments, developer design evidence. P1: NWDP, Bhuvan, CPCB/OGD AQI, CEA, Census 2011, OpenStreetMap. P2: IMD, NRSC, local utility evidence. |
| Build order | JRC + SRTM first, then Sentinel-2, then CGWB. |
| Registry fields | `source_id`, provider, dataset, `data_category`, priority, URL and exact endpoint, access method, authentication, licence and attribution, redistribution, coverage, resolution, observation period, latest release, join key, `test_status`, fallback, owner, next action. |
| Maturity gates | Discovered → Access tested → Processing tested → Validated → Integrated. A portal link is not access. |
| Observation contract | Dataset version, period, geometry hash, method, unit, spatial resolution, coverage, quality flags, missing-data reason, processing version. |
| Retrieval rule | Do not download India-wide archives. Request only candidate-site tiles and configurable buffers, cache them, and store the source version. |
| Failure rule | Return `SOURCE_UNAVAILABLE`; never substitute zero, a green value, or synthetic data. |
| Geographic scope | **Telangana, Maharashtra, Karnataka and Tamil Nadu only.** Candidate sites outside these four states are rejected by the local API. |

## 2. What the roadmap does not change

The earlier product decision still holds: EcoSite Terminal is a **sustainability score
dashboard**. The roadmap's wider programme — evidence graph, document AI, state rule packs,
readiness engines, site comparison and the Site Readiness Passport — is **not** being built
here. Those are separate products.

This note adopts the roadmap's data strategy, not its full product scope.

## 3. Conflicts resolved

| Topic | Earlier plan | Roadmap | Resolution |
| --- | --- | --- | --- |
| First connector | CEA CO2 v22.0 | JRC GSW + SRTM | Roadmap wins. JRC and SRTM are built first. |
| Second connector | NASA POWER | Sentinel-2 (Copernicus STAC) | Roadmap wins. NASA POWER is not in the roadmap's P0/P1 list and is deferred. |
| Terrain | Copernicus DEM GLO-30 in Tier A; SRTM as fallback | SRTMGL1 is P0 | Roadmap wins. SRTM is the primary terrain source; Copernicus DEM remains a fallback. |
| Historical water | JRC GSW in Tier B | JRC GSW is P0 | Roadmap wins. JRC is the first connector. |
| Carbon factor | CEA CO2 required for Scope 2 and CUE | CEA is P1 | Roadmap wins on order. Scope 2 and CUE remain `UNAVAILABLE` until the CEA connector lands; they are not estimated. |
| Rainfall | IMD in Tier A | IMD is P2 | Roadmap wins. Rainfall context waits for P2; no substitute is scored. |
| Source registry shape | 12 Tier A sources, custom fields | Roadmap field set and gates | Roadmap wins. The registry and JSON catalogue use the roadmap fields. |

### Accepted consequence

The first release will **not** show a carbon number. Scope 2 and CUE stay
`SOURCE_UNAVAILABLE` with a reason until CEA is connected. That is deliberate: an official
annual grid factor is the only defensible input, and inventing one would break the
accuracy rules.

## 4. Implemented in this change

| Item | Location |
| --- | --- |
| Roadmap-aligned source registry (14 sources) | `backend/app/data/registry.py` |
| Dataset catalogue with the four-state scope | `data/data-sources.json` |
| Catalogue generator (JSON + CSV) | `backend/scripts/export_catalogue.py` |
| Human-readable registry for the data lead | `docs/data/DATA_SOURCE_REGISTRY.csv` |
| SQLAlchemy models for sources, runs, snapshots, observations, authority evidence, metrics and scores | `backend/app/data/models.py` |
| API schemas | `backend/app/data/schemas.py` |
| Read-only registry API | `backend/app/routers/data_sources.py` |
| JRC Global Surface Water connector | `backend/app/data/connectors/jrc_gsw.py` |
| Copernicus STAC scene-metadata connector | `backend/app/data/connectors/copernicus_stac.py` |
| NASA SRTMGL1 connector | `backend/app/data/connectors/srtm.py` |
| Shared raster helpers | `backend/app/data/connectors/raster.py` |
| Ingestion orchestration, snapshots, idempotent observations | `backend/app/data/ingest.py` |
| Local environmental-analysis API | `backend/app/routers/environmental.py` |
| Four-state screening boundary and gate | `backend/app/state_scope.py`, `backend/data/boundaries/IND-ADM1-4states*` |
| Migration | `backend/migrations/versions/03a_001_data_plane.py` |
| Tests | `backend/tests/test_data_sources.py`, `test_environmental_connectors.py`, `test_state_scope.py` |
| Live verification record | `docs/data/VERIFICATION.md` |

Endpoints:

- `GET /api/v1/data-sources` — full registry, totals and the four-state scope.
- `GET /api/v1/data-sources?priority=P0` — filtered view that still reports full totals.
- `GET /api/v1/data-sources/{source_id}` — one source plus recent ingestion runs.
- `GET /api/v1/data-sources/scope` — the four focus states and the pinned boundary version.
- `POST /api/v1/sites/{site_id}/environmental-analysis` — local-only, candidate-tile fetch
  and parse for the implemented connectors.
- `GET /api/v1/sites/{site_id}/observations` — stored observations with provenance.

## 5. Current verification state

| Source | `test_status` | `runtime_status` | Evidence |
| --- | --- | --- | --- |
| `jrc_gsw` | `PROCESSING_TESTED` | `CONNECTED` | Live Pune runs on 2026-10-27 produced five observations from the 70E/20N tile with 100% valid-pixel coverage. The dev database now holds a Pune candidate with these observations; no refresh schedule exists. |
| `copernicus_stac` | `PROCESSING_TESTED` | `CONNECTED` | Live Pune searches returned 90 Sentinel-2 L2A scenes and stored seven scene-metadata observations. No pixels or NDVI were processed. On-demand only; no schedule. |
| `nasa_srtmgl1` | `PROCESSING_TESTED` | `CONNECTED` | Live Pune run on 2026-10-29 fetched the authenticated `N18E073` tile (12,646,090 bytes) and stored seven terrain observations with 100% valid-pixel coverage and no voids. Screening terrain context, not a site survey; on demand only. |
| Everything else | `DISCOVERED` | `NOT_CONNECTED` | No live access or processing run. |

The live JRC run is recorded in [`docs/data/VERIFICATION.md`](../data/VERIFICATION.md) with
the request, tile, byte count, checksum, observation values and coverage. SRTM is deliberately
not advanced until a real authenticated tile produces an observation.

## 6. Geographic scope: four states only

The product is limited to **Telangana, Maharashtra, Karnataka and Tamil Nadu**. This is
enforced at three levels:

1. `SiteCreate` and `SitePatch` accept only `IN-TG`, `IN-MH`, `IN-KA` and `IN-TN`.
2. The polygon must be covered by the declared state in the pinned geoBoundaries ADM1
   screening layer. A polygon in another state, outside all four, or crossing a state
   boundary is rejected with `state_scope`.
3. The environmental-analysis endpoint refuses a legacy candidate whose `state_code` is
   outside the four states.

The boundary is a screening dataset, not a legal determination. Its provenance and checksum
are in `backend/data/boundaries/IND-ADM1-4states-manifest.json`. A site within 1 km of a state
boundary is saved with `boundary_screening.state_scope.status = "review_required"`.

The Pune/Mumbai pilot remains the only seeded city extent. The other three states are
supported for local candidate polygons, but no city-level pilot data has been invented for
them.

## 7. Next step

1. **NASA SRTMGL1** — obtain an Earthdata token, run the authenticated tile request for the
   same Pune polygon, and record elevation, slope, relief and void fraction. Do not advance
   the maturity gate until that run succeeds.
2. **Copernicus STAC / Sentinel-2** — scene search and cloud-cover metadata are delivered.
   Next: authenticated asset download, pixel-level cloud masking and median NDVI. Do not
   label scene metadata as land cover.
3. **CGWB assessment** — assessment-unit boundaries and groundwater category.
4. **CEA** — the annual CO2 factor for Scope 2/CUE. Until then, both remain
   `SOURCE_UNAVAILABLE`; they are not estimated.
5. **Dashboard wiring** — the Projects page now exposes stored observations, provenance,
   missing reasons and per-source run failures. No source claims `INTEGRATED` yet because
   independent validation (`VALIDATED`) has not been performed.
