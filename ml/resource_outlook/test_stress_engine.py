"""
EcoSite Resource Outlook — Unit and Integration Tests for Facility Resource Stress Engine (ML-F4.1)

Verifies:
1. Engineering units and calculations (Power MW, Water kL/day, MCM/year, matched dry-season drawdown).
2. Backend verification trust levels (distinguishing verified vs documented vs unverified).
3. Renewable matching semantics (annual volumetric PPA matching vs residual grid requirement; no fossil assumptions).
4. Matched reservoir comparison periods (dry-season demand vs dry-season drawdown; storage context vs supply).
5. Versioned forecast outputs, historical backtest labeling, and CURRENT FORECAST UNAVAILABLE flags.
6. Geographic service-area validation and reservoir mismatch detection (e.g. Pune vs Bhatsa).
7. Graceful fallback when forecast files are missing.
8. Absolute absence of unsupported shortage, grid collapse, or regulatory approval claims.
"""

from pathlib import Path
import tempfile
import unittest

from ml.resource_outlook.stress_engine import (
    EvidenceType,
    FacilityPowerFindings,
    FacilityResourceRequest,
    FacilityWaterFindings,
    RegionalElectricityOutlookFindings,
    RegionalReservoirOutlookFindings,
    ResourceOutlook,
    ResourceParameter,
    ResourceStatus,
    ResourceStressEngine,
)


