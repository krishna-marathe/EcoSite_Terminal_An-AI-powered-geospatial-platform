# EcoSite Resource Outlook — ML-F4 Facility Resource Stress Engine

## Overview & Goal
The **Facility Resource Stress Engine** (`ml/resource_outlook/stress_engine.py`) provides deterministic, transparent evaluation combining facility-specific resource requirements (IT capacity, PUE, WUE, sanctioned power, and water allocations) with empirical regional forecasts:
1. **Maharashtra Grid Electricity Outlook (ML-F2.1)**: Seasonal-Naive baseline with out-of-sample conformal residual calibration (81.82% empirical 80% coverage; 1,230.17 MW MAE on untouched 6-month test horizon Nov 2023–Apr 2024).
2. **Bhatsa Reservoir Storage Outlook (ML-F3.4)**: Trend-Adjusted Seasonal Baseline (10.23 MCM MAE, 1.09% of capacity on 2024-H1 fixed-origin 26-week backtest).
3. **Regional Climate Cooling Indicators**: ERA5 thermal tendencies and summer heat index extremes.

---

## Mathematical Formulations & Engineering Conversions

### 1. Facility Power Calculations
- **Total Facility Power Demand**:
  $$\text{Facility Power Demand (MW)} = \text{IT Capacity (MW)} \times \text{PUE}$$
- **Sanctioned Capacity**:
  $$\text{Firm Sanctioned MW} = \begin{cases} \text{Sanctioned MW}, & \text{if } \text{MEASURED\_ACTUAL} \lor \text{DOCUMENTED\_COMMITMENT} \\ 0.0, & \text{otherwise} \end{cases}$$
- **Contracted Power Gap**:
  $$\text{Power Gap (MW)} = \max(0.0, \text{Facility Power Demand (MW)} - \text{Firm Sanctioned MW})$$
- **Contracted Surplus**:
  $$\text{Power Surplus (MW)} = \max(0.0, \text{Firm Sanctioned MW} - \text{Facility Power Demand (MW)})$$
- **Contracted Coverage Percentage**:
  $$\text{Contracted Coverage (\%)} = \left(\frac{\text{Firm Sanctioned MW}}{\text{Facility Power Demand (MW)}}\right) \times 100\%$$
- **Renewable Energy & Fossil Balance**:
  $$\text{Renewable Power (MW)} = \text{Facility Power Demand (MW)} \times \left(\frac{\text{Renewable PPA \%}}{100.0}\right)$$
  $$\text{Grid Fossil Balance (MW)} = \max(0.0, \text{Facility Power Demand (MW)} - \text{Renewable Power (MW)})$$

### 2. Facility Water Calculations
- **Daily Water Demand ($m^3/\text{day}$ or kL/day)**:
  $$\text{Daily Water Demand (kL/day)} = \text{IT Capacity (MW)} \times 1000 \times \text{WUE (L/kWh)} \times \frac{24\text{ hours}}{1000\text{ L/kL}} = \text{IT Capacity (MW)} \times 24 \times \text{WUE}$$
- **Annual Water Demand (MCM/year)**:
  $$\text{Annual Water Demand (MCM/year)} = \frac{\text{Daily Water Demand (kL/day)} \times 365}{1,000,000}$$
- **Documented Water Allocation Gap**:
  $$\text{Water Gap (kL/day)} = \max(0.0, \text{Daily Water Demand (kL/day)} - \text{Allocated Water (kL/day)})$$
  $$\text{Water Gap (MCM/year)} = \frac{\text{Water Gap (kL/day)} \times 365}{1,000,000}$$

### 3. Regional Contextual Benchmarking
- **Facility Grid Peak Share**:
  $$\text{Grid Peak Share (\%)} = \left(\frac{\text{Facility Power Demand (MW)}}{\text{Regional Peak Demand Met (30,675 MW)}}\right) \times 100\%$$
