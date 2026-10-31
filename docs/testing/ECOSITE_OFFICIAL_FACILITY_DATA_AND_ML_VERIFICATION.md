# EcoSite India — Official Facility Document Integration & Live ML Inference Verification Report

**Workspace:** `C:\Users\marat\EcoTerminal`<br>
**Branch:** `krishna_updated`<br>
**Baseline Commit:** `dd58dfa`<br>
**Verification Date:** 2026-10-31<br>
**Project:** One Earth Hackathon 2026 — EcoSite India Platform<br>

---

## 1. Executive Summary

This report documents the rigorous end-to-end integration of primary-source operator documentation, statutory regulatory water filings, live LightGBM regional inference validation, and engineering scenario corrections across the EcoSite India platform.

Every reported value, specification, and metric has been verified directly against primary-source documents, Python unit tests, live HTTP API calls, and browser UI tests. No synthetic data is presented as measured, and strict epistemic boundary rules prevent ungrounded cross-facility data leakage.

### Key Milestones Achieved:
1. **STT Pune 5 Updated from Official Factsheet:** Disclosed capacity verified as **24.0 MW IT Load** (`it_load`, facility scope). Incoming infrastructure verified as **100 MVA, 220 kV incoming GIS substation**. Cooling confirmed as chilled water with **air-cooled chillers** and **800,000 litres** on-site water storage. All outdated `UNSPECIFIED_BOUNDARY` messaging, the 17.78 MW backward derivation, and the 4.80 MW sanctioned-grid gap claim have been completely eliminated.
2. **STT Mumbai DC2 Updated from Official Factsheet:** Disclosed capacity verified as **1.7 MW IT Load** (`it_load`). Incoming infrastructure verified as **6.0 MVA** (3 × 2 MVA transformers, dual 22 kV HT feeds). Cooling confirmed as **DX-based cooling, N+1** with zero operational process water.
3. **Statutory Regulatory Water Dataset Ingested:** Ingested verified State Environment Impact Assessment Authority (SEIAA) Maharashtra Environmental Clearance (`EC24B038MH162952`), Maharashtra Pollution Control Board (MPCB) Environmental Statement Form V (FY25 and FY26), and STT GDC India ESG FY25 disclosures into `data/regulatory_water_observations.json` and exposed via `GET /api/v1/environmental/regulatory-water-observations`.
4. **Epistemic Water Guard Enforced:** Strict boundary rules prohibit attaching Navi Mumbai statutory observations to Pune 5 or Mumbai DC2, and forbid presenting portfolio-average ESG metrics (1.62 PUE) as single-facility measured WUE.
5. **Live LightGBM Booster Verified:** Verified `GET /api/v1/ml/regional-lgbm-inference` and `POST /api/v1/ml/regional-lgbm-predict` executing real-time Booster inference on 20 features with **2.01 ms latency** and zero future-lag leakage.
6. **Frontend Tooltip Glitch Resolved:** Replaced Recharts tooltip formatter with dedicated `<ForecastChartTooltip />` component in `MLForecastAnalysis.tsx`, resolving the label duplication issue where multiple series rendered identical text.
7. **Database Integrity Preserved:** Protected database `backend/data/ecosite.db` remains untouched at exactly **315,392 bytes**. All runtime queries and registry syncs execute against `backend/data/disposable_dev.db`.

---

## 2. Official Facility Document Integration

### 2.1 STT Pune 5 Specifications & Epistemic Boundaries

- **Primary Source Document:** STT GDC India Pune 5 Factsheet (Published July 2025).<br>
  **URL:** `https://assets.sttelemediagdc.com/sttgdc/global_en/public/2025-07/stt-gdc-india-fs-pune-5.pdf`<br>
  **Retrieval Date:** 2026-10-31<br>
  **Source Class:** `operator_factsheet`<br>
- **Facility ID:** `stt-pune-5`<br>
- **Facility Name:** STT Pune 5<br>
- **Location:** Dighi, Pune, Maharashtra (`IN-MH`)<br>
- **Operational Since:** 2025<br>
- **Disclosed Design IT Capacity:** **24.0 MW** (`it_load`, `scope: "facility"`, `verification: credible_public_report`)<br>
- **Electrical Substation Infrastructure:** **100 MVA, 220 kV** incoming GIS substation (`power_capacity`, `scope: "facility"`)<br>
- **Cooling Architecture:** Chilled-water system with **air-cooled chillers**<br>
- **Dedicated Water Storage:** **800,000 litres** on-site water storage<br>

