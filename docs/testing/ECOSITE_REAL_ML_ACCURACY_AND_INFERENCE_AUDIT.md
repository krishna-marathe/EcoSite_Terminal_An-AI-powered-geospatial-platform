# EcoSite Terminal — Real ML Accuracy, Inference & Resource Forecasting Audit Report

> **Workspace:** `C:\Users\marat\EcoTerminal`<br>
> **Branch:** `krishna_updated`<br>
> **Baseline Commit:** `dd58dfa`<br>
> **Evaluation Cutoff Date:** `2026-10-27`<br>
> **Database Protection Status:** `backend/data/ecosite.db` (Strictly untouched: 315,392 bytes)<br>
> **Hackathon Context:** One Earth Hackathon 2026 — Track: Sustainable Infrastructure & Data Centre Readiness<br>

---

## 1. Executive Summary

An exhaustive scientific audit and operational verification of the machine learning pipelines, trained model artifacts, backend endpoints, facility sizing heuristics, and data centre capacity boundaries was conducted across the EcoSite Terminal repository.

### Key Audit Findings & Remediations:
1. **LightGBM Artifact Operationalization:**
   - The primary trained model artifact `ml/resource_outlook/models/v3/lgbm_demand_production_v3.txt` (100 trees, 20 features, L1 regression objective) is authentic, fully loadable, and mathematically reproducible.
   - Previously, the backend served precomputed forecast rows from CSV and ran deterministic sizing inside `POST /api/v1/ml/predict`.
   - **Remediation Implemented:** Created a live LightGBM inference engine (`predict_regional_electricity_lgbm`) and exposed it via `GET /api/v1/ml/regional-lgbm-inference` and `POST /api/v1/ml/regional-lgbm-predict`. Single-sample live inference latency is **2.01 ms**, returning the full 20-feature input vector, Seasonal Naive baseline, residual correction, and model provenance.
2. **7-Window Backtest Metric Reproduction:**
   - Evaluated across 1,239 out-of-sample holdout test days spanning 7 chronologically disjoint windows (2022–2026).
   - **Seasonal Naive Baseline:** MAE = **1,749.68 MW**, MAPE = **6.76%** (Pooled: MAE 1,764.18 MW, MAPE 6.82%).
   - **Trend-Adjusted Baseline:** MAE = **1,805.01 MW**, MAPE = **7.04%** (Pooled: MAE 1,818.46 MW, MAPE 7.10%).
   - **Regularized LightGBM Residual:** MAE = **1,825.61 MW**, MAPE = **7.10%** (Pooled: MAE 1,842.70 MW, MAPE 7.17%).
   - **Scientific Justification for Operational Model Selection:** Seasonal Naive with calibrated 80% empirical intervals (`[-1921.2, 3358.2] MW`) achieved the lowest 7-window mean error and was selected as the operational baseline. However, on the 3 most recent holdout windows (2024–2026), LightGBM outperformed Seasonal Naive on every single window (Window 5: 1485.23 MW vs 1708.59 MW; Window 6: 1408.45 MW vs 1530.54 MW; Window 7: 972.68 MW vs 1021.94 MW).
3. **Forecasting Horizon Audit (6- vs 9- vs 12-Month):**
   - The 26-week (~6-month / 182-day) regional macro forecast has rigorous 7-window backtest validation.
   - Regional projections beyond 26 weeks (52-week / 12-month) carry compound annual drift and are formally labeled **PROVISIONAL_EXTENDED_HORIZON** with clear epistemic caveats.
   - Facility-level 6-, 9-, and 12-month projections are **phased tenant fit-out ramp scenarios** (+12.5% per quarter), not machine learning forecasts.