- **Facility Bhatsa Reservoir Share (MMR Sites Only)**:
  $$\text{Capacity Share (\%)} = \left(\frac{\text{Annual Water Demand (MCM)}}{\text{Bhatsa Gross Capacity (942.1 MCM)}}\right) \times 100\%$$
  $$\text{Summer Minimum Storage Share (\%)} = \left(\frac{\text{Annual Water Demand (MCM)}}{\text{Late June Minimum Storage (~197.0 MCM)}}\right) \times 100\%$$

---

## Strict Epistemic & Geographic Rules

1. **Zero Fabrication of Missing Metrics**:
   - If an operator fails to publish or provide a WUE figure (as with CtrlS in published ESG records), the engine assigns `status = "UNKNOWN"` with `value = None`. It strictly refuses to invent or substitute an assumed default value.
2. **Synthetic / Simulated Evidence Tagging**:
   - Any parameter with `is_synthetic = True` is categorized as `SIMULATED`. It cannot achieve `SUPPORTED_BY_EVIDENCE` status and always requires attention.
3. **Operator Assumptions vs Verifiable Commitments**:
   - Self-declared operator assertions without a formal utility sanction letter (MSEDCL/BEST/Tata Power) or water allocation agreement (MIDC/MCGM/CIDCO) are tagged `OPERATOR_ASSUMPTION` and trigger `ATTENTION_REQUIRED`.
4. **Hydrological Service-Area Gate**:
   - Bhatsa Lake is the drinking water source for Thane and the Mumbai Metropolitan Region (MMR).
   - If a facility is located in Pune, Solapur, Chhatrapati Sambhajinagar, or Nagpur, the engine detects a `SERVICE_AREA_MISMATCH` and marks the reservoir outlook as `SOURCE_UNAVAILABLE`. Bhatsa storage drawdown is never falsely attributed to facilities outside its basin.
5. **No Unsupported Causality or Approval Claims**:
   - High statewide electricity peak load reflects macro grid dispatch conditions; it does not indicate the data centre causes grid overload or blackouts.
   - Reservoir drawdown reflects natural seasonal monsoon cycles and municipal drinking supply prioritization for 21 million MMR residents; it does not indicate the data centre causes community water scarcity.
   - EcoSite India does not grant legal approvals, environmental clearances, or verify spare utility interconnection capacity.

---

## Status Rollup Architecture

| Status | Deterministic Conditions |
|---|---|
| `UNKNOWN` | Critical facility parameters (`it_capacity_mw`, `pue`) are unprovided, invalid, or marked `UNKNOWN`. |
| `SOURCE_UNAVAILABLE` | Regional forecast or localized watershed data is fundamentally unavailable. Sub-status for mismatched basins. |
| `ATTENTION_REQUIRED` | Uncontracted power gap (`power_gap_mw > 0`), water gap (`water_gap_kld > 0`), operator assumptions, synthetic data, unprovided WUE, or service-area mismatch. |
| `SUPPORTED_BY_EVIDENCE` | Power and water requirements are $\le$ verifiable documented commitments (`power_gap == 0`, `water_gap == 0`), no synthetic data, no unverified assumptions, and valid geographic matching. |

---

## Verification Test Matrix (`test_stress_engine.py`)

1. `test_engineering_units_and_calculations`: Verifies exact MW, kL/day, MCM/year, gap, surplus, and renewable PPA arithmetic.
2. `test_missing_commitments_handling`: Asserts full demand becomes gap on missing commitments, and verifies refusal to fabricate missing WUE.
3. `test_synthetic_versus_actual_evidence`: Asserts synthetic data and operator assumptions cannot yield `SUPPORTED_BY_EVIDENCE`.
4. `test_reservoir_service_area_mismatch`: Asserts Pune/Solapur facilities trigger `SOURCE_UNAVAILABLE_BASIN_MISMATCH` while Thane/Navi Mumbai facilities match Bhatsa.
5. `test_unavailable_forecast_data_fallback`: Verifies graceful metadata fallback when forecast files or directories are missing.
6. `test_no_unsupported_shortage_or_approval_claims`: Asserts complete absence of forbidden causality strings across findings, caveats, and recommendations.

