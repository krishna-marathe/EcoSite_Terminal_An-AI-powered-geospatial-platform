"""Tests for ML contracts, taxonomy, and ExtractionCandidate schema."""

import json
import unittest

from ml.contracts.schemas import (
    ExtractionCandidate,
    ExtractionMethod,
    PhaseScope,
    ReviewStatus,
)
from ml.contracts.taxonomy import (
    DocumentSubtype,
    DocumentType,
    FieldKey,
    FIELD_CANONICAL_UNITS,
    SUBTYPE_TO_DOCUMENT_TYPE,
)


class TestMLContracts(unittest.TestCase):
    """Validate contracts against API_CONTRACTS.md Section 4."""

    def test_extraction_candidate_schema_matches_contract(self):
        candidate = ExtractionCandidate(
            document_id="550e8400-e29b-41d4-a716-446655440000",
            document_type="UTILITY_SANCTION",
            page_number=2,
            field_key="sanctioned_grid_mw",
            raw_text="Sanctioned load: 40 MW",
            normalized_value=40.0,
            unit="MW",
            phase_scope="PHASE_1",
            method="RULE_BASED",
            model_version=None,
            confidence=0.92,
            review_status="PENDING",
        )
        d = candidate.to_dict()

        # Check required fields from API_CONTRACTS.md
        self.assertEqual(d["document_id"], "550e8400-e29b-41d4-a716-446655440000")
        self.assertEqual(d["document_type"], "UTILITY_SANCTION")
        self.assertEqual(d["page_number"], 2)
        self.assertEqual(d["field_key"], "sanctioned_grid_mw")
        self.assertEqual(d["raw_text"], "Sanctioned load: 40 MW")
        self.assertEqual(d["normalized_value"], 40.0)
        self.assertEqual(d["unit"], "MW")
        self.assertEqual(d["phase_scope"], "PHASE_1")
        self.assertEqual(d["method"], "RULE_BASED")
        self.assertIsNone(d["model_version"])
        self.assertEqual(d["confidence"], 0.92)
        self.assertEqual(d["review_status"], "PENDING")

        # Must be JSON serializable
        json_str = json.dumps(d)
        self.assertIn('"field_key": "sanctioned_grid_mw"', json_str)

    def test_review_status_defaults_to_pending(self):
        """Rule: ML extraction never grants verified status."""
        candidate = ExtractionCandidate(
            document_id="doc-123",
            document_type="UTILITY_SANCTION",
            page_number=1,
            field_key="sanctioned_grid_mw",
            raw_text="40 MW",
            normalized_value=40.0,
        )
        self.assertEqual(candidate.review_status, ReviewStatus.PENDING.value)
        self.assertNotEqual(candidate.review_status, "GOVERNMENT_VERIFIED")

    def test_roundtrip_dict_serialization(self):
        orig = ExtractionCandidate(
            document_id="doc-999",
            document_type="WATER_ALLOCATION",
            page_number=1,
            field_key="water_allocation_kld",
            raw_text="Allocation: 1500 KLD",
            normalized_value=1500.0,
            unit="KLD",
            phase_scope=PhaseScope.CAMPUS_WIDE.value,
        )
        d = orig.to_dict()
        reconstructed = ExtractionCandidate.from_dict(d)
        self.assertEqual(orig.document_id, reconstructed.document_id)
        self.assertEqual(orig.field_key, reconstructed.field_key)
        self.assertEqual(orig.normalized_value, reconstructed.normalized_value)
        self.assertEqual(orig.unit, reconstructed.unit)

    def test_document_taxonomy_types(self):
        expected_types = {
            "DPR", "UTILITY_APPLICATION", "UTILITY_SANCTION",
            "WATER_ALLOCATION", "WATER_STUDY", "PLANNING", "OTHER"
        }
        enum_types = {t.value for t in DocumentType}
        self.assertEqual(expected_types, enum_types)

    def test_subtypes_map_to_valid_types(self):
        for subtype, doc_type in SUBTYPE_TO_DOCUMENT_TYPE.items():
            self.assertIsInstance(subtype, DocumentSubtype)
            self.assertIsInstance(doc_type, DocumentType)


if __name__ == "__main__":
    unittest.main()
