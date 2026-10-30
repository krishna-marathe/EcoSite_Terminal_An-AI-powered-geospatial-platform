# EcoSite India — ML-F1: Real Dataset Inventory & Quality Analysis
**Domain:** Resource Outlook — 6–12 Month Environmental & Infrastructure Stress Forecast  
**Date of Audit:** October 30, 2026  
**Auditor:** Krishna (Backend & ML Lead)  
**Target Focus:** Maharashtra Electricity Demand & Regional Resource Stress  
**Audit Status:** **`ML-F1 BLOCKED FOR TRAINING (TARGET DEMAND MISSING); READY FOR FEATURE ENGINEERING & SPATIAL BASELINE`**

---

## 1. Executive Summary & Audit Verdict

A rigorous, file-by-file inspection of all 51 files across the 9 subfolders in `C:\Users\marat\Downloads\Datacentres_Data` (~266 MB total) was executed.

### Critical Findings & Feasibility Verdict
1. **Critical Data Mismatch in Folder Name:**  
   The folder titled `Indian state electricity demand dataset` containing `Maharashtra.csv`, `Karnataka.csv`, `Tamil_Nadu.csv`, and `Telangana.csv` **does NOT contain any electricity demand or power grid consumption variables**. Instead, it contains 16,554 daily rows (1979-01-01 to 2024-04-27) of **ECMWF ERA5 meteorological reanalysis features** (2m air temperature, dewpoint temperature, surface solar radiation, total cloud cover, wind vectors $u/v$, and UTCI thermal comfort index).
2. **Missing Ground-Truth Target Series:**  
   There is currently **no daily or monthly time-series electricity demand target variable ($y$)** in the dataset folder. The only verified electricity figures in the folder are static annual aggregations published in the official Central Electricity Authority Annual Report 2025-26 (`Annual_Reports_of_CEA_12950.pdf`, Page 217: Maharashtra FY25-26 Peak Demand = 31,128 MW; Energy Requirement = 202,867 MU).
3. **Synthetic Datasets Identified & Quarantined:**  
   Both `ai_data_center_energy_efficiency_2026.csv` (`data_origin: synthetic`, 3 North American testbed clusters) and `green_ai_datacenter.csv` (100,000 synthetic rows created for KNIME/Tableau ML tutorials) are **100% synthetic simulated telemetry**. They do not reflect real Indian data centres or grid conditions and are **strictly excluded** from infrastructure stress modeling to prevent synthetic artifact leakage.
4. **High-Quality Real Environmental & Spatial Data:**  
   - **IMD Gridded Rainfall:** 6 continuous NetCDF-3 files (2020 through 2025, 2,192 days) across India at 0.25° resolution ($129 \times 135$ grid).
   - **NASA POWER Climate:** 10 full continuous years (2015–2024, 3,653 days) for Pune and Mumbai with zero missing values.
   - **CGWB 2025 Assessment:** 482-page official national groundwater assessment containing block- and district-level extractable recharge and extraction stages.
   - **Data Center Registries:** 191 real Indian facilities in `datacenters.csv` (69 in Maharashtra) and 27 verified Indian campuses with polygon footprints in `datacenter-atlas-latest`.
5. **Verdict:** **`ML-F1 BLOCKED FOR TRAINING`** until a daily electricity demand CSV for Maharashtra (e.g. from MSLDC or POSOCO / Grid-India) is provided. Once the target CSV is supplied, the existing ERA5 climate features, NASA POWER solar insolation, and IMD rainfall are **100% READY** to support a Seasonal-Naive baseline and LightGBM 6-month stress forecasting model.

---

## 2. Dataset Group Inspection Ledger

