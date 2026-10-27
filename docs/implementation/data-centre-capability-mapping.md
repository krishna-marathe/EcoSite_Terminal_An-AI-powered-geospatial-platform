# Data-centre sustainability score dashboard — capability mapping and plan

Status: assessment and scope lock. No application behaviour was changed by this document.
Reviewed: 2026-10-27, commit `0d19f0d`.
Governing scope: **sustainability score dashboard only**.
Reference material: `data/sources.md` (India data-source and feasibility audit).

## 1. Scope lock

This project is a **data-centre sustainability score dashboard**. It should:

- score data-centre sites/facilities across sustainability dimensions;
- show the underlying metrics, weights, and evidence status;
- show what is missing or uncertain;
- recommend interventions that would improve the score;
- support scenario comparison and reporting.

It is **not**:

- an evidence-graph or document-reconciliation platform;
- a utility power-readiness or water-allocation system;
- a state rule-pack / permit engine;
- a digital twin;
- an AI approval or site-readiness engine;
- a replacement for DISCOM, water-authority, planning-authority, or PARIVESH processes.

`data/sources.md` is therefore used for three things only:

1. **Metric definitions** (PUE, WUE, CUE, peak-summer water, land/heat/flood context).
2. **Data-source feasibility** (what can be observed, what must be declared, what must remain unknown).
3. **Honesty constraints** (coverage, licence, observation date, no invented precision).

Its broader recommendations — evidence graph, readiness engines, rule versioning, Site
Readiness Passport, multi-state regulatory packs — are out of scope for this product.

## 2. Executive verdict

The current application is a **credible environmental pre-feasibility dashboard** with
data-centre sector weights, a data-centre mitigation catalogue, project/candidate/phase
persistence, provenance labels, and a strong UI shell.

It is **not yet a data-centre sustainability score dashboard**. The score is an
environmental-risk index, not a sustainability score, and most data-centre-specific
metrics (PUE, WUE, CUE, carbon, heat reuse, e-waste) are absent.

| Layer | Assessment |
| --- | --- |
| Dashboard shell, map, routing, reports, provenance, tests | Strong, reusable |
| Environmental screening score | Usable as a proxy, not a sustainability score |
| Data-centre operational metrics | Mostly absent |
| Data-centre facilities in demo/API data | Absent — DC weights/catalogue are unreachable |
| Real data connectors | Absent; demo layers are synthetic |
| AI forecasting | Absent; synthetic linear formulas, correctly labelled |
| Product claims vs reality | Mixed; README and provenance catalogue overstate live data |

**Approximate coverage of the dashboard brief: 25–30%.** The missing part is the
data-centre metric and scoring layer, not the surrounding application.

## 3. Scorecard

| # | Dashboard area | Target metrics | Current capability | Status |
| --- | --- | --- | --- | --- |
| 1 | Energy and carbon | IT MW, facility MW, PUE, annual MWh, RE share, Scope 1/2, CUE | City-level synthetic demand forecast; facility `capacityMw`; phase PUE; no energy or emissions | Proxy |
| 2 | Water | Withdrawal, consumption, WUE, source mix, peak-summer demand, basin stress | `waterStress` indicator; phase KLD; catalogue actions; no water balance | Proxy |
| 3 | Heat | Rejected heat MW, ERF, reuse potential, UHI exposure | `heatExposure` indicator; demo LST layer; heatwave scenario | Proxy |
| 4 | Grid | Coincident peak, sanctioned MW, headroom, backup, flexibility | `gridPressure` indicator; substation distance for legacy points | Proxy |
| 5 | Community and land | Population exposure, land-cover change, ESZ distance, noise | Population/land indicators; ESZ layer; no noise or land-change analysis | Proxy |
| 6 | Circularity / e-waste | Asset register, refresh cycle, recovery rate, embodied carbon | Nothing data-centre-specific | Absent |
| 7 | Sustainability score | Transparent sub-scores, weights, coverage, hard constraints | Eight-indicator environmental risk score | Partial |
| 8 | Recommendations | Score-linked interventions with quantified benefit | Static catalogue, currently unreachable for DCs | Partial |
| 9 | Scenarios | What-if changes to load, cooling, water, RE, heat reuse | Blanket percentage stress on hotspot scores | Proxy |
| 10 | Reporting | Score breakdown, provenance, assumptions, export | CSV/print dossier; not score-aware | Partial |
| 11 | Data honesty | Observed/declared/estimated/synthetic/unavailable, coverage, dates | `dataStatus` and provenance exist; catalogue overstates `observed` | Partial |

## 4. What `data/sources.md` changes for this dashboard

### 4.1 Metrics to adopt

