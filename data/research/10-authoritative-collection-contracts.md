# Authoritative Data Collection Contracts

Last audited: 2026-10-29

## Purpose

This document turns the source catalogue into collection contracts that can be
implemented and audited. It covers the four current states only: Maharashtra,
Telangana, Karnataka and Tamil Nadu. A listed source is not automatically safe
to ingest: access, licence, response shape and redistribution must be verified
before a connector is enabled.

The platform must keep three classes separate:

1. facility facts disclosed by a government body, operator, filing or
   certification body;
2. public environmental and infrastructure context from an authority dataset;
3. private facility telemetry or utility allocations supplied by an operator or
   authority under agreement.

Context must never be presented as facility-caused consumption, emissions or
available utility capacity.

## Collection contract matrix

| Domain | Authoritative/preferred source | Public access and cadence | Permitted product use | Contract status and blocker |
|---|---|---|---|---|
| Facility identity and operating status | MeitY/PIB/NIC for government facilities; operator facility pages, annual reports and exchange filings for private facilities | Pages/PDFs; event-driven; review at least every 90 days | Registry identity, generalized locality, explicit operating wording and source provenance | **Manual verified ingestion now.** India does not expose a complete facility-level public government registry. MeitY/PIB city totals are validation benchmarks, not facility records. |
| Facility capacity | Operator factsheet/filing; government statement only when facility-specific | Event-driven | Store disclosed number, unit, capacity type and scope separately | **Manual verified ingestion now.** Never sum IT load, total power, campus capacity or planned phases. Withhold capacity if the measurement boundary is unclear. |
| Government data centres | NIC Data Centre service and government department disclosures | Event-driven | Identity/status for specifically named operating facilities | **Usable for named facilities.** NIC publicly identifies National Data Centres at Pune and Hyderabad, but the generic statement about state-capital facilities is insufficient to create unnamed registry records. |
| AQI and ambient pollutants | CPCB dataset on the Open Government Data Platform | Data API/CSV; resource granularity is hourly; underlying field feeds may be more frequent | Nearby station context with station, observation time, retrieval time and quality warning | **P0 connector candidate.** OGD resource is released under NDSAP and the Government Open Data Licence. Requires an API key/resource identifier, pagination, schema mapping and abnormal-value handling. Do not scrape CPCB dashboards. |
| Weather observations | IMD API Management: `current_wx`, `aws_data` and mapping endpoints | Official API; observation-dependent, commonly hourly or better | Temperature, humidity, rainfall, wind and station metadata | **Contract verification required.** Portal account/API access and usage terms must be confirmed before enabling. Store UTC observation time and native units. |
| Weather warnings | IMD `districtnowcast`, `districtwarning`, `stationnowcast` | Event-driven; poll 15–30 minutes | District/station warnings and validity windows | **Contract verification required.** Warning codes and colour mappings are documented; do not convert a warning into a measured facility condition. |
| Groundwater level | National Water Data Portal (NWDP): CGWB and state-agency telemetry | CSV/API; typically six-hourly, some hourly; resources exist for all four states | Nearest eligible station context and long/short trends | **P0 connector candidate after API-contract verification.** Preserve producing agency, station ID, depth datum/unit and resource period. NWDP warns users to independently assess accuracy/completeness. |
| Groundwater assessment category | CGWB assessment resources through NWDP/CGWB | Annual/versioned | Block/assessment-unit planning context | **Batch/versioned ingestion.** Never label an assessment category as a facility measurement. |
| River level and reservoir context | NWDP state/CWC resources | Hourly telemetry or daily manual datasets depending on resource | Flood/water-resource context with station/basin and timestamp | **P1 connector candidate.** NWDP exposes hourly river-level resources for Maharashtra, Telangana and Tamil Nadu, and water-quantity resources including Karnataka reservoir/discharge data. Coverage must be verified per candidate site. |
| Flood forecast/warning | Central Water Commission Flood Forecasting portal and advisory flood forecast | CWC reports three-hour updates for the seven-day advisory system; event-driven products | Current authority forecast/advisory with station, issue and validity time | **Access contract required.** Use portal/API agreement or published feed; do not automate an undocumented web UI. Forecasts are modelled warnings, not observed inundation. |
| Historical surface water | JRC Global Surface Water | Versioned release | Long-term occurrence/change corroboration | **Implemented/processing-tested.** Non-Indian source; use as derived corroboration, never as statutory water availability. |
| Grid system context | Central Electricity Authority API/dashboard/reports | API plus monthly XLS/PDF reports | State/region power-supply position, transformation and transmission context | **P1 public connector.** CEA exposes API categories for state capacity, peak/energy position, transformation capacity and transmission lines. This does not disclose feeder/substation headroom for a facility. |
| Utility capacity and facility load | DISCOM/STU, SLDC and operator evidence | Usually restricted/agreement-based | Sanctioned load, allocation, metered demand and augmentation milestones | **Not public by default.** Requires ministry/utility agreements and access controls. Proximity to a line/substation is not available capacity. |
| Protected areas and ESZ/ESA | MoEFCC final notifications, amendments and attached maps/KML; state forest/wildlife authorities | Notification-driven | Legal-screening overlay with notification number, gazette date, status and geometry version | **Manual/versioned ingestion first.** Final and draft notifications must not be mixed. Amendments can supersede geometry. MoEFCC states notifications include maps, coordinates and sometimes shape/KML files. |
| Broader land/water/terrain layers | NRSC Bhuvan thematic WMS/downloads | Release/version dependent | Screening overlays with source/version/scale | **Licence/service verification required.** WMS availability is not proof that bulk caching or redistribution is permitted. Record layer name, service URL, scale, release and licence decision. |
| Population and settlement | Office of the Registrar General & Census Commissioner (ORGI) Census API/tables | 2011/2001 aggregate tables; API/CSV; static until a newer official census release | District/sub-district/town/village population context | **Usable with attribution.** API is targeted rather than bulk; full tables should be downloaded for reproducible batch processing. Display the required ORGI API attribution and never imply endorsement. Data are historical, not current population telemetry. |
| Administrative boundaries | Official Census/Survey/state boundary releases; pinned project screening boundary | Versioned/static | State/district joins and four-state eligibility screening | **Pinned screening layer exists.** Preserve source/version/hash and state that it is not a cadastral/legal boundary determination. |

