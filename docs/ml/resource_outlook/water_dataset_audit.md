# EcoSite Resource Outlook — ML-F3.3 Complete Water Training Data & Baseline Audit

**Date:** 2026-10-30  
**Lead:** Krishna (Backend & ML Lead)  
**Branch:** `krishna_updated`  
**Status:** **ML-F3 WATER TRAINING DATA COMPLETED / SEASONAL-NAIVE BASELINE BENCHMARKED**

---

## 1. Executive Summary & Audit Context

To forecast environmental and infrastructure stress (6–12 month outlook) for India data center corridors, water availability is a critical constraint. Data centers in the Mumbai Metropolitan Region (MMR), Thane, and Navi Mumbai rely on municipal water allocations originating from major Western Ghats reservoirs, primarily **Bhatsa Dam** (monitored capacity 717 MCM municipal, 942 MCM total live capacity).

Following the ML-F3.2 bounded proof-of-concept, ML-F3.3 scaled the ingestion pipeline across **2022 and 2023**:
1. **Resumable Batch Ingestion:** Executed 4 bounded batches covering 2023-H1, 2023-H2, 2022-H1, and 2022-H2.
2. **Total CWC PDF Bulletins:** **122 official bulletins** downloaded, SHA-256 hashed, and parsed with PyMuPDF.
3. **Continuous Multi-Year Calendar (2022–2024):** Built a 130-week continuous calendar spanning **2022-01-06 to 2024-06-27** (2.5 years) with zero interpolated or synthetic observations.
4. **Data Continuity:**
   - **2024-H1 (Held-out Test Horizon):** 26 / 26 weeks observed (**100.0% coverage**, 0 missing).
   - **2023 (Training Horizon):** 52 / 52 weeks observed (**100.0% coverage**, 0 missing).
   - **2022 (Historical Context):** 41 / 52 weeks observed (11 weeks missing due to official CWC server HTTP 404 dead links).
5. **Changing Monitored Reservoir Handling:** Monitored reservoir count shifted from 28–29 in 2022 to 32 in 2023–2025. Avoided false water availability signals by standardizing to `storage_percent` and a normalized 32-reservoir benchmark capacity (`19.166 BCM`).
6. **Seasonal-Naive Fixed-Origin 26-Week Backtest:** Sourced exclusively from 2023 historical observations to predict 2024-H1 with zero data leakage.

---

## 2. Ingestion & Download Breakdown

| Batch / Year | Target Window | Bulletins Targeted | Downloaded | Skipped (Existing) | Failed (Server 404) | Observational Continuity |
|---|---|---|---|---|---|---|
| **2024-H1** | 2024-01-04 to 2024-06-27 | 26 | 21 | 5 | 0 | **26 / 26 (100.0%)** |
| **2023-H1** | 2023-01-05 to 2023-06-30 | 26 | 23 | 3 | 0 | **26 / 26 (100.0%)** |
| **2023-H2** | 2023-07-06 to 2023-12-28 | 26 | 26 | 0 | 0 | **26 / 26 (100.0%)** |
| **2022-H1** | 2022-01-06 to 2022-06-30 | 25 | 14 | 2 | 9 (CWC 404) | **16 / 25 (64.0%)** |
| **2022-H2** | 2022-07-07 to 2022-12-29 | 26 | 25 | 0 | 1 (CWC 404) | **25 / 26 (96.2%)** |
| **Multi-Year Anchors** | 2024-Oct, 2025-Jan, 2025-Apr | 3 | 3 | 0 | 0 | Anchor Snapshots |
| **Total Ingested** | **2022 to 2025** | **132** | **112** | **10** | **10** | **122 Parsed PDFs** |

---

## 3. Continuous 130-Week Calendar (2022-01-06 to 2024-06-27)

Two continuous weekly calendar files are established in `ml/resource_outlook/water/`:
1. `bhatsa_weekly_continuous_calendar.csv`: 130 calendar weeks tracking Bhatsa level, live storage (MCM), %, and normal 10-yr %.
2. `maharashtra_statewide_weekly_continuous_calendar.csv`: 130 calendar weeks tracking monitored count, capacity (BCM), live storage (BCM/MCM), normalized 32-res storage, %, and normal 10-yr %.

### Calendar Completeness

- **Total Expected Weeks:** 130 weeks
- **Total Observed Weeks:** 119 weeks (91.5% overall)
- **Total Missing Weeks:** 11 weeks (all in 2022 due to official CWC server 404 dead links)
- **Zero Fabrication:** Missing weeks explicitly marked `MISSING_OBSERVATION` with `NaN` storage.

