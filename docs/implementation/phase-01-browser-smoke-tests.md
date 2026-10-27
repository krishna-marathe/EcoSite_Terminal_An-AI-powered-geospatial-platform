# Phase 01 browser smoke acceptance

## Test boundary

Integrated browser, dedicated origin http://127.0.0.1:5187; isolated backend/database
on 127.0.0.1:18000. No normal-origin storage was cleared or edited. Page reached
all six routes. Browser interactions used native selection/fill/pointer/keyboard
operations; a basemap menu retry used DOM click dispatch. Runtime MapLibre status
was inspected through React-held instances, so this does not replace visual QA.
Screenshot tooling did not return an inspectable image. Do not infer screenshot approval.

## Actual results

| Workflow | Status | Evidence / limit |
| --- | --- | --- |
| Six routes reachable | VERIFIED IN BROWSER | dashboard, risk-analysis, forecast, site-analysis, mitigation, reports rendered headings/content via direct navigation |
| Native navigation links | MANUAL TEST REQUIRED | one keyboard navigation attempt did not navigate; direct routes worked; no cause established |
| Dashboard/facilities | VERIFIED IN BROWSER | 3 Pune records, source labels, controls, marker DOM; no observed fatal app exception |
| Initial WebGL/basemap | VERIFIED IN BROWSER, limited | WebGL context active; initial map loaded=true, tilesLoaded=true, three markers, expected source/layer inventory |
| Visual tile/marker placement | MANUAL TEST REQUIRED | no inspectable screenshot; initial narrow viewport click intercepted by panels |
| Marker pointer selection | MANUAL TEST REQUIRED | automatic click timed out/intercepted; existing automated keyboard/click tests pass |
| Zoom/pan/city switch | NOT TESTED in browser | covered only partly by automated tests; execute checklist below |
| Demo overlays | VERIFIED IN BROWSER, limited | six bundled sources, eleven overlay layers; groundwater fill 0.65; other fills 0; synthetic warning visible |
| API source/geometry absence | PARTIAL browser evidence | unavailable message present and later runtime inspection found no sources, but map style itself was unloaded; this is not a successful isolated-overlay visual acceptance |
| Later basemap/style reload | MANUAL TEST REQUIRED | later dashboard visits showed slow-basemap warning; Positron selection logged style-not-loaded rebuild; inspected sources remained empty/loaded=false |
| Candidate edits | VERIFIED IN BROWSER | name, type industrial, capacity 250, water 45, power 175 survived center map click |
| Coordinate update/invalidation | VERIFIED IN BROWSER | off-center click changed to lat18.3573/lng74.3144; prior result cleared, out-of-bounds warning and disabled evaluation |
| Presets | NOT VERIFIED in browser | click stability timeout; deterministic component tests pass |
| Assessment submission | VERIFIED IN BROWSER | Demo and real API submissions completed; insufficient-data/null-suitability semantics displayed; loading cleared |
| Stale request ordering/errors | VERIFIED AUTOMATED | deterministic controllable-promise tests; not repeated with browser network interception |
| Candidate save/context isolation | VERIFIED IN BROWSER | Acceptance Demo absent in API context; Acceptance API saved separately; switching/reloading Demo restored its saved row; storage held both envelopes |
| Candidate removal | VERIFIED AUTOMATED | browser removal not executed |
| Legacy/corrupt storage isolation | VERIFIED AUTOMATED | browser fixtures not injected; unit/component tests preserve raw legacy values |
| Mitigation | VERIFIED IN BROWSER | catalogue visible, disabled AI button, explicit unavailable message; revisit left scoped plan bytes unchanged; both mode keys created independently |
| Private key modal | VERIFIED AUTOMATED/source review | no private Gemini input/consumer; browser modal itself not opened |
| Five forecasts | VERIFIED IN BROWSER | all metric selector values sent POSTs returning200; each chart rendered three series; synthetic and illustrative labels visible |
| Forecast error fallback | VERIFIED AUTOMATED | 422/500 rejection tests; not fault-injected in browser |
| Report context | VERIFIED IN BROWSER | API showed Acceptance API only; switching Demo showed Acceptance Demo only; plan context and evidence limitations displayed |
| Native JSON download | MANUAL TEST REQUIRED | activation attempted, no observable download event within4s; cannot claim saved file success |
| Native CSV downloads | NOT TESTED to completion | multi-export sequence stopped on JSON timeout; automated CSV/export tests pass |
| Print/preview | NOT TESTED | native preview and pagination require manual check |
| Official approval/Passport claims | VERIFIED IN BROWSER | displayed dossier disclaimer says no environmental clearance; not presented as a Site Readiness Passport |
| Optional news | KNOWN LIMITATION | /news503, controlled unavailable panel; no synthetic success substituted |

## Manual acceptance checklist to close Phase 01D

Use the isolated startup procedure in [acceptance](phase-01-foundation-acceptance.md).
Run a fresh desktop Chrome/Edge profile at a fixed 1440×1000 or larger viewport,
then repeat at a narrow viewport. Record screenshots, console errors and actual
files downloaded; do not use forced clicks to bypass occlusion.

1. Open Dashboard. Confirm a visible basemap and three correctly positioned Pune
   markers. Search for substation, clear search, click its visible marker, inspect
   the dossier, zoom and drag. Change city to Mumbai and confirm viewport/records.
2. Open Layers & filters. Toggle groundwater/air and adjust opacity. Switch basemap
   Dark Matter→Positron→ESRI and verify allowed demo overlays reappear with settings.
3. Switch API: confirm all six bundled source IDs from [overlay inventory](../environmental-overlays.md)
   disappear while basemap/markers remain. Repeat style changes and switch back to
   Demo. Check labels, controls and repeated transitions; no leaked geometry.
4. On Site Analysis, change name/type/capacity/water/power, choose a valid preset,
   click a nearby in-bounds location and verify all unrelated values. Submit and
   save; edit while a throttled request is pending and confirm no stale result or
   error. Remove only a disposable test candidate.
5. Save distinct Demo/API candidates and plans, reload each context. Verify report
   rows follow mode and no earlier plan changes on revisit. For legacy migration,
   seed only a disposable profile with the exact fixtures from savedContext tests.
6. Use actual navigation links for every route. Confirm expected state survives.
7. Forecast: select all metrics/horizons in API; throttle/fail a request and verify
   no fabricated chart appears. Preserve explicit synthetic warnings.
8. Reports: download JSON, facilities CSV, candidates CSV and mitigation CSV in
   both modes; open each file and inspect IDs/mode/dataStatus. Test a disposable
   formula-prefixed name and confirm CSV protection. Open native print preview,
   inspect page clipping and repeat header/context; cancel printing afterward.
9. Open settings and confirm only public basemap-token settings, no Gemini key
   input. Do not enter production credentials.
10. Rehash normal DB, compare repository status, stop isolated servers. Record
    remaining failures before changing the acceptance verdict.
