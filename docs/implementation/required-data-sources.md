# Required data sources for the sustainability score dashboard

Status: source selection and feasibility register.
Date: 2026-10-27.
Product scope: **sustainability score dashboard only**.
Geographic scope: **Telangana, Maharashtra, Karnataka and Tamil Nadu only.** Candidate
polygons outside these four states are rejected by the local API; the four-state ADM1
screening layer and its limitations are documented in
[`backend/data/boundaries/README.md`](../../backend/data/boundaries/README.md).
Companion documents:
[source-to-implementation map](source-implementation-map.md) (what exists today),
[capability mapping](data-centre-capability-mapping.md) (score design and roadmap),
[live verification record](../data/VERIFICATION.md) (what was actually exercised).

This document answers one question: **which data sources does the dashboard actually
need to produce an accurate, defensible sustainability score?**

It does not treat every source named in `data/sources.md` as required. A source is
included only if it feeds a sub-score or a hard constraint, is authoritative or
methodologically documented, can be accessed repeatably, has a usable licence, and has a
precision that can be stated honestly in the UI.

`data/sources.md` remains the research reference. This is the selection register built on
top of it.

**Build order is governed by `roadmap.md` §8, not by the table order below.** The roadmap
starts with JRC Global Surface Water and NASA SRTMGL1, then Copernicus Sentinel-2, then
CGWB. CEA, NWDP, Bhuvan, CPCB, Census and OpenStreetMap are P1; IMD and NRSC are P2.
The tiers here describe coverage, not sequence. See
[roadmap-alignment.md](roadmap-alignment.md) for the conflicts and accepted trade-offs.

---

## 1. Selection rule

A source is **needed** when all six conditions hold:

1. **Metric link** — it supplies an input to one of the six sub-scores, or to a hard
   constraint.
2. **Credibility** — it is published by the competent authority, a peer-reviewed
   programme, or a documented modelling effort.
3. **Access** — it has an API, a stable download, or a repeatable manual process.
4. **Licence** — reuse and, where relevant, commercial use are permitted.
5. **Precision** — its spatial/temporal resolution and error characteristics are known
   and can be displayed.
6. **Failure behaviour** — if it is unavailable, the dashboard can show `unavailable`
   without substituting synthetic data.

A source that fails any of these can still be shown as **context**, but it must not
influence the score.

---

## 2. Source hierarchy

Not all evidence has equal authority. The dashboard should rank inputs in this order:

| Rank | Evidence class | Example | Score use |
| --- | --- | --- | --- |
| 1 | Measured / metered | Facility meter, water flow meter, fuel log | Direct score input |
| 2 | Authority-verified | DISCOM sanction, water allocation, consent | Direct score input |
| 3 | Declared / documented | Design PUE, DPR, cooling design | Qualified input; labelled declared |
| 4 | Official geospatial layer | CGWB assessment unit, WDPA, Census | Context input |
| 5 | Remote-sensing observation | Sentinel-2 land cover, MODIS LST | Context input; never legal proof |
| 6 | Modelled / reanalysis | NASA POWER, ERA5, Aqueduct | Context input; uncertainty stated |
| 7 | Crowd-sourced / predicted | OSM, GridFinder | Proximity context only |
| 8 | Synthetic / demo | Bundled demo polygons | UI demonstration only; never scored |

A high aggregate score must never override a missing rank-1 or rank-2 input.

---

## 3. Tier A — minimum viable source stack

These twelve public sources are enough to produce a credible first version of the six
sub-scores. They are listed with the metric they unlock and the precision limit that must
be shown in the UI. **This is a coverage register, not the build order.** The roadmap's P0
sequence is JRC → SRTM → Sentinel-2 → CGWB.

The **Repo status** column records the pre-registry state of this review. Current maturity
(`test_status`, `runtime_status`) is tracked in
[`data/data-sources.json`](../../data/data-sources.json) and
[`DATA_SOURCE_REGISTRY.csv`](../data/DATA_SOURCE_REGISTRY.csv); only `jrc_gsw` and
`copernicus_stac` have passed a live processing test, and neither is in the dashboard yet.

