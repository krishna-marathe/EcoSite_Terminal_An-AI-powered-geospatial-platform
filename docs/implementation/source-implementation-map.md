# Source-to-implementation map

Status: assessment only. No application behaviour was changed by this document.
Mapped: 2026-10-27, commit `0d19f0d`.
Source list: `data/sources.md` (India data-source and feasibility audit).
Product scope: **sustainability score dashboard only** (see
[capability mapping](data-centre-capability-mapping.md)).
Required-source selection: [required-data-sources.md](required-data-sources.md).

> **Update, 2026-10-27.** This map records the state at commit `0d19f0d`, before the data
> plane existed. Sections 1–3 are the historical assessment. Since then: a database-backed
> registry of 14 roadmap sources, a JRC Global Surface Water connector (live-verified on a
> Pune polygon, `PROCESSING_TESTED` / `NOT_CONNECTED`), an SRTM connector (implemented,
> awaiting an Earthdata token), ingestion/snapshot/observation tables, and a four-state ADM1
> scope gate were added. Current status is in
> [`data/data-sources.json`](../../data/data-sources.json) and
> [`docs/data/VERIFICATION.md`](../data/VERIFICATION.md), not in the counts below. The
> Projects page now displays stored observations with provenance, but no source is
> `INTEGRATED` because independent validation has not been performed.

## 1. Method and status legend

Every source named in `data/sources.md` was traced through the repository:

- `frontend/src/data/demo/provenance.ts` — static provenance catalogue.
- `frontend/src/data/demo/layers.ts` — map layer catalogue and provenance metadata.
- `frontend/src/data/demo/environmentalOverlays.ts` — bundled demo geometry.
- `frontend/src/data/demo/wmLayers.ts` — dashboard layer ribbon definitions.
- `frontend/src/utils/environmentalLayers.ts` — demo overlay registry and API state classifier.
- `backend/app/main.py` — environmental-layers endpoint, facilities, forecasts, news.
- `backend/app/geometry.py` + `backend/data/boundaries/` — India boundary screening.
- `shared/pilot.json` — synthetic facility records.
- `README.md` and `docs/` — claims and limitations.

| Status | Meaning |
| --- | --- |
| **Connected** | Code fetches or ingests data from the source at runtime. |
| **Placeholder** | An endpoint or layer entry exists but returns `unavailable`; no data is loaded. |
| **Demo** | Bundled synthetic geometry or records, explicitly labelled synthetic. |
| **Catalogue only** | Source metadata exists, but no data, geometry, or connector. |
| **Text only** | Mentioned in README/docs, not referenced by application code. |
| **Absent** | No meaningful reference in the repository. |

Important distinction: a source name appearing in a provenance record does **not** mean
the source is connected. In the current UI, demo overlay provenance is normalised to
`Bundled demonstration geometry` / `synthetic` (`frontend/src/data/demo/layers.ts:374-380`),
so the original provider names are not presented as evidence.

## 2. Summary

| Status | Count | Sources |
| --- | --- | --- |
| Connected | 0 | No environmental or utility source is connected. |
| Placeholder | 3 | CPCB air quality, Bhuvan land use, Bhuvan flood, CGWB groundwater (four entries, three organisations). |
| Demo | 6 | CGWB groundwater, CPCB air, MODIS/Bhuvan heat, NDMA flood, WII protected areas, transmission grid. |
| Catalogue only | 6 | CEA CO2, CWC reservoirs, IMD climate, WII, NDMA, CGWB (metadata only beyond the demo overlay). |
| Text only | 8 | Sentinel-2, Bhuvan, Bhoonidhi, Earth Engine, SRTM, JRC, NRSC flood atlas, PARIVESH, PM GatiShakti, DISCOM/STU, water authority, zoning. |
| Absent | 12+ | Sentinel-2, Bhoonidhi, Earth Engine, SRTM/NASADEM, JRC GSW, NRSC flood atlas, NWDP, Data.gov, NPP, DISCOM/STU, water authority, PARIVESH, PM GatiShakti, zoning. |

The counts overlap because one source can have catalogue metadata and a demo overlay but
no connector. The actionable conclusion is simple: **there are zero connected
environmental data sources**.

## 3. Master mapping — sources named in `data/sources.md`