| Metric | Definition | Why it matters | Data reality |
| --- | --- | --- | --- |
| PUE | facility energy / IT energy | Core efficiency KPI | Developer/operator declared; measure later |
| WUE | litres water / kWh IT | Cooling water intensity | Developer/operator declared; source split needed |
| CUE | kgCO2e / kWh IT | Carbon intensity of compute | Needs grid emission factor and RE attributes |
| Scope 1 | backup fuel combustion | Onsite emissions | Asset/fuel data |
| Scope 2 | purchased electricity × grid factor | Main emissions | CEA/grid factor; location vs market |
| Peak-summer water | KLD at design wet-bulb | Real water stress occurs at peak | Engineering input |
| Rejected heat / ERF | MW and recovered fraction | Heat-reuse opportunity | Cooling design input |
| Grid headroom | (sanctioned − coincident peak) / sanctioned | Real constraint, not proximity | DISCOM evidence; not public |
| Land-cover change | built/vegetated/water change in polygon | Local ecological impact | Sentinel-2 / Bhuvan |
| E-waste recovery | mass reused/recycled / retired | Circularity | Asset register; no public dataset |

### 4.2 Data sources that are actually usable

From `data/sources.md`, the realistic dashboard data stack is:

| Dashboard need | Best available source | Use in a score dashboard | Caveat |
| --- | --- | --- | --- |
| Land cover / vegetation | Copernicus Sentinel-2 (10–60 m) | Observed land-cover composition and change around a site | Remote-sensing-derived, not legal land use |
| India thematic layers | ISRO Bhuvan WMS/WMTS | Corroboration for LULC, water bodies, flood hazard | Access/dates vary by theme |
| Terrain | NASA SRTM/NASADEM 30 m | Slope/elevation screening | Screening only |
| Historical surface water | JRC Global Surface Water 1984–2021 | Historical water presence | Historical, not predictive |
| Historical flood | NRSC Flood Affected Area Atlas 1998–2022 | Historical flood exposure | Not a return-period probability |
| Groundwater stress | CGWB assessment units | Basin stress context | Not a project allocation |
| Groundwater levels | NWDP/CGWB telemetry | Local trend context | Station coverage varies |
| Rainfall/river data | NWDP/CWC/IMD | Water/flood context | Access varies |
| Air quality | CPCB via Data.gov.in | Station-based context | Needs API key; station representativeness |
| Surface heat | MODIS LST ~1 km | Land-surface temperature anomaly | Not air temperature |
| Heat hazard | IMD hazard/vulnerability atlas | District-scale context | Not site measurement |
| Grid context | CEA / National Power Portal | Regional/state context | Never site-level spare capacity |
| Protected areas | WII database + notifications | Screening flag | Legal geometry needs confirmation |
| Clearance context | PARIVESH | Reference only | Not an approval engine |

### 4.3 Data honesty rules for the score

These come directly from `data/sources.md` and should be enforced in the dashboard:

- Missing data must stay missing; it must not become zero or a favourable score.
- A high aggregate score must never override a hard constraint or an unknown critical input.
- Satellite-derived flood/land/heat indicators are **observations**, not approvals or
  probabilities.
- Groundwater stress is not a water allocation; nearby substation is not available MW.
- Declared, documented, verified, estimated, synthetic, and unavailable must be visibly
  different.
- Every dataset needs a licence, coverage, resolution, observation date, and last-checked
  date in a source registry.
- PUE/WUE/CUE must state their measurement boundary; design values are not verified
  performance.
- Do not claim live telemetry, trained AI, or calibrated confidence intervals until they
  exist.

## 5. Current implementation map

### 5.1 What exists and is reusable

| Capability | Where | Reuse |
| --- | --- | --- |
| Dashboard shell and map | `frontend/src/components/worldmonitor/*`, `components/map/MainMap.tsx` | Keep; add DC KPI panels |
| City selection and scope | `frontend/src/data/pilotCities.ts`, `shared/pilot.json` | Keep for pilot; optionally generalize later |
| Risk scoring | `backend/app/main.py` (`weighted_risk`), `shared/pilot.json` sector weights | Replace with sustainability sub-scores; keep explainability pattern |
| Project/candidate/phase persistence | `backend/app/models/{projects,sites,phases}.py`, routers | Keep as the planning backbone |
| Candidate polygons | `components/site-analysis/PolygonEditor.tsx`, `backend/app/geometry.py` | Keep; add site-level metrics |
| Phase inputs | `components/projects/PhaseEditor.tsx` | Extend with sanctioned MW, water sources, RE/storage |
| Provenance model | `frontend/src/types/index.ts`, `data/demo/provenance.ts` | Keep; convert to a real source registry |
| Reports/CSV/print | `pages/Reports.tsx`, `utils/planningReport.ts` | Extend to score breakdown |
| Tests and lint/build | 147 frontend tests passing (this review) | Keep green |

### 5.2 What must change

1. **Seed data-centre facilities.** `shared/pilot.json` has no `data_centre` records, so
   the DC sector weights and catalogue cannot be exercised.