| # | Source | Sub-score / metric | Provider | Access | Licence | Precision and limit | Repo status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | **CEA CO2 Baseline Database v22.0** | Energy & carbon: Scope 2, CUE | Central Electricity Authority, Ministry of Power | XLSX download, annual. Page verified: `cea.nic.in/cdm-co2-baseline-view?mappingId=234&lang=en` | Government of India publication; confirm GODL/NDSAP before redistribution | National weighted-average grid factor. CEA v22.0 reports one unified Indian grid (the five regional grids merged in December 2013); annual, not nodal or hourly | Bundled workbook verified by cell; no connector yet |
| A2 | **CEA / National Power Portal** | Energy & carbon: RE share context; Grid: state/regional capacity | CEA / NPP | Reports, APIs, GIS dashboards: `cea.nic.in`, `npp.gov.in` | Government of India | State/regional; never site-level headroom | Catalogue only |
| A3 | **NASA POWER** | Energy & carbon: cooling degree days; Water: rainfall, wet-bulb; Heat: air temperature, humidity | NASA Langley | REST API, no authentication: `power.larc.nasa.gov/docs/services/api/` | No restrictions on use, access or download | Modelled/reanalysis meteorology at roughly 0.5° × 0.625°; daily/hourly; not a station measurement | Absent |
| A4 | **CGWB Dynamic Ground Water Resources** | Water: basin stress | CGWB, Ministry of Jal Shakti | Assessment reports and GIS: `cgwb.gov.in` | Government of India | Assessment unit (block/tehsil), annual; latest national assessment 2025; stress is not allocation | Placeholder + demo |
| A5 | **India-WRIS** | Water: basin/sub-basin, water bodies, reservoir, groundwater context | CWC / ISRO / NWIC | Portal download: `indiawris.gov.in/wris/`; public API not confirmed in this review | Per-resource; verify each dataset | Basin/sub-basin scale; freshness varies by resource | Absent |
| A6 | **National Water Data Portal (NWDP)** | Water: groundwater levels, rainfall, river levels | NWIC / CGWB / CWC / IMD | CSV/API per dataset: `nwdp.nwic.gov.in` | Per-resource; some resources display "No License Provided" | Station-level; geographical coverage varies | Absent |
| A7 | **IMD gridded rainfall 0.25°** | Water: rainfall and recharge context | India Meteorological Department, Pune | NetCDF download: `imdpune.gov.in/cmpg/Griddata/Rainfall_25_NetCDF.html` | Government of India; verify redistribution terms | 0.25° daily, 1901–2024; interpolated from stations, not a site gauge | Absent |
| A8 | **HydroSHEDS / HydroBASINS** | Water: basin boundary for spatial join | WWF / HydroSHEDS | Shapefile/GeoPackage: `hydrosheds.org/products/hydrobasins` | v2 core products CC BY 4.0; v1 has a specific licence | Sub-basin polygons, roughly 500 m–1 km; used to assign a site to a basin | Absent |
| A9 | **MODIS LST (MOD11A1 / MYD11A1)** | Heat: land-surface temperature anomaly | NASA LP DAAC | Earthdata download/API; direct access, not only Earth Engine | NASA open data | 1 km daily; **surface** temperature, not air temperature | Demo only |
| A10 | **Sentinel-2 via CDSE STAC** | Community & land: land-cover composition and change | ESA / Copernicus | STAC API; anonymous search confirmed: `catalogue.dataspace.copernicus.eu/stac` | Free, full and open; registration for download | 10/20/60 m; 5-day revisit; cloud cover and observation date must be shown | Absent |
| A11 | **Copernicus DEM GLO-30** | Community & land: terrain and slope | ESA / Airbus | CDSE download; registration: `dataspace.copernicus.eu` | Copernicus licence | 30 m digital surface model; global; includes buildings/vegetation | Absent (SRTM is named in `sources.md`) |
| A12 | **WorldPop** | Community & land: population exposure | WorldPop, University of Southampton | REST API / STAC: `worldpop.org/sdi/introapi/`, `stac.worldpop.org` | CC BY 4.0 | 100 m gridded modelled population; annual; not a census count | Absent |

### Why these twelve

They cover the score's material inputs:

- **Carbon and CUE** are impossible without A1. No other public source gives an official
  India grid emission factor.
