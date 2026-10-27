"""Tests for DocumentIntelligenceService and release inference entry points."""

import json
from pathlib import Path
import tempfile
import unittest

from ml.contracts.schemas import ReviewStatus
from ml.service import (
    DocumentIntelligenceService,
    extract_candidates_from_bytes,
    extract_candidates_from_file,
)


class TestInferenceService(unittest.TestCase):
    """Test inference entry point on valid, unsupported, malformed, and empty inputs."""

    def setUp(self):
        self.service = DocumentIntelligenceService()
        self.fixtures_dir = Path(__file__).resolve().parent.parent / "data" / "synthetic" / "fixtures"

    def test_valid_pdf_file_inference(self):
        pdf_path = self.fixtures_dir / "TSSPDCL_Grid_Sanction_FabCity_Phase1.pdf"
        res = self.service.process_file(pdf_path)

        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["file_format"], "PDF")
        self.assertGreaterEqual(res["page_count"], 1)
        self.assertEqual(res["classification"]["predicted_type"], "UTILITY_SANCTION")
        self.assertGreater(res["candidate_count"], 0)

        # Invariant check: every candidate must match API_CONTRACTS.md schema
        for cand in res["extraction_candidates"]:
            self.assertIn("document_id", cand)
            self.assertIn("document_type", cand)
            self.assertIn("page_number", cand)
            self.assertGreaterEqual(cand["page_number"], 1)
            self.assertIn("field_key", cand)
            self.assertIn("raw_text", cand)
            self.assertIn("normalized_value", cand)
            self.assertIn("unit", cand)
            self.assertIn("phase_scope", cand)
            self.assertIn("method", cand)
            self.assertIn("model_version", cand)
            self.assertIn("confidence", cand)
            self.assertEqual(cand["review_status"], ReviewStatus.PENDING.value)

        # Must be valid JSON
        json_output = json.dumps(res)
        self.assertIn('"field_key": "sanctioned_grid_mw"', json_output)

    def test_valid_docx_file_inference(self):
        docx_path = self.fixtures_dir / "MIDC_Water_Allocation_Taloja_Campus.docx"
        res = self.service.process_file(docx_path)

        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["file_format"], "DOCX")
        self.assertEqual(res["classification"]["predicted_type"], "WATER_ALLOCATION")
        self.assertGreater(res["candidate_count"], 0)

        fields = {c["field_key"]: c["normalized_value"] for c in res["extraction_candidates"]}
        self.assertEqual(fields.get("water_allocation_kld"), 1800.0)

    def test_valid_txt_file_inference(self):
        txt_path = self.fixtures_dir / "BESCOM_HT_Power_Application_Devanahalli.txt"
        res = self.service.process_file(txt_path)

        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["file_format"], "TXT")
        self.assertGreater(res["candidate_count"], 0)

    def test_unsupported_format_rejection(self):
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf:
            tf.write(b"\x89PNG\r\n\x1a\nfake-png-payload")
            tf_path = Path(tf.name)

        try:
            res = self.service.process_file(tf_path)
            self.assertEqual(res["status"], "ERROR")
            self.assertEqual(res["error_code"], "UNSUPPORTED_FORMAT")
            self.assertEqual(res["candidate_count"], 0)
        finally:
            tf_path.unlink()

    def test_malformed_corrupt_pdf(self):
        corrupt_data = b"%PDF-1.4\ncorrupted-random-binary-stream-without-objects\x00\xff"
        res = self.service.process_bytes(corrupt_data, filename="broken.pdf")
        self.assertIn(res["status"], ["SUCCESS", "DEGRADED"])
        self.assertEqual(res["candidate_count"], 0)

    def test_malformed_corrupt_docx(self):
        corrupt_data = b"PK\x03\x04\x00\x00broken-zip-file-payload"
        res = self.service.process_bytes(corrupt_data, filename="broken.docx")
        self.assertIn(res["status"], ["SUCCESS", "DEGRADED"])
        self.assertTrue(any("corrupted" in w.lower() for w in res["warnings"]))

    def test_empty_input_bytes(self):
        res = self.service.process_bytes(b"", filename="empty.pdf")
        self.assertEqual(res["status"], "EMPTY_DOCUMENT")
        self.assertEqual(res["candidate_count"], 0)
        self.assertEqual(res["page_count"], 0)

    def test_missing_file_path(self):
        res = self.service.process_file("non_existent_file_xyz_123.pdf")
        self.assertEqual(res["status"], "ERROR")
        self.assertEqual(res["error_code"], "FILE_NOT_FOUND")

    def test_top_level_functional_entry_points(self):
        txt_path = self.fixtures_dir / "TSSPDCL_Grid_Sanction_FabCity_Phase1.txt"
        res1 = extract_candidates_from_file(txt_path)
        self.assertEqual(res1["status"], "SUCCESS")

        data = txt_path.read_bytes()
        res2 = extract_candidates_from_bytes(data, filename="tsspdcl.txt")
        self.assertEqual(res2["status"], "SUCCESS")


if __name__ == "__main__":
    unittest.main()
