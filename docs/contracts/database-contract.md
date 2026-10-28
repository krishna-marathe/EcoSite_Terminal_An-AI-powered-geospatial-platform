# EcoSite Database Contract

Status: DB0 frozen vocabulary for parallel implementation  
Schema head: `04c_001`  
Last reviewed: 2026-10-29

Operational hardening is documented in `docs/operations/database-runbook.md`.
It adds no schema revision: backup/restore verification, integrity checks and
retention are implemented by `backend/scripts/database_maintenance.py`. The
retention contract is raw observations 90 days, hourly rollups 730 days, daily
rollups retained, and no automatic raw-snapshot deletion. A job-lock table is
deferred until an actual multi-worker scheduler requires leasing; the current
operational contract permits one writer.

## Purpose

This contract is the database agent's handoff to the Backend/API and Frontend
agents. It fixes identity, evidence, visibility, time, metric and unit
vocabulary before normalized public-registry and environmental tables are
introduced. Database column names are `snake_case`. Response-visible names are
owned by `docs/contracts/api-contract.md`; the backend must map them explicitly
and must not expose ORM rows directly.

## Existing schema and compatibility policy

The reproducible migration head is `03c_001`:

| Revision | Purpose |
|---|---|
| `02a_001` | projects |
| `02b_001` | candidate sites |
| `02b_002` | boundary-screening metadata |
| `02c_001` | development phases |
| `03a_001` | source registry, ingestion, observations, authority evidence and scoring |
| `03b_001` | phase-bound developer evidence |
| `03c_001` | legacy demo-facility compatibility table |
| `04a_001` | normalized approved public operational-facility registry |
| `04b_001` | monitoring stations, facility links, environmental observations and rollups |
| `04c_001` | private operator submissions, ministry review, audit and publication linkage |

`facilities` is a legacy synthetic planning/demo store. Revision `03c_001`
creates its historical schema on a fresh database, but does not alter an
existing table, its rows or its custom indexes. No new public registry,
ministry monitoring or operator-registration feature may depend on it.

`developer_evidence` stores private declared design evidence associated with a
candidate site and project phase. It is not an operational public-facility
record and must not be published automatically.

The reviewed `data/public_data_centres.json` seed remains separate until the
normalized public-registry migration and parity import are delivered in DB3.

## Identity

- Identifiers are stable, opaque strings. Clients must not derive meaning from
  them.
- `facility_id` identifies one physical data-centre facility/campus record.
- Aliases and operator naming history will be separate records; names are not
  identifiers.
- Provider station IDs retain both provider namespace and native ID.
- India state codes are fixed to `IN-MH`, `IN-TG`, `IN-KA`, `IN-TN` for this
  release.
- Coordinates are WGS84 longitude/latitude. Public generalized coordinates and
  restricted exact geometry will be stored in physically separate structures.

## Evidence vocabulary

Existing evidence classes remain canonical:

- `MEASURED`
- `AUTHORITY_VERIFIED`
- `DECLARED`
- `DOCUMENTED`
- `OFFICIAL_GEOSPATIAL`
- `REMOTE_SENSING_DERIVED`
- `MODELLED`
- `CROWD_SOURCED`
- `SYNTHETIC_DEMO`
- `UNAVAILABLE`

Public-source, operator-declared and authority-verified values are separate
records. Verification changes status; it does not erase the original source or
turn a declaration into a measurement.

Observation availability states remain:

- `AVAILABLE`
- `PARTIAL`
- `STALE`
- `SOURCE_UNAVAILABLE`
- `NOT_APPLICABLE`
- `UNKNOWN`

Missing values are SQL `NULL` with a non-empty reason where the observation
contract requires one. Missing values are never stored as zero.

## Visibility vocabulary

Future facility facts and measurements must carry one of these policy classes:

- `PUBLIC`: eligible for an approved generalized public snapshot.
- `MINISTRY`: visible to authorized ministry users.
- `REGULATOR_RESTRICTED`: shared only under the responsible agency agreement.
- `OPERATOR_PRIVATE`: visible to the submitting operator and authorized reviewers.

Visibility is independent of evidence class and temporal class. Public APIs
read approved public facts/snapshots, never mutable submissions.

## Temporal vocabulary and timestamps

Every response-visible value belongs to one temporal class:

- `STATIC_VERSIONED`: identity, generalized location and design facts.
- `PERIODIC`: annual/quarterly operator or authority reporting.
- `NEAR_REAL_TIME`: cached public station/provider observations.
- `PRIVATE_LIVE`: authenticated operator/utility telemetry.
- `DERIVED`: rollups, comparisons, alerts and screening results.

All application timestamps are UTC ISO-8601 strings with an explicit `Z` or
`+00:00` offset. The environmental contract distinguishes:

