# EcoSite Ministry Platform - Research Index

Last researched: 2026-10-29

This folder captures the product and data research for a government-operated
data-centre oversight and sustainable siting platform. The first release covers
Maharashtra, Telangana, Karnataka and Tamil Nadu.

## Documents

- `01-ministry-dashboard-parameters.md` - parameters the ministry needs for
  operational monitoring, siting and city planning.
- `02-authoritative-data-sources.md` - primary sources, proposed integrations,
  refresh frequencies and limitations.
- `03-platform-architecture.md` - frontend, API, database, telemetry and
  security architecture.
- `04-five-hour-mvp.md` - original time-box and completed decision log; superseded
  by the one-day plan.
- `05-one-day-build-plan.md` - current end-to-end implementation scope.
- `06-public-facility-inventory.md` - primary-source candidate inventory and
  lifecycle/capacity caveats for the four states.
- `07-tech-stack-and-data-ownership.md` - selected frontend/backend/SQLite stack,
  API responsibilities and proposed data model.
- `08-public-environmental-timeseries-architecture.md` - scheduled public API
  ingestion, SQLite time series, station context and dashboard range filters.
- `09-us-europe-government-platform-benchmarks.md` - EU and US government
  reporting, benchmarking, air, water and grid precedents, with an India design
  recommendation.
- `10-data-integrity-audit.md` - official-document byte validation and a
  non-destructive raw-snapshot path/payload-hash classification.
- `10-authoritative-collection-contracts.md` - implementation-ready source
  contracts, access/licence decisions, refresh cadences, blockers and acceptance
  gates for facility, environmental, grid, biodiversity and population data.

- `11-niti-aayog-evaluation-framework.md` - NITI Aayog Data Centre Evaluation
  Framework parameters covering power, water, siting, sustainability and governance.

## Product statement

EcoSite Terminal is a government decision-support system for:

1. monitoring registered data centres and their resource/environmental impact;
2. evaluating new candidate sites without shifting harm to communities,
   biodiversity, water systems or the electricity grid; and
3. planning cumulative data-centre growth at city, watershed, grid and state
   level.

The initial release uses only publicly available information about physically
existing and currently operational, publicly disclosed data-centre facilities
in Maharashtra, Telangana, Karnataka and Tamil Nadu. Facilities are included
whether privately owned, government owned or operated through another ownership
model. Proposed, announced and under-construction facilities are excluded from
the public dashboard and all public totals. They may remain in restricted
research records for later operational-status verification. The platform also
provides an operator-registration
workflow through which an operator can register a facility and place its campus
or site on the map. Registration creates a declared record; it does not make
the facility or its claims government verified. A future ministry policy may
make registration mandatory.

The system must distinguish measured, authority-verified, declared, derived,
modelled, synthetic and unavailable information. It must never describe
proximity as capacity, screening as legal clearance, or synthetic data as a
real observation.

Public-source facts, operator declarations and government-verified facts must
never be merged into one undifferentiated value.

