# Public Environmental Time-Series Architecture

Last researched: 2026-10-29

## Architecture decision

Separate data into two categories:

1. **Facility registry data** - relatively stable identity, operator, public
   locality, disclosed capacity, source and verification.
2. **Environmental time series** - changing public observations fetched by
   backend connectors from official APIs or datasets.

The frontend never calls CPCB, IMD, NWDP or another third-party provider
directly. It queries EcoSite's API. Backend ingestion jobs fetch, validate,
normalise and cache observations in SQLite before the UI requests them.

```text
Official public API/dataset
        -> scheduled connector
        -> ingestion run + raw snapshot reference
        -> validation/normalisation
        -> SQLite observations
        -> hourly/daily rollups
        -> EcoSite REST API
        -> 24h / 7d / 30d dashboard filters
```

This avoids slow page loads, third-party rate-limit exposure, inconsistent
formats, browser CORS failures and the loss of historical values.

## Public metrics for the first version

| Metric | Preferred source | Native/public cadence | Backend poll target | Default chart |
|---|---|---:|---:|---:|
| AQI and pollutant sub-indices | CPCB CAAQMS/CCR | 15-minute station averages; public AQI commonly hourly | 15-60 minutes | 24 hours |
| PM2.5, PM10, NO2, SO2, CO, O3 | CPCB CAAQMS | 15 minutes where available | 15-60 minutes | 24 hours |
| Temperature | IMD current weather/AWS | Station/API dependent, often hourly or better | 30-60 minutes | 24 hours |
| Relative humidity | IMD | Station/API dependent | 30-60 minutes | 24 hours |
| Rainfall | IMD | Current/daily/AWS | Hourly | 24 hours / 7 days |
| Wind speed/direction | IMD | Current/AWS | 30-60 minutes | 24 hours |
| Weather warnings | IMD district warnings/nowcast | Event driven | 15-30 minutes | Current |
| Groundwater depth | NWDP/CGWB/state telemetry | Commonly six-hourly; dataset dependent | 6 hours | 7 / 30 days |
| Groundwater assessment category | CGWB assessment | Annual/versioned | On release | Latest only |
| Historical surface-water occurrence | JRC GSW | Versioned/static | On release | Long-term context |

Official source evidence:

- CPCB technical specifications describe real-time station files containing
  15-minute average values, updated every 15 minutes:
  https://cpcb.nic.in/openpdffile.php?id=TGF0ZXN0RmlsZS8yNjRfMTU2NTI1Nzg1OV9tZGlhcGhvdG8xNTQwN2MucGRm
- IMD public APIs expose current weather, AWS observations, rainfall, forecasts
  and district warnings: https://api.imd.gov.in/public/api_reference.html
- NWDP publishes CGWB and state groundwater telemetry as CSV/API resources,
  frequently with six-hour readings. Examples:
  - Telangana: https://www.nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-daily-telangana-gw
  - Karnataka: https://www.nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-hourly-karnataka-ground-water-department
  - CGWB national/state resources: https://www.nwdp.nwic.gov.in/en/dataset/ground-water-level-telemetry-daily-cgwb-as-assam

Source cadence is a capability, not a guarantee. The UI must show observation
time, station, distance and freshness for every metric.

## Facility-to-station relationship

Public environmental readings generally come from monitoring stations, not
from the data centre itself. Store an explicit facility-station link:

- facility ID
- station ID and source
- metric family
- station coordinates
- distance from generalised facility location
- selection method: nearest, same district, manual authority mapping
- effective date
- reviewer/processing version

Display copy such as:

> Nearest public CPCB station, 8.4 km from the generalised facility location.
> This is ambient context, not an on-site measurement.

Never describe station groundwater depth as the facility's groundwater level.

## SQLite schema

### `metric_definitions`

- metric key and display name
- canonical unit
- metric family
- valid numeric range
- preferred aggregation: mean, min, max, sum or latest
- default time window
- stale-after duration

### `monitoring_stations`

- station ID and provider station key
- source ID
- name, state, district and locality
- longitude/latitude
- station type and measured metrics
- active/status and last-seen timestamps
- metadata JSON

Station coordinates are public source locations. They are distinct from
restricted facility coordinates.

### `facility_station_links`

- facility ID
- station ID
- metric family
- distance in kilometres
- selection method
- active/effective timestamps
- processing version