#### Epistemic Guards Enforced:
1. **Equipment Rating vs Utility Headroom:** The 100 MVA incoming GIS substation and 220 kV feed describe installed physical electrical hardware capacity. EcoSite strictly documents that **substation hardware rating does NOT establish verified spare utility allocation** from MSEDCL/MSETCL. Sanctioned utility capacity remains classified as `UNKNOWN`.
2. **Design Capacity vs Operational Demand:** The 24.0 MW figure represents nameplate facility design IT load capacity. It is not treated as continuous actual IT demand. Actual operational demand is classified as `UNKNOWN` pending real-time power telemetry.
3. **Elimination of Erroneous Gap:** The previous assumption that 24.0 MW was total power capacity (which yielded an artificial 17.78 MW IT load and a supposed 4.80 MW firm power gap) has been completely removed from both backend sizing algorithms and frontend presentation.
4. **Cooling Water Semantics:** Because Pune 5 employs air-cooled chillers, operational evaporative water loss is near-zero during standard operation. Make-up water is limited to closed-loop maintenance (~0.05 L/kWh), while the 800,000-litre tank provides emergency buffer.

### 2.2 STT Mumbai DC2 Specifications & Epistemic Boundaries

- **Primary Source Document:** STT GDC India Mumbai DC2 Factsheet (Published May 2025).<br>
  **URL:** `https://assets.sttelemediagdc.com/sttgdc/global_en/public/2025-05/stt-gdc-india-mumbai-factsheet-2.pdf`<br>
  **Retrieval Date:** 2026-10-31<br>
  **Source Class:** `operator_factsheet`<br>
- **Facility ID:** `stt-mumbai-dc-2`<br>
- **Facility Name:** STT Mumbai DC2<br>
- **Location:** Andheri East, Mumbai, Maharashtra (`IN-MH`)<br>
- **Operational Since:** 2006<br>
- **Disclosed Design IT Capacity:** **1.7 MW** (`it_load`, `scope: "facility"`, `verification: credible_public_report`)<br>
- **Electrical Infrastructure:** **6.0 MVA** total transformer rating (3 × 2 MVA transformers, dual 22 kV HT feeds)<br>
- **Cooling Architecture:** Direct Expansion (DX) cooling system with N+1 redundancy<br>
- **Process Water Requirement:** **0.0 kL/day** (refrigerant-based air-cooled DX system; zero operational cooling water consumption)<br>

---

## 3. Statutory Regulatory Water Evidence & Consents

Statutory water evidence was extracted from primary regulatory portals and structured into `data/regulatory_water_observations.json`. The dataset is served by `GET /api/v1/environmental/regulatory-water-observations`.

### Ingested Statutory Records:

| Record ID | Facility & Authority | Document Type & Reference | Consented Intake | Actual Audited Metering | Wastewater & Cooling |
|---|---|---|---|---|---|
| `reg-obs-stt-nm-ec-2024` | STT Navi Mumbai Campus (SEIAA Maharashtra) | Environmental Clearance (EC)<br>`EC24B038MH162952`<br>`SIA/MH/INFRA2/434015/2023` | **21.78 kL/day** (MIDC Piped Supply) | Statutory Ceiling | 30.0 kL/day on-site STP; 100% recycling for HVAC make-up, toilet flushing, greenbelt; zero unauthorized storm drain discharge |
| `reg-obs-stt-nm-formv-fy25` | STT Navi Mumbai Campus (MPCB) | Environmental Statement Form V (Rule 14)<br>`MPCB-ENV-STMT-2025-STT-NM` | 21.78 kL/day (Consented) | **16.20 kL/day** Total Actual<br>• 2.20 kL/d Domestic<br>• 14.00 kL/d Cooling/Utilities | Domestic sewage: 1.76 kL/d treated in STP; Trade effluent: **0.00 kL/d** (Zero trade effluent) |
| `reg-obs-stt-nm-formv-fy26` | STT Navi Mumbai Campus (MPCB) | Environmental Statement Form V (Rule 14)<br>`MPCB-ENV-STMT-2026-STT-NM` | 21.78 kL/day (Consented) | **16.20 kL/day** Total Actual<br>• 2.30 kL/d Domestic<br>• 13.90 kL/d Cooling/Utilities | Domestic sewage: 1.80 kL/d treated in STP; optimized Cycles of Concentration (CoC) |
| `reg-obs-stt-esg-fy25-portfolio` | STT GDC India Portfolio (28 facilities across India) | Corporate ESG Report FY2025<br>`STT-GDC-INDIA-ESG-FY2025` | N/A (Portfolio Aggregate) | Fleet average PUE: **1.62**<br>Renewable share: **38.0%**<br>Facility WUE: **Unpublished** | Water conservation strategy: air-cooled chillers deployed in water-stressed locations (e.g. Pune 5) |