4. **Correction of Facility Capacity Boundaries & Elimination of Artificial Gaps:**
   - In public press releases (INFRAINTEL Newsletter), **STT Pune 5** discloses "24 MW" without specifying whether it represents IT load, critical capacity, or total utility grid intake.
   - Previously, the system assumed 24 MW was total intake, backed out 17.78 MW IT load (at 1.35 PUE), and then multiplied by STT's fleet-wide average PUE (1.62) to produce a 28.80 MW demand, asserting an artificial **"4.80 MW firm power gap"**.
   - **Remediation Implemented:** Per `AGENTS.md`, unverified boundaries are classified as `UNSPECIFIED_BOUNDARY`. IT capacity and grid headroom are marked `UNKNOWN`. Sizing is presented as dual What-If Engineering Scenarios:
     - **Scenario A (Intake Boundary):** 24.0 MW Grid Intake $\to$ 17.78 MW IT Load (at benchmark 1.35 PUE).
     - **Scenario B (IT Load Boundary):** 24.0 MW IT Load $\to$ 32.40 MW Grid Intake (at benchmark 1.35 PUE).
5. **Water Telemetry Transparency:**
   - Measured water consumption is marked `UNKNOWN` / `NOT_DISCLOSED` across all facilities because operator WUE is unpublished in public filings.
   - Make-up water estimates are calculated strictly on **IT energy consumption** ($E_{\text{IT}} = P_{\text{IT}} \times \text{CF} \times 8760$), never total grid intake, using explicit engineering cooling architecture options (Evaporative Hybrid: 1.20 L/kWh, Dry/Air-Cooled: 0.05 L/kWh, Direct Liquid: 0.25 L/kWh, Immersion: 0.02 L/kWh).

---

## 2. Complete Inventory of ML Models, Artifacts & Endpoints

| Component | Path / Identifier | Scope / Type | Evaluation Status | Primary Role |
|---|---|---|---|---|
| **ML-F2.1 / v3** | `ml/resource_outlook/models/v3/lgbm_demand_production_v3.txt` | Regional Transmission Grid | 7-Window Backtest (MAE 1,825.61 MW, MAPE 7.10%) | Live Regional Residual Booster (100 trees, 20 features) |
| **Seasonal Naive** | Operational Baseline Algorithm | Regional Transmission Grid | 7-Window Backtest (MAE 1,749.68 MW, MAPE 6.76%) | Primary Deployed Regional Operational Forecast |
| **ML-F3.4** | `ml/resource_outlook/water/water_model_results.json` | Bhatsa Reservoir Basin | Multi-Year Dry Season Drawdown (MAE 39.85 MCM) | Regional Water Availability Scenarios |
| **ML-F4.1** | `backend/app/services/ml_service.py` | Facility Engineering | Deterministic Sizing (PUE 1.35, CF 80%, WUE 1.20) | Phased Facility Engineering Scenario Modeling |
| **Forecast Series (26w)** | `ml/resource_outlook/electricity_recent/electricity_forecast_26w_2026_2027.csv` | Regional 182-Day Daily Forecast | Conformal 80% Residual Intervals (`[-1921.2, 3358.2] MW`) | Cached Operational Forecast Payload |
| **Forecast Series (52w)** | `ml/resource_outlook/electricity_recent/electricity_forecast_52w_2026_2027.csv` | Regional 365-Day Daily Projection | Provisional / Compound Annual Drift | Extended Reference Series |
| **Training Dataset** | `ml/resource_outlook/electricity_recent/maharashtra_daily_combined_2013_2026.csv` | 4,958 daily historical records | 2013-04-01 to 2026-10-27 (MSLDC + Zenodo) | Primary Training & Climatology Source |

### Active API Endpoints:
- `GET /api/v1/ml/regional-lgbm-inference?target_date=YYYY-MM-DD`: Real-time execution of `lgbm_demand_production_v3.txt` booster.
- `POST /api/v1/ml/regional-lgbm-predict`: POST interface for real-time LightGBM inference.
- `POST /api/v1/ml/predict`: Facility deterministic sizing with `capacity_boundary` awareness (`UNSPECIFIED_BOUNDARY` dual scenarios).
- `GET /api/v1/ml/models`: Enumerable model identifiers (`["ML-F2.1", "ML-F3.4", "ML-F4.1", "ML-LGBM-V3"]`).
- `GET /api/v1/ml/model-info/{version}`: Model architecture metadata, features list, and epistemic boundaries.
- `GET /api/v1/resource-outlook/current-forecast`: 182-day regional electricity forecast + Bhatsa dry-season drawdown.
- `GET /api/v1/resource-outlook/facility/{facility_id}`: Resource stress evaluation with boundary-aware headroom checks.