---

## 4. Seasonal-Naive Baseline 26-Week Backtest (2024-H1)

- **Forecast Origin:** `2024-01-04` (Fixed origin at the start of the dry season)
- **Forecast Horizon:** 26 weekly steps forward (Weeks 1 to 26 of 2024: `2024-01-04` to `2024-06-27`)
- **Historical Predictor:** Corresponding week of 2023 (52 weeks prior)
- **Data Leakage:** Strictly zero lookahead. 2024 observations were untouched.

### A. Bhatsa Reservoir 26-Week Backtest Performance

- **Reservoir Capacity:** 942.1 MCM (FRL 142.07 m)
- **Target Unit:** MCM (Million Cubic Metres)
- **MAE:** **39.85 MCM** (**4.23% of total reservoir capacity**)
- **RMSE:** **40.30 MCM**
- **MAPE:** **10.80%**
- **Mean Error / Bias:** **-39.85 MCM**
- **Observed 2024 Drawdown Range:** 705.0 MCM (Jan 4) $\rightarrow$ 197.0 MCM (Jun 27)
- **Predicted 2023 Trajectory:** 735.0 MCM (Jan 5) $\rightarrow$ 230.0 MCM (Jun 29)

> **Physical Interpretation:** Bhatsa follows a highly structured, smooth seasonal depletion curve during the pre-monsoon dry season. In 2024, extreme summer heat accelerated depletion relative to 2023, causing actual storage to run ~39.85 MCM below 2023 levels throughout the spring. The Seasonal-Naive baseline provides a strong, physically grounded benchmark with only ~10.8% MAPE.

### B. Maharashtra Statewide 26-Week Backtest Performance

- **Monitored Capacity Benchmark:** 32 reservoirs / 19.166 BCM (19,166 MCM)
- **MAE (Normalized MCM):** **2,720.15 MCM (2.72 BCM)**
- **MAE (Percentage Points of Capacity):** **14.19 percentage points**
- **RMSE (Normalized MCM):** **2,809.42 MCM**
- **MAPE:** **40.24%**
- **Mean Error / Bias:** **-2,720.15 MCM (-14.19 % points)**
- **Observed 2024 Range:** 65.0% (Jan 4) $\rightarrow$ 15.0% (Jun 20) $\rightarrow$ 16.0% (Jun 27)
- **Predicted 2023 Range:** 86.0% (Jan 5) $\rightarrow$ 21.0% (Jun 29)

> **Physical Interpretation:** Unlike Bhatsa (which had robust post-monsoon storage entering both 2023 and 2024), Marathwada and parts of Western Maharashtra suffered an acute drought in 2024 (Jayakwadi dropped to 5% and Bhima/Ujjani dropped to 0.00 BCM). Consequently, statewide storage started 21 percentage points lower in January 2024 (65% vs 86%) and stayed depressed throughout summer. A pure seasonal naive model cannot anticipate these macro-drought deviations without rainfall/inflow predictors.

---

## 5. Remaining Data Quality Limitations

1. **2022 CWC Server 404s:** 10 weekly bulletins in 2022 cannot be downloaded because the government portal links return HTTP 404 Not Found. This creates 11 missing calendar weeks in 2022. However, 2023 and 2024 are 100% complete.
2. **BMC Daily Mirror Gaps:** The municipal daily series remains severely deficient in pre-monsoon summer (<10 records across 6 years in Feb–May). The official weekly CWC bulletin series is the authoritative primary source.
3. **Macro-Drought Divergence:** Statewide water availability varies substantially between monsoon deficit years (2023–2024) and surplus years. LightGBM with ERA5 precipitation/temperature features is well-suited to improve upon the seasonal-naive baseline.

---

## 6. Final Status & Verdict

```
========================================================================================
ECOSITE RESOURCE OUTLOOK (WATER) — AUDIT & MODEL GATE VERDICT:
  - Real Multi-Year CWC Ingestion:               122 Official Bulletins Parsed
  - Continuous 130-Week Calendar (2022-2024):    ESTABLISHED (119 Observed / 11 Missing)
  - Training Set (2023):                         100.0% Complete (52/52 weeks)
  - Held-out Test Set (2024-H1):                 100.0% Complete (26/26 weeks)
  - Seasonal-Naive Baseline Fixed Backtest:      COMPLETED (Bhatsa MAE: 39.85 MCM / 10.8% MAPE)
  - Unit Tests:                                  10/10 PASSED (test_water_ingestion.py)
  - ML-F3 Status:                                ML-F3 READY (Data & Baseline Complete)
========================================================================================
```