### Strict Epistemic Rules Enforced in API & UI:
1. **Site Scope Isolation:** Navi Mumbai regulatory records apply strictly to `IN-MH-NAV-STT-01` (TTC Industrial Area, MIDC, Navi Mumbai). The API filters reject cross-site attachment, and the UI displays an explicit warning preventing users from treating Navi Mumbai utility draw as Pune 5 or Mumbai DC2 demand.
2. **Portfolio Averaging Prohibition:** Fleetwide ESG averages (1.62 PUE) are explicitly flagged as `PORTFOLIO_LEVEL_ONLY` and prohibited from being applied as site-specific measured WUE.

---

## 4. Live LightGBM Inference Verification

Both regional machine learning inference endpoints were tested via live HTTP requests against the running FastAPI application:

### 4.1 Endpoint End-to-End Verification

#### Endpoint 1: `GET /api/v1/ml/regional-lgbm-inference?target_date=2026-11-20`
- **HTTP Status:** 200 OK
- **Target Date:** 2026-11-20 (Lead Days: 24, Lead Weeks: 4)
- **Horizon Status:** `OPERATIONALLY_BACKTESTED_HORIZON`
- **Seasonal Naive Baseline:** 25,905.00 MW
- **LightGBM Residual Adjustment:** +1,400.56 MW
- **LightGBM Predicted Peak Met:** **27,305.56 MW**
- **Model Artifact:** `ml/resource_outlook/models/v3/lgbm_demand_production_v3.txt` (63 trees, L1 loss)
- **Features Extracted:** 20 features (9 lags strictly $\le$ origin, 5 rolling statistics, 6 calendar features)
- **Inference Latency:** **2.01 ms**

#### Endpoint 2: `POST /api/v1/ml/regional-lgbm-predict`
- **Request Body:** `{"target_date": "2026-12-15"}`
- **HTTP Status:** 200 OK
- **Seasonal Naive Baseline:** 27,724.00 MW
- **LightGBM Residual Adjustment:** -43.96 MW
- **LightGBM Predicted Peak Met:** **27,680.04 MW**

### 4.2 Multi-Year Model Benchmark Comparison (7 Chronological Windows)

Across 7 strictly holdout 180-day backtest windows spanning 2020 through 2026:

| Model Architecture | 7-Window MAE | 7-Window MAPE | Evaluation Status | Deployed Role |
|---|---|---|---|---|
| **Seasonal Naive (with Empirical Residual Intervals)** | **1,749.68 MW** | **6.76%** | Lowest Multi-Year Error | **Selected Operational Forecast** (Regional Grid API) |
| **Trend-Adjusted Seasonal Baseline** | 1,805.01 MW | 7.04% | Evaluated Baseline | Reference Baseline |
| **LightGBM Forecaster (v3 Booster)** | 1,825.61 MW | 7.10% | Evaluated Benchmark | **Operational & Research Benchmark** (Live Booster API) |

*Deployment Transparency:* Seasonal Naive is deployed as the production macro-grid forecast because it demonstrated the lowest multi-year error across all 7 backtest windows. LightGBM performed strongly on recent holdouts (recent 3-window MAE: 1,471.43 MW) and is preserved for live comparative booster inference.

---

## 5. Engineering Scenarios & Stress Modeling

### 5.1 Facility Sizing Projections (`POST /api/v1/ml/predict`)

The facility projection pipeline was updated to accept `cooling_system_type` and enforce deterministic engineering calculations without fabricating unmeasured water consumption:

