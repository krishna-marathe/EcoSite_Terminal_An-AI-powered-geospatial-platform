# EcoSite India — API and Data Contract Register

**Owner:** Krishna (reviewers: Omar, Siddharth, Samarth)  
**Snapshot:** 27 October 2026; **draft for Phase B**, not an assertion that future routes exist.  
**Authoritative implemented contract:** the checked-out FastAPI `/openapi.json` and corresponding Pydantic schemas. Verify branch/HEAD before integration.

## 1. Non-negotiable conventions

- Base prefix `/api/v1` except existing `/health`.
- IDs are UUIDs in new Project APIs. Timestamps are UTC ISO 8601; dates are unambiguous `YYYY-MM-DD`.
- Geometry is WGS84 GeoJSON Polygon at boundaries; site area derived geodesically in hectares. Existing India ADM0 test is **screening-only**, not authoritative state/district/parcel verification.
- Canonical engineering units: MW, kWh where needed, KLD for water, hectares for site area, fractional `coverage_fraction` in `[0,1]`; never silently treat MVA as MW or MLD as KLD.
- `ProjectPhase` facility peak/IT loads are **cumulative campus values** at milestones. Water peak-summer >= average; water values need not increase between phases.
- Unknown/unavailable is distinct from zero, safe, not applicable, unsupported-by-evidence or proven physical shortage.
- Every factual assertion should be scoped to project/site/phase/time and linked to evidence/provenance when available. A source-backed observation does not become a verified legal claim.
- Existing Project/Site/Phase mutations use revision/409 semantics where implemented. For any new API, specify exact optimistic-concurrency behavior before coding.
- Loopback-local guarding in Phase 02 is **not production authentication**. Do not expose new private evidence endpoints to a public network without authorization and file-access controls.

## 2. Existing implemented endpoint families (inspect actual OpenAPI)

| Group | Source-reported routes and semantics | Implementation status |
|---|---|---|
| Health | `GET /health` | Existing |
| Projects | `POST/GET /api/v1/projects`; `GET/PATCH` and archive/restore at `/api/v1/projects/{id}` | Phase 02A implemented; verify exact verbs and schemas in source |
| Candidate Sites | `POST/GET /api/v1/projects/{project_id}/sites`; `GET/PATCH/DELETE /api/v1/sites/{site_id}`; nested variants exist | Phase 02B implemented; 3-active limit, revision checks, boundary-review errors |
| Project Phases | `/api/v1/projects/{project_id}/phases` and phase edit/archive APIs | Phase 02C code implemented; acceptance pending; read exact endpoints from OpenAPI |
| Legacy | facilities, cities, risk, site assessment, synthetic forecasts, mitigation, environmental-layers metadata, news, ingestion, reports | Preserve; **not** new readiness or verified GIS |

**Current migration chain reported:** `02a_001 -> 02b_001 -> 02b_002 -> 02c_001`. Normal DB may lack Alembic tables; schema-not-ready can return 503. Do not run migrations on normal DB without approval/backup.

## 3. Planned interfaces: proposed, not implemented

Before coding Phase B, agree final Pydantic schemas, list pagination, error envelopes, allowed verbs, document-size limits and access checks. These URLs are **route proposals**, not claims that the backend currently supports them.

| Workstream | Proposed path | Responsibility |
|---|---|---|
| Evidence artifacts | `POST/GET /api/v1/projects/{project_id}/evidence` | Private upload + metadata/listing; Krishna API, Omar UI |
| Evidence artifact | `GET /api/v1/evidence/{artifact_id}` | Authorized metadata/secure file fetch design |
| Assertions | `POST/GET /api/v1/projects/{project_id}/assertions` | Scoped claim CRUD + version/audit semantics |
| Assertion review | `POST /api/v1/assertions/{assertion_id}/reviews` | Review outcome and method, not automatic government verification |
| Document extraction | `POST /api/v1/evidence/{artifact_id}/extract` | Async or bounded parsing job; Samarth/Krishna |
| Extraction candidates | `GET /api/v1/evidence/{artifact_id}/extractions` | Page-linked proposed values |
| Human confirmation | `POST /api/v1/extractions/{extraction_id}/confirm` | Create/update reviewed assertion; no auto-verified status |
| Power commitments | `POST/GET /api/v1/projects/{project_id}/power-commitments` | Site/phase/date-scoped |
| Water commitments | `POST/GET /api/v1/projects/{project_id}/water-commitments` | Source and phase scope |
| GIS jobs | `POST /api/v1/sites/{site_id}/environmental-analysis` | Persisted analysis job, source & dataset versions |
| Analysis status | `GET /api/v1/analysis-jobs/{job_id}` | Queued/running/completed/failed |
| Observations | `GET /api/v1/sites/{site_id}/observations` | Real values + coverage and limitations |
| Readiness | `POST /api/v1/projects/{project_id}/readiness-runs` | Deterministic findings from frozen inputs |
| State screening | `GET /api/v1/projects/{project_id}/regulatory-screening` | Versioned rule metadata and unknown coverage |
| Comparison | `POST /api/v1/projects/{project_id}/comparisons` | Up to three sites and independent dimensions |
| Passport | `GET /api/v1/assessment-runs/{run_id}/passport` | Reproducible report based on immutable run |

## 4. Proposed data records (Phase B contract review)

### EvidenceArtifact (private)