## Confirmed official access facts

### Facility benchmark sources

- The [NIC Data Centre service](https://www.nic.gov.in/service/data-centre/)
  identifies National Data Centres at Pune and Hyderabad and describes them as
  supporting round-the-clock government services. This supports those named
  facility records, not an inferred record for every state capital.
- The [MeitY/PIB status release](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2241783&lang=2&reg=48)
  publishes city-level operational capacity estimates, including Mumbai/Navi
  Mumbai and Chennai. These totals are useful as an inventory completeness
  check but cannot be divided into facility records without facility-level
  evidence.
- The [Economic Survey 2025–26](https://www.indiabudget.gov.in/economicsurvey/doc/eschapter/echap09.pdf)
  reports national totals based partly on industry estimates. It is a national
  benchmark, not a primary facility inventory.

### Air quality

The [OGD real-time AQI catalogue](https://www.data.gov.in/catalog/real-time-air-quality-index)
states that the resource is sourced from CPCB, is available as a Data API/CSV,
has hourly granularity, covers AQI and major pollutants, and is released under
NDSAP. The [Government Open Data Licence](https://www.data.gov.in/sites/default/files/NDSAP_OpenDataLicense.pdf)
must be recorded in the source configuration. The catalogue warns that
instrument data may contain abnormal values; ingestion must therefore retain
quality flags instead of silently clipping or deleting values.

### IMD weather

The [IMD API reference](https://api.imd.gov.in/public/api_reference.html)
documents current weather, AWS/ARG observations, rainfall, district/station
nowcasts and warnings. Current weather includes station ID/name, UTC
observation time, temperature, humidity, wind and 24-hour rainfall. The
[IMD API portal](https://api.imd.gov.in/public/index.php) exposes account
creation, so anonymous endpoint visibility must not be treated as production
authorization. Confirm credentials, quotas, caching and attribution with IMD
before enabling scheduled collection.

### Groundwater and surface water

The [National Water Data Portal](https://nwdp.nwic.gov.in/) exposes CSV/API
resources from central and state producers. Its published principles say
public-good water data should be findable, accessible, interoperable and
reusable, while responsibility remains with the producing agency. Its
[disclaimer](https://www.nwdp.nwic.gov.in/footer/disclaimer) requires users to
evaluate accuracy and completeness.

Examples relevant to the four states include:

- [CGWB telemetry catalogue with Maharashtra, Karnataka, Telangana and Tamil Nadu resources](https://nwdp.nwic.gov.in/en/dataset/ground-water-level-telemetry-daily-cgwb-as-assam)
- [Maharashtra state groundwater telemetry](https://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-daily-maharashtra-gw)
- [Tamil Nadu groundwater telemetry](https://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-daily-tamil-nadu-sw-gw)
- [Maharashtra hourly river level](https://nwdp.nwic.gov.in/dataset/river-water-level-telemetry-hourly-maharashtra-surface-water-department)
- [Telangana hourly river level](https://www.nwdp.nwic.gov.in/dataset/river-water-level-telemetry-hourly-telangana-surface-water-department)
- [Tamil Nadu hourly river level](https://nwdp.nwic.gov.in/dataset/river-water-level-telemetry-hourly-tamil-nadu-sw-and-gw-department)

Dataset titles sometimes contain inconsistent cadence wording. The connector
must trust and validate resource metadata and observed timestamps, not infer
cadence from a URL slug or title.

### Flood context

The CWC flood-forecasting appraisal describes the
[seven-day advisory forecast](https://cwc.gov.in/sites/default/files/ffwnappraisal-report-2023.pdf)
as covering major basins and being updated every three hours. Operational
integration still needs an approved machine-readable feed or agreement; portal
screen scraping is not an acceptable collection contract.

### Grid context

The [CEA data API catalogue](https://cea.nic.in/api-for-central-electricity-authority-data/?lang=en)
lists state/region installed capacity, power-supply position, transformation
capacity and transmission lines. The [CEA dashboard/report area](https://cea.nic.in/dashboard/?lang=en)
also publishes downloadable tables. Collect these as state/region context with
report period and retrieval hash. Facility load, utility allocation and local
headroom remain restricted/operator- or utility-supplied evidence.

### Biodiversity and protected areas

The [MoEFCC ESZ portal](https://moef.gov.in/eco-sensitive-zone-esz?lang=en)
explains that notifications include boundary descriptions, maps, coordinates,
villages and, where supplied, shape/KML files. Ingestion must store notification
status (`draft`, `final`, `amended`, `superseded`), gazette identifier/date and
geometry hash. Only the current final/amended geometry may drive a legal-risk
flag; draft geometry can be shown separately as a policy-development warning.

### Population

The [ORGI Census API](https://censusindia.gov.in/census.website/en/data/api/about)
exposes aggregate 2001/2011 tables; it does not expose individual or household
records. The [API terms](https://censusindia.gov.in/census.website/en/data/api/terms-of-use)
allow search/display/analysis with attribution, prohibit re-identification and
require that ORGI not be represented as endorsing the product. For bulk and
reproducible processing, use official table downloads rather than high-volume
API calls.

## Required connector record

No connector is enabled until its source configuration contains:

- authority and producing agency;
- dataset/resource identifier and canonical URL;
- access method (`api`, `csv`, `xlsx`, `wms`, `document`, `manual_review`);
- licence/terms URL and an explicit caching/redistribution decision;
- geographic and temporal coverage;
- native cadence and expected publication delay;
- station/layer/catalogue discovery method;
- schema version or response fingerprint;
- unit and time-zone mapping;
- pagination, quota, retry and response-size limits;
- stale-after and retention policy;
- quality checks and impossible-range rules;
- raw snapshot policy and content hash;
- named owner and last successful contract test.

## Collection sequence

1. **Facility inventory first:** complete a second-pass operating-facility
   census using facility-level operator/government evidence and 90-day reviews.
2. **CPCB through OGD:** implement the documented OGD API contract before any
   dashboard scraping; catalogue stations before observations.
3. **NWDP catalogue pilot:** verify resource/API contracts for all four states,
   then ingest station metadata before groundwater/river observations.
4. **IMD contract test:** obtain portal authorization and confirm terms, quotas
   and response fields; only then enable weather polling.
5. **CEA batch context:** ingest versioned monthly/state reports/API outputs;
   label them grid context, never facility capacity.
6. **MoEFCC notification register:** manually establish final/amended ESZ
   geometry lineage before automating downloads.
7. **ORGI batch baseline:** ingest official aggregate tables with vintage and
   attribution; never describe 2011 population as current.
8. **Restricted integrations later:** utility capacity, allocation and operator
   telemetry require authenticated agreements and must not enter the public
   context tables.

## Acceptance gates

- A source-contract test validates one real response/file without writing to the
  live database.
- Station/layer identity and coordinates are stable and deduplicated before
  observations are loaded.
- Every stored observation links to an ingestion run, source record and raw
  snapshot/hash when retention is permitted.
- Original value/unit/time are preserved alongside normalized fields.
- Missing, stale, unavailable and not-covered states remain distinct.
- A failed source never produces zero, synthetic or last-known-current data.
- Facility-to-station selection is versioned, distance-disclosed and reviewed.
- Licence and redistribution decisions are testable source metadata, not prose
  known only to developers.
- Public UI wording explicitly separates authority context from operator
  telemetry and from facility-caused environmental impact.