Unique active link per facility, station and metric family.

### `environmental_observations`

- source and station IDs
- optional facility ID only for a derived contextual association
- metric key
- observed timestamp in UTC
- retrieved timestamp in UTC
- numeric value and canonical unit
- source value/unit
- quality status and flags
- raw snapshot ID
- deduplication key
- created timestamp

Indexes:

- `(station_id, metric_key, observed_at)`
- `(facility_id, metric_key, observed_at)` when contextual associations exist
- `(source_id, retrieved_at)`
- unique `dedupe_key`

### `environmental_rollups`

- station/facility context
- metric key
- bucket start and interval (`hour`, `day`)
- minimum, maximum, mean, sum, latest and sample count as applicable
- valid/expected sample counts and coverage fraction
- source/processing version

Unique key: station, metric, interval and bucket start.

Reuse existing `data_sources`, `ingestion_runs` and `raw_snapshots` tables for
connector provenance and failure history.

## Time-window API

### Facility environmental context

`GET /api/v1/public-facilities/{id}/environmental`

Parameters:

- `metrics=aqi,pm25,temperature,humidity,groundwater_depth`
- `range=24h|7d|30d|90d|1y`
- `interval=auto|raw|hour|day`

Rules:

- `auto` returns raw/hourly data for 24h, hourly/daily for 7d and daily rollups
  for longer windows.
- Server enforces maximum point counts.
- Missing metrics return an explicit unavailable result, not zero.
- Response includes station, distance, observation time, retrieval time,
  freshness, coverage and provenance.

### Current context

`GET /api/v1/public-facilities/{id}/environmental/current`

Returns the latest valid observation per metric plus freshness state:

- `CURRENT`
- `STALE`
- `SOURCE_UNAVAILABLE`
- `NOT_COVERED`

### State/city rollups

`GET /api/v1/environmental/summary?state=IN-MH&range=24h`

This aggregates monitoring context, not facility-caused pollution or water use.

## Frontend filter behaviour

Recommended controls:

- 24 hours - default for AQI, pollutants, temperature, humidity and wind
- 7 days - default for rainfall and groundwater telemetry
- 30 days - groundwater/environmental trend
- 90 days - seasonal context
- 1 year - daily rollups only

The selected range changes the API query. It must not merely hide points in an
already-loaded array.

Each chart shows:

- metric and unit
- source/station
- distance and selection method
- latest observation time
- freshness state
- missing intervals/coverage
- source link

## Ingestion jobs

Use separate idempotent connector jobs, not request-time fetches:

- `poll_imd_weather`
- `poll_cpcb_air_quality`
- `poll_nwdp_groundwater`
- `refresh_station_catalogues`
- `build_environmental_rollups`
- `mark_stale_sources`

For the SQLite prototype, run jobs through a CLI script invoked by Windows Task
Scheduler/cron or a single controlled background scheduler process. Do not run
the same scheduler independently in multiple Uvicorn workers.

Each job:

1. creates an ingestion run;
2. fetches with timeout, retry/backoff and response-size limits;
3. stores a raw snapshot when licence permits;
4. validates station/time/unit/range;
5. normalises and deduplicates observations in one short transaction;
6. updates rollups/freshness;
7. completes the run with success, partial or failed status.

## Retention for SQLite

Recommended prototype retention:

- Raw 15-minute observations: 90 days
- Hourly rollups: 2 years
- Daily rollups: retained indefinitely for the pilot
- Raw connector snapshots: source/licence-specific retention
- Ingestion/audit metadata: retained

Retention is applied only after a verified backup and should be configurable.

## Reliability and honesty rules

- Serve last known data with a visible stale label when a provider is down.
- Never block the facility page waiting for a third-party API.
- Never use `0` for missing observations.
- Use UTC in storage and return ISO 8601 timestamps.
- Preserve original value/unit alongside the canonical value.
- Do not interpolate missing AQI or water data unless labelled as modelled.
- Do not attribute ambient station conditions to a facility's operations.
- Log source failures without leaking credentials or full sensitive payloads.

## One-day prototype implementation boundary

Implement the schema/API contract and deterministic observation fixtures first.
Connect one live official public API only after its access terms and response
contract are verified. The architecture allows additional connectors without
changing frontend chart contracts.