- **Water stress and water context** need A4–A8. CGWB gives the regulatory stress class;
  India-WRIS/NWDP give basin and station context; HydroSHEDS supplies the spatial join;
  IMD rainfall gives recharge context.
- **Heat** needs A3 and A9 together. LST alone is not air temperature, and air temperature
  alone is not surface heat.
- **Land and community** need A10–A12. Sentinel-2 gives current condition and change;
  Copernicus DEM gives terrain; WorldPop gives exposure.
- **Grid context** needs A2. It cannot give headroom, but it prevents the dashboard from
  pretending that proximity equals capacity.

---

## 4. Tier B — recommended next

These sources improve coverage, cross-checking, or precision. They are not required for
the first score release, but they close known gaps.

| # | Source | Use | Why not Tier A | Access / licence |
| --- | --- | --- | --- | --- |
| B1 | **WRI Aqueduct 4.0** | Water stress, seasonal variability, drought and flood risk | Catchment-level global model; complements, but does not replace, CGWB assessment units | `wri.org/aqueduct/data`; CC BY 4.0 |
| B2 | **ESA WorldCover 10 m** | Land-cover baseline (2020/2021) | Static baseline; Sentinel-2 is needed for change | `esa-worldcover.org/en/data-access`; CC BY 4.0 |
| B3 | **WDPA / Protected Planet** | Protected-area screening | Non-commercial licence; token required; may lag Indian notifications | `protectedplanet.net`; API v4 token; **non-commercial use only unless permission** |
| B4 | **WII National Wildlife Database** | India-specific protected-area and ESZ confirmation | Not machine-readable; legal confirmation still required | `v1.wii.gov.in/nwdc_aboutus`; verify reuse terms |
| B5 | **NRSC Flood Affected Area Atlas** | Historical flood exposure 1998–2022 | Published as an atlas/PDF; machine-readable geometry not confirmed; historical occurrence is not return-period probability | `nrsc.gov.in`; Government of India |
| B6 | **JRC Global Surface Water** | Historical surface-water presence 1984–2024 | **Roadmap P0.** Historical only; not predictive; build first alongside SRTM | JRC download portal / Earth Engine; free with attribution |
| B7 | **OpenStreetMap / Overpass API** | Transmission lines, substations, land use, settlements | Crowd-sourced; not utility records; completeness varies | `wiki.openstreetmap.org/wiki/Overpass_API`; ODbL 1.0 |
| B8 | **GridFinder / World Bank** | Predicted transmission and distribution network | Modelled from night lights and OSM; validated at coarse resolution; not capacity | `gridfinder.rdrn.me`; World Bank open data |
| B9 | **CPCB via Data.gov.in** | Air-quality context | API key required; station representativeness varies | `data.gov.in/catalog/real-time-air-quality-index`; NDSAP/GODL |
| B10 | **OpenAQ** | Air-quality fallback and cross-check | Aggregated from providers with different licences; not an official Indian baseline | `docs.openaq.org`; API key; provider-specific licences |
| B11 | **Sentinel-5P TROPOMI** | NO₂, SO₂, aerosol context | Satellite column, not ground-level concentration | CDSE; free/open |
| B12 | **CPCB EPR e-waste portal** | Circularity context | Aggregate compliance data, not facility-level recovery | `eprewaste.cpcb.gov.in`; registration |
| B13 | **Census of India 2011** | Population ground truth | 2011 and boundary-based; use with WorldPop | `censusindia.gov.in`; GODL/NDSAP |
| B14 | **IMD Climate Hazard & Vulnerability Atlas** | District heat and climate hazard | District-scale, not site measurement | IMD; Government of India |
| B15 | **MNRE state renewable capacity** | RE share context | State-level; not contractual supply | `mnre.gov.in`; Government of India |
| B16 | **Sentinel-3 SLSTR** | LST alternative / cross-check | 1 km; redundant with MODIS for most uses | CDSE; free/open |

---

## 5. Tier C — context only, or not needed

These appear in `data/sources.md` or the repository, but they are not score inputs for a
sustainability dashboard. Some are useful for a future readiness module; that is a
different product.