class TestResourceStressEngine(unittest.TestCase):
    def setUp(self):
        self.engine = ResourceStressEngine()

    def test_engineering_units_and_calculations(self):
        """
        Verify mathematical correctness and unit conversions:
        - Power Demand = IT MW * PUE
        - Daily Water = IT MW * 24 * WUE (kL/day or m^3/day)
        - Dry Season Water = Daily kL * 182 / 1e6 (MCM)
        - Annual Water = Daily kL * 365 / 1e6 (MCM/year)
        - Power & Water gaps and surplus
        - Residual Grid Requirement = max(0, Demand - PPA Matched)
        """
        req = FacilityResourceRequest(
            facility_id="fac-unit-test",
            facility_name="Navi Mumbai Test DC",
            location_district="Navi Mumbai",
            it_capacity_mw=ResourceParameter(value=10.0, unit="MW", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            pue=ResourceParameter(value=1.40, unit="ratio", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            wue=ResourceParameter(value=1.50, unit="L/kWh", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            sanctioned_grid_mw=ResourceParameter(value=12.0, unit="MW", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            water_allocation_kld=ResourceParameter(value=250.0, unit="kL/day", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            renewable_ppa_pct=ResourceParameter(value=50.0, unit="%", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
        )

        outlook = self.engine.evaluate_facility(req)

        # 1. Power conversions
        # Demand: 10.0 * 1.40 = 14.0 MW
        self.assertEqual(outlook.power_findings.facility_power_demand_mw, 14.0)
        self.assertEqual(outlook.power_findings.sanctioned_power_mw, 12.0)
        self.assertEqual(outlook.power_findings.documented_power_mw, 12.0)
        self.assertEqual(outlook.power_findings.verified_power_mw, 0.0)  # Documented is not independently verified
        # Gap: max(0, 14.0 - 12.0) = 2.0 MW
        self.assertEqual(outlook.power_findings.power_gap_mw, 2.0)
        self.assertEqual(outlook.power_findings.power_surplus_mw, 0.0)
        # Contracted coverage: (12.0 / 14.0) * 100 = 85.7%
        self.assertEqual(outlook.power_findings.contracted_coverage_pct, 85.7)
        # Renewable PPA & Residual Grid Requirement: 14.0 * 0.50 = 7.0 MW
        self.assertEqual(outlook.power_findings.annual_ppa_matched_mw, 7.0)
        self.assertEqual(outlook.power_findings.residual_grid_requirement_mw, 7.0)

        # 2. Water conversions
        # Daily: 10.0 MW * 24 h * 1.50 L/kWh = 360.0 kL/day (m^3/day)
        self.assertEqual(outlook.water_findings.daily_water_demand_kld, 360.0)
        # Dry season 182-day demand: 360.0 * 182 / 1e6 = 0.06552 MCM
        self.assertEqual(outlook.water_findings.dry_season_water_demand_mcm, 0.06552)
        # Annual: 360.0 * 365 / 1,000,000 = 0.13140 MCM/year
        self.assertEqual(outlook.water_findings.annual_water_demand_mcm, 0.1314)
        # Allocated: 250.0 kL/day -> 250.0 * 365 / 1e6 = 0.09125 MCM/year
        self.assertEqual(outlook.water_findings.allocated_water_kld, 250.0)
        self.assertEqual(outlook.water_findings.allocated_water_mcm, 0.09125)
        # Water Gap: 360.0 - 250.0 = 110.0 kL/day
        self.assertEqual(outlook.water_findings.water_gap_kld, 110.0)
        # Water Gap in MCM: 110.0 * 365 / 1e6 = 0.04015 MCM/year
        self.assertEqual(outlook.water_findings.water_gap_mcm, 0.04015)
        self.assertEqual(outlook.water_findings.water_surplus_kld, 0.0)

        # 3. Overall status due to gaps must be ATTENTION_REQUIRED
        self.assertEqual(outlook.overall_status, ResourceStatus.ATTENTION_REQUIRED)

    def test_verification_semantics_and_trust_levels(self):
        """
        Verify that documented-but-unverified utility sanctions are NOT counted
        as independently verified firm capacity, matching backend readiness semantics.
        """
        # Case 1: Documented commitment
        req_doc = FacilityResourceRequest(
            facility_id="fac-doc",
            facility_name="Documented DC",
            location_district="Thane",
            it_capacity_mw=ResourceParameter(value=10.0, unit="MW", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            pue=ResourceParameter(value=1.30, unit="ratio", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            sanctioned_grid_mw=ResourceParameter(value=15.0, unit="MW", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
        )
        outlook_doc = self.engine.evaluate_facility(req_doc)
        self.assertEqual(outlook_doc.power_findings.documented_power_mw, 15.0)
        self.assertEqual(outlook_doc.power_findings.verified_power_mw, 0.0)  # Must be 0.0
        self.assertTrue(any("NOT independently verified" in f for f in outlook_doc.power_findings.findings))

        # Case 2: Measured actual
        req_act = FacilityResourceRequest(
            facility_id="fac-act",
            facility_name="Metered Operational DC",
            location_district="Thane",
            it_capacity_mw=ResourceParameter(value=10.0, unit="MW", evidence_type=EvidenceType.MEASURED_ACTUAL),
            pue=ResourceParameter(value=1.30, unit="ratio", evidence_type=EvidenceType.MEASURED_ACTUAL),
            sanctioned_grid_mw=ResourceParameter(value=15.0, unit="MW", evidence_type=EvidenceType.MEASURED_ACTUAL),
        )
        outlook_act = self.engine.evaluate_facility(req_act)
        self.assertEqual(outlook_act.power_findings.verified_power_mw, 15.0)
        self.assertEqual(outlook_act.power_findings.documented_power_mw, 15.0)

        # Case 3: Operator assumption
        req_assump = FacilityResourceRequest(
            facility_id="fac-assump",
            facility_name="Self-Declared DC",
            location_district="Thane",
            it_capacity_mw=ResourceParameter(value=10.0, unit="MW", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            pue=ResourceParameter(value=1.30, unit="ratio", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            sanctioned_grid_mw=ResourceParameter(value=15.0, unit="MW", evidence_type=EvidenceType.OPERATOR_ASSUMPTION),
        )
        outlook_assump = self.engine.evaluate_facility(req_assump)
        self.assertEqual(outlook_assump.power_findings.unverified_power_mw, 15.0)
        self.assertEqual(outlook_assump.power_findings.qualifying_firm_capacity_mw, 0.0)
        self.assertEqual(outlook_assump.power_findings.power_gap_mw, 13.0)  # Entire demand is gap

    def test_renewable_matching_semantics(self):
        """
        Verify:
        - Renaming to Residual Grid Requirement
        - No inference of grid fossil percentage without empirical generation-mix data
        - Explicit separation of annual volumetric matching from 24/7 firm clean power
        """
        req = FacilityResourceRequest(
            facility_id="fac-re",
            facility_name="Green Matching DC",
            location_district="Thane",
            it_capacity_mw=ResourceParameter(value=20.0, unit="MW", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            pue=ResourceParameter(value=1.25, unit="ratio", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            renewable_ppa_pct=ResourceParameter(value=80.0, unit="%", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            sanctioned_grid_mw=ResourceParameter(value=25.0, unit="MW", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
        )
        outlook = self.engine.evaluate_facility(req)
        pf = outlook.power_findings

        # Demand = 25.0 MW, 80% PPA = 20.0 MW, Residual = 5.0 MW
        self.assertEqual(pf.facility_power_demand_mw, 25.0)
        self.assertEqual(pf.annual_ppa_matching_pct, 80.0)
        self.assertEqual(pf.annual_ppa_matched_mw, 20.0)
        self.assertEqual(pf.residual_grid_requirement_mw, 5.0)

        # Check absence of fossil inference
        self.assertTrue(any("does not estimate the grid fossil/clean percentage" in f for f in pf.findings))
        self.assertTrue(any("annual volumetric matching" in f for f in pf.findings))

    def test_matched_reservoir_periods_and_supply_distinction(self):
        """
        Verify:
        - Removal of misleading annual demand vs instantaneous storage ratio
        - Comparison of 26-week dry-season demand vs 26-week storage drawdown
        - Comparison of daily requirement vs daily municipal throughput
        - Clear distinction between regional storage context and allocated piped supply
        """
        req = FacilityResourceRequest(
            facility_id="fac-bhatsa-matched",
            facility_name="Airoli Colocation",
            location_district="Thane",
            it_capacity_mw=ResourceParameter(value=10.0, unit="MW", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            pue=ResourceParameter(value=1.35, unit="ratio", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            wue=ResourceParameter(value=1.2, unit="L/kWh", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            sanctioned_grid_mw=ResourceParameter(value=15.0, unit="MW", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            water_allocation_kld=ResourceParameter(value=300.0, unit="kL/day", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
        )
        outlook = self.engine.evaluate_facility(req)
        rf = outlook.regional_reservoir

        self.assertTrue(rf.service_area_match)
        # Daily water = 10 * 24 * 1.2 = 288.0 kL/day
        # Dry season water = 288 * 182 / 1e6 = 0.05242 MCM
        # Drawdown = 508.0 MCM -> Share = 0.05242 / 508.0 * 100 = 0.0103%
        self.assertIsNotNone(rf.facility_share_of_dry_season_drawdown_pct)
        self.assertAlmostEqual(rf.facility_share_of_dry_season_drawdown_pct, 0.0103, places=3)

        # Municipal throughput = 2,400,000 kL/day -> Share = 288 / 2,400,000 * 100 = 0.0120%
        self.assertIsNotNone(rf.facility_share_of_daily_municipal_throughput_pct)
        self.assertAlmostEqual(rf.facility_share_of_daily_municipal_throughput_pct, 0.0120, places=3)

        # Context vs supply distinction must be explicitly noted
        self.assertTrue(any("Storage context vs supply distinction" in f for f in rf.findings))

    def test_historical_backtest_labeling_and_metadata(self):
        """
        Verify:
        - Prominent HISTORICAL BACKTEST classification
        - CURRENT FORECAST UNAVAILABLE flag
        - Inclusion of version, data cutoff, forecast origin, and uncertainty method
        """
        req = FacilityResourceRequest(
            facility_id="fac-labels",
            facility_name="Labels Check DC",
            location_district="Thane",
            it_capacity_mw=ResourceParameter(value=5.0, unit="MW", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            pue=ResourceParameter(value=1.30, unit="ratio", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
        )
        outlook = self.engine.evaluate_facility(req)

        self.assertEqual(outlook.forecast_classification, "HISTORICAL_BACKTEST")
        self.assertEqual(outlook.live_status_label, "CURRENT_FORECAST_UNAVAILABLE")

        # Electricity metadata
        ef = outlook.regional_electricity
        self.assertEqual(ef.forecast_classification, "HISTORICAL_BACKTEST")
        self.assertFalse(ef.is_live_2026_forecast)
        self.assertEqual(ef.live_status_label, "CURRENT_FORECAST_UNAVAILABLE")
        self.assertEqual(ef.data_cutoff_date, "2023-10-31")
        self.assertEqual(ef.forecast_origin, "2023-10-31")
        self.assertIn("conformal", ef.uncertainty_method.lower())

        # Reservoir metadata
        rf = outlook.regional_reservoir
        self.assertEqual(rf.forecast_classification, "HISTORICAL_BACKTEST")
        self.assertFalse(rf.is_live_2026_forecast)
        self.assertEqual(rf.live_status_label, "CURRENT_FORECAST_UNAVAILABLE")
        self.assertEqual(rf.data_cutoff_date, "2024-01-04")
        self.assertEqual(rf.forecast_origin, "2024-01-04")
        self.assertIn("residual quantiles", rf.uncertainty_method.lower())

    def test_reservoir_service_area_mismatch(self):
        """
        Verify geographic service area gate:
        - A facility in Pune or Solapur must NOT be evaluated against Bhatsa (Thane/MMR).
        - Service area mismatch must be flagged with status SOURCE_UNAVAILABLE.
        """
        req_pune = FacilityResourceRequest(
            facility_id="fac-pune",
            facility_name="Hinjawadi Phase 2 Facility",
            location_district="Pune",
            it_capacity_mw=ResourceParameter(value=10.0, unit="MW", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            pue=ResourceParameter(value=1.35, unit="ratio", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            wue=ResourceParameter(value=1.2, unit="L/kWh", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            sanctioned_grid_mw=ResourceParameter(value=15.0, unit="MW", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            water_allocation_kld=ResourceParameter(value=300.0, unit="kL/day", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
        )

        outlook_pune = self.engine.evaluate_facility(req_pune)
        self.assertFalse(outlook_pune.regional_reservoir.service_area_match)
        self.assertEqual(outlook_pune.regional_reservoir.status, ResourceStatus.SOURCE_UNAVAILABLE)
        self.assertEqual(outlook_pune.regional_reservoir.storage_drawdown_risk, "SOURCE_UNAVAILABLE_BASIN_MISMATCH")
        self.assertTrue(any("SERVICE AREA MISMATCH" in f for f in outlook_pune.regional_reservoir.findings))

    def test_unavailable_forecast_data_fallback(self):
        """
        Verify that engine handles empty/missing directories cleanly with fallback defaults.
        """
        with tempfile.TemporaryDirectory() as tmp_dir:
            fallback_engine = ResourceStressEngine(base_dir=Path(tmp_dir))
            self.assertEqual(fallback_engine.elec_model_name, "SEASONAL_NAIVE_WITH_CALIBRATED_INTERVALS")
            self.assertEqual(fallback_engine.water_model_name, "Candidate 2: Trend-Adjusted Seasonal Baseline")

            req = FacilityResourceRequest(
                facility_id="fac-temp",
                facility_name="Fallback Check DC",
                location_district="Thane",
                it_capacity_mw=ResourceParameter(value=5.0, unit="MW", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
                pue=ResourceParameter(value=1.3, unit="ratio", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            )
            outlook = fallback_engine.evaluate_facility(req)
            self.assertIsNotNone(outlook)
            self.assertEqual(outlook.power_findings.facility_power_demand_mw, 6.5)

    def test_no_unsupported_shortage_or_approval_claims(self):
        """
        Verify epistemic integrity:
        - NEVER claim a data centre causes a blackout, grid collapse, or community water scarcity.
        - NEVER grant approvals or assert legal compliance.
        """
        req = FacilityResourceRequest(
            facility_id="fac-epistemic",
            facility_name="Large Hyperscale Campus",
            location_district="Thane",
            it_capacity_mw=ResourceParameter(value=100.0, unit="MW", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            pue=ResourceParameter(value=1.5, unit="ratio", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            wue=ResourceParameter(value=2.0, unit="L/kWh", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            sanctioned_grid_mw=ResourceParameter(value=50.0, unit="MW", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
            water_allocation_kld=ResourceParameter(value=500.0, unit="kL/day", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT),
        )

        outlook = self.engine.evaluate_facility(req)
        full_json_str = outlook.to_json().lower()

        forbidden_phrases = [
            "causes blackout",
            "causes grid collapse",
            "causes grid overload",
            "causes community water scarcity",
            "causes water crisis",
            "causes local scarcity",
            "approved for compliance",
            "approved by ecosite",
            "grants approval",
        ]

        for phrase in forbidden_phrases:
            self.assertNotIn(phrase, full_json_str, f"Forbidden phrase '{phrase}' found in output text.")

        self.assertTrue(any("does not grant approvals" in d for d in outlook.epistemic_disclaimers))
        self.assertTrue(any("aggregate grid loading" in d for d in outlook.epistemic_disclaimers))
        self.assertTrue(any("not data centre causation alone" in d for d in outlook.epistemic_disclaimers))


if __name__ == "__main__":
    unittest.main()
