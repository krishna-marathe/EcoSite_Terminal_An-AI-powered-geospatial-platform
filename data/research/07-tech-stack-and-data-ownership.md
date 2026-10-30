# Tech Stack and Data Ownership Decision

Last updated: 2026-10-29

## Decision summary

Use the existing stack and evolve it rather than replacing it:

- Frontend: React 19, TypeScript, Vite, React Router, TanStack Query, Zustand,
  MapLibre and Tailwind CSS.
- Backend: Python 3.11, FastAPI, Pydantic, SQLAlchemy and Alembic.
- Database: SQLite for all structured prototype data.
- Large files: repository/runtime file storage with SHA-256, path, MIME type,
  size, provenance and access policy stored in SQLite.
- API style: versioned JSON REST API under `/api/v1`.

SQLite is an embedded database, not a standalone database server. FastAPI is
the only service allowed to write application data; browsers must never access
the SQLite file directly.

## Frontend responsibilities

The frontend is responsible for presentation and user interaction only:

- Public operational-facility registry
- Generalised facility map
- State/operator/search filters
- Facility profiles and source links
- Environmental layer display
- Site candidate drawing and comparison
- Operator registration forms, later
- Ministry review screens, later
- Loading, empty, error, stale and restricted states
- Client-side form feedback before API submission

The frontend must not:

- decide whether a facility is publishable;
- calculate verification expiry as the authority;
- expose exact/restricted coordinates;
- invent missing capacity, power, water, PUE or WUE;
- read or modify SQLite directly;
- treat local storage as permanent evidence storage;
- make government-verification decisions.

### Frontend state ownership

| State | Owner |
|---|---|
| Server data and cache | TanStack Query |
| Temporary map/UI controls | React component state or Zustand |
| Non-sensitive display preferences | localStorage through Zustand persistence |
| Facility registry, submissions, reviews and evidence | Backend only |

## Backend responsibilities

FastAPI is the policy and data boundary. It must handle:

### Public registry

- Load/query currently operational facilities
- Apply 90-day publication freshness
- Filter by state, operator and search text
- Return only approved public fields
- Return only generalised public geometry
- Preserve capacity type, unit and scope
- Return field/source provenance
- Withhold stale, disputed, proposed and non-operational records
- Produce operational counts without summing incompatible capacity types

### Public environmental time series

- Poll official public sources through scheduled connectors
- Normalise AQI, pollutants, weather and water observations
- Cache observations and rollups in SQLite
- Associate facilities with public monitoring stations and store distance
- Serve 24-hour, 7-day, 30-day and longer filtered ranges
- Report source freshness, coverage and missing intervals
- Never fetch a third-party service during a user page request

### Source and verification management

- Record source URL, publisher, class and retrieval date
- Store source snapshots/hashes when lawful
- Maintain operational verification date and expiry
- Record reviewer and review outcome
- Handle conflicts and superseded claims
- Maintain aliases for facilities, campuses and operators

### Operator registration, later milestone

- Save private drafts and submissions
- Validate required fields and geometry
- Keep exact location and contact details restricted
- Prevent a submission from publishing itself
- Support request-information, reject and approve transitions
- Create immutable approved public snapshots
- Record every transition in an audit log

### Site planning

- Validate polygons and four-state scope
- Run environmental connector/screening operations
- Store observations and provenance
- Separate hard constraints from comparison metrics
- Return missing-data reasons
- Generate a site passport without granting legal approval

### Platform concerns

- Input validation and response serialization
- Role/permission checks, even with demo identities
- Transactions and optimistic concurrency
- Redacted errors and safe logs
- Pagination and query limits
- Database migrations
- Health, version and data-freshness endpoints

## SQLite data model

All structured records belong in one application SQLite database managed by
Alembic. Use foreign keys, check constraints, unique constraints, indexes and
transactions.

### Public facility registry tables

#### `facility_entities`

Stable real-world identity, independent of a particular public revision:

- `id` UUID
- canonical name
- operator entity ID
- ownership category
- facility type
- state code, city and locality
- lifecycle status
- first/last known operational dates
- created/updated timestamps

#### `facility_aliases`