| Source | Verdict | Reason |
| --- | --- | --- |
| **Google Earth Engine** | Optional compute, not a source | Convenient analysis environment, but operational commercial/government use can require a paid configuration; underlying datasets keep their own terms. Do not make it the only access path. |
| **ISRO Bhoonidhi** | Not needed for MVP | Redundant with Sentinel-2 CDSE for 10–60 m land analysis; token-gated; useful only if finer-than-5 m imagery is required. |
| **ISRO Bhuvan WMS/WMTS** | Useful corroboration, not MVP-critical | India-specific thematic layers are valuable, but WMS access was not runtime-validated in `sources.md`; Sentinel-2 + ESA WorldCover + India-WRIS cover the first release. |
| **PARIVESH** | Out of scope | Clearance workflow and regulatory reference, not a sustainability metric. Keep as a future link-out, not a score input. |
| **PM GatiShakti** | Out of scope | Infrastructure planning and approval context; registration/2FA; not a sustainability data source. |
| **State data-centre policy packs** | Out of scope | Incentives and approvals, not environmental performance. |
| **NITI Aayog Data Centre Evaluation Framework** | Guidance, not data | Defines the five pillars and metric expectations; do not treat it as a dataset. |
| **BEE / BIS / MeitY standards** | Methodology, not data | Essential for PUE/WUE/CUE measurement boundaries, but not a feed. |
| **DC Byte / Baxtel** | Commercial competitors, not data | Market intelligence and site selection; not open sources. |
| **Google News RSS** | Policy news only | Not a sustainability input. |
| **PowerGrid / NLDC, NIWE, DPIIT, UrbanEmissions** | Catalogue-only | Metadata exists in the repo; no score-critical dataset is connected. |
| **EcoSite ML / CMIP6** | Synthetic | Explicitly synthetic; not evidence. |
| **gbOpen India ADM0/ADM1 boundaries** | Keep | Geometry validation, India containment and the four-state product scope; not a sustainability metric. Screening only, not a legal determination. |
| **SRTM** | **Roadmap P0; keep** | Primary terrain source in `roadmap.md` §8. Copernicus DEM GLO-30 is the fallback. 30 m screening only, not a site survey. |

---

## 6. What `sources.md` already gets right

These are the sources from the user's research that should be kept and used:

| Source | Keep because | Recommended role |
| --- | --- | --- |
| Copernicus Sentinel-2 | Best open 10 m land-cover/change source | Tier A land sub-score |
| CGWB assessment | Official national groundwater stress classification | Tier A water sub-score |
| NWDP / CGWB telemetry | Station-level groundwater and rainfall context | Tier A water context |
| CWC reservoir data | Surface-water storage context | Tier B / India-WRIS |
| IMD | Official weather, rainfall, hazard atlas | Tier A rainfall; Tier B hazard atlas |
| CPCB / Data.gov | Official station air quality | Tier B air context |
| MODIS LST | Global 1 km surface heat | Tier A heat sub-score |
| NRSC flood atlas | Official India historical flood evidence | Tier B flood screening |
| JRC Global Surface Water | Long historical water record | Tier B water screening |
| WII protected areas | India-specific PA information | Tier B legal confirmation |
| CEA / NPP | Official power-system context | Tier A grid/RE context |
| PARIVESH | Clearance reference | Tier C link-out |
| PM GatiShakti | Infrastructure context | Tier C |
| Bhuvan | India thematic corroboration | Tier B |
| Bhoonidhi | Indian EO archive | Tier C |

---

## 7. What `sources.md` is missing

These are the material gaps for a sustainability score. All were checked against the
publisher's own site in this review unless marked otherwise.

### 7.1 CEA CO2 Baseline Database — the most important omission

`sources.md` lists CEA/NPP only as "aggregate electricity system — context only." That is
correct for capacity, but it misses the one CEA product the score cannot work without: the
**CO2 Baseline Database for the Indian Power Sector**.

- **Why it matters:** Scope 2 and CUE require an official grid emission factor. Without
  it, carbon is either omitted or invented.