| Field | Type / meaning |
|---|---|
| `id`, `project_id`, `site_id?` | UUIDs; site optional if campus-wide |
| `document_type` | `DPR`, `UTILITY_APPLICATION`, `UTILITY_SANCTION`, `WATER_ALLOCATION`, `WATER_STUDY`, `PLANNING`, `OTHER` (draft; revise with Siddharth/Samarth) |
| `filename`, `mime_type`, `file_size_bytes`, `sha256` | Stored file metadata; filename never trusted as disk path |
| `issuer?`, `reference?`, `issued_on?`, `valid_until?` | Source information, **not** authenticity |
| `visibility` | `PROJECT_TEAM`, `RESTRICTED_REVIEWER`, optionally `PUBLIC_SUMMARY` after redaction |
| `synthetic_demo` | Boolean; synthetic documents must remain unmistakable |
| `uploaded_by`, `uploaded_at` | Authorized identity/time; seeded demo reviewer ≠ official issuer |

### Assertion

| Field | Type / meaning |
|---|---|
| `id`, `project_id`, `site_id?`, `phase_id?` | IDs / explicit scope |
| `field_key` | Canonical semantic field, e.g. `sanctioned_grid_mw`, `peak_summer_water_kld` |
| `value`, `unit` | Typed/normalized value and original-unit retention where appropriate |
| `scope_type`, `scope_detail?` | Full campus / phase / candidate / connection/source |
| `asserted_by`, `asserted_at`, `effective_from?`, `effective_to?` | Provenance, validity |
| `supersedes_assertion_id?` | Revision lineage; preserve old evidence |
| `evidence_artifact_ids[]` | Supporting document IDs, optionally page ranges via join table |
| `revision` | Optimistic concurrency integer (proposed) |

Displayed evidence state must derive from source, verification/review, expiry, supersession and conflicts. Proposed vocabulary: `DECLARED`, `DOCUMENTED`, `VERIFIED_WITHIN_SCOPE`, `EXPIRED`, `SUPERSEDED`, `CONFLICTING`, `MISSING`. These are **not** interchangeable; a conflict is also a finding, not a reason to erase originals.

### ExtractionCandidate (Samarth -> backend -> Omar)

```json
{
  "document_id": "<uuid>",
  "document_type": "UTILITY_SANCTION",
  "page_number": 2,
  "field_key": "sanctioned_grid_mw",
  "raw_text": "Sanctioned load: 40 MW",
  "normalized_value": 40,
  "unit": "MW",
  "phase_scope": "PHASE_1",
  "method": "RULE_BASED",
  "model_version": null,
  "confidence": null,
  "review_status": "PENDING"
}
```

Illustrative **proposed DTO**: Samarth must supply real field provenance and any calibrated confidence; never fabricate confidence or grant verification. Confirm `document_id` vs `artifact_id` naming before implementation.

### EnvironmentalObservation (Siddharth -> API -> Omar)

```json
{
  "site_id": "<uuid>",
  "indicator": "historical_water_overlap_pct",
  "value": null,
  "unit": "%",
  "status": "SOURCE_UNAVAILABLE",
  "source_id": "JRC_GSW",
  "dataset_version": null,
  "observation_start": null,
  "observation_end": null,
  "retrieved_at": null,
  "geometry_hash": "<hash>",
  "processing_version": "1.0",
  "coverage_fraction": null,
  "limitations": "Awaiting provider access and validated spatial processing"
}
```

This is a **missing-source response example**, not a real measurement. Never manufacture values or dataset timestamps.

## 5. Resource-engine calculation semantics (design, not yet API code)

- Power: distinguish required net grid MW, requested, sanctioned, energized and evidence-backed deliverable capacity. Count only commitments valid for that **candidate**, full/phase scope and commissioning date. Unknown capacity is not necessarily a proven physical deficit.
- PUE consistency: `implied_pue = facility_peak_mw / it_peak_mw` for compatible simultaneous load definitions; warn on discrepancies, do not alter inputs.
- Water: compare **peak-summer KLD** minus valid non-double-counted internal reuse against source-specific evidenced external supply; document missing physical delivery/entitlement separately from stress context.
- Comparison: preserve four independent dimensions — **resource readiness, environmental exposure, regulatory/site readiness, evidence completeness**. No opaque universal score or legal approval verdict.

## 6. Error and trust-state contract

Existing errors may differ; inspect source before asserting the concrete wire envelope. New APIs should consistently distinguish:

| Condition | Proposed HTTP status / behavior |
|---|---|
| Malformed input / invalid unit or geometry | 422 with field-level detail and stable error code |
| Unknown project, site, artifact | 404 without leaking other tenants' private records |
| Stale revision / active-candidate limit | 409, with stable code |
| Unauthenticated / unauthorized | 401 / 403 once auth is implemented |
| Required schema unavailable | 503 `schema_not_ready` |
| External source unavailable | Preserve a structured `SOURCE_UNAVAILABLE` observation/job result, not a zero-valued success |
| Reviewer simulated | `SIMULATED_REVIEW` with explicit status; **never** `GOVERNMENT_VERIFIED` |
| Missing rule/source coverage | `COVERAGE_UNAVAILABLE` / `AUTHORITY_CONFIRMATION_REQUIRED` |

## 7. Contract freeze checklist before Phase B code merges

- [ ] Inspect actual `/openapi.json` and current Pydantic models; mark exact **implemented** verbs/fields.
- [ ] Krishna/Omar approve request/response shapes and UI error handling.
- [ ] Krishna/Samarth approve document extraction candidate DTO, units and page provenance.
- [ ] Krishna/Siddharth approve observation DTO, coverage, source registry and dataset licences.
- [ ] Approve roles and access checks for sensitive uploads; loopback-only is **not** adequate for public deployment.
- [ ] Add contract tests for all new endpoints and document versioning/409 behavior.
- [ ] Update this file only after team review; move proposals into the implemented section **after tests pass**.