---

## 3. LightGBM Production Model Verification

The booster artifact `ml/resource_outlook/models/v3/lgbm_demand_production_v3.txt` was loaded via `lightgbm.Booster(model_file=...)` and inspected directly:
- **Boosting Type:** `gbdt` (Gradient Boosted Decision Trees)
- **Objective:** `regression_l1` (Mean Absolute Error minimization)
- **Trees Built:** 100
- **Feature Count:** 20
- **Learning Rate:** 0.03
- **Max Depth:** 3 | **Num Leaves:** 8 | **Min Data in Leaf:** 80
- **Regularization:** $\lambda_{L1} = 2.0$, $\lambda_{L2} = 10.0$, Feature fraction = 0.80, Bagging fraction = 0.80

### Required Input Features (20):
1. `lead_days`: Forecast horizon lead time (1 to 182 days)
2. `month`: Integer calendar month (1 to 12)
3. `day_of_week`: Day of week index (0=Monday, 6=Sunday)
4. `day_of_year`: Day of year (1 to 366)
5. `is_weekend`: Binary weekend flag (1 if Saturday or Sunday)
6. `month_sin`: Harmonic cyclical month sine: $\sin(2\pi \times \text{month} / 12)$
7. `month_cos`: Harmonic cyclical month cosine: $\cos(2\pi \times \text{month} / 12)$
8. `doy_sin`: Harmonic cyclical day of year sine: $\sin(2\pi \times \text{doy} / 365.25)$
9. `doy_cos`: Harmonic cyclical day of year cosine: $\cos(2\pi \times \text{doy} / 365.25)$
10. `dow_sin`: Harmonic cyclical day of week sine: $\sin(2\pi \times \text{dow} / 7)$
11. `dow_cos`: Harmonic cyclical day of week cosine: $\cos(2\pi \times \text{dow} / 7)$
12. `climo_t2m_max_c`: ERA5 30-year climatological max 2m air temperature (°C)
13. `climo_t2m_mean_c`: ERA5 30-year climatological mean 2m air temperature (°C)
14. `climo_cdd_base24`: Cooling Degree Days: $\max(0, T_{\text{max}} - 24.0)$
15. `climo_dewpoint_c`: ERA5 30-year climatological dewpoint (°C)
16. `climo_solar_mj`: ERA5 surface solar radiation downwards ($\text{MJ/m}^2$)
17. `climo_utci_c`: Universal Thermal Climate Index (°C)
18. `lag_364d_mw`: Actual Maharashtra transmission peak met 364 days prior (MW)
19. `lag_364d_energy_mu`: Actual Maharashtra daily energy met 364 days prior (MU)
20. `lag_728d_mw`: Actual Maharashtra transmission peak met 728 days prior (MW)

---

## 4. Electricity Forecasting Model Comparison & Accuracy Reproduction

The training script `train_and_evaluate_electricity_v3.py` was executed directly against `maharashtra_daily_combined_2013_2026.csv`. Metrics were computed across all 7 chronologically disjoint backtest windows:

### Window-by-Window Backtest Performance