- **Current version:** v22.0, with an XLSX workbook and user guide.
- **URL:** `https://cea.nic.in/cdm-co2-baseline-view?mappingId=234&lang=en`
- **Precision:** weighted-average national/regional factor for a financial year. It is not
  nodal, hourly, or market-based. Use the factor for the year the electricity was consumed
  and state the boundary.
- **Verdict:** Tier A, required.

### 7.2 Climate and wet-bulb data — NASA POWER and ERA5

`sources.md` covers IMD and MODIS, but not the two sources that make cooling and
peak-summer water calculable.

- **NASA POWER** — free, no authentication, hourly/daily meteorology including wet-bulb
  temperature, precipitation, humidity and solar. `https://power.larc.nasa.gov/docs/services/api/`
- **Copernicus Climate Data Store / ERA5** — free with registration and API key; hourly
  reanalysis from 1940. `https://cds.climate.copernicus.eu/`
- **Why they matter:** PUE is climate-dependent, WUE depends on cooling degree days and
  water availability, and peak-summer water demand depends on design wet-bulb temperature.
  IMD's API is auth-gated; NASA POWER and ERA5 are usable now.
- **Precision:** modelled/reanalysis, not a station. Use them for climate normals and
  design conditions, not for compliance monitoring.
- **Verdict:** Tier A.

### 7.3 Basin boundaries — HydroSHEDS / HydroBASINS

- **Why it matters:** CGWB assessment units and Aqueduct indicators are meaningless
  unless the site is joined to the correct basin/sub-basin. This is the spatial key for
  water accounting.
- **URL:** `https://www.hydrosheds.org/products/hydrobasins`
- **Licence:** HydroSHEDS v2 core products are CC BY 4.0; v1 has a specific licence.
- **Verdict:** Tier A.

### 7.4 Water risk — WRI Aqueduct 4.0

- **Why it matters:** CGWB is an Indian regulatory classification; Aqueduct adds
  catchment-level water stress, seasonal variability and drought risk, and covers
  transboundary basins.
- **URL:** `https://www.wri.org/aqueduct/data`
- **Licence:** CC BY 4.0.
- **Precision:** catchment/sub-basin, not parcel.
- **Verdict:** Tier B, strong complement.

### 7.5 Land-cover baseline — ESA WorldCover

- **Why it matters:** Sentinel-2 gives imagery and change; WorldCover gives a consistent
  10 m classified baseline for 2020/2021. It makes the first land-cover number
  reproducible.
- **URL:** `https://esa-worldcover.org/en/data-access`
- **Licence:** CC BY 4.0.
- **Verdict:** Tier B.

### 7.6 Terrain — Copernicus DEM GLO-30

- **Why it matters:** `sources.md` recommends SRTM. Copernicus GLO-30 is a more current
  30 m DSM with global coverage and a clear licence. It is better for slope and drainage
  screening.
- **URL:** `https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM`
- **Licence:** Copernicus licence; registration required.
- **Verdict:** Tier A; keep SRTM as fallback.

### 7.7 Population — WorldPop and Census 2011

- **Why it matters:** The community sub-score needs population exposure within 1/5/10 km.
  `sources.md` does not name a population source at all.
- **WorldPop:** 100 m gridded modelled population, API/STAC, CC BY 4.0.
  `https://www.worldpop.org/sdi/introapi/`
- **Census 2011:** authoritative district/village counts, GODL/NDSAP.
  `https://censusindia.gov.in`
- **Precision:** WorldPop is modelled and annual; Census is authoritative but 2011 and
  boundary-based. Show both, or show one with its date.
- **Verdict:** Tier A (WorldPop), Tier B (Census).

### 7.8 Protected areas — WDPA

- **Why it matters:** WII is the India-specific source, but it is not machine-readable.
  WDPA provides a global, API-accessible protected-area layer.
- **URL:** `https://www.protectedplanet.net/en/thematic-areas/wdpa`; API v4:
  `https://api.protectedplanet.net/documentation`
- **Licence:** **non-commercial use only unless permission is obtained.** This is a hard
  constraint for a commercial dashboard.
- **Precision:** global compilation; may lag Indian notifications. Always label as
  "screening — legal confirmation required."
- **Verdict:** Tier B; use WII/official notifications if commercial use is required.

### 7.9 Grid proximity — OpenStreetMap and GridFinder

