# Phase 02 technical handoff — proposed, not implemented

Phase01 automated foundation passes; Phase01D remains partial pending the native
browser acceptance gaps. This document is a design handoff, not authorization to
implement Phase02. Preserve the current React/TypeScript/Vite/MapLibre and FastAPI/
SQLite stack. No ORM, migration package, schema or routes were added here.

## Reuse and entry points

| Existing code | Reuse / boundary |
| --- | --- |
| frontend/src/app/router.tsx, components/layout/AppLayout.tsx | Keep all six legacy routes and layout; add project routes alongside them |
| components/map/MainMap.tsx | Keep basemaps/facility selection and mode-gated demo overlays; future project layers should have independent source/layer IDs and cleanup |
| components/site-analysis/SiteMapPicker.tsx | Reuse coordinate/viewport interaction and fresh callback conventions; 15km circle is an approximate screening buffer, never a parcel |
| pages/SiteAnalysis.tsx | Preserve snapshot/token/abort lifecycle; reuse patterns in a separate project-site editor |
| services/siteAssessments.ts | Keep legacy point assessment request/response; do not overload it with polygon semantics |
| stores/dashboardStore.ts | UI filters, current view/selection and explicitly scoped legacy browser context only |
| utils/savedContext.ts | Keep legacy isolation intact; do not silently upload browser fixtures as API project evidence |
| utils/planningReport.ts, pages/Reports.tsx | Preserve current screening exports; future Passport must be separate and versioned |
| backend/app/main.py | Keep facilities, cities, forecasts, assessments, mitigation, reports and ingestion compatibility |

Current ProposedSite is an assessment-result point with generated ID, cityId,
coordinates, capacity/demand fields and nullable screening observations. It is not
a parcel, persistent project entity, legal ownership record or verified site.
Saved comparisons currently have no enforced three-site cap. Phase02's maximum
three candidate polygons is a new project constraint, not a retroactive deletion rule.

## Frontend/server state separation

Keep ephemeral viewport, open panels, filters and selected project/site IDs in UI
state. Project/site/phase documents belong to the backend; use the installed query
library for fetching/caching and explicit invalidation. Do not duplicate authoritative
server documents in Zustand persistence. Draft inputs may be local and labelled
unsaved; associate each request with draft version and abort obsolete requests.
Cache keys must include project, authorization context, candidate and revision.
Switching projects/users must not show another project's stale result.

## Backend boundaries and SQLite conventions

Add narrow modules such as app/routers/projects.py, app/schemas/projects.py,
app/models/projects.py and app/db.py only when approved. Register a new APIRouter
under the existing API prefix; avoid extracting every legacy endpoint first.
Keep the current /facilities, /site-assessments, /forecasts and disabled Gemini routes
unchanged during the first slice. OpenAPI is the source for frontend contracts.

Current raw sqlite3 connections require explicit closing. The transaction context
commits on success and rolls back on failure but does not itself close the handle.
The caller owns a borrowed upsert connection; the callee closes only connections
it opened. Preserve atomic ingestion and Windows immediate-delete regressions.
Never hold a transaction open while calling a network provider.

Proposed SQLAlchemy/Alembic integration:

1. Pin reviewed compatible versions only in an approved implementation task; no
   installation occurs during this handoff. Introduce session-per-request ownership,
   explicit transaction scopes, rollback on error and guaranteed closure.
2. Use exactly the same resolved absolute DB path as the legacy connection layer.
   Rehearse on a copied database; record hash, row counts and payload samples first.
3. The initial migration adds only project-owned tables and indexes. Do not rebuild,
   rename, auto-reflect into destructive migrations or silently manage the existing
   facilities table. Review Alembic autogenerate output manually and restrict metadata
   scope so it cannot propose dropping legacy tables.
4. Enable/check foreign keys on ORM connections. Decide and test busy timeout,
   transaction locking and concurrent-write behavior consistently for both access
   paths. Do not change WAL/journal settings without backup/recovery tests.
5. Do not call metadata.create_all as a production migration strategy. Provide an
   explicit upgrade command and schema-version health check. Separate demo seeding
   from deployment migration execution; do not seed production projects on startup.
6. Test upgrade against both an empty DB and a copy containing legacy facilities.
   Test rollback/failure recovery. Any downgrade dropping project data needs explicit
   destructive-operation approval; backup restoration is the safer rehearsal path.

## Proposed schemas and invariants

| Entity | Minimum fields |
| --- | --- |
| Project | id UUID; owner_id/tenant_id from trusted identity; name; description; country='IN'; status='draft'; revision integer; created_at/updated_at UTC |
| CandidateSite | id UUID; project_id FK; name; geometry GeoJSON Polygon in EPSG:4326; area_m2 derived server-side; provenance/origin flag; revision; created_at/updated_at |
| ProjectPhase | id UUID; project_id FK; sequence; name; target_date; cumulative_it_load_mw; cumulative_power_demand_mw; cumulative_water_demand_kld; revision; created_at/updated_at |

Use unique(project_id, sequence). Enforce <=3 active candidate sites transactionally
on the server, including concurrent creates. Do not trust client counts. Validate
finite nonnegative numeric quantities; distinguish null (not supplied) from zero.
Choose decimal precision/units explicitly. Timestamps are UTC; target dates are
calendar dates. Do not claim project/site creation constitutes environmental readiness.

