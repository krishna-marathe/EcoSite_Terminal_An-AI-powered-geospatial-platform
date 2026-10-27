# Phase 02B completion — approved screening boundary

Current verdict: COMPLETE (preliminary screening scope only). The earlier checkpoint below is historical and its boundary blocker is resolved.

- Bundled gbOpen India ADM0 boundary IND-ADM0-67634026, version 9469f09, CC0 1.0; raw bytes match Git LFS SHA-256 77fb5cb03be9970e638fa38d1bd6a377ea7e158b4dfd1a511067925442233443. See [dataset attribution/configuration](../../backend/data/boundaries/README.md) and [manifest](../../backend/data/boundaries/IND-ADM0-manifest.json).
- No environment variables or request-time download are needed for the default. Existing explicit overrides remain supported and fail closed if incomplete. No actual environment file was changed.
- New migration 02b_002 adds boundary_screening JSON with version/licence/source URL, screening-only marker, review status and policy distance. Existing rows retain all data and receive an empty metadata object, displayed as requiring review. No historical record is silently approved. Geometry updates recompute provenance/status; non-geometry edits preserve it.
- Full containment remains mandatory. Covered polygons within the conservative 5 km review band are saved with review_required. Crossing/nearby outside polygons receive controlled 422 boundary_review_required, no save. Clearly outside polygons receive 422 invalid_geometry. Survey of India is the preferred authoritative reference. The band is not dataset accuracy or legal verification.
- New tests: actual bundled mainland, coast, Andaman and Lakshadweep geometry; crossing boundary review; clear outside rejection; checksum/provenance; API persistence/error code; frontend review labels. 126 frontend tests and 48 backend tests passed; lint/build passed. Build retains the existing large-chunk warning.
- Empty and disposable legacy-copy migrations through 02b_002 passed, including idempotence, Alembic metadata check, integrity_check and preservation of existing candidate fields and all six facilities.
- Isolated real Chrome: three MapLibre clicks, finish, save drawn polygon and reload PASS (three vertices restored). Pasted Pune polygon import/save and displayed pinned provenance also PASS. No mock tile substitutions used. Previous external-tile failures remain an environment reliability caveat, not a reason to disable import/edit.
- No normal database migration or commit. Phase 02C not started.

Completion files: bundled GeoJSON/manifest/README; geometry loader/classifier; candidate schema/model/router; schema revision and new migration; Projects service type/page; backend India-boundary and candidate tests; frontend Projects test; this handoff. Earlier Phase 02A/02B changes retained.

---

# Phase 02B — Candidate site polygons

Status: PARTIAL pending an approved India screening boundary and live map-drawing acceptance with accessible tiles.

## Storage and API

Migration 02b_001 follows 02a_001. It adds candidate_sites only; facilities and projects are retained. Candidate records contain UUID, project UUID foreign key, name, WGS84 Polygon GeoJSON, geodesic hectares, user-supplied state_code/district, canonical geometry SHA-256, boundary checksum/source, revision, active/archived status and UTC timestamps. State codes are syntax-validated (IN-XX), not geographically verified.

- POST/GET /api/v1/projects/{project_id}/sites creates/lists active candidates; include_archived=true includes archived records.
- GET/PATCH/DELETE /api/v1/sites/{site_id}, also available under the nested project path.
- PATCH requires expected_revision. DELETE soft-archives and requires expected_revision query parameter. PATCH status=active restores, subject to the limit.
- Stale revisions and a fourth active candidate return 409. Invalid geometry returns 422. Missing boundary configuration returns controlled 503.
- SQLite BEGIN IMMEDIATE serializes site mutations; database triggers enforce the three-active-candidate limit on insert/update, including concurrent writes and restores. Transactions roll back on failure.
- Local single-user access restrictions from Phase 02A apply. This is not authenticated multi-user ownership.

## Geometry and configuration

Pinned Shapely 2.1.2 validates topology; PyProj 3.7.2 measures WGS84 ellipsoidal area, subtracting holes. Only closed, finite, two-dimensional Polygon geometry is accepted (maximum 2000 positions and 10 holes). Empty/degenerate/self-intersecting rings, invalid holes and polygons not fully covered by the configured boundary are rejected. Hashes normalize ring direction/start position.

