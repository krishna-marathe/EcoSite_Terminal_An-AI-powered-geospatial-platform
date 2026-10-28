# Five-to-Six-Hour MVP Plan and Decision Log

Status: superseded as an implementation time-box by `05-one-day-build-plan.md`.
The confirmed product decisions in this document remain valid.

## Honest deliverable

In five to six hours we can build a convincing, working ministry dashboard
prototype using the repository's existing data and clearly labelled synthetic
data where a visual demonstration needs it. The agreed product boundary is
publicly available facility information plus an operator-registration flow.
We will not imply that private real-time operator telemetry is available.

## MVP scope

### Dashboard

- Four-state national overview map
- Facility totals, operating capacity, power, water, PUE, WUE and alert cards
- State and facility filters
- Facility table with operational/compliance status
- Selected-facility detail with public facts, provenance and unknown fields
- Environmental and infrastructure map layers already available in the repo
- Public-source update and environmental-warning panel
- Operator registration form with map location selection
- Registration status and ministry-review state

### Site planning

- Reuse existing project and candidate-polygon workflow
- Run existing state/boundary validation
- Show biodiversity, water, flood, population, power and evidence dimensions
- Display hard constraints separately from comparative scores
- Generate a site-passport summary with provenance and missing-data warnings

### Backend/data

- Add ministry summary, facility detail, telemetry and alerts endpoints
- Add operator registration and review endpoints
- Seed only publicly sourced facility facts; label demonstration values explicitly
- Reuse existing observations and source registry
- Fix the database/migration mismatch before depending on project routes
- Preserve observed/derived/synthetic/unavailable labels in every response

### Verification

- API contract tests
- Frontend component tests for the command dashboard
- Production build
- Lint cleanup in touched files
- Demo runbook documenting which data is real and which is synthetic

## Explicitly outside the five-hour MVP

- Production operator telemetry connections
- Government SSO and production authorization
- Utility capacity APIs
- Complete biodiversity and cadastral datasets
- Legally authoritative automated approval decisions
- Production PostgreSQL/PostGIS migration
- AI forecasting trained on real operational history
- Public deployment or security accreditation

## Build sequence

1. Confirm MVP decisions below.
2. Repair repository data/migration blockers.
3. Define TypeScript/Pydantic ministry contracts.
4. Implement deterministic backend endpoints.
5. Build national dashboard and facility drill-down.
6. Connect site planning/passport view.
7. Test, build and document the demo.

## Decision log - answers required

### Q1: meaning of public facility - decided

Include every physically existing data-centre facility in the four target
states whose existence and location are publicly disclosed, whether privately
or government owned, provided its current operational status is supported by
an acceptable source. Proposed and under-construction facilities remain
restricted research records and do not appear on the public dashboard.

### Q2: geographic presentation

Should the dashboard open as an India map with only four active states, or zoom
directly to the four-state region?

### Location precision - decided

The ministry view receives exact reviewed geometry. The public view receives a
separate generalised locality-level position. Exact operator-submitted geometry
remains restricted during review.

### Registration publication - decided

Operator submissions remain private until ministry approval. Approval creates
an explicit public snapshot containing only approved fields and generalised
geometry. Rejected, incomplete and duplicate submissions remain private.

### Q3: facility inventory

Should we retain the current small Pune/Mumbai facility set, or seed a larger
four-state demonstration inventory?

### Q4: decision authority

Should a site ever display "Approved", or only "Recommended for detailed
review"? The safer MVP uses the latter.

### Q5: visual priority

Should the command dashboard emphasize live operational alerts or new-site
planning first?

### Q6: public versus restricted view

Which registration fields should be public immediately, and which should remain
visible only to the operator and ministry reviewer?

### Q7: branding

Should we retain the EcoSite Terminal name and current dark visual identity?

## Recommended defaults if answers are delayed

- Public information only; missing operational values remain unknown
- India map with four active states
- Seed 12-16 demonstration facilities across the four states
- "Recommended for detailed review", never automatic approval
- Operational command overview as the landing screen
- Public dashboard plus operator registration and ministry review workflow
- Retain EcoSite branding and dark theme