- **Why it matters:** CEA/NPP gives state/regional context, not the nearest line. OSM and
  GridFinder give transmission/substation proximity for screening.
- **OSM:** `https://wiki.openstreetmap.org/wiki/Overpass_API`; ODbL 1.0.
- **GridFinder:** `https://gridfinder.rdrn.me`; World Bank open data.
- **Precision:** crowd-sourced or modelled; neither is a utility record. Never convert
  proximity into available MW.
- **Verdict:** Tier B.

### 7.10 Air quality — OpenAQ and Sentinel-5P

- **Why it matters:** CPCB is the official station network, but the Data.gov API key is a
  dependency. OpenAQ provides a fallback; Sentinel-5P adds spatial coverage.
- **OpenAQ:** `https://docs.openaq.org`; API key; provider-specific licences.
- **Sentinel-5P:** `https://dataspace.copernicus.eu/data-collections/copernicus-sentinel-missions/sentinel-5p`;
  free/open.
- **Precision:** OpenAQ aggregates stations; Sentinel-5P is a column measurement, not
  ground-level concentration. Neither replaces CPCB for a statutory baseline.
- **Verdict:** Tier B.

### 7.11 Circularity — CPCB EPR e-waste

- **Why it matters:** The circularity sub-score needs e-waste recovery. There is no public
  facility-level dataset; CPCB's EPR portal is the official aggregate context.
- **URL:** `https://eprewaste.cpcb.gov.in/`
- **Precision:** producer/recycler compliance data, not a site's asset register.
- **Verdict:** Tier B context; the actual score input must be the operator's asset register.

### 7.12 Measurement standards — BEE, BIS, MeitY

- **Why it matters:** PUE, WUE and CUE are meaningless without a measurement boundary.
  `sources.md` correctly notes that BEE/BIS/MeitY are expected to standardise these
  boundaries. Until then, the dashboard must record the boundary with every value.
- **Verdict:** methodology requirement, not a data feed.

---

## 8. Metric-to-source matrix

| Sub-score | Declared/measured input | Public context source | Authority evidence | Precision limit |
| --- | --- | --- | --- | --- |
| **Energy & carbon** (30%) | IT MW, facility MW, annual MWh, PUE, RE share, fuel | CEA CO2 v22.0; CEA/NPP; NASA POWER | DISCOM sanction; PPA/REC; meter data | Grid factor is annual/regional; PUE is design or declared until metered |
| **Water** (25%) | Withdrawal, consumption, WUE, source mix, peak-summer demand | CGWB; India-WRIS; NWDP; IMD rainfall; HydroSHEDS; Aqueduct | Water allocation/NOC; supply contract | Assessment unit and basin, not parcel; allocation is separate from stress |
| **Heat** (15%) | Rejected heat MW, ERF, reuse potential, cooling design | MODIS LST; NASA POWER/ERA5; IMD hazard atlas | Cooling design; metered heat | LST is surface temperature at 1 km; air temperature is modelled |
| **Grid** (15%) | Sanctioned MW, contract demand, backup MW, flexibility | CEA/NPP; OSM; GridFinder | DISCOM/STU load flow and sanction | No public source gives site headroom; proximity is not capacity |
| **Community & land** (10%) | Site polygon, land-cover change, ESZ distance, noise | Sentinel-2; Copernicus DEM; WorldPop; WDPA/WII; NRSC/JRC | Planning authority; ESZ notification | 10 m imagery, 100 m population, 30 m terrain; none is a cadastre |
| **Circularity** (5%) | Asset register, refresh cycle, recovery rate, embodied carbon | CPCB EPR (aggregate only) | Operator asset records; recycler certificates | No public facility-level dataset |

---

## 9. Declared and authority evidence — no public substitute

These inputs determine whether the score is accurate. They cannot be scraped from a
government portal. The dashboard must collect them, label them, and show their evidence
status.