### 3.1 Satellite, terrain and land

| Source (sources.md) | Current status | Where in the implementation | What actually exists | Gap |
| --- | --- | --- | --- | --- |
| **Copernicus Sentinel-2** | Connector implemented; scene metadata live-verified | `backend/app/data/connectors/copernicus_stac.py`; registry entry `copernicus_stac`. | Anonymous CDSE STAC search, pagination, scene deduplication and cloud-cover summary; live Pune run returned 90 scenes and stored seven observations. | No asset download, cloud masking or NDVI yet; `PROCESSING_TESTED` / `NOT_CONNECTED` and not in the dashboard. |
| **ISRO Bhuvan** (WMS/WMTS thematic layers) | Placeholder + catalogue only | `backend/app/main.py:321-328` lists `bhuvan-land-use` and `bhuvan-flood-hazard` as `unavailable`; `frontend/src/data/demo/provenance.ts:78-92` catalogues LULC. | Two unavailable backend entries; a demo LULC catalogue entry; no WMS request. | No WMS/WMTS client, no GetCapabilities validation, no geometry. |
| **ISRO Bhoonidhi** | Absent | No code reference. | Nothing. | No bearer-token STAC client; access not tested. |
| **Google Earth Engine** | Absent | No code reference. | Nothing. | No GEE dependency; optional compute layer only. |
| **NASA SRTM / NASADEM** | Connector implemented; live-verified | `backend/app/data/connectors/srtm.py`; registry entry `nasa_srtmgl1`. | Authenticated Earthdata tile fetch, HGT parse, elevation/relief/slope/void statistics, fixture tests; live Pune run fetched `N18E073` and stored seven observations. | `PROCESSING_TESTED` / `CONNECTED`, on demand only. Screening terrain context, not a site survey, and not independently validated. |
| **JRC Global Surface Water** | Connected connector; not in dashboard | `backend/app/data/connectors/jrc_gsw.py`; registry entry `jrc_gsw`. | Candidate-tile fetch, GeoTIFF parse, occurrence overlap/mean/max, proximity and valid-pixel coverage; live Pune run produced five observations. | Values are stored but not shown in the UI; no refresh schedule, so `runtime_status` is `NOT_CONNECTED`. |
| **NRSC Flood Affected Area Atlas** | Absent | No code reference. The current catalogue uses **NDMA** flood data instead (`provenance.ts:108-122`). | A demo NDMA-labelled flood polygon (`environmentalOverlays.ts:234-283`). | Wrong dataset for the sources.md recommendation; no NRSC 1998–2022 atlas. |
| **MODIS LST** | Demo + catalogue only | `frontend/src/data/demo/layers.ts:199-217` (surface temperature layer), `environmentalOverlays.ts:181-232` (synthetic heat polygons), `wmLayers.ts:82-92` (source string, overridden). | Two synthetic heat polygons labelled as illustrative geometry. | No MODIS granule, no LST anomaly calculation, no observation dates. |

### 3.2 Water, groundwater and hydrology

| Source (sources.md) | Current status | Where in the implementation | What actually exists | Gap |
| --- | --- | --- | --- | --- |
| **CGWB Dynamic Ground Water Resources** | Placeholder + demo + catalogue | `backend/app/main.py:321-328` (`cgwb-groundwater`, unavailable); `provenance.ts:17-32`; `layers.ts:160-179`; `environmentalOverlays.ts:4-124`. | Five synthetic groundwater polygons; a catalogue entry; an unavailable backend layer. | No CGWB assessment-unit ingestion, no spatial join to a candidate polygon, no 2025 assessment update. |
| **National Water Data Portal / CGWB telemetry** | Absent | No code reference. | Nothing. | No station-level groundwater time series. |
| **NWDP / CWC / IMD rainfall, river levels, discharge** | Absent for NWDP; catalogue for CWC | `provenance.ts:63-77` catalogues CWC reservoir storage; no NWDP code. | A CWC catalogue entry only. | No NWDP API/CSV ingestion, no river-level or discharge series. |
| **CWC reservoir storage** | Catalogue only | `provenance.ts:63-77`; `wmLayers.ts:115-125` (source string, overridden). | Metadata only. | No reservoir geometry or live storage. |
| **Water authority / ULB / groundwater allocation** | Absent | No code reference. Phase records capture water demand only (`backend/app/models/phases.py:24-25`). | Demand inputs, no allocation. | No allocation, permit, or verified supply field. |