2. **Add a data-centre profile.** Facility-level IT MW, facility MW, PUE, WUE, CUE,
   cooling type, water sources, backup generation, grid connection, heat rejection.
3. **Add deterministic calculators.** PUE, WUE, CUE, Scope 2, water balance, ERF, grid
   headroom, e-waste recovery.
4. **Replace the risk score with a sustainability score.** Keep it explainable and
   multi-dimensional; do not hide missing data.
5. **Add coverage/uncertainty.** Show which sub-scores are observed, declared, estimated,
   synthetic, or unavailable.
6. **Link recommendations to score gaps.** A recommendation should state which metric it
   improves and by how much (with assumptions).
7. **Correct product claims.** README and provenance catalogue must match implemented
   behaviour.

### 5.3 What to retire or relabel

- The eight-indicator environmental risk score can remain as an **Environmental Exposure**
  sub-score, but not as the overall product score.
- The synthetic city forecast can remain as a labelled demo, but not as decision evidence.
- The blanket scenario multiplier can become a simple what-if control, clearly labelled.
- The "digital twin", "AI forecasting", and "live OSINT" claims should be removed until
  the corresponding capability exists.

## 6. Sustainability score design

### 6.1 Sub-scores

Use six weighted sub-scores, each 0–100, with a visible contribution:

| Sub-score | Inputs | Example weight |
| --- | --- | --- |
| Energy and carbon | PUE, CUE, RE share, Scope 1/2 intensity | 30% |
| Water | WUE, source stress, peak-summer gap, recycled share | 25% |
| Heat | Rejected heat, ERF, reuse potential, UHI exposure | 15% |
| Grid | Coincident peak, headroom, backup, flexibility | 15% |
| Community and land | Population exposure, land-cover change, ESZ, noise | 10% |
| Circularity | E-waste recovery, embodied carbon, battery end-of-life | 5% |

Weights are configurable per archetype (enterprise, colocation, hyperscale, edge).
Show the weight and contribution for every sub-score.

### 6.2 Score rules

- **Hard constraints** (e.g. site outside India, invalid polygon, missing critical water
  evidence) produce a status, not a high score.
- **Coverage** is separate from score: e.g. "Score 72/100 · Evidence coverage 45%".
- **Missing inputs** lower confidence, not the score itself; show "Insufficient evidence"
  rather than a fabricated number.
- **Score version** and calculation version are stored with every result.
- **No single number** in the UI without its breakdown and coverage.

### 6.3 Example output

```text
Site: Maharashtra candidate A
Sustainability score: 68/100 (v1)
Evidence coverage: 62%
Sub-scores:
  Energy & carbon  74  (PUE 1.32 declared; grid factor CEA 2025; RE 40% contracted)
  Water            55  (WUE 1.8 L/kWh; basin over-exploited; peak-summer gap 0.4 MLD)
  Heat             61  (rejected heat 18 MW; reuse potential 5 MW; LST anomaly +1.8°C)
  Grid             70  (sanctioned 40 MW; phase-1 peak 32 MW; headroom 20%)
  Community & land 66  (population 12k within 5 km; 3.2 ha land-cover change)
  Circularity      48  (no asset register; e-waste recovery unknown)
```

## 7. Roadmap (dashboard-only)

### Phase 03A — Truth and reachability (1 week)

- Correct README and provenance statuses.
- Seed two synthetic `data_centre` facilities (Pune, Mumbai).
- Add a scope banner: sustainability score dashboard, not a compliance or readiness system.
- Verify the DC catalogue and weights are reachable.

**Acceptance:** no live/AI/telemetry claims; DC facility appears in dashboard, risk,
mitigation, and reports; tests updated.

### Phase 03B — Data-centre profile and KPI tiles (2–3 weeks)

- Add `DataCentreProfile` model, schema, migration, API.
- Add facility KPI tiles: IT MW, facility MW, PUE, WUE, CUE, RE share, water sources,
  backup MW, rejected heat.
- Distinguish design vs actual vs unavailable.
- Add units and null/zero tests.

**Acceptance:** create/edit/read profile; reload persists; null and zero round-trip
separately; no invented values.

### Phase 03C — Deterministic calculators (3–4 weeks)

- PUE, WUE, CUE, Scope 1/2, water balance, ERF, grid headroom, e-waste recovery.
- Every calculator has a method, assumptions, and data status.
- Hand-calculated unit tests.

**Acceptance:** dashboard and CSV show the same numbers; unsupported inputs render
unavailable; no percentage savings without a calculation.

### Phase 03D — Transparent sustainability score (2–3 weeks)

- Six sub-scores, configurable weights, contribution breakdown.
- Coverage/confidence display; hard constraints.
- Score versioning and scenario comparison.

