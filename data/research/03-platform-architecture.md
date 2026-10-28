# Proposed Ministry Platform Architecture

## Core principle

Operational telemetry, regulatory evidence, geospatial screening and public
reporting have different security and storage requirements. They must share a
common facility/site identity and provenance model, but should not be placed in
one unrestricted database or API.

## Frontend workspaces

1. National Command Overview
2. Live Facility Operations
3. Environmental and Infrastructure Map
4. New-Site Planning and Comparison
5. Water and Energy Planning
6. Compliance, Evidence and Inspections
7. City/State Scenarios
8. Public Transparency View with restricted fields removed

The MVP uses the public view as its primary dashboard. An operator-registration
page adds declared records and a ministry review state, but does not expose
private telemetry.

## Backend services

- Facility Registry API
- Telemetry Ingestion API
- Site Screening API
- Environmental Connector Service
- Compliance/Evidence API
- Alert and Incident Service
- Scenario/Forecast Service
- Reporting and Public-Data API
- Identity, role and audit service

The operator workflow also needs registration submission, revision, evidence
links and ministry review endpoints. Authentication can be mocked for the
prototype, but all submitted records must retain the declared operator identity
and review status.

## Location security - decided

- Store exact operator-submitted geometry as restricted data.
- Store independently generated public display geometry at locality/district precision.
- Ministry APIs may return exact reviewed geometry only after role checks.
- Public APIs return public display geometry and `location_precision`, never
  restricted geometry with coordinates rounded in the browser.
- Audit access to restricted facility locations.

For the MVP these can remain modules in one FastAPI application. The API
boundaries should still be defined so high-volume telemetry can be separated
later without rewriting the product.

## Storage

| Store | Responsibility |
|---|---|
| PostgreSQL/PostGIS | Facilities, projects, sites, permits, boundaries and spatial queries |
| Time-series store/partitioned PostgreSQL | Meter readings, KPIs, alarms and rollups |
| Object storage | Evidence documents and immutable raw source snapshots |
| Analytics tables | City/state aggregates, trends and scenarios |
| Redis/message broker, later | Live events, buffering and alert fan-out |

The five-hour MVP should continue using the existing SQLite database and demo
fixtures. PostgreSQL/PostGIS migration is post-MVP.

## Minimum API contracts

- `GET /api/v1/ministry/summary`
- `GET /api/v1/ministry/facilities`
- `GET /api/v1/ministry/facilities/{id}`
- `GET /api/v1/ministry/facilities/{id}/telemetry`
- `GET /api/v1/ministry/alerts`
- `POST /api/v1/projects/{id}/sites`
- `POST /api/v1/sites/{id}/screen`
- `GET /api/v1/sites/{id}/passport`
- `GET /api/v1/data-sources`
- `POST /api/v1/operator/registrations`
- `PATCH /api/v1/operator/registrations/{id}`
- `POST /api/v1/operator/registrations/{id}/submit`
- `GET /api/v1/operator/registrations/{id}`
- `POST /api/v1/ministry/registrations/{id}/review`

Registration submissions and their revisions are private by default. Public
facility records are produced from an approved publication snapshot rather
than directly exposing the mutable submission row. This prevents an operator
edit from bypassing ministry review.

Every API response containing evidence must expose data status, source,
observation time, retrieval time, unit, quality flags and processing version.

## Security roles

- Central ministry administrator
- State nodal officer
- Environmental regulator/inspector
- Utility authority
- Data-centre operator
- Analyst/read-only government user
- Public viewer

### Prototype identity decision

The one-day local prototype uses built-in demo identities for `OPERATOR` and
`MINISTRY_REVIEWER`. Role selection is a demonstration mechanism, not
authentication. Backend authorization paths and public/restricted serializers
must still be separate so production government SSO can replace the demo
identity provider without changing registration or review workflows.

Operational network topology, customer/workload identity, precise resilience
weaknesses and cybersecurity details must never enter the public API.

Production requirements include government SSO, MFA, encryption, tenant and
field-level authorization, immutable audit logs, document malware scanning,
rate limits, backups, disaster recovery and security review. These are not
realistically deliverable in the five-hour prototype.

## Scoring model

1. Run legal and environmental hard constraints.
2. Mark missing authority evidence explicitly.
3. Calculate separate power, water, biodiversity, community, hazard,
   connectivity and economic dimensions.
4. Show the dimensions and evidence coverage; do not hide them behind one
   unexplained score.
5. Allow a combined comparison score only with versioned ministry-approved
   weights and a full calculation trace.