| Group / Subfolder | Files | Size | Publisher / Origin | License | Temporal Range | Nature | ML Suitability Role |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Climate Reanalysis (Misnamed Demand)** | 4 CSVs | 14.24 MB | ECMWF / Copernicus ERA5 | CC BY 4.0 | 1979-01-01 to 2024-04-27 | Modelled Reanalysis | **Exogenous Features** (Weather/Cooling drivers); Target Missing |
| **2. Climate & Solar Observations** | 3 CSVs | 0.37 MB | NASA POWER / MERRA-2 / CERES | Public Domain | 2015-01-01 to 2024-12-31 | Observed & Assimilated | **Exogenous Features** (Pune & Mumbai local climate) |
| **3. IMD Gridded Rainfall** | 6 NetCDFs | 145.66 MB | India Meteorological Dept (IMD) | Govt Open Data | 2020-01-01 to 2025-12-31 | Observed Rain-gauge | **Exogenous Features** (Monsoon deficit, drought index) |
| **4. Central Electricity Authority (CEA)** | 1 PDF | 8.09 MB | Central Electricity Authority | Official Statutory | FY 2024-25 to 2025-26 | Certified Grid Records | **Macro Target / Calibration** (Annual state demand) |
| **5. CGWB Groundwater Assessment** | 1 PDF | 10.23 MB | Central Ground Water Board | Official Statutory | 2025 Compilation | Hydrogeological Survey | **Static Siting & Stress Baseline** (District extraction stage) |
| **6. Data-Centre Facility Registries** | 2 CSVs | 0.20 MB | EcoSite India / Data Center Atlas | CC BY 4.0 | Current to late 2026 | Observed Ground Truth | **Spatial Infrastructure Metadata** (191 Indian facilities) |
| **7. Datacenter Atlas Latest Core** | 21 Files | 64.49 MB | Data Center Atlas v0.17 | CC BY 4.0 | 2024-08-06 to 2026-10-28 | Documented Evidence | **Spatial Verification Polygons** (27 Indian campuses) |
| **8. Hyperscale Water Benchmarks** | 7 Files | 0.13 MB | Hyperscale Operators (Google/AWS/MS) | CC BY 4.0 / Apache | FY 2022 to FY 2025 | Corporate ESG Disclosures | **Engineering Benchmark Calibration** (35 reported WUEs) |
| **9. Synthetic Testbed Telemetry** | 6 Files | 22.73 MB | Synthetic Generator / Kaggle | Public Domain / Open | Fictional 2026 / Categorical | **100% Synthetic** | **EXCLUDE (Synthetic Artifact Bias)** |

---

## 3. Deep Dive into Real Datasets

### A. Climate Reanalysis (`Indian state electricity demand dataset/Maharashtra.csv`)
- **File:** `Maharashtra.csv` (and counterparts for `Karnataka.csv`, `Tamil_Nadu.csv`, `Telangana.csv`).
- **Records:** Exactly 16,554 daily rows covering 45.3 years from **1979-01-01 to 2024-04-27**.
- **Continuity:** Zero missing calendar days. Zero duplicate timestamps.
- **Variables & Units:**
  - `2m_temperature_min/mean/max`: Kelvin (Range: 295.4 K to 319.8 K = 22.2°C to 46.6°C).
  - `2m_dewpoint_temperature_min/mean/max`: Kelvin (Range: 271.8 K to 301.2 K = -1.3°C to 28.0°C).
  - `surface_solar_radiation_downwards_min/mean/max`: Joules per square meter ($J/\text{m}^2$).
  - `total_cloud_cover_min/mean/max`: Dimensionless fraction (0.0 to 1.0).
  - `10m_u_component_of_wind` & `10m_v_component_of_wind`: Meters per second ($m/s$).
  - `utci_min/mean/max`: Universal Thermal Climate Index in Kelvin (Range: 292.4 K to 328.6 K = 19.2°C to 55.4°C).
- **Missing Data:**
  - 1 row null for wind, temperature, dewpoint, and cloud cover ($0.006\%$).
  - 2 rows null for solar radiation ($0.012\%$).
  - 90 rows null for UTCI ($0.54\%$, easily imputed via spline or mean temperature-humidity regression).
- **Critical Evaluation:** Highly valuable, clean, multi-decade reanalysis dataset representing the exact thermodynamics that drive state air conditioning and chiller load surges. However, **the demand target variable was omitted during collection**.