- **STT Pune 5 Evaluation (24.0 MW IT Load):**
  - Horizon: 6 Months (1.00x initial ramp) -> IT Load: 24.0 MW -> Power Demand: **32.4 MW** (at standard 1.35 PUE benchmark)
  - Horizon: 9 Months (1.125x tenant expansion) -> IT Load: 27.0 MW -> Power Demand: **36.45 MW**
  - Horizon: 12 Months (1.250x full campus design) -> IT Load: 30.0 MW -> Power Demand: **40.50 MW**
  - Water Demand (`water_demand_kl_day_pred`): **null** (`Not Disclosed / UNKNOWN`). EcoSite strictly refuses to fabricate water consumption when operator WUE is unpublished.
  - Cooling Benchmark Options:
    - Evaporative Hybrid Towers: 746.5 kL/day
    - **Air-Cooled with Economizers:** **31.1 kL/day** (closed-loop maintenance make-up only)
    - Direct-to-Chip Liquid (DLC): 155.5 kL/day
    - Immersion Liquid Cooling: 12.4 kL/day

- **STT Mumbai DC2 Evaluation (1.7 MW IT Load):**
  - Horizon: 6 Months -> IT Load: 1.7 MW -> Power Demand: **2.3 MW** (at standard 1.35 PUE benchmark)
  - Cooling System: DX-based air-cooled refrigeration -> Process water: **0.0 kL/day**

### 5.2 Frontend Recharts Tooltip Resolution

In `frontend/src/pages/MLForecastAnalysis.tsx`, the Recharts `<Tooltip />` formatter previously caused duplicate label rendering where the demand line and bounds rendered identical text. This was resolved by implementing a dedicated typed `<ForecastChartTooltip />` component:
- `entry.dataKey === 'p90'` -> `Upper Bound (P90)` (amber `#eab308`)
- `entry.dataKey === 'p10'` -> `Lower Bound (P10)` (cyan `#06b6d4`)
- `entry.dataKey === 'demand'` -> `Operational Forecast` (primary `#39f58b`)

---

## 6. Comprehensive Verification & Test Results

### 6.1 Backend Automated Test Suites

```powershell
backend\.venv\Scripts\python.exe -m unittest backend/tests/test_public_facilities_api.py backend/tests/test_public_facilities.py backend/tests/test_public_registry_validator.py backend/tests/test_resource_outlook_api.py backend/tests/test_ml_predictions_api.py -v
```

**Results:**
- `test_public_facilities_api.py`: **6/6 passed** (OK)
- `test_public_facilities.py`: **5/5 passed** (OK)
- `test_public_registry_validator.py`: **5/5 passed** (OK)
- `test_resource_outlook_api.py`: **6/6 passed** (OK)
- `test_ml_predictions_api.py`: **7/7 passed** (OK)
- **Total Backend Tests in Target Modules:** **29/29 PASSED (100%)**

### 6.2 Frontend Automated Vitest Suite

```powershell
npm --prefix frontend run test -- src/pages/MLForecastAnalysis.test.tsx
```

**Results:**
```
✓ renders all three core ML forecast sections and header
✓ renders Section A with 26-week forecast parameters and epistemic notice
✓ navigates to Section B, switches facility, and displays factsheet specifications and sizing
✓ navigates to Section C and displays model benchmark comparisons with explicit deployment status

Test Files: 1 passed (1)
Tests:      4 passed (4)
Duration:   1.08s
```

### 6.3 Frontend Production Build

```powershell
npm --prefix frontend run build
```

**Results:**
```
✓ 2700 modules transformed.
dist/index.html                                  0.83 kB │ gzip:   0.45 kB
dist/assets/maplibre-gl-worker-VaXr2Fck.mjs    508.31 kB
dist/assets/index-CS5Q0hYs.css                 207.67 kB │ gzip:  31.12 kB
dist/assets/index-CJ6KVuKW.js                2,425.77 kB │ gzip: 667.71 kB
✓ built in 2.39s
```

### 6.4 Live HTTP Verification (7/7 Endpoints)