| Window Label | Test Period | Days | Seasonal Naive MAE (MW) | Seasonal Naive MAPE (%) | Trend-Adjusted MAE (MW) | Trend-Adjusted MAPE (%) | LightGBM v3 MAE (MW) | LightGBM v3 MAPE (%) |
|---|---|---|---|---|---|---|---|---|
| **Window 1** | Winter/Summer 2022–23 | 177 | 2,011.82 | 7.66% | 1,423.24 | 5.50% | 2,124.62 | 8.18% |
| **Window 2** | Monsoon 2023 | 183 | 3,125.57 | 12.20% | 2,219.40 | 8.66% | 3,700.10 | 14.52% |
| **Window 3** | Winter/Summer 2023–24 | 176 | 1,230.17 | 4.62% | 1,894.52 | 7.22% | 1,452.34 | 5.51% |
| **Window 4** | Monsoon 2024 | 182 | 1,619.12 | 6.77% | 2,702.04 | 11.33% | 1,635.86 | 6.92% |
| **Window 5** | Winter/Summer 2024–25 | 180 | 1,708.59 | 6.16% | 1,813.93 | 6.52% | **1,485.23** | **5.31%** |
| **Window 6** | Monsoon 2025 | 178 | 1,530.54 | 6.25% | 1,495.23 | 6.12% | **1,408.45** | **5.78%** |
| **Window 7** | Winter/Summer 2025–26 | 163 | 1,021.94 | 3.65% | 1,086.74 | 3.96% | **972.68** | **3.50%** |
| **7-Window Mean** | **Unweighted Average** | **1,239** | **1,749.68** | **6.76%** | **1,805.01** | **7.04%** | **1,825.61** | **7.10%** |

### Pooled Metrics Across All 1,239 Out-of-Sample Test Days

| Metric | Seasonal Naive Baseline | Trend-Adjusted Baseline | Regularized LightGBM (v3) |
|---|---|---|---|
| **Pooled MAE** | **1,764.18 MW** | 1,818.46 MW | 1,842.70 MW |
| **Pooled RMSE** | **2,302.57 MW** | 2,337.85 MW | 2,446.07 MW |
| **Pooled MAPE** | **6.82%** | 7.10% | 7.17% |
| **Pooled WAPE** | **6.73%** | 6.94% | 7.03% |
| **Mean Bias** | -809.99 MW | +313.93 MW | -450.70 MW |
| **Recent 3-Window MAE** | 1,420.36 MW | 1,465.30 MW | **1,288.79 MW** (Best) |

### Lead-Day Horizon Bins Analysis

| Lead Horizon Bin | Sample Count | Seasonal Naive MAE | Seasonal Naive MAPE | LightGBM MAE | LightGBM MAPE |
|---|---|---|---|---|---|
| **1–30 Days (~1 Month)** | N = 205 | 1,844.74 MW | 7.28% | 1,893.50 MW | 7.51% |
| **31–90 Days (~2–3 Months)** | N = 414 | 1,659.71 MW | 6.45% | **1,628.61 MW** | **6.37%** |
| **91–182 Days (~4–6 Months)** | N = 614 | 1,789.06 MW | 6.84% | 1,956.81 MW | 7.55% |

---

## 5. Evaluation Horizon Analysis (6-, 9-, and 12-Month)

| Horizon | Regional Electricity Grid Status | Facility Engineering Status | Epistemic Guard & Display Policy |
|---|---|---|---|
| **6 Months (182 Days)** | **Operationally Validated:** Covered by 7 chronological backtest windows. Conformal intervals calibrated. | **Initial Operational Phase:** Baseline load factor (1.000x IT load). Thermal surge factor = 1.35x. | **Standard Production Baseline:** Fully supported by historical evaluation data. |
| **9 Months (270 Days)** | **Provisional:** LightGBM was trained with max lead_days 182. Lacks 270-day holdout validation. | **Phased Tenant Ramp:** Intermediate fit-out expansion (+12.5% IT load, 1.125x). Monsoon relief factor = 0.90x. | **Provisional Scenario:** Labeled as extended scenario with compound annual uncertainty. |
| **12 Months (365 Days)** | **Provisional / Research Only:** 52-week CSV projection available, but lacks 1-year holdout backtests. | **Full Campus Design Capacity:** Expanded contractual fit-out (+25.0% IT load, 1.250x). Annual baseline = 1.00x. | **Provisional Horizon:** Labeled as design-capacity ceiling. Never presented as a validated 1-year statistical forecast. |

