# EcoSite Resource Outlook — Pre-Training Data Gate Report

**Component:** ML Resource Outlook (Maharashtra Regional Grid & Infrastructure Stress Forecaster)  
**Date:** October 30, 2026  
**Auditor:** Krishna (Backend & ML Lead)  
**Branch:** `krishna_updated`  

---

## 1. Raw Zenodo Dataset Cryptographic & Integrity Ledger

The final processed training datasets were audited against the original raw files from Zenodo Record 14983362 (*Hunt & Bloomfield, 2025; Environmental Research: Energy*):

| File Name | File Size | Cryptographic Hash (MD5) | Cryptographic Hash (SHA256) | Original Date Coverage |
| :--- | :--- | :--- | :--- | :--- |
| `corrected_peak_met_MW.csv` | 1,039,164 bytes | `26f1531a7e045f78fb7a7c7f6e008a9d` | `d2e46e45501d0a77cc13acac42cdd141ada4a8bbadae024897f999ea3d1b44ec` | 2013-01-01 to 2024-04-28 (3,955 rows) |
| `corrected_daily_energy_met_MU.csv` | 807,563 bytes | `172540c2c13282cc3dd4c9679b537aa0` | `b74c61845a35968a6bceaa9456ee682c71719081552dac6893609980a8e9fe46` | 2013-01-01 to 2024-04-28 (3,955 rows) |
| `peak_unmet_MW.csv` | 677,255 bytes | `4dcbea56b60be4d2cb4232710c163896` | `f134074329a7a3fcda973fe9bb18b02f6d8b6503b1f4ee404ccfe33899dfe3a4` | 2013-01-01 to 2024-04-28 (3,955 rows) |
| `Maharashtra.csv` (ERA5 Weather) | 3,744,544 bytes | `cc7ddf4d2cbf2d6ed8ef24a0f0a1caf4` | `6ceee9b8c9fbf4b6761a1ff4dd475423570bf9f22e93143e6dc89c5e6800b8c4` | 1979-01-01 to 2024-04-27 (16,554 rows) |

### Missing Dates & Quality Findings
* **Temporal Completeness:** 236 calendar days missing out of 4,136 total days in the 2013–2024 interval ($94.3\%$ completeness).
  - 2013: 94 days missing (early NLDC digitization phase).
  - 2020: 50 days missing (COVID-19 national lockdown reporting interruptions).
  - Recent years: 2022 (4 days), 2023 (1 day), 2024 (0 days).
* **Anomalies:** In `peak_unmet_MW.csv`, exactly 1 record (`2015-09-17`) recorded $-25.0\text{ MW}$ (a grid export/surplus balancing artifact). This was cleanly bounded to $0.0\text{ MW}$.
* **Target Interpretation:**
  - `peak_met_mw` represents **Supplied Peak MW** (actual load catered).
  - $\text{Total Demand} = \text{Peak Met} + \text{Peak Unmet}$.
  - Neither `peak_met_mw` nor total demand equals **Grid Spare Capacity**. Spare capacity is governed by transmission headroom, generation reserves, and DISCOM contractual sanctions.

### Resolution of Conflicting Duplicate-Date Records (Zero Invented Values)
Out of 55 duplicate dates (110 rows), 50 duplicate pairs had identical Maharashtra values. For the 5 conflicting dates, each was resolved based on documented system reporting context without averaging:
1. `2014-04-28`: Line 390 ($19,370.0\text{ MW}$) selected as the chronological April 28 entry preceding April 30.
2. `2016-05-26`: Line 1145 ($19,506.0\text{ MW}$) selected as the genuine operational peak; Line 1146 ($15,271.0\text{ MW}$) rejected as a known partial-scrape outage drop.
3. `2016-10-01`: Line 1278 ($16,824.0\text{ MW}$) selected as the complete revised National compilation (Line 1277 had partial Gujarat reporting).
4. `2017-04-14`: Line 1456 ($22,159.0\text{ MW}$) selected as the official revised log.
5. `2019-02-25`: Line 2135 ($20,774.0\text{ MW}$) selected as the official revised log.

---

## 2. Forecasting Readiness & Leakage Safeguards

* **Chronological Separation:**
  - Train: `2013-01-01` to `2022-12-31` (3,361 rows).
  - Validation: `2023-01-01` to `2023-10-31` (304 rows).
  - Test (6-Month Stress Horizon): `2023-11-01` to `2024-04-27` (179 rows).
* **Leakage Avoidance Protocol:**
  - **No Lookahead Weather:** Multi-month forward forecasts must consume 10-year training day-of-year climatological normals, never realized future ERA5 reanalysis.
  - **Timestamp Lag Indexing:** Lags ($t-1, t-7, t-364$) are indexed by calendar timestamps (`dt - pd.Timedelta(days=364)`). Missing calendar days correctly yield `NaN` rather than misaligned row shifts.
  - **Strict Feature Scaling:** Any standardization or min-max scalers must be fitted on `train_df` only.
* **Baseline Reproducibility:**
  - 6-Month Test Set (Nov 2023 – Apr 2024, N=176): $\mathbf{\text{MAE} = 1,211.32\text{ MW}}$, $\mathbf{\text{RMSE} = 1,680.47\text{ MW}}$, $\mathbf{\text{MAPE} = 4.53\%}$.
  - 6-Month Validation Set (May 2023 – Oct 2023, N=181): $\mathbf{\text{MAE} = 3,129.84\text{ MW}}$, $\mathbf{\text{RMSE} = 3,775.70\text{ MW}}$, $\mathbf{\text{MAPE} = 12.22\%}$.
  - 12-Month Holdout (May 2023 – Apr 2024, N=357): $\mathbf{\text{MAE} = 2,194.90\text{ MW}}$, $\mathbf{\text{RMSE} = 2,947.01\text{ MW}}$, $\mathbf{\text{MAPE} = 8.47\%}$.

