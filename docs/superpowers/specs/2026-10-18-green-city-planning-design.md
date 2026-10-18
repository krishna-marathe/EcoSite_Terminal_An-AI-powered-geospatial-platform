# EcoSite: Smart Urban Planning with Big Data for Green Cities

Status: proposed design for user review. No implementation changes made.

## Purpose

Help planners compare locations for sustainable urban infrastructure using environmental conditions, resource demands, population exposure, and transparent evidence. Produce a traceable decision dossier showing the candidate comparison, assumptions, recommended interventions, and data limitations.

Working scope: India, the existing six application modules, and a two-city pilot covering **Pune and Mumbai**, selected by the user. Each city has a separate planning context, facility registry view, environmental coverage summary, candidate collection, and report. Existing demonstration records are not evidence of verified coverage in either city.

Use stable city identifiers (`pune` and `mumbai`) throughout API queries, saved projects, candidate sites, and reports. Navi Mumbai remains a distinct location and must not be silently included as Mumbai data. City extents must be explicitly described and sourced; a demonstration map extent is not an official municipal boundary. Records outside a selected city's defined extent must not contribute to its summaries.

Support side-by-side Pune/Mumbai summaries using the same indicator definitions, units, time windows, and scoring version. Show differences in data coverage alongside results; unavailable measurements must not improve a city's ranking. Candidate comparisons within a city remain the primary site-selection workflow.

## Website and README assessment

The current application has dashboard, risk analysis, forecast, site evaluation, mitigation, and report routes. The map, environmental layers, risk-weight controls, candidate comparison, scenario controls, and CSV exports provide a useful foundation for the chosen theme.

The current center of attention is national infrastructure monitoring. A planner cannot yet complete a city-scoped, persistent, consistently sourced decision workflow. Most facility views read bundled fixtures, even when the backend is available. Backend environmental layers are unavailable, forecasts are synthetic, and site assessment is heuristic. The README overstates live telemetry, trained models, confidence intervals, and connected official data sources.

A local dashboard capture at 1440 × 1000 shows that the six telemetry tiles are compressed inside one narrow panel, clipping labels and figures. The navigation and panel content are dense. The captured map shows facility markers without a visible geographic basemap; a subsequent browser check must distinguish loading/provider failure from a rendering defect before changing map code.

## Options

1. **Recommended: city-focused infrastructure planning pilot.** Reuse all six modules and complete one coherent city-to-report workflow. Adds city context and explicit decision outputs while keeping data requirements bounded.
2. **Facility-siting completion.** Fix and connect existing modules without city-level context. Smaller implementation, but narrower fit to urban planning.
3. **Full municipal planning platform.** Add ward planning, transport, waste, green-space accessibility, and land-use allocation. Broader thematic fit, but requires new datasets, models, and workflows beyond the current application.

## Recommended user workflow

Select Pune or Mumbai → inspect available environmental evidence → add and save candidate sites → compare environmental burdens and resource demands → apply a documented sensitivity scenario → review mitigation options → export a city-specific planning dossier. An optional city comparison view uses matching metrics and periods and displays coverage for both cities.

The interface should explain this workflow directly and identify EcoSite as a green-city infrastructure planning tool. Preserve the existing visual style, but make the chosen city, planning objective, data coverage, and next action prominent.

## Architecture and ownership

Keep React, TypeScript, MapLibre, TanStack Query, Zustand, FastAPI, and SQLite. Use a modular backend rather than introducing distributed services before there is a demonstrated workload need.

- **Registry and ingestion:** authoritative facility identity, source metadata, validated ingestion, and restricted write access. Reject ingestion when server credentials are unconfigured or invalid; never expose ingestion credentials through frontend environment variables.
- **Planning areas and observations:** a named area with explicit bounds; timestamped environmental measurements with units, coverage, source, and data status. A rectangular planning extent must not be presented as an official municipal boundary.
- **Assessment:** one versioned scoring definition shared by API results and the UI. Distinguish normalized risk indicators from physical measurements. Missing inputs remain unavailable and are reported in coverage; they must not silently become zero or favorable evidence.
- **Forecast:** supported metric/location pairs, calendar-month horizons, units, and explicit synthetic or validated status. Historical validation is required before claiming trained-model accuracy or calibrated confidence intervals.
- **Planning projects and reports:** persist candidate sites and scenario assumptions; generate reports from the same selected records and assessment version shown in the UI.
- **Frontend data access:** shared API queries serve map, selectors, risk views, statistics, and reports. Zustand owns UI selection and filters. Demo mode is explicit and consistently labeled; request failures do not silently turn an operational view into a fabricated result.