- `observed_at`: when the physical observation applies;
- `published_at`: when the provider released it;
- `retrieved_at`: when EcoSite obtained it;
- `created_at` / `updated_at`: EcoSite record lifecycle;
- `verified_at` / `valid_until`: evidence validity;
- `bucket_start` / `bucket_end`: rollup interval.

The backend must not replace one timestamp with another when a provider omits a
field. Freshness is derived from `observed_at` using a metric/provider policy.

## Capacity contract

Every capacity disclosure contains all of:

- numeric `value` greater than zero;
- `unit`: `MW` or `MVA`;
- `capacity_type`: `it_load`, `total_power`, `power_capacity`, or
  `power_capacity_unspecified`;
- `scope`: a non-empty measurement boundary such as campus, building or phase;
- provenance and validity.

Values with different units, types or scopes must not be summed. Unknown
capacity remains absent rather than estimated.

## Environmental metric vocabulary

The following metric keys and canonical units are reserved for DB4/API B2. A
provider's original value and unit must also be retained when normalization is
performed.

| Metric key | Canonical unit | Default display range |
|---|---|---|
| `aqi` | `index` | `24h` |
| `pm25` | `ug/m3` | `24h` |
| `pm10` | `ug/m3` | `24h` |
| `no2` | `ug/m3` | `24h` |
| `so2` | `ug/m3` | `24h` |
| `o3` | `ug/m3` | `24h` |
| `co` | `mg/m3` | `24h` |
| `temperature` | `degC` | `24h` |
| `relative_humidity` | `percent` | `24h` |
| `wind_speed` | `m/s` | `24h` |
| `wind_direction` | `degree` | `24h` |
| `rainfall` | `mm` | `7d` |
| `groundwater_depth` | `m_bgl` | `7d` |
| `groundwater_assessment` | `category` | `1y` |

Allowed range values are `24h`, `7d`, `30d`, `90d`, `1y`. Allowed storage/API
rollup intervals are `raw`, `hour`, `day`; `auto` is an API selection rule, not
a stored interval. AQI is an index and must retain the provider/index standard.
Station readings represent nearby environmental context, never campus water
use, withdrawal, discharge or private telemetry.

`groundwater_assessment` is a periodic categorical authority assessment, not a
near-real-time sensor reading. `NOT_COVERED` is reserved as a derived API query
state when no eligible facility/station link exists; it is not a persisted
physical observation status and does not replace `UNKNOWN` or
`NOT_APPLICABLE` in the existing observation table.

## Planned normalized table names

These names are reserved so agents do not create competing structures.

DB3 public registry (implemented in `04a_001`):

- `facility_operators`
- `public_facilities`
- `facility_aliases`
- `facility_capacity_disclosures`
- `facility_sources`
- `facility_verifications`
- `public_facility_snapshots`

DB4 environmental monitoring (implemented in `04b_001`):

- `metric_definitions`
- `monitoring_stations`
- `facility_station_links`
- `environmental_observations`
- `environmental_rollups`

### DB4 physical handoff

`metric_definitions` is the canonical metric vocabulary. Its primary key is
`key`; it stores display name, family, canonical unit, value kind, preferred
aggregation, default range, stale-after seconds, optional valid bounds and
description. Migration `04b_001` creates no production metric rows. Connector
or application seed work must use the frozen keys in this contract.

`monitoring_stations` uses an EcoSite `id` plus the unique provider key
`(source_id, native_station_id)`. It stores provider/name, public station
coordinates, location labels, station type, measured metric keys, source
status, first/last-seen UTC times and provider metadata. Station coordinates
are public source locations, never restricted facility geometry.

`facility_station_links` connects one approved `public_facilities.id` to one
station and one metric key. It stores `distance_km`, `selection_method`, UTC
effective/expiry times, primary status, processing version and selection
metadata. Frozen selection methods are `nearest_eligible`, `same_district` and
`manual_authority_mapping`. Query-time `NOT_COVERED` means no eligible effective
link; it is not inserted as an observation.

`environmental_observations` is station-centric. `facility_id` is nullable and
reserved only for an explicitly derived contextual association; normal public
station ingestion leaves it null and joins through `facility_station_links`.
Each row references `data_sources` and may reference an `ingestion_runs` and
`raw_snapshots` record. It preserves:

- normalized `value` or `category_value` and `canonical_unit`;
- `original_value` or `original_category_value` and `original_unit`;
- availability `status`, observation `quality`, evidence/temporal/visibility;
- UTC `observed_at`, optional `published_at`, and required `retrieved_at`;
- quality flags, explicit missing reason and provider dedupe key.

The provider identity constraint is `(source_id, provider_dedupe_key)`. A row
contains exactly one normalized numeric value, categorical value, or missing
reason. Missing is never zero.