| Input | Who supplies it | Why public data cannot replace it |
| --- | --- | --- |
| IT MW, facility MW, annual energy | Developer / operator | Facility-specific engineering |
| PUE, WUE, CUE and measurement boundary | Developer / operator | Design vs actual; boundary-specific |
| RE share, PPA, REC | Developer / operator | Contractual, not grid-average |
| Scope 1 fuel consumption | Developer / operator | Onsite combustion |
| Water withdrawal, consumption, source mix | Developer / operator | Site-specific |
| Peak-summer water demand | Cooling/mechanical design | Design wet-bulb and load-specific |
| Water allocation / NOC | Water authority / ULB | Legal allocation |
| Sanctioned MW, contract demand | DISCOM / STU | Utility record |
| Grid headroom | DISCOM / STU load flow | Not public |
| Rejected heat, ERF | Cooling design | Site-specific |
| E-waste asset register and recovery | Operator / recycler | Asset-level |
| Zoning, ESZ, clearance | Planning authority / PARIVESH | Legal |
| Noise | Measurement or approved model | Site-specific |

**Rule:** if a declared value has no evidence, it may be shown as `declared` and used in a
scenario, but it must not be presented as verified performance.

---

## 10. Precision and accuracy guardrails

These are the statements the UI must be able to make. If it cannot make them, the source
is not ready to influence the score.

| Source | Can say | Cannot say |
| --- | --- | --- |
| CEA CO2 v22.0 | "Scope 2 uses the CEA grid factor for FY X, region Y." | "This facility's hourly carbon intensity is Z." |
| CGWB | "The site falls in an over-exploited assessment unit." | "The site has X MLD of groundwater available." |
| Aqueduct | "The catchment has high baseline water stress." | "This parcel has a water shortage." |
| Sentinel-2 | "Land cover changed by X ha between dates A and B." | "This land use is legally approved." |
| WorldPop | "About N people live within 5 km (modelled, year Y)." | "Exactly N people live there." |
| WDPA | "The polygon intersects a protected-area screening layer." | "The project is legally prohibited." |
| OSM / GridFinder | "A transmission line is approximately X km away." | "The substation has Y MW of headroom." |
| NASA POWER / ERA5 | "Design wet-bulb is estimated at X °C from reanalysis." | "The site measured X °C." |
| IMD gridded | "Grid-cell rainfall was X mm." | "The site gauge recorded X mm." |
| CPCB | "The nearest station recorded PM2.5 = X." | "The site's baseline concentration is X." |
| MODIS LST | "Land-surface temperature anomaly is +X °C." | "Air temperature is +X °C." |
| NRSC flood atlas | "The polygon overlaps historically flood-affected area." | "The annual exceedance probability is X%." |
| CPCB EPR | "National e-waste recovery is X." | "This facility recovered X%." |

---

## 11. Licence flags

These must be resolved before a source is redistributed or used commercially.

| Source | Licence position | Action |
| --- | --- | --- |
| CEA CO2, CEA/NPP, MNRE, IMD, India-WRIS, CPCB | Government of India publication; GODL/NDSAP may apply per dataset | Record the exact dataset licence; confirm redistribution |
| NWDP | Per-resource; some resources display "No License Provided" | Check each dataset; do not redistribute unlicensed resources |
| WDPA | Non-commercial use only unless permission | Obtain permission for commercial use, or use WII/official notifications |
| WII | Verify reuse terms | Do not redistribute geometry without permission |
| WRI Aqueduct | CC BY 4.0 | Attribution required |
| HydroSHEDS v2 | CC BY 4.0 | Attribution required |
| HydroSHEDS v1 | Specific licence agreement | Check the product page |
| ESA WorldCover | CC BY 4.0 | Attribution required |
| WorldPop | CC BY 4.0 | Attribution required |
| NASA POWER | No restrictions | Attribution appreciated |
| Copernicus Sentinel / DEM / ERA5 | Free and open; registration for some services | Attribution and Copernicus notice |
| OSM | ODbL 1.0 | Share-alike for derived databases; attribution |
| GridFinder | World Bank open data | Check the dataset terms |
| OpenAQ | Provider-specific | Check each provider's licence |
| CPCB EPR | Government portal; registration | Do not scrape personal/compliance data |

---

## 12. Implementation order (roadmap §8)

Priority tiers, not the coverage table above, govern sequence. The reconciliation is in
[roadmap-alignment.md](roadmap-alignment.md).

### P0 — first-release foundations