### B. NASA POWER Daily Observations (`daily/POWER_Point_Daily_...`)
- **Files:**
  - `POWER_Point_Daily_20150101_20241231_018d52N_073d86E_UTC.csv` (Pune: 18.5204° N, 73.8567° E).
  - `POWER_Point_Daily_20150101_20241231_019d08N_072d88E_UTC.csv` (Mumbai: 19.08° N, 72.88° E).
  - `POWER_Point_Daily_20150101_20241231_018d52N_073d86E_UTC (1).csv` (**Redundant Duplicate:** Byte-for-byte identical to the first file, MD5: `c3f34437b00102a71621e0a242ea4c17`).
- **Records:** 3,653 daily rows covering 10 full calendar years (**2015-01-01 to 2024-12-31**).
- **Data Quality:** Exactly **0 missing values** (`-999` count is zero across all variables).
- **Variables:** `T2M` (daily mean °C), `T2M_MAX` (daily max °C), `RH2M` (relative humidity %), `ALLSKY_SFC_SW_DWN` (solar insolation in $\text{kW-hr}/\text{m}^2/\text{day}$).
- **Role in ML:** Provides localized microclimate signals specifically pinpointing the two dominant data centre hubs in Western India (Mumbai-Navi Mumbai coastal humidity corridor and Pune-Chakan-Talegaon plateau).

### C. IMD Gridded Daily Rainfall NetCDF-3 (`IMD gridded rainfall/RF25_ind[2020-2025]_rfp25.nc`)
- **Format:** Classic NetCDF-3 (`b'CDF\x01'`).
- **Files:** 6 annual files for 2020 (366 days), 2021 (365 days), 2022 (365 days), 2023 (365 days), 2024 (366 days), and 2025 (365 days) = **2,192 consecutive days**.
- **Spatial Coverage:** 0.25° grid across India ($129 \text{ latitudes } \times 135 \text{ longitudes } = 17,415 \text{ grid points/day}$). Latitude: 6.5° N to 38.5° N; Longitude: 66.5° E to 100.0° E.
- **Variable:** `RAINFALL` in `mm/day`. Fill value `-999.0` for non-terrestrial/ocean cells.
- **Data Quality:** Complete temporal continuity through December 31, 2025.
- **Role in ML:** Essential for computing monsoon deficit, Standardized Precipitation Index (SPI), and reservoir catchment inflow anomalies.

### D. Central Electricity Authority Annual Report 2025-26 (`Annual_Reports_of_CEA_12950.pdf`)
- **Nature:** 258-page statutory publication by the Ministry of Power, Government of India.
- **Key Tables Identified:**
  - Page 75–81: Power Supply Position Overview & Regional Trends.
  - Page 216–218 (Annexure 4A & 4B): Official State/UT Power Supply Position for FY 2024-25 and FY 2025-26.
- **Official Maharashtra Grid Figures (Annexure 4A, Page 217):**
  - **Peak Demand Met:** $31,128\text{ MW}$ (Unmet peak: $0\text{ MW}$, $0.0\%$).
  - **Annual Energy Requirement:** $202,867\text{ MU}$ ($202.87\text{ TWh}$).
  - **Annual Energy Supplied:** $202,854\text{ MU}$ ($13\text{ MU}$ unmet deficit = $0.006\%$).
- **Role in ML:** Serves as the ground-truth macro-calibration target and annual scale envelope for state load models.

### E. CGWB Dynamic Ground Water Resources Assessment 2025 (`1762513884655822300file (1).pdf`)
- **Nature:** 482-page statutory report (ISBN 978-81-984761-6-6) published in November 2025 by CGWB, Ministry of Jal Shakti.
- **Coverage:** Nationwide block-level, taluka-level, and district-level assessments for 2025.
- **Key Indicators:** Annual Extractable Ground Water Resource, Current Extraction for Domestic/Industrial Uses, Current Extraction for Irrigation, and Stage of Extraction (Categorized as Safe, Semi-Critical, Critical, or Over-Exploited).
- **Role in ML:** Hard regulatory constraint and baseline stress feature. Ground extraction stages dictate statutory CGWA NOC feasibility for candidate sites.