---

## 6. Facility Capacity Boundary Analysis (STT Pune 5, Hyderabad DC1, etc.)

### The STT Pune 5 Discrepancy Resolved
1. **Public Disclosure:** STT GDC India INFRAINTEL Newsletter states **"24 MW"** under Pune 5 disclosures.
2. **Boundary Ambiguity:** The publication does not define whether "24 MW" is design IT load, critical UPS power, or total utility grid intake sanction (`power_capacity_unspecified`).
3. **Flawed Derivation in Legacy Code:**
   - Sizing engine assumed 24 MW was IT load $\to 24 \times 1.35 = 32.40 \text{ MW}$ total power.
   - Resource stress router assumed 24 MW was total intake $\to 24 / 1.35 = 17.78 \text{ MW}$ IT load.
   - Stress engine applied STT fleet-average PUE (1.62) to 17.78 MW IT load $\to 28.80 \text{ MW}$ power demand.
   - Subtracted $28.80 - 24.00 = \mathbf{4.80 \text{ MW}}$ and asserted an unverified **"firm power gap"**.
4. **Corrected Implementation:**
   - Boundary status is labeled `UNSPECIFIED_BOUNDARY`.
   - IT capacity and firm grid headroom are marked `UNKNOWN` / `UNVERIFIED`.
   - The platform outputs dual What-If Engineering Scenarios:
     - **Scenario A (Total Grid Intake Ceiling):** 24.0 MW Grid Intake $\implies$ 17.78 MW IT Load | Est. Water: 409.8 kL/d.
     - **Scenario B (Design IT Load):** 24.0 MW IT Load $\implies$ 32.40 MW Grid Intake | Est. Water: 553.0 kL/d.
   - No firm power gap is asserted without documented Single-Line Diagrams (SLD) or utility sanction letters.

### Other Facilities in Public Registry
- **STT Mumbai DC2:** Discloses 1.7 MW with capacity type `it_load`. Boundary is explicitly documented; sizing computes $1.7 \times 1.35 = 2.295 \approx 2.3 \text{ MW}$ power demand.
- **CtrlS Hyderabad DC1:** Discloses 12 MW. Where boundary is unspecified, dual scenarios are generated (8.89 MW IT at 12 MW intake vs 16.20 MW intake at 12 MW IT).

---

## 7. Engineering Assumption Inventory & Scientific Justification

| Parameter | Value | Source / Standard | Purpose | Sensitivity & Dynamic Bounds |
|---|---|---|---|---|
| **Power Usage Effectiveness (PUE)** | **1.35** | IGBC Green Data Centre Standard / Uptime Institute India Benchmark | Converts IT capacity to total facility power intake: $P_{\text{grid}} = P_{\text{IT}} \times \text{PUE}$ | Modern Indian campuses range from 1.25 (efficient) to 1.65 (legacy). STT India fleet average is 1.62. |
| **Water Usage Effectiveness (WUE)** | **1.20 L/kWh** | BIS IS 15797 / OpenDC-LCA Tropical Climate Benchmark | Converts IT energy to evaporative cooling make-up water | Applied strictly to IT load. Dry air-cooling: 0.05, DLC: 0.25, Immersion: 0.02 L/kWh. |
| **Capacity Factor (CF)** | **0.80 (80%)** | Colocation Industry Operating Load Standard | Computes operational server duty over 8,760 hours | Colocation facilities ramp from 40% initial tenant occupancy to 85% steady-state. |
| **Summer Surge Multiplier** | **1.35x** | Wet-Bulb Depression Thermodynamics (ASHRAE TC 9.9) | Peak summer evaporative cooling make-up surge | High ambient temperatures (38–44°C) increase cooling tower evaporation and blowdown by 35%. |
| **Monsoon Multiplier** | **0.90x** | Regional Seasonal Precipitation Modeling | Monsoon ambient temperature drop and cooling relief | High relative humidity (85–95%) reduces wet-bulb depression and cooling tower evaporation. |
| **Phased Ramp Factors** | **1.00x, 1.125x, 1.25x** | Commercial Tenant Phase Deployment Standard | Illustrates multi-month fit-out progression (6m, 9m, 12m) | Represents scheduled tenant rack installation, not a statistical time-series model. |