No India boundary is bundled or downloaded. There is no bounding-box fallback. Supply an approved WGS84 GeoJSON Polygon/MultiPolygon geometry file and set these server-only environment variables:

- ECOSITE_INDIA_BOUNDARY_PATH: absolute path to that geometry file.
- ECOSITE_INDIA_BOUNDARY_SHA256: SHA-256 of its exact bytes.
- ECOSITE_INDIA_BOUNDARY_SOURCE: attributable dataset name/version and licensing reference.

The boundary selection, territorial policy, version and licensing need human approval. Restart after replacing the configured boundary. Successful screening is not legal parcel, state/district or land-ownership verification. Missing/mismatched configuration disables geometry writes; existing reads and non-geometry changes remain available.

Install backend requirements using the existing backend virtual environment. Run Alembic against an explicitly selected disposable ECOSITE_DB_PATH first:

    backend\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head

Normal database migration was not performed in this checkpoint. Existing Phase 02A schema must be upgraded before project/site endpoints can be used.

## Frontend

/projects provides project selection/creation, up to three active polygon candidates, MapLibre click-to-draw, coordinate-based vertex editing, pasted GeoJSON or file import (256 KiB limit), save and archive. Project/site IDs in the URL restore selected saved polygons after reload. Unsaved drafts are not persisted. Local backend projects remain separate from legacy Demo/API browser comparisons; legacy point selection is preserved. No polygon assessment or readiness scoring is implied.

## Validation executed

- Frontend: 125 tests passed (116 existing + 9 new), lint and production build passed. Existing Site Analysis tests now include router context for the new navigation link. Build retains the large-chunk warning.
- Backend: 43 tests passed (32 Phase 02A baseline + 11 new). Coverage includes geometry/holes/hash, validation, persistence, revisions, parent isolation, archive/restore, concurrent candidate limit and fail-closed boundary behavior.
- Migration rehearsal: empty database and disposable copy of the normal legacy database upgraded through 02a_001 to 02b_001; repeated upgrade idempotent; inserted pre-upgrade project preserved; all six legacy facility rows preserved; integrity_check=ok.
- Real isolated headless Chrome + disposable SQLite: project creation, pasted Polygon import/save, selected polygon reload, coordinate edit/reload (revision increment), GeoJSON Feature file import/save, archive/removal from active list verified.
- Browser geometry tests used an explicitly synthetic local test boundary. They do not verify containment against an approved India dataset.
- Carto requests failed with ERR_NETWORK_ACCESS_DENIED. Existing map error overlay blocked canvas pointer interaction. Actual live drawing and visual basemap/polygon alignment remain NOT VERIFIED; deterministic MapLibre interaction tests pass. No tile-provider bypass or unrelated map change was made.
- A browser response waiter timed out and reset the harness; servers were restarted against the same disposable database and edit/import/archive were rechecked successfully.

## Files for Phase 02B

New: backend/app/geometry.py; backend/app/models/sites.py; backend/app/schemas/sites.py; backend/app/routers/sites.py; backend/migrations/versions/02b_001_candidate_sites.py; backend/tests/test_candidate_sites.py; frontend/src/services/projects.ts and projects.test.ts; frontend/src/components/site-analysis/PolygonEditor.tsx; frontend/src/pages/Projects.tsx and Projects.test.tsx; this document.

Extended: backend/requirements.txt; backend/app/main.py; backend/app/db.py; backend/app/routers/projects.py; backend/migrations/env.py; backend/tests/test_projects.py; frontend/src/app/router.tsx; frontend/src/components/site-analysis/SiteMapPicker.tsx and SiteMapPicker.test.tsx; frontend/src/pages/SiteAnalysis.tsx and SiteAnalysis.test.tsx.

Pre-existing Phase 02A work and editor configuration retained. No staging, commit, reset, cleanup, actual environment-secret edit or normal database migration. No project phases, GIS provider integration, evidence engine or scoring added.