- facility ID
- alias/name
- alias type: former name, operator name, campus label or source label
- effective dates
- source ID

#### `facility_public_snapshots`

Immutable approved public representation:

- snapshot ID and facility ID
- public name/operator/location text
- generalised longitude/latitude
- location precision
- operational verification status/date/expiry
- published/superseded timestamps
- approved payload JSON for reproducibility

Only the current, unexpired snapshot is returned publicly.

#### `capacity_disclosures`

- facility or snapshot ID
- numeric value and unit
- capacity type: IT load, total power, power capacity or unspecified
- scope: facility, combined facilities, phase, live phase or campus design
- lifecycle applicability
- source assertion ID
- effective/retrieval dates

Capacity disclosures are never automatically summed across different types or
scopes.

### Provenance tables

#### `public_sources`

- ID, title, publisher and URL
- source class/tier
- publication and retrieval dates
- content hash/snapshot reference
- licence/cache policy
- last access status

#### `source_assertions`

Field-level facts extracted from a source:

- source and facility ID
- field key
- typed value and unit
- claim text/notes
- lifecycle scope
- review status
- effective and expiry dates
- reviewer and timestamps

#### `verification_reviews`

- facility/assertion/snapshot target
- reviewer identity
- decision and reason
- reviewed and expiry timestamps
- conflict/missing-evidence flags

### Registration and governance tables

- `operator_entities`
- `operator_users` or external identity references
- `facility_registrations`
- `registration_revisions`
- `registration_evidence`
- `review_actions`
- `audit_events`

Registration tables remain private. Public snapshots are separate records.

### Site-planning and environmental tables

Retain and reconcile the existing tables:

- `projects`
- `candidate_sites`
- `project_phases`
- `data_sources`
- `ingestion_runs`
- `raw_snapshots`
- `observations`
- `metric_results`
- `score_runs`
- `authority_evidence`
- `developer_evidence`
- `metric_definitions`
- `monitoring_stations`
- `facility_station_links`
- `environmental_observations`
- `environmental_rollups`

The migration history must be repaired before adding new revisions because the
runtime database currently reports `03c_001` while the repository ends at
`03a_001`.

## Files that should not be stored as SQLite BLOBs

For this prototype, do not place large binaries in SQLite:

- policy PDFs and spreadsheets
- operator evidence documents
- satellite images and rasters
- compressed raw API snapshots
- generated reports

Store them under controlled directories. SQLite stores:

- stable relative path/object key
- SHA-256
- MIME type and byte size
- source, retrieval and publication dates
- access classification
- uploader/reviewer
- retention/expiry state

Small JSON API responses may be stored as JSON text when needed for audit or
reproducibility, but large raw data remains compressed on disk.

## SQLite operating rules

- Python 3.11 baseline
- SQLAlchemy sessions for new application tables
- Alembic-only schema evolution
- `PRAGMA foreign_keys=ON`
- bounded busy timeout
- WAL mode after compatibility testing for concurrent readers
- short write transactions
- no long network/file processing inside a database transaction
- one writer path through FastAPI
- regular consistent backups plus file-store backup
- integrity checks and migration-version checks at startup/health endpoints

SQLite is appropriate for a local prototype and limited ministry pilot. Move to
PostgreSQL/PostGIS when multiple backend instances, heavy concurrent writes,
large spatial queries or national production availability are required.

## API boundary

### Public, unauthenticated prototype endpoints

- `GET /api/v1/public-facilities`
- `GET /api/v1/public-facilities/summary`
- `GET /api/v1/public-facilities/{id}`
- approved public data-source and environmental endpoints

### Restricted operator endpoints, later

- create/update draft registration
- submit registration
- view own submission status
- upload/link evidence

### Restricted ministry endpoints, later

- review queue and registration detail
- request information/reject/approve
- manage publication snapshot
- reverify or suspend public facility
- view exact geometry and audit history

## Information lifecycle

```text
Credible public source
        -> source record
        -> field assertions
        -> reviewer verification
        -> immutable public snapshot
        -> public API
        -> React dashboard

Operator submission
        -> private revision
        -> ministry review
        -> approved field selection
        -> immutable public snapshot
```

At no point does the browser write directly to a public facility record.

