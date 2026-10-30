"""Tests for candidate field extraction and unit normalizers."""

import unittest

from ml.contracts.schemas import ParsedDocument, ParsedPage
from ml.contracts.taxonomy import FieldKey
from ml.extractors.extractor import CandidateExtractor, detect_phase_scope
from ml.extractors.normalizers import (
    normalize_area_hectares,
    normalize_date_string,
    normalize_power_mva,
    normalize_power_mw,
    normalize_voltage_kv,
    normalize_water_kld,
)


class TestExtractors(unittest.TestCase):
    """Test candidate field extraction and normalizers."""

    def setUp(self):
        self.extractor = CandidateExtractor()

    def test_unit_normalizers(self):
        # Power MW
        self.assertEqual(normalize_power_mw(50.0, "MW"), 50.0)
        self.assertEqual(normalize_power_mw(50000.0, "kW"), 50.0)

        # Power MVA
        self.assertEqual(normalize_power_mva(55.5, "MVA"), 55.5)
        self.assertEqual(normalize_power_mva(55500.0, "kVA"), 55.5)

        # Voltage
        self.assertEqual(normalize_voltage_kv(220.0, "kV"), 220.0)
        self.assertEqual(normalize_voltage_kv(220000.0, "V"), 220.0)

        # Water KLD
        self.assertEqual(normalize_water_kld(1800.0, "KLD"), 1800.0)
        self.assertEqual(normalize_water_kld(1.80, "MLD"), 1800.0)
        self.assertEqual(normalize_water_kld(1800.0, "m3/day"), 1800.0)

        # Area
        self.assertAlmostEqual(normalize_area_hectares(14.16, "hectares"), 14.16)
        self.assertAlmostEqual(normalize_area_hectares(35.0, "acres"), 14.16, delta=0.01)

        # Dates
        self.assertEqual(normalize_date_string("15-03-2026"), "2026-03-15")
        self.assertEqual(normalize_date_string("15/03/2026"), "2026-03-15")
        self.assertEqual(normalize_date_string("2026-03-15"), "2026-03-15")
        self.assertEqual(normalize_date_string("March 15, 2026"), "2026-03-15")

    def test_detect_phase_scope(self):
        self.assertEqual(detect_phase_scope("Supply for Phase 1 Commercial Operations"), "PHASE_1")
        self.assertEqual(detect_phase_scope("Requirements for Phase 2 expansion"), "PHASE_2")
        self.assertEqual(detect_phase_scope("Full Campus cumulative water supply"), "CAMPUS_WIDE")

    def test_extract_power_sanction_fields(self):
        raw_text = """TSSPDCL Sanction Letter
Ref: TSSPDCL/CGM/COM/HT/2026/D-8841 Date: 15-03-2026
Sanctioned Grid Load: 50.0 MW
Contracted Maximum Demand: 55.5 MVA
Supply Voltage: 220 kV
Interconnection Substation: Fab City 220/33kV GIS Substation
Valid until: 14-03-2028"""
        doc = ParsedDocument(
            document_id="doc-test-pwr",
            filename="tsspdcl.txt",
            file_format="TXT",
            page_count=1,
            pages=[ParsedPage(page_number=1, text=raw_text)],
        )
        candidates = self.extractor.extract_candidates(doc, document_type="UTILITY_SANCTION")
        fields_found = {c.field_key: c.normalized_value for c in candidates}

        self.assertEqual(fields_found.get(FieldKey.SANCTIONED_GRID_MW.value), 50.0)
        self.assertEqual(fields_found.get(FieldKey.CONTRACT_DEMAND_MVA.value), 55.5)
        self.assertEqual(fields_found.get(FieldKey.SUPPLY_VOLTAGE_KV.value), 220.0)
        self.assertIn("Fab City", fields_found.get(FieldKey.SUBSTATION_NAME.value, ""))
        self.assertEqual(fields_found.get(FieldKey.SANCTION_DATE.value), "2026-03-15")
        self.assertEqual(fields_found.get(FieldKey.VALIDITY_EXPIRY_DATE.value), "2028-03-14")

    def test_extract_water_allocation_fields(self):
        raw_text = """MIDC Sanction Order
Order No: MIDC/EE/WATER/TALOJA/2026/W-104 Date: 20-01-2026
Permitted Normal Water Allocation: 1800 KLD
Peak Summer Water Cap: 2200 KLD
Mandatory Treated Wastewater Supply: 800 KLD
Valid until: 19-01-2031"""
        doc = ParsedDocument(
            document_id="doc-test-wtr",
            filename="midc.txt",
            file_format="TXT",
            page_count=1,
            pages=[ParsedPage(page_number=1, text=raw_text)],
        )
        candidates = self.extractor.extract_candidates(doc, document_type="WATER_ALLOCATION")
        fields_found = {c.field_key: c.normalized_value for c in candidates}

        self.assertEqual(fields_found.get(FieldKey.WATER_ALLOCATION_KLD.value), 1800.0)
        self.assertEqual(fields_found.get(FieldKey.PEAK_SUMMER_WATER_KLD.value), 2200.0)
        self.assertEqual(fields_found.get(FieldKey.TREATED_WASTEWATER_KLD.value), 800.0)
        self.assertEqual(fields_found.get(FieldKey.SANCTION_DATE.value), "2026-01-20")

    def test_page_number_attribution(self):
        """Page number must be 1-indexed and match the page containing the fact."""
        page1 = ParsedPage(page_number=1, text="Campus Plot Area: 14.16 hectares\nTotal Permissible Built-up Area: 450,000 sq ft")
        page2 = ParsedPage(page_number=2, text="Phase 1 Power Sanction: 40.0 MW grid sanction")
        page3 = ParsedPage(page_number=3, text="Peak Summer Water Demand: 1500 KLD")

        doc = ParsedDocument(
            document_id="doc-test-multi",
            filename="dpr.txt",
            file_format="TXT",
            page_count=3,
            pages=[page1, page2, page3],
        )
        candidates = self.extractor.extract_candidates(doc, document_type="DPR")

        cand_pages = {c.field_key: c.page_number for c in candidates}
        self.assertEqual(cand_pages.get(FieldKey.SITE_AREA_HECTARES.value), 1)
        self.assertEqual(cand_pages.get(FieldKey.SANCTIONED_GRID_MW.value), 2)
        self.assertEqual(cand_pages.get(FieldKey.PEAK_SUMMER_WATER_KLD.value), 3)


if __name__ == "__main__":
    unittest.main()
