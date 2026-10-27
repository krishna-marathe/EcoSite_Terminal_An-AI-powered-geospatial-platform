# Phase 01D foundation acceptance

Date: 2026-10-27 Asia/Calcutta (browser/API timestamps are UTC on 2026-10-26).
Verdict: **PHASE 01D PARTIAL**. Automated gates pass; complete native-browser map,
download and print acceptance is still required. No Phase 02 implementation or
application behavior change was made in this acceptance pass.

## VERIFIED AUTOMATED

Commands ran from the repository root, sequentially (tests and build did not overlap):

| Command | Result | Exit |
| --- | --- | --- |
| `npm --prefix frontend run lint -- --no-cache` | PASS | 0 |
| `npm --prefix frontend run test` | 114/114, 13 files | 0 |
| `npm --prefix frontend run build` | TypeScript and Vite production build PASS | 0 |
| `backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -v` | 17/17 | 0 |
| `git diff --check` | PASS; CRLF conversion notices only | 0 |
| `git ls-files -u` | No unresolved index conflicts | 0 |

Toolchain actually used: Node 24.7.0, npm 11.5.1, backend venv Python 3.11.0.
Vite 8.3.4 emitted the existing >500 kB chunk warning (main JS about 2.08 MB,
589 kB gzip). No dependencies were installed or upgraded.

Regression coverage includes HTML injection, disabled Gemini, forecast identifiers,
SQLite closure/rollback, candidate races, callback freshness, mode-scoped saved
records and exports, CSV escaping, and environmental overlay lifecycle/provenance.
The Phase 01 regression files were present and executed. No test was weakened.

## Isolated startup and API verification

Normal database: `backend/data/ecosite.db`.
Before/after SHA-256: `669505be79419bd771ff2c2ccae1b1fbfa1b1a8aeaec8996571e157f00a9697a`.
Backend startup calls ensure_database then seed_facilities; normal startup is NOT
read-only. It may seed and refresh facility scores.

This run used a new database at:
`C:/Users/marat/AppData/Local/Temp/vscode-agent-codex-sandbox-vsep54/ecosite-01d-mFDkzu/acceptance.db`
The environment override was applied in the child process before importing app.main.
Uvicorn bound only 127.0.0.1:18000. Frontend bound 127.0.0.1:5187 with a temporary
Vite config proxying /api to 18000. Its envDir was the temporary test directory,
so the frontend did not load the user's normal environment file or Mapbox token.
No ingestion key or Gemini key was enabled for this server. The test browser used
this dedicated origin; its initial storage contained only the newly initialized
v2 dashboard key. Normal-origin browser records were not edited.

The temporary frontend config initially failed with EPERM while Vite attempted
an out-of-workspace .vite-temp cache. Retrying with --configLoader runner and
approved execution succeeded. This is test-harness setup, not an app source fix.

| Live route | Observed result |
| --- | --- |
| GET /health | 200, status ok, 6 seeded fixture records |
| GET /api/v1/cities | 200 |
| GET /api/v1/facilities?city=pune | 200, 3 synthetic fixture records |
| GET /api/v1/environmental-layers | 200, 4 unavailable metadata entries, no geometry |
| POST /api/v1/site-assessments | 200, requested name/demands preserved, insufficient data/null suitability |
| POST /api/v1/mitigation-plans | 200, deterministic recommendation |
| POST /api/v1/mitigation-plans/gemini | 503, controlled disabled response |
| POST /api/v1/forecasts | 200 for all five canonical metrics, 12 points each |

The browser successfully used the /api proxy for assessment and forecasts.
The optional /news route returned 503 with an honest unavailable panel. It is not
required for candidate, forecast or report operations.

## Security/privacy

Production frontend source/config scan found no private VITE_GEMINI_API_KEY
consumer, x-goog-api-key header or Google generative endpoint. Newly built assets
were checked for those references, provider-key patterns and locally configured
Gemini key values without printing values: no matches. The legacy storage key name
remains solely for removeItem retirement. API mode is not treated as verification.
Actual environment files were never edited. This is a focused check, not a full
penetration test or proof that historical deployed bundles contain no credentials.
Previously exposed credentials still require owner-driven rotation.

## Preservation and deliverables

All tracked/untracked files existing at the start were snapshotted in memory.
The acceptance pass adds only these documents under docs/implementation:
[acceptance](phase-01-foundation-acceptance.md),
[browser results/manual checklist](phase-01-browser-smoke-tests.md),
[Phase 02 handoff](phase-02-technical-handoff.md),
[limitations](known-limitations.md).
Existing source changes and untracked tests remain intact. No schema/source changes,
staging, commits, resets, cleaning or deletion were performed. The inaccessible
.pytest_cache directory was not modified; Git continued to warn about its access.