`environmental_rollups` stores station-level `hour` or `day` buckets. Facility
series are derived through effective station links rather than duplicating a
rollup for every facility. Rows contain preferred value, min/max/sum/latest,
optional latest category, counts, coverage, status/quality, source, processing
version and generation time. The unique bucket key is
`(station_id, metric_key, interval, bucket_start)`.

Required physical indexes implemented in `04b_001` include:

- environmental observations by `(station_id, metric_key, observed_at)`;
- optional contextual observations by `(facility_id, metric_key, observed_at)`;
- source retrieval history by `(source_id, retrieved_at)`;
- rollups by `(metric_key, bucket_start, interval)`;
- rollups by `(station_id, metric_key, bucket_start)`; and
- facility/station link lookup by facility/metric/effective time and station/metric.

DB5 private registration/review (implemented in `04c_001`):

- `operator_organisations`
- `facility_submissions`
- `facility_submission_revisions`
- `submission_exact_geometries`
- `submission_evidence`
- `review_events`
- `publication_snapshots`
- `audit_events`

### DB5 physical handoff

`operator_organisations` represents a submitting organisation, not a second
public operator catalogue. Its optional `facility_operator_id` links a reviewed
organisation to the existing `facility_operators` record. It stores no user
credentials or authentication secrets.

`facility_submissions` is the mutable workflow header. It contains organisation,
status, current revision number, optional reviewer assignment and lifecycle
timestamps. Facility facts are not stored on the header.

`facility_submission_revisions` is append-only and contains the complete
private facility fact set for one revision. Capacity disclosures remain typed
objects in its JSON list and are validated again by the service contract.
Every header revision increment requires the corresponding immutable revision
row to exist first.

`submission_exact_geometries` is the only registration table containing exact
geometry. It is a physically separate, append-only one-to-one child of a
submission revision with visibility fixed to `OPERATOR_PRIVATE`. Neither
`facility_submissions`, `facility_submission_revisions`, `public_facilities`
nor `public_facility_snapshots` contains an exact-geometry column.

`submission_evidence` stores append-only attachment metadata or an external
URL. SQLite stores no document blob. A metadata row references a submission
revision and records optional storage path, SHA-256, content type, size, issuer,
issue time, evidence class and restricted visibility.

`review_events` and `audit_events` are append-only. Review events link to the
exact submission revision reviewed and record action, actor, from/to status,
reason and requested fields. Audit events provide generic entity/action/request
metadata without containing credentials.

`publication_snapshots` is an immutable linkage, not a second public payload
store. It joins an approved private submission revision and approve review event
to an existing `public_facility_snapshots` row. The linked public snapshot must
have `approval_basis = 'ministry_review'`, the same public facility ID and the
same payload SHA-256.

Publication transaction order is:

1. insert the new immutable private submission revision;
2. transition the header to `approved` and the matching revision number;
3. insert the immutable approve review event;
4. create the generalized `public_facility_snapshots` payload with no exact
   geometry and `approval_basis = 'ministry_review'`;
5. insert `publication_snapshots`; and
6. append the audit event.

The service must perform all steps in one SQLite transaction. A database trigger
rejects the publication link unless submission, revision, approve event, public
facility, public snapshot, approval basis and payload hash agree.

Allowed submission status transitions are:

- `draft` -> `submitted` or `withdrawn`;
- `submitted`, `resubmitted` or `under_review` -> `under_review`,
  `information_requested`, `approved`, `rejected` or `withdrawn`;
- `information_requested` -> `resubmitted` or `withdrawn`; and
- `approved`, `rejected` and `withdrawn` are terminal.

Every status transition creates exactly one next revision. Database triggers
reject skipped revision numbers, missing revision rows and invalid transitions.
Corrections create a new revision/event; append-only rows cannot be updated or
deleted.

Exact DB6+ columns will be introduced only in their reviewed phase migrations.
Backend repositories may be designed against these concepts but must not create
tables at application startup.

## Indexing and ingestion rules

- Provider observations require a deterministic deduplication key.
- DB4 indexes will cover `(station_id, metric_key, observed_at)` and rollup
  lookup by `(metric_key, bucket_start, interval)`; add a facility lookup index
  only if facility-linked observations are materialized.
- Existing `data_sources`, `ingestion_runs` and `raw_snapshots` remain the one
  provenance/ingestion system.
- Third-party polling writes through one controlled backend job process. Page
  requests never write provider observations and never call providers.
- SQLite foreign keys remain enabled, write waits use the configured busy
  timeout, and migrations run only against an explicitly selected database.

## Contract change procedure

Any response-visible rename, new status, metric key, unit, visibility class or
temporal class must be recorded here and coordinated with the Backend/API agent
before implementation. The Frontend agent consumes the API contract rather
than database column names.