Cumulative phase targets are totals at each phase, not increments; do not sum them
again. First proposal: project-level milestones shared across all candidate
comparisons. Human decision needed before coding: are phases instead site-specific,
and may water/power demand decrease with efficiency changes? Do not enforce a false
monotonic rule before deciding this. IT capacity monotonicity and date ordering also
need explicit acceptance rules. Avoid optional override machinery until required.

## Polygon validation

Server validation must require a nonempty single Polygon with closed rings, finite
longitude/latitude coordinates, allowed coordinate count/payload size, nonzero area,
no self-intersection, and valid holes contained inside the outer ring. Reject NaN,
Infinity, wrong CRS, malformed nesting, unclosed rings and unsupported MultiPolygon
rather than silently repairing or simplifying survey boundaries. Decide hole support
and maximum vertices/area before implementation. Compute area geodesically or in an
appropriate projected CRS; degrees-squared is not square metres. Test winding,
precision and longitude/latitude reversal. India-wide eligibility requires a trusted
boundary source and agreed border policy; a bounding box is not official containment.
Until such evidence exists, return an explicit unverified geography status rather
than claiming cadastral/legal validation. Client validation is assistance, not authority.

## Authentication gate

No unauthenticated shared project-write endpoint. Choose the intended identity
provider/session design first, or explicitly restrict an initial local-only prototype
to a single developer and disallow public exposure. Derive owner/tenant server-side.
Authorize every list/read/write by project ownership; an opaque UUID is not access
control. Test cross-user enumeration and nested candidate/phase access. Add deployment
origin/CSRF/session protection appropriate to the chosen auth mechanism, rate/body
limits and redacted error logging. Do not reuse the ingestion key as per-user identity.

## Proposed API contracts

All endpoints under /api/v1; publish typed request/response schemas and stable errors.

- POST /projects ->201 Project; GET /projects -> paginated authorized list.
- GET /projects/{projectId} -> Project with revision; PATCH with expected revision
  or If-Match -> updated Project; stale revision ->409/412 (choose one convention).
- GET/POST /projects/{projectId}/sites -> list /201 CandidateSite. Fourth site ->409
  with code candidate_limit. PATCH /projects/{projectId}/sites/{siteId} validates
  geometry/revision. DELETE requires an explicit user action; decide soft deletion.
- GET/POST /projects/{projectId}/phases; PATCH individual phase. Validate phase
  ordering and cumulative-unit rules in one transaction. Reorder endpoint only if
  needed by the first UI; otherwise sequence is immutable in the first slice.
- 401 unauthenticated, 403 or non-disclosing404 unauthorized (choose consistently),
  404 absent, 422 field/geometry validation, 409 revision/limit conflict. Structured
  errors contain code, safe message and field details, never raw SQL or secrets.

Creation responses must return persistent IDs, revisions, timestamps, geometry and
explicit source status. No invented readiness score/evidence. Consider idempotency
keys for repeated POSTs; at minimum prevent retry double-submission in the UI and
test refresh/retry handling. No automatic browser-legacy import endpoint yet.

## Proposed routes and first vertical slice

Add /projects and /projects/:projectId with candidate/phase tabs or child routes
/projects/:projectId/sites/:siteId and /projects/:projectId/phases. Keep current
/dashboard, /risk-analysis, /forecast, /site-analysis, /mitigation and /reports working.

Dependency order: resolve identity/phase/polygon decisions -> migration rehearsal ->
authorized Project CRUD -> one validated CandidateSite -> one cumulative ProjectPhase
-> minimal create/open/edit UI -> reload round-trip -> maximum-three enforcement ->
conflict/error acceptance. No connector, document extraction, scoring or Passport.

## First-slice acceptance gates

- Existing114 frontend/17 backend tests remain green; complete Phase01D manual gaps.
- Migration leaves legacy facility rows/payloads intact and old API contracts working.
- Create project/site/phase, restart server and browser, retrieve identical persistent
  IDs/geometry/values; edits advance revision. Null and zero round-trip separately.
- Validate all invalid polygon cases and oversized payloads; no partial writes.
- Fourth-site rejection holds under concurrent requests. Failed phase/site edit rolls
  back without affecting other projects or legacy facilities; Windows DB handles close.
- UserA cannot read/write/list UserB projects or nested sites/phases.
- Stale requests/revisions cannot overwrite newer edits; cancellation/loading recovery.
- Demo and legacy browser data remain isolated and never silently uploaded/promoted.
- Cumulative phases use confirmed semantics; no double counting or unverifiable claims.
- Read-only exports clearly state unverified inputs and do not claim official approval.
- Document backup/restore, migration commands, chosen auth and scope restrictions.

## Decisions needing human agreement

Identity/tenant model and deployment audience; phases project-wide versus per-site;
cumulative demand decrease rules; required project fields and units/precision;
polygon holes/limits and India boundary authority; deletion/archive policy;
revision conflict convention; explicit legacy import policy. These are Phase02 entry
conditions, not reasons to rewrite the stabilized frontend or legacy facility backend.