## Reproduce safely

Use separate terminals, a fresh temporary directory and a fresh browser profile/origin.
Do not start the usual backend command before setting its DB override.

```powershell
$testRoot = Join-Path $env:TEMP ('ecosite-acceptance-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $testRoot
$env:ECOSITE_DB_PATH = Join-Path $testRoot 'acceptance.db'
$env:ECOSITE_CORS_ORIGINS = 'http://127.0.0.1:5187'
$env:GEMINI_API_KEY = ''
$env:ECOSITE_INGESTION_KEY = ''
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 18000 --app-dir backend
```

Create a temporary Vite config importing the existing frontend/vite.config.ts,
override envDir to the empty test directory, server host to 127.0.0.1, port to
5187, strictPort=true, and proxy /api to http://127.0.0.1:18000. From frontend run:
`node node_modules/vite/bin/vite.js --config <temporary-config-path> --configLoader runner`.
Check health, record the normal DB hash again, and follow the browser checklist.
Use only test data in the dedicated origin. Stop the two test processes afterward;
retain temporary evidence if needed. Do not delete or reset real saved records.

## Suggested checkpoint — NOT EXECUTED

1. Review `git status --short`, `git diff --check` and each diff, including untracked tests.
2. Export/back up normal browser data and the normal SQLite database separately.
3. Resolve acceptance gaps in a separate approved behavior-fix task before claiming
   a complete release gate. Keep acceptance documentation honest in the meantime.
4. With explicit approval, use `git add -p -- <explicit paths>` for tracked hunks and
   `git add -- <explicit test/doc paths>` for new files; inspect `git diff --cached`.
   Do not use blanket git add .; do not include .env files, SQLite DBs, caches or
   machine-specific .vscode configuration without separate review.
5. Proposed dependency-ordered commits: forecast contract (01B.3); candidate
   lifecycle/callback tests (01C.1–2); saved-context contracts and exports (01C.3);
   environmental isolation/provenance (01C.4); foundation acceptance docs (01D).
   Review earlier completed phases already present in HEAD rather than recommitting
   unchanged code. Suggested last message: docs: record Phase 01 acceptance and Phase 02 handoff.

## Recorded working tree and final cleanup

Existing changes at this acceptance pass (preserved):

```text
 M frontend/src/components/layout/LeftSidebar.tsx
 M frontend/src/components/map/MainMap.test.tsx
 M frontend/src/components/map/MainMap.tsx
 M frontend/src/components/site-analysis/SiteMapPicker.tsx
 M frontend/src/components/worldmonitor/DataQualityBanner.tsx
 M frontend/src/components/worldmonitor/WorldMonitorLayerRibbon.tsx
 M frontend/src/data/demo/layers.ts
 M frontend/src/data/demo/wmLayers.ts
 M frontend/src/pages/Forecast.tsx
 M frontend/src/pages/Mitigation.tsx
 M frontend/src/pages/Reports.tsx
 M frontend/src/pages/SiteAnalysis.tsx
 M frontend/src/services/forecasts.ts
 M frontend/src/services/mitigation.test.tsx
 M frontend/src/services/siteAssessments.ts
 M frontend/src/stores/dashboardStore.ts
 M frontend/src/types/index.ts
 M frontend/src/utils/planningReport.ts
?? .vscode/
?? backend/tests/test_environmental_layers.py
?? backend/tests/test_forecast_contract.py
?? docs/browser-storage.md
?? docs/environmental-overlays.md
?? frontend/src/components/map/EnvironmentalLayers.test.tsx
?? frontend/src/components/site-analysis/SiteMapPicker.test.tsx
?? frontend/src/pages/Forecast.test.tsx
?? frontend/src/pages/SiteAnalysis.test.tsx
?? frontend/src/services/forecasts.test.ts
?? frontend/src/services/siteAssessments.test.ts
?? frontend/src/utils/environmentalLayers.ts
?? frontend/src/utils/savedContext.test.tsx
?? frontend/src/utils/savedContext.ts
```

Final byte comparison found zero changes to pre-existing tracked or untracked files.
Only the four acceptance/handoff documents were added. Normal DB hash remained
identical; actual environment-file hashes checked at final review were unchanged.
Frontend server stopped with Ctrl+C. Backend process-tree cleanup initially required
escalation after Access denied; the explicitly identified acceptance process tree
was then terminated successfully. Neither test server is intentionally left running.
Temporary database/config/API logs remain outside the repository for inspection.
