# EcoSite India — Current Project State

**Snapshot date:** 27 October 2026  
**Status:** Team synchronization / Phase A — **Phase 02C closed (COMPLETE)**  
**Document owner:** Krishna  
**Source:** Latest Antigravity verification on branch `krishna_updated` at HEAD `0d19f0d`.

## 1. Product goal

India-wide, **data-centre-only** pre-investment screening of candidate sites and their complete phased power/water needs, environmental observations, policy coverage and document evidence. Output is an explainable, reproducible **Site Readiness Passport**; no automated statutory approval.

Hard rules: unknown ≠ safe; synthetic ≠ observed; documented ≠ authentically verified; a nearby substation ≠ spare MW; Phase-1 sanction ≠ full-campus readiness; official policy ≠ mandatory permit; satellite results ≠ legal clearance.

## 2. Latest audited Git/database baseline (verify again locally)

| Property | Last reported value |
|---|---|
| Working branch | `krishna_updated`, tracking `origin/krishna_updated` |
| Last audited HEAD | `0d19f0d` (27 Oct 2026) |
| Working tree at audit | Clean; no unmerged paths |
| Integration branch for team | **NOT YET AGREED** — decide in Phase A; do not assume local `master` is current |
| Local `master` at audit | Behind remote, at `27eb14e` |
| Existing stash | `stash@{0}` preserved untouched |
| Main schema migration chain | `02a_001 -> 02b_001 -> 02b_002 -> 02c_001` |
| Normal SQLite DB | `backend/data/ecosite.db` preserved untouched (20,480 bytes, 6 legacy facilities) |
| Boundary | Bundled `geoBoundaries gbOpen IND ADM0`, version `9469f09`, checksum pinned, screening-only with 5 km review band |

**After any new pull, merge, commit or PR:** update branch, HEAD, tests and DB state. Never present this dated snapshot as today's verified condition.

## 3. Verification status from Phase 02C closure audit

| Check | Actual reported result |
|---|---|
| Backend suite | **56/56 PASS** (all projects, sites, phases, pilot, boundary, forecast, and security tests) |
| Frontend lint | **PASS** (`eslint . --no-cache`, 0 errors, 0 warnings) |
| Frontend build | **PASS** (`tsc -b && vite build`, production bundle generated) |
| Full frontend suite | **133/133 PASS** across 17 test files (testTimeout: 10000 set for jsdom load) |
| Browser Phase 02B | Map polygon draw/save/reload and GeoJSON import previously verified |
| Browser Phase 02C | **PASS** — verified Phase 1, Phase 2, Phase 3 creation, PUE warning, edit, archive, and reload |
| Native report printing | Preview/readability **not verified**; CSV/JSON downloads previously verified |
| Phase 02C migration | **PASS** on empty disposable DB and disposable copy of legacy `ecosite.db`; normal DB untouched |

## 4. What is actually implemented

| Work | Status | Reality check |
|---|---|---|
| Phase 00/01 — audit and stabilization | Implemented, regression covered | Map HTML, secrets, forecasts, requests, saved modes and overlays stabilized |
| 02A — persistent Project CRUD | Implemented | Local/loopback-only guard, no production multi-user ownership |
| 02B — candidate polygons | Implemented | Up to 3, WGS84 geometry, active limit, versioned screening boundary; **not land-ownership verification** |
| 02C — ProjectPhase API/editor | **COMPLETE** | Cumulative IT/facility MW, dates, PUE warning, water, revision validation, migrations and browser lifecycle verified |
| Environmental layers | Synthetic demo overlays or unavailable metadata | **No real GIS observations integrated yet** |
| Forecasts | Legacy synthetic illustrations | Not trained/validated environmental predictions |
| Gemini mitigation | Disabled; deterministic mitigation available | No live AI provider calls |
| Evidence graph/documents | Not implemented | Next foundation priority |
| Power/water readiness engines | Not implemented | Need evidence-scoped resource commitments |
| State regulatory rule packs | Not implemented | Source research ongoing |
| Passport/site comparison | Not implemented | Existing legacy reports are **not** the Passport |
| Trained site-suitability model | Not implemented and **out of MVP scope** | No validated training outcomes |

## 5. Next work: Phase A (in parallel)

- **Krishna:** Phase 02C closed; reconcile team integration branch/PR convention, freeze draft Evidence API/schema for Phase B.
- **Siddharth:** Dataset source registry for JRC, SRTM, Sentinel-2 and CGWB; access/licence tests; seven-state policy references (branch `feature/siddharth-data-sources` prepared).
- **Omar:** Full-suite frontend timeout resolved via Vitest configuration (testTimeout: 10000); Phase 02C browser workflow verified; continue Evidence UI mock contract.
- **Samarth:** Document taxonomy, labelled synthetic PDF dataset spec, deterministic extraction/classification baseline.

**Phase A gate:** everyone agrees on Git baseline, ownership, evidence/extraction contracts and dataset status; backend/frontend validation and 02C browser/migrations are recorded truthfully. No one must wait to complete independent research or mock UI work.

## 6. Next phases (planned, not implemented)

| Phase | Outcome | Principal owners |
|---|---|---|
| B | Evidence artifacts, scoped assertions, review and upload | Krishna API; Omar UI; Samarth parser; Siddharth document taxonomy |
| C | Site- and phase-scoped power/water commitments and deterministic gaps | Krishna engines; Omar timeline; Siddharth authority paths; Samarth conflict fixtures |
| D | Real GIS observations (JRC/SRTM first, then Sentinel/CGWB where workable) | Siddharth connectors; Krishna observations/jobs; Omar map |
| E | Evaluated document classifier/extraction and human review | Samarth with Krishna/Omar integration |
| F | Versioned state screening, 3-site comparison and reproducible Passport | Siddharth sources; Krishna engines; Omar UX; Samarth explanation QA |
| G | Security, browser/e2e acceptance, data licensing, deployment, demo | All four |

**P0 cutline:** Project/Site/Phase persistence + evidence uploads and status + power/water findings + 2–3 real source-backed GIS indicators + basic state screening + A/B/C comparison + reproducible Passport. An ML model is optional to the P0 demo.

## 7. Risks / unresolved decisions

- Agree the authoritative integration branch: `master` or `krishna_updated`; inspect remote before any ref movement.
- Inspect the old stash safely; distinguish old work from commits, avoid accidental reapplication.
- Phase 02C: latest full frontend suite had 3 timeouts; browser/migration close-out unrecorded.
- Normal DB requires a separately approved, backed-up Alembic upgrade before live project workflows.
- Current users are loopback-local only; real developer/government roles and authorization remain planned.
- API mode has no real environmental observations; no live spare-grid-capacity or parcel-level zoning feed.
- Document access/licensing and official rule effective dates must be checked per source.
- CSV/JSON exports were checked; native print-preview layout remains an acceptance limitation.

## 8. Updates and handoff

Krishna updates this **after each merged PR or approved phase gate**, with: date, HEAD, migration, passing/failing suite counts, browser verification, new known issues, current task owner and next dependency. Don't overwrite audit facts with unexecuted assumptions.

See [team assignments](TEAM_TASKS.md) and [API/data contracts](../contracts/API_CONTRACTS.md). The complete four-member plan is the separately shared **EcoSite India Four-Member Master Implementation Plan v2.0**; retain it as a single reference rather than duplicating its full text here.