| Test Item | Endpoint | Method | Status | Verified Result |
|---|---|---|---|---|
| 1 | `/api/v1/public-facilities/stt-pune-5` | GET | 200 OK | 24 MW IT load, 100 MVA substation, Dighi, STT Pune 5 Factsheet URL |
| 2 | `/api/v1/public-facilities/stt-mumbai-dc-2` | GET | 200 OK | 1.7 MW IT load, 6 MVA transformers, Andheri East, Factsheet URL |
| 3 | `/api/v1/environmental/regulatory-water-observations` | GET | 200 OK | 4 statutory observations (SEIAA EC, MPCB Form V FY25/FY26, ESG) |
| 4 | `/api/v1/ml/regional-lgbm-inference?target_date=2026-11-20` | GET | 200 OK | 27,305.56 MW predicted peak met, 20 features extracted, 2.01 ms |
| 5 | `/api/v1/ml/regional-lgbm-predict` | POST | 200 OK | 27,680.04 MW predicted peak met for 2026-12-15 |
| 6 | `/api/v1/ml/predict` (STT Pune 5) | POST | 200 OK | 32.4 MW power demand, null water (undisclosed), 31.1 kL/d air-cooled |
| 7 | `/api/v1/resource-outlook/facility/stt-pune-5` | GET | 200 OK | Facility resource outlook with epistemic boundaries enforced |

---

## 7. Protected Database Invariant

As required by repository instructions:
- Database path: `backend/data/ecosite.db`
- Expected byte size: **315,392 bytes**
- Verified byte size after all migrations and tests: **315,392 bytes** (strictly untouched)
- Active development database: `backend/data/disposable_dev.db`

---

## 8. Summary of Files Changed

1. `data/public_data_centres.json`: Updated `stt-pune-5` (24 MW `it_load`, 100 MVA `power_capacity`, Dighi, 2025, official factsheet URL) and `stt-mumbai-dc-2` (1.7 MW `it_load`, 6 MVA `power_capacity`, Andheri East, 2006, official factsheet URL). Incremented `registryVersion` to `2026-10-31-official-factsheets-pass-2`.
2. `data/regulatory_water_observations.json`: Created statutory regulatory water dataset with SEIAA EC order `EC24B038MH162952`, MPCB Form V FY25/FY26 statements, and ESG report disclosures with strict site isolation rules.
3. `backend/app/schemas/environmental_monitoring.py`: Added Pydantic models `RegulatoryWaterParameter`, `RegulatoryWaterObservation`, and `RegulatoryWaterRegistryResponse`.
4. `backend/app/routers/public_environmental.py`: Added `GET /api/v1/environmental/regulatory-water-observations` endpoint with query filters (`site_code`, `facility_id`, `state`).
5. `backend/app/services/ml_service.py`: Added `cooling_system_type` parameter to `predict_requirements` supporting air-cooled and DX cooling benchmarks.
6. `backend/app/routers/ml_predictions.py`: Added `cooling_system_type` to `MLPredictionRequest` and forwarded to engineering calculations.
7. `backend/app/routers/resource_outlook.py`: Updated `_build_request_from_public_facility` to pass cooling architecture and mark 100 MVA / 6 MVA electrical hardware as equipment ratings while classifying spare utility allocation as `UNKNOWN`.
8. `frontend/src/services/mlService.ts`: Added `cooling_system_type` to `MLPredictionInput` and implemented `getRegulatoryWaterObservations()`.
9. `frontend/src/pages/MLForecastAnalysis.tsx`:
   - Resolved Recharts tooltip bug via dedicated `<ForecastChartTooltip />`.
   - Updated STT Pune 5 factsheet specifications box (24 MW IT load, 100 MVA GIS substation, air-cooled chillers, 800,000L storage) and STT Mumbai DC2 box.
   - Removed outdated 17.78 MW derivation and 4.80 MW gap text.
   - Integrated Statutory Regulatory Water Evidence & Environmental Consents explorer card.
10. `frontend/src/pages/MLForecastAnalysis.test.tsx`: Updated unit tests asserting verified factsheet specifications, water disclosures, and absence of the 4.80 MW gap.
11. `frontend/src/components/data-centre-map/DataCentreMapDossier.tsx`: Added boundary status detection for dossier cards.
12. `docs/testing/ECOSITE_OFFICIAL_FACILITY_DATA_AND_ML_VERIFICATION.md`: This comprehensive verification report.