### F. Data Centre Facility Metadata (`datacenters.csv` & `datacenter-atlas-latest`)
- **Inventory (`datacenters.csv`):** 191 verified Indian data centre facilities (69 in Maharashtra, 22 in Telangana, 21 in Uttar Pradesh, 19 in Tamil Nadu, 19 in Karnataka).
- **Capacity Telemetry:** 78 facilities report substantiated IT capacity (Mean: $93.5\text{ MW}$, Max: $1000\text{ MW}$).
- **Water Stress:** 118 facilities ($61.8\%$) are situated in high or critical baseline water stress zones.
- **Data Center Atlas (`datacenter-atlas-latest`):** Relational SQLite database (`atlas.sqlite`), validated GeoJSON boundaries, and evidence ledger covering 932 global sites (27 verified Indian campuses with geocoded parcel polygons).
- **Rule Enforcement:** These metadata files provide infrastructure spatial coordinates and campus design MW capacities. **They must never be treated as time-series electricity or water consumption.**

---

## 4. Useful ML Variables Grouped by Domain Category

### 1. Electricity Demand and Supply
- **Actual Targets (Macro Annual):** State Peak Demand ($31,128\text{ MW}$ in Maharashtra), Annual Energy Requirement ($202,867\text{ MU}$), Deficit Rate ($0.006\%$) [Source: CEA Annual Report 2025-26].
- **Missing Target (Daily):** Daily peak load ($\text{MW}$) and daily energy consumption ($\text{MU}$) time series for Maharashtra.

### 2. Rainfall and Drought
- **Daily Precipitation ($mm/\text{day}$):** IMD 0.25° gridded daily rainfall (2020–2025) [Source: IMD NetCDF-3].
- **Catchment Anomaly Features:** 30-day, 60-day, and 90-day rolling precipitation deficits relative to 5-year monsoon baseline.

### 3. Reservoir and Groundwater Conditions
- **Static Aquifer Metrics:** Annual extractable groundwater resource ($\text{BCM}$), total annual draft ($\text{BCM}$), and Stage of Groundwater Extraction ($\%$) [Source: CGWB 2025].
- **Regulatory Stress Categorization:** Safe ($<70\%$), Semi-Critical ($70\text{--}90\%$), Critical ($90\text{--}100\%$), Over-Exploited ($>100\%$).

### 4. Climate and Cooling
- **Ambient Dry-Bulb Temperature ($K$ / $^\circ\text{C}$):** `2m_temperature_max`, `mean`, `min` [Source: ERA5 & NASA POWER].
- **Ambient Dewpoint & Wet-Bulb Driver ($K$):** `2m_dewpoint_temperature_mean`, `RH2M` [Source: ERA5 & NASA POWER].
- **Solar Irradiance:** `surface_solar_radiation_downwards_mean` ($J/\text{m}^2$) [ERA5] and `ALLSKY_SFC_SW_DWN` ($\text{kW-hr}/\text{m}^2/\text{day}$) [NASA CERES].
- **Bio-thermal Stress Index ($K$):** `utci_max` (Universal Thermal Climate Index) [ERA5].

### 5. Data-Centre Facility Metadata
- **Static Infrastructure Features:** IT Load Capacity ($\text{MW}$), Operational Status (`operational`, `under_construction`), Water Stress Flag (`True`/`False`), Geographic Coordinates, State, District [Source: `datacenters.csv`].
- **Spatial Siting Boundaries:** Parcel polygon GeoJSON [Source: `datacenter-atlas-latest`].

### 6. Operator Energy and Water Benchmarks
- **Water Usage Effectiveness (WUE):** Reported $L/\text{kWh}$ across 35 operator disclosures (Mean: $0.377\text{ L/kWh}$, Range: $0.02\text{ to }2.85\text{ L/kWh}$) [Source: `data-center-water.csv`].
- **Facility Water Volume:** Annual consumption in million litres [Source: `data-center-water.csv`].

---

## 5. Maharashtra Electricity Demand Training Feasibility Analysis

### A. Target Variable & Unit Availability
- **Required Target:** Daily state electricity demand met ($MW$ peak demand or $MU$ daily energy).
- **Current Status in Folder:** **ABSENT**. The folder `Indian state electricity demand dataset` contains only weather features. The target time series must be obtained from MSLDC daily reports or POSOCO / Grid-India daily operational bulletins.