### 3.3 Weather, climate and air

| Source (sources.md) | Current status | Where in the implementation | What actually exists | Gap |
| --- | --- | --- | --- | --- |
| **IMD operational weather / warnings** | Absent | No code reference. | Nothing. | No IMD API client; sources.md notes anonymous access returned 401. |
| **IMD Climate Hazard & Vulnerability Atlas** | Catalogue only (different dataset) | `provenance.ts:123-137` catalogues a gridded meteorological database, not the hazard atlas. | Metadata only. | Wrong dataset for the recommendation; no district hazard layer. |
| **CPCB via Data.gov.in (CAAQMS)** | Placeholder + demo + catalogue | `backend/app/main.py:321-328` (`cpcb-air-quality`, unavailable); `provenance.ts:33-47`; `layers.ts:180-198`; `environmentalOverlays.ts:126-179`. | Two synthetic air-quality polygons; a catalogue entry; an unavailable backend layer. | No Data.gov API key, no station ingestion, no station-distance or representativeness logic. |
| **Data.gov.in / OGD platform** | Absent as an integration | No code reference. | Nothing. | No API-key handling, no catalogue client, no licence metadata. |

### 3.4 Power and infrastructure

| Source (sources.md) | Current status | Where in the implementation | What actually exists | Gap |
| --- | --- | --- | --- | --- |
| **CEA / National Power Portal** | Catalogue only | `provenance.ts:48-62` (CEA CO2 database); `layers.ts:25-43` (thermal power, CEA); `wmLayers.ts:49-70` (source strings, overridden). | Metadata only. | No CEA API/NPP ingestion; no grid emission factor table; no transmission capacity data. |
| **DISCOM / STU grid evidence** | Absent (proxy only) | Legacy point assessment computes distance to synthetic substations (`backend/app/main.py:366-378`); no headroom. | Approximate substation distance. | No sanctioned MW, feeder limit, transformer loading, or utility evidence. Proximity is not capacity. |
| **PM GatiShakti Public** | Absent | No code reference. | Nothing. | No integration; registration/2FA access not attempted. |

### 3.5 Land, biodiversity and regulatory

| Source (sources.md) | Current status | Where in the implementation | What actually exists | Gap |
| --- | --- | --- | --- | --- |
| **WII National Wildlife Database** | Demo + catalogue | `provenance.ts:93-107`; `layers.ts:275-293`; `environmentalOverlays.ts:285+`. | Two synthetic protected-area polygons. | No WII geometry, no legal notification reconciliation, no ESZ verification. |
| **PARIVESH** | Absent | No code reference. | Nothing. | No clearance-status reference, no workflow integration. |
| **State/local planning authority zoning** | Absent | No code reference. Candidate sites store user-supplied `state_code` and `district` only (`backend/app/models/sites.py:22-23`). | User-entered state/district. | No zoning, permitted-use, or planning-authority data. |
| **State data-centre policies** (Maharashtra 2023, Karnataka 2022–27, UP 2026, Tamil Nadu 2021 expired, West Bengal 2021 expired) | Absent | No code reference. | Nothing. | No rule pack, no effective dates, no policy versioning. Out of scope for the score dashboard. |
| **NITI Aayog Data Centre Evaluation Framework** | Text only | `data/sources.md`; capability mapping. | Reference only. | No implementation; guidance, not a data source. |
| **BEE / BIS / MeitY PUE-WUE-CUE standards** | Absent | No code reference. | Nothing. | No measurement-boundary or benchmark fields. |

### 3.6 Source-access findings from `data/sources.md`

| Source | Access result recorded in sources.md | Current implementation response |
| --- | --- | --- |
| Copernicus CDSE STAC | Anonymous STAC JSON confirmed working | No client; not used. |
| NWDP | Partial CSV/API access | No client; not used. |
| IMD | Anonymous request returned HTTP 401 | No client; not used. |
| Bhuvan | Documented WMS/WMTS; not runtime-validated | Placeholder only. |
| Bhoonidhi | Token-gated; not authenticated | Absent. |
| Data.gov / CPCB | API key required | Placeholder only. |
| Google Earth Engine | Paid for operational commercial/government use | Absent; optional. |
| DISCOM/STU, water authority, zoning | No public national dataset | Absent; manual evidence only. |