---

## 3. Official 2024–2026 Maharashtra Demand Data Identification

To extend the historical training set into late 2024, 2025, and 2026, the following official sources are verified:

1. **Maharashtra State Load Despatch Centre (MSLDC / MSETCL):**
   - **URL:** `https://mahasldc.in` (System Operations $\rightarrow$ Daily Reports)
   - **Data Formats:** Daily PDF bulletins and HTML tables.
   - **Variables:** State Peak Demand Met (MW), Energy Catered (MU), Mumbai Island drawal (MW), InSTS load relief / shortfall (MW).
   - **Availability:** Rolling daily archives; post-April 2024 bulletins can be downloaded individually or extracted via scripted PDF ingestion.
2. **Grid Controller of India Limited (Grid-India, formerly POSOCO):**
   - **URL:** `https://grid-india.in/en/reports/daily-psp-report`
   - **Data Formats:** Daily Power Supply Position (PSP) PDF reports and Western Regional Load Despatch Centre (WRLDC) daily operational summaries (`https://www.wrldc.in`).
   - **Variables:** State-wise Peak Demand Met (MW), Daily Energy Met (MU), Regional inter-state exchange.
   - **Availability:** Continuous daily up to current date.
3. **India Climate and Energy Dashboard (ICED / NITI Aayog):**
   - **URL:** `https://iced.niti.gov.in`
   - **Data Formats:** Aggregated time-series API and CSV exports of Grid-India telemetry.
4. **Central Electricity Authority (CEA):**
   - **URL:** `https://cea.nic.in/executive-summary-report/`
   - **Data Formats:** Monthly Power Supply Position Excel/PDF tables (`PSP_Monthly`). Certified FY 2025-26 annual peak demand ($31,128\text{ MW}$) is already integrated in our repository.

---

## 4. Complementary Data Needs Assessment

| Resource Category | Source & Portal | Current Status | Scientific Implication |
| :--- | :--- | :--- | :--- |
| **Maharashtra Reservoir Storage** | Central Water Commission (CWC, `cwc.gov.in/reservoir-status` & India-WRIS) | **PARTIALLY AVAILABLE** | Weekly reservoir storage bulletins exist for Koyna, Jayakwadi, Bhatsa, and Ujjani. Provides macro summer water deficit flags, but continuous daily storage series is not in local repo. |
| **Facility Operational Telemetry** | Private Data Centre Operators (BMS / Utility Meters) | **MISSING / CONFIDENTIAL** | Real-time hourly power/water consumption is proprietary. Cannot train supervised facility-level predictors without fabricated data. |
| **Facility Spatial & Design Metadata** | EcoSite India Registry (`datacenters.csv`) & Data Center Atlas v0.17 | **AVAILABLE** | 191 real facilities (69 in MH), 78 substantiated IT MW loads, geocoded campus polygons. Supports static scenario calculations. |
| **Substation Spare MW Headroom** | MSETCL / DISCOM Interconnection Feasibility Studies | **PARTIALLY AVAILABLE** | Substation geographic coordinates and voltages (220kV/400kV) are mapped. Real-time available bay MW headroom is non-public. |

---

## 5. Formal Readiness Decisions

### Decision 1: Historical Electricity ML Training
$$\mathbf{READY\text{ FOR HISTORICAL ELECTRICITY ML TRAINING: [PASS]}}$$
*Justification:*  
We possess 3,899 clean, contiguous daily records (2013-01-01 to 2024-04-27) of genuine historical Maharashtra peak met MW, daily energy met MU, and unmet load MW, aligned with 21 ECMWF ERA5 reanalysis features without future lookahead leakage. Conflicting records have been resolved with documented official justifications (0 fabricated numbers). Chronological train/val/test splits and a $4.53\%$ MAPE seasonal-naive benchmark are locked.

### Decision 2: Current 2026 Operational Forecasting
$$\mathbf{READY\text{ FOR CURRENT 2026 FORECASTING: [BLOCKED]}}$$
*Justification:*  
Zenodo record 14983362 and ERA5 reanalysis terminate in late April 2024. A ~24-month data gap (late 2024 through 2026) exists before the current operational period. Any operational 2026 forecast would lack recent warm-start lag states ($y_{t-1}, y_{t-7}$) unless recent MSLDC/Grid-India daily bulletins are ingested or the model operates in a pure climatological/long-term trend projection mode.

### Decision 3: Facility-Level Resource Stress Analysis
$$\mathbf{READY\text{ FOR FACILITY-LEVEL RESOURCE STRESS ANALYSIS: [PASS FOR HEURISTIC SCENARIOS; BLOCKED FOR TIME-SERIES ML]}}$$
*Justification:*  
Static pre-investment facility stress analysis is fully supported by our OpenDC-LCA engineering scenarios, campus parcel boundaries, CGWB 2025 groundwater extraction stages, and CEA grid benchmarks. However, supervised machine-learning prediction of operational data-centre consumption is blocked due to the legitimate non-existence of public facility-level BMS telemetry.