### B. Historical Date Coverage & Recency Gap
- **ERA5 Climate Features:** Available from **1979-01-01 through 2024-04-27** (45.3 years).
- **NASA POWER Observations:** Available from **2015-01-01 through 2024-12-31** (10 years).
- **IMD Gridded Rainfall:** Available from **2020-01-01 through 2025-12-31** (6 years).
- **Recency Gap:** Climate reanalysis features terminate in late April 2024. Late 2024, 2025, and early 2026 data are missing from the ERA5 files.

### C. Leakage Risks & Avoidance Protocols
1. **Temporal Reanalysis Leakage:** In a 6-month forward forecast ($t+1$ to $t+180$), actual future ERA5 weather reanalysis cannot be known in advance. Feeding observed future reanalysis data into a 6-month forecast model creates massive optimistic temporal leakage.  
   *Mitigation:* Use climatological 10-year day-of-year seasonal normals (or IMD seasonal outlook anomalies) as exogenous inputs during multi-month forward horizons, rather than realized reanalysis.
2. **Synthetic Data Contamination:** Mixing synthetic telemetry (`green_ai_datacenter.csv` or `ai_data_center_energy_efficiency_2026.csv`) with real Indian state grid models would corrupt feature distributions with artificial correlations.  
   *Mitigation:* Quarantined completely.
3. **Target Inversion Leakage:** Never use data-centre capacity additions ($MW$) as dynamic demand predictors unless officially commissioned on the grid.

### D. Backtesting Framework & Modeling Recommendations
Once the real Maharashtra daily demand target series is supplied:
1. **Temporal Split:**
   - **Training Set:** 2015-01-01 to 2022-12-31 (8 years).
   - **Validation Set (12-month backtest):** 2023-01-01 to 2023-12-31.
   - **Test Set (6-month stress backtest):** 2024-01-01 to 2024-06-30 (capturing the extreme summer peak heat wave in Maharashtra).
2. **Baseline Model:**
   - **Seasonal-Naive Baseline:** Predict demand at $t+h$ as the observed demand on the same calendar day from the previous year ($t+h-365$), adjusted for the 3-year historical annual CAGR:
     $$\hat{y}_{\text{seasonal-naive}}(t) = y(t - 365) \cdot (1 + \text{CAGR})$$
3. **ML Model:**
   - **LightGBM Regressor:** Multi-horizon recursive or direct quantile forecaster ($p10, p50, p90$) incorporating:
     - Calendar cyclical features: Day of week, month, day of year ($\sin/\cos$ encodings), holiday indicators.
     - Lags: $y_{t-1}, y_{t-7}, y_{t-14}, y_{t-365}$, 7-day and 30-day rolling mean/max.
     - Climate features: 2m temperature max (cooling degree days, base 24°C), dewpoint temperature (latent heat proxy), UTCI max, and solar irradiance.

---

## 6. Deliverable Artifacts Summary

The audit generated two structured reference CSVs in `docs/ml/resource_outlook/`:
1. [`dataset_inventory.csv`](file:///C:/Users/marat/EcoTerminal/docs/ml/resource_outlook/dataset_inventory.csv): Full metadata catalog of all 16 distinct dataset entries covering filenames, paths, sizes, record counts, date bounds, publishers, licenses, missing data rates, and operational statuses.
2. [`data_dictionary.csv`](file:///C:/Users/marat/EcoTerminal/docs/ml/resource_outlook/data_dictionary.csv): Comprehensive variable registry covering 23 core variables categorized into the 6 required domain groups with units, roles in ML, value bounds, null rates, and provenance citations.

---

## 7. Action Items to Unblock ML-F1 Training

To proceed to training and evaluation in ML-F2:
1. **Supply Real Maharashtra Demand Target:** Provide a daily time series of Maharashtra state electricity demand met (MW peak and MU total energy) from 2018 to 2025 (sourced from POSOCO/Grid-India Western Regional Load Despatch Centre or MSLDC).
2. **Purge Redundant Duplicate:** Remove `daily/POWER_Point_Daily_20150101_20241231_018d52N_073d86E_UTC (1).csv` from any training pipelines.
3. **Isolate Synthetic Datasets:** Keep `AI Data Center Energy Efficiency Dataset 2026` and `Hyperscale Data Center Dataset` permanently quarantined from real infrastructure models.