**Acceptance:** score reproduces from inputs; weights sum correctly; missing data does
not improve the score; hard constraints cannot be overridden.

### Phase 03E — Data source registry and first connectors (3–4 weeks)

- Add `DataSource` registry: provider, dataset, version, access, licence, cache/redistribute,
  resolution, coverage, observation date, last checked.
- Connect one real source end-to-end (prefer Copernicus STAC for land cover, or CGWB
  assessment for groundwater).
- Show coverage and observation dates in the dashboard.

**Acceptance:** connector failure shows unavailable, not synthetic green; licence and
date visible; no redistribution beyond licence.

### Phase 03F — Score-linked recommendations and scenarios (2–3 weeks)

- Map each recommendation to the sub-score it improves.
- Quantify benefit ranges with assumptions.
- Scenario controls: cooling retrofit, RE PPA, BESS, water reuse, heat reuse, workload
  shift (if modelled).
- Keep AI disabled; catalogue remains deterministic.

**Acceptance:** recommendation shows target metric, expected delta, assumptions, and
verification steps; scenario deltas are reproducible.

### Phase 03G — Reporting and validation (2 weeks)

- Score breakdown, coverage, provenance, assumptions, and limitations in the dossier.
- CSV/print parity.
- Regression suite and browser acceptance.

**Acceptance:** exported report reproduces the screen result; all data statuses and
source dates appear; no compliance/approval claim.

## 8. Immediate backlog (next two weeks)

1. **Seed DC facilities**
   - Add `data_centre` records to `shared/pilot.json` with `dataStatus: synthetic`.
   - Add a backend test asserting DC weights and catalogue retrieval.
2. **Add the profile contract**
   - `backend/app/models/data_centres.py`, `schemas/data_centres.py`,
     `routers/data_centres.py`, migration.
   - `frontend/src/services/dataCentres.ts`, types, KPI panel.
3. **Add one calculator**
   - `backend/app/impact.py` with PUE, WUE, Scope 2 (location), grid headroom.
   - Hand-calculated tests.
4. **Replace the headline score**
   - Keep the eight-indicator score as `environmentalExposure`.
   - Add a sustainability score shell with six sub-scores and coverage.
5. **Truth pass**
   - Update `README.md`.
   - Mark unconnected provenance records as `synthetic`/`not_connected`.
6. **Regression gate**
   - `npm --prefix frontend run lint -- --no-cache`
   - `npm --prefix frontend run test`
   - `npm --prefix frontend run build`
   - `backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -v`

## 9. Data-source rules to enforce

From `data/sources.md`, these are non-negotiable for a score dashboard:

- **Licence:** every dataset needs a licence and redistribution flag.
- **Coverage:** national does not mean uniform; show missing/stale/no-station states.
- **Dates:** show observation date and last-checked date.
- **Resolution:** show spatial/temporal resolution; do not imply parcel-level precision.
- **Semantics:** LST is not air temperature; groundwater stress is not allocation;
  historical flood is not probability; nearby substation is not headroom.
- **Evidence status:** declared, documented, verified, estimated, synthetic, unavailable,
  conflicting, missing.
- **No silent substitution:** a failed API must not be replaced with synthetic green data.
- **No opaque score:** always show the breakdown, weights, coverage, and version.

## 10. Decisions needed

1. **Pilot geography:** keep Pune/Mumbai, or go India-wide? The current code is city-scoped;
   India-wide is a larger change.
2. **Score weights:** fixed per archetype, or user-adjustable?
3. **Carbon standard:** location-based, market-based, or both?
4. **Water accounting:** withdrawal vs consumption; how to treat recycled water?
5. **Heat boundary:** fence-line rejected heat only, or campus + reuse?
6. **Noise:** screening model or measured data only?
7. **E-waste:** asset-level or aggregate accounting?
8. **Real data priority:** Copernicus, CGWB, or CEA first?
9. **AI:** keep disabled, or add server-side document extraction later? (Not needed for the
   score dashboard.)
10. **Authentication:** local single-user for the demo, or multi-user?

## 11. What not to build

- An evidence graph, rule engine, readiness passport, or utility-allocation workflow.
- A digital twin or live telemetry pipeline.
- A trained AI model before a deterministic baseline and backtest harness.
- An LLM chatbot or autonomous approval.
- More map layers before the DC metrics exist.
- A single opaque score without breakdown, coverage, and version.

## 12. Bottom line

The existing project already has the hard, unglamorous parts: provenance, explicit
synthetic labels, revisioned persistence, boundary validation, tests, and honest
disclaimers. What it lacks is the data-centre metric and scoring layer.

Build in this order: **seed data centres → profile and KPIs → deterministic calculators →
transparent score → real data registry → recommendations/reporting**. That keeps the
product a sustainability score dashboard, uses `data/sources.md` for data realism, and
avoids drifting into a different product.