## Six-module behavior

| Module | Required result |
| --- | --- |
| Dashboard | Planning-area selection, facilities, available environmental layers, coverage summary, and legible summary metrics. |
| Risk analysis | Explainable sector weights, consistent scores, indicator units, missing inputs, and source attribution. |
| Forecast | Correct metric and horizon; meaningful unavailable/error state; demo baselines labeled synthetic. |
| Site evaluation | Saved candidates, actual substation-only proximity, nullable unavailable measurements, and comparison using consistent criteria. |
| Mitigation | Practical catalog recommendations plus optional AI assistance, with validated structured output and explicit assumptions. No invented percentage savings or unearned AI attribution. |
| Reports | A saved planning decision with candidate comparison, scenario parameters, sources, dates, statuses, and consistent CSV/print output. |

## Big-data scope and evidence

The initial implementation should demonstrate the foundations of heterogeneous geospatial and time-series processing: normalized ingestion, source validation, timestamps, geographic filtering, pagination, aggregation, and reproducible refresh. Publish measured ingestion/query results on a reproducible generated dataset, labeled as a scale test rather than real observations.

No distributed processing or large-scale performance claim follows from the current small fixture set. Introduce a spatial database or background processing only when measured data volume and spatial query requirements justify them.

Verified real-data integrations depend on accessible datasets, licensing, coverage, and historical depth. The build can support documented imports without pretending those sources have already been acquired. Begin with a small usable subset, and keep unsupported layers unavailable. A connected provider must identify the actual dataset and measurement date, not merely link to an agency homepage.

## Delivery sequence and agent assignments

1. **Manager:** maintain scope, resolve shared contracts, integrate changes, and own release checks.
2. **Planner:** convert this approved design into bounded backend, frontend, and data/validation tasks with file ownership and dependencies.
3. **Researcher:** verify usable source formats, coverage, and access conditions; distinguish sourced observations from generated demonstration data.
4. **Backend builder:** ingestion authorization, correct proximity and missing-data contracts, consistent assessments, forecast horizons, and planning-project persistence.
5. **Frontend builder:** shared API consumption, city planning workflow, state handling, readable panel layout, and consistent reports.
6. **Quality reviewer:** independent regression checks and browser validation of the complete planning workflow.

The available agent slots are shared. Planner/researcher roles hand off to builders after the design and contracts are settled. Parallel builders must have nonoverlapping file ownership; shared types and API shapes are agreed before concurrent edits.

## Acceptance checks

- Authorized ingestion persists a unique facility; missing/invalid credentials do not mutate storage.
- That facility appears in the map, selectors, filters, report, and CSV without fixture-only lookups.
- A colocated data centre cannot be mistaken for a substation. No substations returns unavailable.
- Null population and distances render unavailable; genuine zero remains zero.
- Six-, twelve-, and twenty-four-month forecasts have the requested periods, correct units, and distinct calendar months. Unsupported combinations do not reuse another metric's values.
- A selected planning area consistently scopes facilities and summaries; its boundary provenance is explicit.
- Switching between Pune and Mumbai updates map extent, facilities, summaries, and candidate views without mixing city records. Saved projects and exported dossiers retain the correct city identifier.
- Navi Mumbai records are not automatically classified as Mumbai. Pune/Mumbai comparisons show matching units, periods, scoring versions, and each city's coverage.
- Saved candidate sites and scenario assumptions survive reload and appear in the exported dossier.
- Demo, estimated, observed, and unavailable statuses remain accurate through charts, scores, recommendations, and exports.
- Missing environmental evidence cannot produce an apparently verified favorable suitability result.
- Dashboard text and summary metrics remain readable at desktop and mobile widths; map failures have a visible state.
- TypeScript, lint, production build, focused backend/frontend regression checks, and one browser city-to-report workflow pass.
- README describes implemented behavior, real setup commands, data limitations, and measured scale evidence accurately.

## Boundaries of this build

The pilot provides planning support and evidence comparison. It does not assert statutory clearance, verified live environmental coverage, calibrated impact prediction, or municipal-scale production readiness without corresponding evidence. Transport optimization, waste collection routing, billing, multi-tenant administration, and additional city-wide optimization systems are separate extensions.