## 4. Sources used by the current implementation but **not** in `data/sources.md`

| Source / dataset | Status | Where | Notes |
| --- | --- | --- | --- |
| **gbOpen India ADM0 boundary** | Connected (bundled file) | `backend/data/boundaries/IND-ADM0-9469f09.geojson`, `backend/app/geometry.py` | Used for candidate-polygon containment and 5 km review band. Not in sources.md. |
| **Google News RSS** | Connected (server-side) | `backend/app/main.py:331-356` | Powers the policy news panel. Not in sources.md; returns 503 when unreachable. |
| **PowerGrid / NLDC** | Catalogue only | `layers.ts:120-138`, `wmLayers.ts:60-70` | Transmission-line metadata; demo geometry only. |
| **MNRE** | Catalogue only | `layers.ts:63-81`, `wmLayers.ts:126-136` | Solar/wind layer metadata; no data. |
| **NIWE** | Catalogue only | `layers.ts:82-100` | Wind layer metadata; no data. |
| **DPIIT** | Catalogue only | `layers.ts:139-157` | Industrial cluster metadata; no data. |
| **Census / WorldPop** | Catalogue only | `layers.ts:256-274` | Population layer metadata; pilot population values are zero. |
| **UrbanEmissions** | Catalogue only | `layers.ts:180-198` | Air-quality metadata; no data. |
| **Sentinel-3** | Text/catalogue only | `layers.ts:199-217`, `wmLayers.ts:82-92` | Mentioned with MODIS for heat; no data. |
| **EcoSite ML / CMIP6** | Catalogue only (synthetic) | `provenance.ts:138-152`; `layers.ts:295-371` | Explicitly synthetic; no trained model. |
| **NDMA flood atlas** | Demo + catalogue | `provenance.ts:108-122`; `environmentalOverlays.ts:234-283` | Different from the NRSC atlas recommended in sources.md. |

## 5. Source-level findings

### 5.1 There are no connected environmental sources

The only runtime data paths are:

1. Synthetic facilities from `shared/pilot.json` seeded into SQLite.
2. The bundled gbOpen boundary for polygon screening.
3. Google News RSS for headlines.
4. Synthetic frontend overlays in demo mode.
5. Synthetic forecast arithmetic.

Everything else is metadata, a placeholder, or a demo polygon.

### 5.2 The provenance catalogue overstates reality

`frontend/src/data/demo/provenance.ts` marks eight external datasets as `observed` with
confidence scores of 88–96, but none is connected. This is the most important trust defect
for a score dashboard: a user can see a source badge and assume live evidence.

Recommended correction:

- Add `connectionStatus: 'connected' | 'catalogue_only' | 'demo' | 'unavailable'`.
- Mark all current external records `catalogue_only`.
- Remove or qualify confidence scores until data is actually ingested.
- Show observation date and last-checked date separately from publication date.

### 5.3 The backend placeholder is honest but narrow

`GET /api/v1/environmental-layers` returns four entries, all `isAvailable: false` and
`dataStatus: "unavailable"`:

- `cpcb-air-quality`
- `bhuvan-land-use`
- `bhuvan-flood-hazard`
- `cgwb-groundwater`

This is correct behaviour, but it is only four of the sources in `data/sources.md`. It
does not include Sentinel-2, SRTM, JRC, NRSC flood, NWDP, IMD, MODIS, CEA/NPP, WII,
PARIVESH, or PM GatiShakti.

### 5.4 Demo overlays are correctly labelled but source names are misleading

`docs/environmental-overlays.md` documents that all six rendered overlays are bundled
illustrations. `layers.ts:374-380` normalises their provenance to
`Bundled demonstration geometry` / `synthetic`. This is good.

However, the original layer catalogue still contains provider names and confidence scores
(CGWB, CPCB, NDMA, WII, MODIS, etc.), and `wmLayers.ts` contains source strings such as
"CGWB", "CPCB", "NDMA", "WII". The ribbon overrides these with
"Current facility records — consult individual provenance"
(`wmLayers.ts:151`), so they are not displayed. Keep it that way; do not reintroduce
provider names without data.

