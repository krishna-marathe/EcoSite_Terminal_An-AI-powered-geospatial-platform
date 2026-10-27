# Known limitations after Phase 01D acceptance

No application behavior was changed during Phase 01D. Prioritized findings below
distinguish confirmed behavior from unresolved environment/browser acceptance gaps.

## P0

None found by this scoped validation. This is not a penetration-test assurance.

## P1 — release/acceptance gates

- **Incomplete native-browser map acceptance.** Initial WebGL and loaded tiles were
  confirmed, but later route/style visits reported slow/unloaded basemap state.
  Reproduce in fixed-size desktop Chrome/Edge, capture network/style events and
  inspect MainMap lifecycle/ResizeObserver ownership. Current evidence does not
  establish whether the cause is provider/network, integrated-browser resizing or
  app lifecycle. Smallest correction must follow reproduction; do not rewrite maps.
- **Native download and print acceptance incomplete.** JSON activation produced no
  observable integrated-browser download event; subsequent CSV steps were not
  completed. Inspect downloadFile in frontend/src/utils/csvExport.ts and browser
  download policy, then verify native print preview for Reports.tsx/Reports.css.
  Automated export/escaping tests pass but do not close these end-user gates.
- **Multi-user persistence requires authorization first.** Existing app has no
  project-owner authorization architecture. Before public Phase02 project writes,
  add trusted server identity and per-project authorization; a supplied owner ID
  is not authentication. This is a future deployment gate, not an inherited local
  single-user test failure. Gemini remains hard-disabled.

## P2 — warnings and bounded follow-up

- Default narrow integrated viewport intercepted a facility-marker click; several
  locator clicks could not reach a stable layout. Desktop keyboard and raw pointer
  interactions worked for candidate forms. Retest actual navigation and markers;
  do not claim a confirmed CSS root cause yet.
- Optional news relay returns503 in this environment and honestly shows unavailable.
  Check outbound RSS reachability/CA configuration separately; no blanket TLS bypass.
- Production main chunk is ~2.08MB/~589kB gzip, triggering the existing size warning.
  Deferrable code splitting should follow measurement, not this acceptance phase.
- Browser storage has no concurrent-tab conflict resolution. Legacy-unscoped data
  is preserved/excluded; invalid versioned storage blocks persistence until reviewed.
  Never auto-promote old records into API context. See [storage contract](../browser-storage.md).
- API fixtures can be synthetic. No source-backed environmental geometry exists.
  Forecasts are illustrative formulas and not validated predictions. Unused legacy
  forecast fixtures still contain model descriptions that must not be presented
  as verified model execution.
- Normal backend startup seeds/refreshes facility scores. Always use an isolated
  database for acceptance/migration rehearsal; existing SQLite closure/rollback
  tests are mandatory guards.
- Git warns about inaccessible .pytest_cache and LF→CRLF conversion on some test
  files. No cache or line-ending cleanup was attempted.
- Root .env.example retains a pre-existing misplaced public basemap token in the
  API URL field; frontend/.env.example is the setup reference. Do not copy the
  root value or treat it as a backend URL. Do not print or commit actual secrets.

## Deferred, not implemented

Native-browser gap closure requires review; behavior fixes require approval.
Phase02 Project/CandidateSite/ProjectPhase entities, polygons, ORM/migrations and
multi-user identity are design only. Phase05 connectors need real source metadata,
validated geometry/coverage/units and explicit unavailable semantics. No model,
satellite provider, official approval or Site Readiness Passport is introduced.

## Phase 01D.1 follow-up

See [map reliability evidence](phase-01d1-map-reliability.md). Confirmed style-load
overlay restoration and redundant non-default-style reset defects were fixed.
Three controlled return-navigation/style cycles now pass with one live map style.
Earlier empty-style probing could select a disposed StrictMode instance. Low-zoom
marker overlap was reproduced separately; zooming permits selection. Keep the
historical observations above, but do not treat the resolved style defects as open.
Native downloads/print remain a separate acceptance gate.