---

## 8. Water Assessment: Measured vs Scenario vs Regional

1. **Measured Water Consumption:**
   - **Status:** `UNKNOWN` / `NOT_DISCLOSED` across all facilities in the public registry.
   - **Epistemic Rule:** EcoSite strictly refuses to present derived scenario figures as actual meter readings or utility billing records.
2. **Scenario Water Requirements:**
   - **Status:** `WHAT-IF ENGINEERING ESTIMATE`.
   - **Physics Formula:**
     $$W_{\text{scenario}} = C_{\text{IT}} \times \text{CF} \times 24 \times \text{WUE} \times S_{\text{seasonal}}$$
   - Where:
     - $C_{\text{IT}} = 24.0 \text{ MW}$ (or $17.78 \text{ MW}$ under Scenario A)
     - $\text{CF} = 0.80$ (Capacity factor)
     - $\text{WUE} = 1.20 \text{ L/kWh}$ (Evaporative Hybrid baseline)
     - $S_{\text{seasonal}} = 1.35$ (6-month summer surge) $\implies 746.5 \text{ kL/day}$ (at 24 MW IT) or $553.0 \text{ kL/day}$ (at 17.78 MW IT).
3. **Regional Water Availability:**
   - **Status:** `HISTORICAL RESERVOIR OBSERVATION`.
   - Source: Central Water Commission (CWC) weekly reservoir bulletins for Bhatsa Lake (Gross storage 942.1 MCM, live capacity 928 MCM).
   - Serves as regional catchment context for MMR/Thane, not a direct facility pipeline audit.

---

## 9. Operational LightGBM Live Inference Integration

### Implementation Architecture
In `backend/app/services/ml_service.py`:
- `predict_regional_electricity_lgbm(target_date: str)` loads the cached booster `lgbm_demand_production_v3.txt`.
- Extracts ERA5 climatology and 364d/728d historical lags from `maharashtra_daily_combined_2013_2026.csv`.
- Runs `booster.predict(feature_matrix)`.
- Adds the residual correction to the Seasonal Naive baseline ($y_{\text{pred}} = y_{\text{naive}} + y_{\text{residual}}$).

### Live Inference Verification Test Output

```json
{
  "status": "OK",
  "scope": "MAHARASHTRA_MACRO_GRID_PEAK_MET",
  "target_date": "2026-11-20",
  "origin_date": "2026-10-27",
  "lead_days": 24,
  "lead_weeks": 3.4,
  "horizon_status": "OPERATIONALLY_BACKTESTED_HORIZON",
  "predictions": {
    "lightgbm_predicted_peak_met_mw": 27305.56,
    "seasonal_naive_baseline_mw": 26162.0,
    "lightgbm_residual_adjustment_mw": 1143.56
  },
  "model_metadata": {
    "model_artifact": "ml/resource_outlook/models/v3/lgbm_demand_production_v3.txt",
    "model_type": "LightGBM Regressor (GBDT L1 Residual Booster)",
    "num_trees": 100,
    "num_features": 20,
    "backtest_7window_mae_mw": 1825.61,
    "backtest_7window_mape_pct": 7.10,
    "recent_3window_mae_mw": 1288.79
  }
}
```

---

## 10. Test Execution Results

All unit and integration test suites were executed sequentially:

1. **Frontend Vitest Test Suite:**
   - **Command:** `npm --prefix frontend run test`
   - **Result:** **62 test files passed (100%), 325 tests passed (100%)**, duration 41.72s.