### 5.5 The source registry is not a registry

`provenance.ts` has 9 entries (8 external + 1 synthetic). The README claims 14 official
feeds. It has no fields for:

- licence / redistribution permission;
- cache permission;
- spatial and temporal coverage;
- observation date vs publication date;
- last checked;
- access method / auth type;
- dataset version;
- quality notes.

For a score dashboard, these are required before any source can influence a score.

### 5.6 Data-source coverage is city-scoped, not India-wide

The legacy facility, forecast, and risk modules are restricted to `pune` and `mumbai`
(`backend/app/main.py:33`, `shared/pilot.json`). Candidate polygons are India-wide via the
gbOpen boundary, but the dashboard's environmental data is not. This is acceptable for a
pilot; it is a gap for an India-wide source map.

## 6. Recommended source roadmap

### P0 — sources that can support the score dashboard soon

| Source | Dashboard use | First step |
| --- | --- | --- |
| **Copernicus Sentinel-2** | Land-cover composition/change around a site | CDSE STAC search + scene metadata; no download required for a first demo. |
| **CGWB assessment** | Groundwater stress context | Ingest assessment-unit polygons; spatial join to candidate polygon. |
| **NRSC Flood Affected Area Atlas** | Historical flood exposure | Ingest atlas geometry; report overlap percentage, not probability. |
| **NASA SRTM** | Terrain/slope screening | DEM tile sampling for the polygon. |
| **JRC Global Surface Water** | Historical water presence | Occurrence layer sampling. |
| **CEA CO2 database** | Grid emission factor context | Annual factor table; location-based Scope 2. |
| **CPCB / Data.gov** | Air-quality context | API key + station list; show distance and missing fraction. |
| **IMD** | Heat/weather context | Resolve authentication; district hazard atlas. |

### P1 — valuable, but access or coverage is less certain

- **Bhuvan WMS/WMTS** — validate GetCapabilities, then add LULC/flood layers.
- **Bhoonidhi** — obtain token; use only if Sentinel-2 CDSE is insufficient.
- **NWDP** — groundwater-level and rainfall time series where stations exist.
- **MODIS LST** — land-surface temperature anomaly (not air temperature).
- **WII** — protected-area screening with legal-confirmation language.
- **PARIVESH** — reference link/status only; not an approval engine.
- **PM GatiShakti** — context only; registration/2FA required.

### P2 — manual or out of scope for the score dashboard

- **DISCOM/STU** — site-level headroom; cannot be replaced by public data. If included,
  make it a declared/verified input, not a satellite-derived score.
- **Water authority** — allocation; keep separate from CGWB stress.
- **Zoning** — local planning authority; manual input.
- **State policy packs** — out of scope for the dashboard; could be a reference panel.
- **NITI framework** — guidance, not a data source.

## 7. Acceptance criteria for adding any source

A source may influence a score only when all of the following are true:

1. **Identity**: provider, dataset, version, and official URL are recorded.
2. **Access**: the connector works from the deployment environment; auth is server-side.
3. **Licence**: `can_cache` and `can_redistribute` are explicitly set.
4. **Coverage**: spatial/temporal coverage is known and displayed.
5. **Date**: observation date and last-checked date are stored.
6. **Resolution**: spatial/temporal resolution is displayed; no parcel-level implication.
7. **Status**: `observed`, `estimated`, `synthetic`, or `unavailable` is explicit.
8. **Failure**: a failed fetch shows unavailable and never substitutes synthetic data.
9. **Method**: any derived metric has a documented formula and units.
10. **Score link**: the source's contribution to the sustainability score is visible and
    versioned.

## 8. Bottom line

The repository currently has **source metadata, demo geometry, and honest placeholders**,
but **no connected environmental data source**. For a sustainability score dashboard, the
highest-value next step is not more map layers; it is:

1. correct the provenance catalogue so `catalogue_only` is not shown as `observed`;
2. add a real source registry with licence, coverage, and dates;
3. connect one P0 source end-to-end (Sentinel-2 land cover or CGWB groundwater);
4. add the deterministic metric that uses it;
5. show the metric, source date, coverage, and score contribution together.

That sequence keeps the dashboard honest and makes every source addition measurable.
