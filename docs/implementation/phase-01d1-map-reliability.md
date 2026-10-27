# Phase 01D.1 — MapLibre browser reliability

Date: 2026-10-27 Asia/Calcutta. Verdict: **PHASE 01D.1 COMPLETE** for the scoped
reproduced defects and controlled browser sequence. Phase01D still has separate
native download/print acceptance gaps; Phase01D.2 and Phase02 were not started.

## Diagnosis and evidence before editing

Fresh origin http://127.0.0.1:5188 used an empty test-origin browser storage and an
isolated SQLite database, supplied via ECOSITE_DB_PATH before backend import.
Backend port18001 and frontend port5188 bound only loopback. Vite envDir was an
empty temporary directory: no production provider credentials were used.

Initial map: loaded/style-loaded/tiles-loaded true, three markers, CARTO tile HTTP200.
Instrumented MapLibre setStyle/remove and style.load/load/idle/error events in the
test page only; no diagnostic globals were added to application source. React
StrictMode creates and removes a development-only map before its replacement.
Both instances can retain the same connected container. The earlier acceptance
probe that selected the first React-held instance could read a disposed map with
an empty style. Selecting a connected container alone is not a valid liveness test.
The original intermittent fully unloaded active basemap was not reproduced in the
controlled fixed-size session; do not claim every earlier symptom had one cause.

Two application defects were reproduced:

1. Switching Dark Matter to Positron produced a loaded basemap but only carto-light
   remained: all six demo sources disappeared. style.load is safe for adding sources,
   but map.isStyleLoaded() can still be false while source data loads. The old guard
   returned early and no idle retry restored overlays.
2. Returning to Dashboard with a non-default style created that style and then
   redundantly called setStyle again. prevStyleRef began as dark rather than the
   constructed style. Instrumentation recorded two carto-light calls on the same
   replacement map and the browser warned: Style is not done loading; rebuilding.

Classification: both above are confirmed application defects. The broad unloaded
basemap observation is intermittent/unreproduced here and partly confounded by the
old probe. No provider outage, missing token or WebGL context loss caused the two
confirmed defects. Initial and successful later tile requests returned200. The
configured styles are inline raster specifications; no sprites/glyphs are required.
Mapbox credential behavior was not tested and no secret values are included here.

## Minimal correction

- MainMap.tsx: syncEnvironmentalLayers accepts an authoritative style.load event
  flag. That event can reconcile sources without waiting for tile/source readiness;
  ordinary calls keep their readiness guard. API-mode removal remains first and
  cannot add bundled geometry. This does not claim tiles are available.
- MainMap.tsx: initialize prevStyleRef with the style actually constructed, avoiding
  a redundant reset on remount. No provider, map architecture, scoring, storage or
  API contract changes.
- EnvironmentalLayers.test.tsx: simulate style.load before source readiness, add
  non-default StrictMode remount and rapid-style/mode regression tests; stub the
  optional public token in tests for deterministic non-secret configuration.

Before the production fix, the two new tests and the strengthened existing
style-restoration test failed. Afterward all11 overlay tests passed. Existing source
and fixture work was preserved; textContent facility-name rendering is unchanged.

## Actual browser revalidation

At desktop dimensions, use native Dashboard→Risk→Dashboard links; wait for the
active replacement map's loaded state, not an arbitrary delay. Change basemap via
its menu; wait for both target raster source and loaded state. Repeat across ESRI
Satellite, Dark Matter and Positron Light. Then toggle/adjust groundwater, switch
Demo→API, change style, switch back. Use real pointer pan and zoom controls.

| Check | Actual result |
| --- | --- |
| Initial load and WebGL | PASS; active context, loaded tiles, three markers |
| Return navigation | PASS for three post-fix cycles, including non-default styles |
| Basemap changes | PASS for CARTO Light/Dark and ESRI Satellite |
| Overlay restoration | PASS; six demo sources plus basemap, eleven overlay layers |
| Visibility/opacity | PASS; groundwater off=0; keyboard-adjusted opacity=0.15 |
| Demo→API | PASS; only carto-light remained, no bundled source |
| API style change | PASS; only carto-dark remained |
| API→Demo | PASS; six sources restored and opacity0.15 retained |
| Resource ownership | PASS; seven observed StrictMode/navigation instances, exactly one live style at final inspection |
| Marker interaction | PASS for native solar-farm click after zooming in; selected=true and selection zoom8.5 |
| Zoom/pan | PASS; native controls and drag changed center from [73.8367,18.5054] to [73.73799,18.54295] |
| City selection | PASS; Mumbai center [72.8777,19.076], three markers |
| Console/network | No recorded MapLibre error events after fix; no repeated-style warning in corrected cycles; 162 completed CARTO/ESRI resource entries reported200 |

Some zoom/selection requests were aborted when superseded (net::ERR_ABORTED), not
HTTP provider failures. The optional news relay continued to return503 with its
unavailable UI. No arbitrary sleeps were used as load correctness gates.

Pointer timeout reproduced independently: at low zoom the selected industrial
marker's check badge intercepted the substation marker click. It was actual DOM
occlusion, not unloaded-map state. A separated marker was clickable after zooming.
Existing overlap behavior is left intact rather than introducing clustering or
changing selection layout in this checkpoint. Narrow-viewport panel obstruction
from the earlier run remains a separate visual usability limitation.

## Sequential automated validation

| Exact command from repo root | Result / exit |
| --- | --- |
| npm --prefix frontend run lint -- --no-cache | PASS /0 |
| npm --prefix frontend run test |116/116, all prior114 retained /0 |
| npm --prefix frontend run build | PASS /0; existing >500kB chunk warning |
| backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -v |17/17 /0 |
| git diff --check | PASS /0; existing CRLF notices only |

Normal backend/data/ecosite.db SHA-256 remains
669505be79419bd771ff2c2ccae1b1fbfa1b1a8aeaec8996571e157f00a9697a.
No schema, actual environment-secret, saved-context, candidate lifecycle or Gemini
changes. Only MainMap.tsx, its overlay test file, this report and a follow-up note
in known-limitations.md changed in this checkpoint. No staging/commit/reset/clean.
The inaccessible .pytest_cache is untouched.

## Limits and next checkpoint

This is bounded browser verification, not a long-duration/network-outage soak or
cross-browser pixel comparison. Invalid/private Mapbox credentials and forced tile
outages were not tested; external failures must remain honestly unavailable. No
screenshot-based visual sign-off is claimed. Phase01D.2 should verify real downloaded
CSV/JSON and native print preview in an isolated profile, retain formula-injection
and context-isolation assertions, and investigate only reproduced export defects.
Do not implement Phase02 as a workaround for remaining acceptance gaps.

Both isolated servers were stopped after validation. Final preservation checks
confirmed only the declared files changed and the normal database hash is intact.