2. **Frontend Production Build:**
   - **Command:** `npm --prefix frontend run build`
   - **Result:** **Built in 1.97s, 0 TypeScript errors**.
3. **ML Electricity Forecasting Tests:**
   - **Command:** `backend\.venv\Scripts\python.exe ml/resource_outlook/electricity_recent/test_electricity_forecast_v3.py`
   - **Result:** **4 passed, 0 failed (OK)**.
4. **Backend Predictions & Resource Outlook API Tests:**
   - **Command:** `backend\.venv\Scripts\python.exe -m unittest backend/tests/test_ml_predictions_api.py backend/tests/test_resource_outlook_api.py backend/tests/test_public_facilities_api.py -v`
   - **Result:** **19 passed, 0 failed (OK)**.
5. **Database Protection Audit:**
   - `backend/data/ecosite.db`: **Length 315,392 bytes (strictly untouched)**.

---

## 11. Prioritized Data Requirements Table

To transition EcoSite from pre-investment engineering scenarios to certified legal and capacity readiness, the following data sources are required:

| Priority | Required Data | Source / Entity | Impact on Platform | Current Workaround / Status |
|---|---|---|---|---|
| **P1** | Single-Line Diagrams (SLD) & MSEDCL/MSETCL Grid Sanction Letters | State Electricity Distribution Utility (MSEDCL / BEST / TSSPDCL) | Confirms actual allocated MW, voltage level (220kV vs 33kV), and substation transformer reserve. | Assumed grid sanction from public press reports; marked `UNKNOWN` if unspecified. |
| **P2** | Certified Operator WUE & Water Supply Agreements | Facility Operator / Municipal Water Supply Board (MIDC / CIDCO / HMWSSB) | Enables verified cooling water draw vs municipality allocation; identifies genuine water stress. | Refuses to fabricate water consumption; provides OpenDC-LCA cooling benchmarks. |
| **P3** | Real-Time Substation SCADA Headroom Telemetry | State Load Despatch Centre (SLDC) / CEA | Validates transmission n-1 contingency and local substation hosting capacity. | Regional transmission demand forecast (Maharashtra macro-grid only). |
| **P4** | On-Site Sub-metered Server PUE Logs | Operator Sustainability Disclosures (Level 2/3 metering) | Replaces 1.35 industry benchmark with audited operational server efficiency. | 1.35 Indian standard benchmark (IGBC / CII). |
| **P5** | High-Resolution ADM1/ADM2 State Boundary Polygons | Survey of India (SOI) Digital Boundaries | Upgrades screening polygons to legal cadastral parcels. | Pinned ADM0 screening boundary with non-legal disclaimers. |

---

## 12. Appendices

### Appendix A: Mathematical Formulas

1. **Seasonal Naive 364-Day Lag:**
   $$\hat{y}_{t+h}^{\text{naive}} = y_{t+h-364}$$
2. **LightGBM Residual Correction:**
   $$\hat{y}_{t+h}^{\text{LGBM}} = \hat{y}_{t+h}^{\text{naive}} + f_{\text{booster}}(\mathbf{x}_{t+h})$$
3. **Calibrated 80% Residual Interval Bounds:**
   $$I_{80} = [\hat{y}_{t+h} - 1921.2 \text{ MW},\; \hat{y}_{t+h} + 3358.2 \text{ MW}]$$
4. **Facility Power Demand:**
   $$P_{\text{grid}} = P_{\text{IT}} \times \text{PUE}$$
5. **Scenario Cooling Make-up Water:**
   $$W_{\text{day}} = P_{\text{IT}} \times \text{CF} \times 24 \times \text{WUE} \times S_{\text{season}} \quad (\text{kL/day})$$

### Appendix B: Audit Verification Certification
- **Auditor:** Krishna (Backend & ML Integration Lead)
- **Reviewers:** Omar (Frontend Lead), Siddharth (GIS/Provenance), Samarth (ML/Evaluation)
- **Status:** **APPROVED & OPERATIONALLY VERIFIED**
