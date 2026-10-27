"""Tests for lightweight document classifier."""

import unittest

from ml.classifiers.classifier import DocumentClassifier
from ml.contracts.taxonomy import DocumentSubtype, DocumentType


class TestClassifier(unittest.TestCase):
    """Test classification across categories and out-of-domain handling."""

    def setUp(self):
        self.classifier = DocumentClassifier()

    def test_classify_power_sanction(self):
        text = """SOUTHERN POWER DISTRIBUTION COMPANY OF TELANGANA LIMITED (TSSPDCL)
Sanction of HT Power Supply of 50 MW (55.5 MVA) at 220 kV level
Sanctioned Grid Load: 50.0 MW
Contracted Maximum Demand: 55.5 MVA
Interconnection Substation: Fab City 220/33kV GIS Substation"""
        res = self.classifier.classify_text(text)
        self.assertEqual(res.predicted_type, DocumentType.UTILITY_SANCTION.value)
        self.assertEqual(res.predicted_subtype, DocumentSubtype.GRID_SANCTION_LETTER.value)
        self.assertGreater(res.confidence, 0.70)
        self.assertGreater(len(res.rationale), 0)

    def test_classify_water_allocation(self):
        text = """MAHARASHTRA INDUSTRIAL DEVELOPMENT CORPORATION (MIDC)
SANCTION ORDER FOR INDUSTRIAL BULK WATER SUPPLY
Permitted Normal Water Allocation: 1800 KLD (1.80 MLD)
Peak Summer Water Cap: 2200 KLD
Mandatory Treated Wastewater Supply: 800 KLD from CETP"""
        res = self.classifier.classify_text(text)
        self.assertEqual(res.predicted_type, DocumentType.WATER_ALLOCATION.value)
        self.assertEqual(res.predicted_subtype, DocumentSubtype.MUNICIPAL_BULK_WATER_ALLOCATION.value)
        self.assertGreater(res.confidence, 0.70)

    def test_classify_power_application(self):
        text = """BANGALORE ELECTRICITY SUPPLY COMPANY LIMITED (BESCOM)
High Tension Power Supply Application Form (Form HT-1)
Proposed Contract Demand: 42.0 MVA
Estimated Peak Active Load: 35.0 MW
Nearest Substation: Devanahalli 220/66kV Substation"""
        res = self.classifier.classify_text(text)
        self.assertEqual(res.predicted_type, DocumentType.UTILITY_APPLICATION.value)
        self.assertEqual(res.predicted_subtype, DocumentSubtype.DISCOM_POWER_APPLICATION.value)

    def test_classify_groundwater_noc(self):
        text = """CENTRAL GROUND WATER AUTHORITY (CGWA)
NO OBJECTION CERTIFICATE (NOC) FOR GROUND WATER ABSTRACTION
Permitted Daily Ground Water Withdrawal: 50.0 KLD
Category of Assessment Unit: Semi-Critical
Borewell abstraction authorized"""
        res = self.classifier.classify_text(text)
        self.assertEqual(res.predicted_type, DocumentType.WATER_ALLOCATION.value)
        self.assertEqual(res.predicted_subtype, DocumentSubtype.GROUNDWATER_CGWA_NOC.value)

    def test_classify_detailed_project_report(self):
        text = """DETAILED PROJECT REPORT (DPR)
PROJECT: CHENNAI ONE HYPERSCALE GREEN DATA CENTRE CAMPUS
Campus Plot Area: 14.16 hectares
Total Permissible Built-up Area: 450,000 sq ft
Master Plan Planned IT Capacity: 60.0 MW
Target PUE: 1.30"""
        res = self.classifier.classify_text(text)
        self.assertEqual(res.predicted_type, DocumentType.DPR.value)
        self.assertEqual(res.predicted_subtype, DocumentSubtype.DETAILED_PROJECT_REPORT.value)

    def test_reject_out_of_domain_invoice(self):
        text = """GLOBAL HARDWARE SUPPLIES LLC
Invoice No: INV-2026-992384
Server racks and UPS modules purchase order
Total Taxable Value: $412,000
Payment Terms: Net 30 days via Wire Transfer"""
        res = self.classifier.classify_text(text)
        self.assertEqual(res.predicted_type, DocumentType.OTHER.value)
        self.assertEqual(res.predicted_subtype, DocumentSubtype.MISCELLANEOUS.value)
        self.assertLess(res.confidence, 0.40)

    def test_abstain_on_residential_lease_with_utility_words(self):
        text = """RESIDENTIAL APARTMENT LEASE AGREEMENT
Flat No 402, Green Acres Residency, Outer Ring Road, Bangalore.
Monthly Rent: INR 65,000. Security Deposit: INR 350,000.
Domestic water supply shall be billed as per sub-meter.
BESCOM domestic power meter account is transferred."""
        res = self.classifier.classify_text(text)
        self.assertEqual(res.predicted_type, DocumentType.OTHER.value)
        self.assertEqual(res.predicted_subtype, DocumentSubtype.MISCELLANEOUS.value)
        self.assertLessEqual(res.confidence, 0.20)
        self.assertTrue(any("Abstained" in r for r in res.rationale))

    def test_held_out_up_pvvnl_classification(self):
        text = """PASCHIMANCHAL VIDYUT VITRAN NIGAM LIMITED (PVVNL)
Memorandum No: PVVNL/COMM/EHV/2026/7710
SUBJECT: IN-PRINCIPLE SANCTION OF EXTRA HIGH VOLTAGE (EHV) POWER GRID CONNECTIVITY
Sanctioned Load: 60.0 MVA at 132 kV voltage grade
from Sector 148 Substation"""
        res = self.classifier.classify_text(text)
        self.assertEqual(res.predicted_type, DocumentType.UTILITY_SANCTION.value)
        self.assertGreaterEqual(res.confidence, 0.65)

    def test_held_out_gujarat_dholera_water_classification(self):
        text = """DHOLERA INDUSTRIAL CITY DEVELOPMENT LIMITED (DICDL)
Allotment Reference: DICDL/WATER/2026/ALLOT-449
SUBJECT: ALLOTMENT OF INDUSTRIAL RAW WATER IN DHOLERA SPECIAL INVESTMENT REGION (DSIR)
Permitted Normal Water Allocation: 2500 cum/day
Seasonal Peak Water: 3200 cum/day"""
        res = self.classifier.classify_text(text)
        self.assertEqual(res.predicted_type, DocumentType.WATER_ALLOCATION.value)
        self.assertGreaterEqual(res.confidence, 0.65)


if __name__ == "__main__":
    unittest.main()