1. **JRC Global Surface Water** — *delivered.* Live Pune run produced five observations from
   the 70E/20N tile. `PROCESSING_TESTED` / `NOT_CONNECTED`; not yet in the dashboard.
2. **NASA SRTMGL1** — *implemented, not verified.* Blocked on `ECOSITE_EARTHDATA_TOKEN`.
3. **Copernicus STAC / Sentinel-2** — *scene metadata delivered.* A live Pune search
   returned 90 L2A scenes and stored seven metadata observations. `PROCESSING_TESTED` /
   `NOT_CONNECTED`. Next: authenticated asset download, cloud masking and median NDVI.
4. **CGWB assessment** — assessment-unit boundaries and groundwater category.
5. **Developer evidence** — design PUE/WUE/CUE, peak-summer water, backup generation and
   asset register. Schema exists; no evidence has been supplied.

**Acceptance:** a real candidate polygon inside the four focus states has JRC water and SRTM
terrain observations, each with source, version, period, resolution, coverage and method.
Scope 2/CUE stay `SOURCE_UNAVAILABLE` until CEA lands.

### P1 — coverage and cross-checks

6. **NWDP** — station-level groundwater and rainfall context.
7. **Bhuvan** — one validated thematic layer for corroboration.
8. **CPCB / Data.gov AQI** — nearest monitored station and averaging period.
9. **CEA** — regional power-system context and the annual CO2 factor for Scope 2/CUE.
10. **Census 2011** — administrative population aggregates, labelled 2011.
11. **OpenStreetMap / Overpass** — roads and receptors within a buffer.

**Acceptance:** carbon, grid, population and air-quality context are available with source,
date, resolution and licence; proximity is never converted into capacity.

### P2 — context and utility evidence

12. **IMD rainfall** — resolve authenticated access and redistribution terms first.
13. **NRSC flood atlas** — only if machine-readable geometry is confirmed.
14. **State utility evidence** — sanctioned MW, water allocation and connection commitments,
    stored as declared/verified evidence rather than public observations.

### Authority evidence workflow

Add first-class fields for DISCOM sanction, water allocation, PUE/WUE/CUE boundary, asset
register and zoning/ESZ status. These are not connectors; they are evidence objects with
issuer, reference, date and verification state. Until supplied, the affected metric stays
missing rather than estimated.

---

## 13. What not to do

- Do not use Google Earth Engine as the only access path. It is a compute convenience, not
  a source of truth, and operational use can be paid.
- Do not use WDPA in a commercial product without permission.
- Do not treat CEA/NPP or OSM proximity as grid headroom.
- Do not treat CGWB stress as water allocation.
- Do not treat Sentinel-2 land cover as legal land use.
- Do not treat MODIS LST as air temperature.
- Do not treat NRSC flood history as a return-period probability.
- Do not treat WorldPop as a census.
- Do not use `sources.md` as a mandate to build an evidence graph, rule engine, or
  readiness passport. Those are out of scope for this dashboard.

---

## 14. Bottom line

The dashboard needs **twelve public sources** for a credible first score (the registry also
tracks developer and state-utility evidence, which are not public datasets):

1. CEA CO2 Baseline Database v22.0
2. CEA / National Power Portal
3. NASA POWER
4. CGWB Dynamic Ground Water Resources
5. India-WRIS
6. NWDP
7. IMD gridded rainfall
8. HydroSHEDS / HydroBASINS
9. MODIS LST
10. Sentinel-2 via CDSE STAC
11. Copernicus DEM GLO-30
12. WorldPop

It needs **declared and authority evidence** for the numbers that public data cannot
supply: PUE, WUE, CUE, IT/facility MW, RE contracts, water allocation, sanctioned MW,
grid headroom, rejected heat, e-waste recovery, zoning and ESZ status.

The roadmap's first build is **JRC + SRTM + Sentinel-2 + CGWB**, because those four establish
water history, terrain, land condition and groundwater stress for a candidate polygon inside
the four focus states. CEA remains essential for carbon, but it is P1: until a connector lands,
Scope 2 and CUE stay `SOURCE_UNAVAILABLE` rather than estimated. Add the remaining Tier A
sources before claiming a full six-dimension score.
