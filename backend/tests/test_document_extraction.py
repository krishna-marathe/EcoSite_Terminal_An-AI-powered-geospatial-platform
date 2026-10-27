"""Tests for document upload, storage safety, ML extraction and review-first confirmation.

Verifies Phase B.2 integration with Evidence Foundation and ML service.
"""

import base64
import hashlib
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from uuid import UUID, uuid4

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

from backend.app import db, main as api
from backend.app.routers.evidence import serialize_assertion
from backend.app.services.document_storage import get_storage_dir

ROOT = Path(__file__).resolve().parents[2]


def migration_config(path: Path) -> Config:
    config = Config(str(ROOT / "backend/alembic.ini"))
    config.attributes["db_path"] = path
    return config


class DocumentExtractionTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = self.enterContext(tempfile.TemporaryDirectory())
        self.db_path = Path(self.temp_dir) / "test_extraction.db"
        self.storage_dir = Path(self.temp_dir) / "storage"

        self.enterContext(patch.object(api, "DB_PATH", self.db_path))
        self.enterContext(patch.object(db, "DB_PATH", self.db_path))
        self.enterContext(patch.dict("os.environ", {"ECOSITE_STORAGE_DIR": str(self.storage_dir)}))

        command.upgrade(migration_config(self.db_path), "head")

        async def local_app(scope, receive, send):
            if scope["type"] == "http":
                scope = {**scope, "client": ("127.0.0.1", 50000)}
            await api.app(scope, receive, send)

        self.client = self.enterContext(TestClient(local_app, base_url="http://127.0.0.1"))

        # Create a test project
        res = self.client.post(
            "/api/v1/projects",
            json={"name": "Extraction Project", "organization_label": "EcoSite", "archetype": "colocation"},
        )
        self.assertEqual(res.status_code, 201)
        self.project_id = res.json()["id"]

    def create_sample_text_document(self) -> bytes:
        return (
            "GOVERNMENT OF MAHARASHTRA - INDUSTRY & ENERGY DEPARTMENT\n"
            "SANCTION ORDER REF: MSEDCL/GRID/2026/0984\n"
            "Date of Issuance: 12 January 2026\n"
            "Subject: Sanction of dedicated power connectivity for EcoSite Pune Campus.\n"
            "1. Grid Sanctioned Load: 60.0 MW at 220 kV level.\n"
            "2. Water Allocation: 1200 KLD from MIDC industrial line.\n"
            "3. Project Phase: Phase 1 commercial operations target Q4 2026.\n"
        ).encode("utf-8")

    def test_direct_upload_and_retrieval_lifecycle(self):
        doc_bytes = self.create_sample_text_document()
        b64 = base64.b64encode(doc_bytes).decode("ascii")

        payload = {
            "filename": "Sanction_Order.txt",
            "document_type": "UTILITY_SANCTION",
            "content_base64": b64,
            "issuer": "MSEDCL",
            "reference": "MSEDCL/GRID/2026/0984",
            "confidentiality": "confidential",
            "synthetic_demo": False,
        }

        res = self.client.post(f"/api/v1/projects/{self.project_id}/evidence/upload", json=payload)
        self.assertEqual(res.status_code, 201, res.text)
        art = res.json()
        self.assertEqual(art["filename"], "Sanction_Order.txt")
        self.assertEqual(art["file_size_bytes"], len(doc_bytes))
        self.assertEqual(art["sha256"], hashlib.sha256(doc_bytes).hexdigest())

        # Retrieve file content via GET
        get_res = self.client.get(f"/api/v1/evidence/{art['id']}/content")
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.content, doc_bytes)

    def test_two_step_upload_with_sha256_validation_and_mismatch_protection(self):
        doc_bytes = b"%PDF-1.4 Mock valid PDF document content for testing"
        sha256 = hashlib.sha256(doc_bytes).hexdigest()

        # Step 1: Register metadata
        reg_payload = {
            "document_type": "UTILITY_SANCTION",
            "filename": "Sanction.pdf",
            "mime_type": "application/pdf",
            "file_size_bytes": len(doc_bytes),
            "sha256": sha256,
            "confidentiality": "confidential",
            "synthetic_demo": False,
            "uploaded_by": "test-agent",
        }
        reg_res = self.client.post(f"/api/v1/projects/{self.project_id}/evidence", json=reg_payload)
        self.assertEqual(reg_res.status_code, 201)
        art_id = reg_res.json()["id"]

        # Step 2: Try uploading wrong content (mismatch SHA-256)
        wrong_bytes = b"%PDF-1.4 Corrupted or tampered content"
        mismatch_res = self.client.put(
            f"/api/v1/evidence/{art_id}/content",
            content=wrong_bytes,
            headers={"content-type": "application/pdf"},
        )
        self.assertEqual(mismatch_res.status_code, 422)
        self.assertEqual(mismatch_res.json()["detail"]["code"], "sha256_mismatch")

        # Step 3: Upload valid matching content
        valid_res = self.client.put(
            f"/api/v1/evidence/{art_id}/content",
            content=doc_bytes,
            headers={"content-type": "application/pdf"},
        )
        self.assertEqual(valid_res.status_code, 200)
        self.assertTrue(valid_res.json()["stored"])

    def test_duplicate_file_upload_rejected(self):
        doc_bytes = self.create_sample_text_document()
        b64 = base64.b64encode(doc_bytes).decode("ascii")

        payload = {
            "filename": "Doc1.txt",
            "document_type": "UTILITY_SANCTION",
            "content_base64": b64,
        }
        res1 = self.client.post(f"/api/v1/projects/{self.project_id}/evidence/upload", json=payload)
        self.assertEqual(res1.status_code, 201)

        # Upload duplicate with different filename but identical hash
        payload2 = {
            "filename": "Doc2_Duplicate.txt",
            "document_type": "UTILITY_SANCTION",
            "content_base64": b64,
        }
        res2 = self.client.post(f"/api/v1/projects/{self.project_id}/evidence/upload", json=payload2)
        self.assertEqual(res2.status_code, 409)
        self.assertEqual(res2.json()["detail"]["code"], "duplicate_artifact")

    def test_file_validation_rejections(self):
        # 1. Empty content (0 bytes)
        res_empty = self.client.post(
            f"/api/v1/projects/{self.project_id}/evidence/upload",
            json={"filename": "empty.txt", "document_type": "OTHER", "content_base64": ""},
        )
        self.assertEqual(res_empty.status_code, 422)

        # 2. Unsupported extension (.exe)
        b64_dummy = base64.b64encode(b"executable").decode("ascii")
        res_unsupp = self.client.post(
            f"/api/v1/projects/{self.project_id}/evidence/upload",
            json={"filename": "payload.exe", "document_type": "OTHER", "content_base64": b64_dummy},
        )
        self.assertEqual(res_unsupp.status_code, 422)
        self.assertIn("Unsupported file format", res_unsupp.json()["detail"]["message"])

        # 3. PDF extension without %PDF header
        b64_fake_pdf = base64.b64encode(b"Not a real pdf header").decode("ascii")
        res_fake_pdf = self.client.post(
            f"/api/v1/projects/{self.project_id}/evidence/upload",
            json={"filename": "fake.pdf", "document_type": "OTHER", "content_base64": b64_fake_pdf},
        )
        self.assertEqual(res_fake_pdf.status_code, 422)
        self.assertIn("%PDF", res_fake_pdf.json()["detail"]["message"])

    def test_extraction_lifecycle_and_pending_invariant(self):
        doc_bytes = self.create_sample_text_document()
        b64 = base64.b64encode(doc_bytes).decode("ascii")

        up_res = self.client.post(
            f"/api/v1/projects/{self.project_id}/evidence/upload",
            json={"filename": "Sanction.txt", "document_type": "UTILITY_SANCTION", "content_base64": b64},
        )
        self.assertEqual(up_res.status_code, 201)
        art_id = up_res.json()["id"]

        # Run extraction
        ext_res = self.client.post(f"/api/v1/evidence/{art_id}/extract")
        self.assertEqual(ext_res.status_code, 200, ext_res.text)
        data = ext_res.json()
        self.assertEqual(data["status"], "SUCCESS")
        self.assertGreaterEqual(data["candidate_count"], 1)

        # Verify strict PENDING review status on all candidates
        for cand in data["extraction_candidates"]:
            self.assertEqual(cand["review_status"], "PENDING")
            self.assertTrue(cand["extraction_id"].startswith(f"{art_id}-cand-"))
            self.assertGreaterEqual(cand["page_number"], 1)
            self.assertIn("field_key", cand)

        # Calling GET /extractions returns the same cached run
        get_res = self.client.get(f"/api/v1/evidence/{art_id}/extractions")
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.json()["candidate_count"], data["candidate_count"])

        # Invariant: No assertions are created automatically!
        assertions_res = self.client.get(f"/api/v1/projects/{self.project_id}/assertions")
        self.assertEqual(len(assertions_res.json()), 0)

    def test_candidate_confirmation_creates_documented_assertion(self):
        doc_bytes = self.create_sample_text_document()
        b64 = base64.b64encode(doc_bytes).decode("ascii")

        up_res = self.client.post(
            f"/api/v1/projects/{self.project_id}/evidence/upload",
            json={"filename": "Sanction.txt", "document_type": "UTILITY_SANCTION", "content_base64": b64},
        )
        art_id = up_res.json()["id"]

        ext_res = self.client.post(f"/api/v1/evidence/{art_id}/extract")
        candidates = ext_res.json()["extraction_candidates"]
        self.assertGreaterEqual(len(candidates), 1)

        target_cand = candidates[0]
        cand_id = target_cand["extraction_id"]

        # Confirm the candidate
        confirm_payload = {
            "reviewer_id": "engineer@ecosite.local",
            "notes": "Reviewed and confirmed against DISCOM sanction letter.",
            "is_simulated": True,
        }
        confirm_res = self.client.post(
            f"/api/v1/evidence/{art_id}/extractions/{cand_id}/confirm",
            json=confirm_payload,
        )
        self.assertEqual(confirm_res.status_code, 200, confirm_res.text)
        assertion = confirm_res.json()

        # Invariant: Status is DOCUMENTED and verification method is EXTRACTED_RULE_BASED
        self.assertEqual(assertion["status"], "DOCUMENTED")
        self.assertEqual(assertion["verification_method"], "EXTRACTED_RULE_BASED")
        self.assertEqual(assertion["field_key"], target_cand["field_key"])
        self.assertEqual(len(assertion["evidence_links"]), 1)
        self.assertEqual(assertion["evidence_links"][0]["artifact_id"], art_id)
        self.assertEqual(assertion["evidence_links"][0]["page_number"], target_cand["page_number"])

        # Cached candidate status is updated to ACCEPTED
        extractions_res = self.client.get(f"/api/v1/evidence/{art_id}/extractions")
        confirmed_cand = [c for c in extractions_res.json()["extraction_candidates"] if c["extraction_id"] == cand_id][0]
        self.assertEqual(confirmed_cand["review_status"], "ACCEPTED")
        self.assertEqual(confirmed_cand["assertion_id"], assertion["id"])

    def test_candidate_rejection_workflow(self):
        doc_bytes = self.create_sample_text_document()
        b64 = base64.b64encode(doc_bytes).decode("ascii")

        up_res = self.client.post(
            f"/api/v1/projects/{self.project_id}/evidence/upload",
            json={"filename": "Sanction.txt", "document_type": "UTILITY_SANCTION", "content_base64": b64},
        )
        art_id = up_res.json()["id"]
        ext_res = self.client.post(f"/api/v1/evidence/{art_id}/extract")
        cand_id = ext_res.json()["extraction_candidates"][0]["extraction_id"]

        # Reject candidate
        reject_payload = {
            "reviewer_id": "auditor@ecosite.local",
            "notes": "Document references adjacent property, not Pune campus parcel.",
        }
        reject_res = self.client.post(
            f"/api/v1/evidence/{art_id}/extractions/{cand_id}/reject",
            json=reject_payload,
        )
        self.assertEqual(reject_res.status_code, 200)
        self.assertEqual(reject_res.json()["review_status"], "REJECTED")

        # Zero assertions created
        assertions = self.client.get(f"/api/v1/projects/{self.project_id}/assertions").json()
        self.assertEqual(len(assertions), 0)

    def test_scope_isolation_and_cross_project_protection(self):
        # Create Project 2
        p2_res = self.client.post(
            "/api/v1/projects",
            json={"name": "Project 2", "organization_label": "OtherOrg", "archetype": "enterprise"},
        )
        p2_id = p2_res.json()["id"]

        doc_bytes = self.create_sample_text_document()
        b64 = base64.b64encode(doc_bytes).decode("ascii")

        # Upload in Project 1
        art1 = self.client.post(
            f"/api/v1/projects/{self.project_id}/evidence/upload",
            json={"filename": "P1.txt", "document_type": "UTILITY_SANCTION", "content_base64": b64},
        ).json()

        # Run extraction in Project 1
        ext = self.client.post(f"/api/v1/evidence/{art1['id']}/extract").json()
        cand_id = ext["extraction_candidates"][0]["extraction_id"]

        PUNE_GEOMETRY = {
            "type": "Polygon",
            "coordinates": [[[73.84, 18.51], [73.86, 18.51], [73.86, 18.53], [73.84, 18.53], [73.84, 18.51]]],
        }

        # Create site in Project 2
        p2_site_res = self.client.post(
            f"/api/v1/projects/{p2_id}/sites",
            json={
                "name": "P2 Site",
                "geometry": PUNE_GEOMETRY,
                "state_code": "IN-MH",
            },
        )
        self.assertEqual(p2_site_res.status_code, 201, p2_site_res.text)
        p2_site = p2_site_res.json()

        # Attempt to confirm candidate in Project 1 linked to Project 2 site -> 422 site_scope_mismatch
        bad_confirm = self.client.post(
            f"/api/v1/evidence/{art1['id']}/extractions/{cand_id}/confirm",
            json={
                "reviewer_id": "rev1",
                "notes": "Invalid scope attempt",
                "target_site_id": p2_site["id"],
            },
        )
        self.assertEqual(bad_confirm.status_code, 422)
        self.assertEqual(bad_confirm.json()["detail"]["code"], "site_scope_mismatch")

    def test_simulated_review_during_confirmation(self):
        doc_bytes = self.create_sample_text_document()
        b64 = base64.b64encode(doc_bytes).decode("ascii")

        up_res = self.client.post(
            f"/api/v1/projects/{self.project_id}/evidence/upload",
            json={"filename": "Sanction.txt", "document_type": "UTILITY_SANCTION", "content_base64": b64},
        )
        art_id = up_res.json()["id"]
        ext_res = self.client.post(f"/api/v1/evidence/{art_id}/extract")
        cand_id = ext_res.json()["extraction_candidates"][0]["extraction_id"]

        # Confirm with explicit review outcome
        confirm_payload = {
            "reviewer_id": "senior_reviewer@ecosite.local",
            "notes": "Verified against utility portal.",
            "is_simulated": True,
            "review_outcome": "SIMULATED_VERIFICATION",
        }
        res = self.client.post(
            f"/api/v1/evidence/{art_id}/extractions/{cand_id}/confirm",
            json=confirm_payload,
        )
        self.assertEqual(res.status_code, 200)
        assertion = res.json()
        self.assertEqual(assertion["status"], "VERIFIED_WITHIN_SCOPE")
        self.assertEqual(assertion["verification_method"], "SIMULATED_REVIEW")
        self.assertEqual(len(assertion["reviews"]), 1)
        self.assertTrue(assertion["reviews"][0]["is_simulated"])

        # Audit flags simulated review deterministically
        audit_res = self.client.get(f"/api/v1/projects/{self.project_id}/evidence-audit")
        self.assertEqual(audit_res.status_code, 200)
        findings = [f["code"] for f in audit_res.json()["findings"]]
        self.assertIn("SIMULATED_REVIEW_ONLY", findings)

    def test_extraction_missing_file_fails_closed(self):
        # Register metadata without uploading file
        art = self.client.post(
            f"/api/v1/projects/{self.project_id}/evidence",
            json={
                "document_type": "DPR",
                "filename": "Missing.pdf",
                "mime_type": "application/pdf",
                "file_size_bytes": 100,
                "sha256": "a" * 64,
                "confidentiality": "confidential",
                "synthetic_demo": False,
                "uploaded_by": "user",
            },
        ).json()

        # Calling extract fails with 404
        res = self.client.post(f"/api/v1/evidence/{art['id']}/extract")
        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json()["detail"]["code"], "document_file_missing")

    def test_double_confirmation_rejected_with_409(self):
        doc_bytes = self.create_sample_text_document()
        b64 = base64.b64encode(doc_bytes).decode("ascii")

        up_res = self.client.post(
            f"/api/v1/projects/{self.project_id}/evidence/upload",
            json={"filename": "Sanction.txt", "document_type": "UTILITY_SANCTION", "content_base64": b64},
        )
        art_id = up_res.json()["id"]
        ext_res = self.client.post(f"/api/v1/evidence/{art_id}/extract")
        cand_id = ext_res.json()["extraction_candidates"][0]["extraction_id"]

        confirm_payload = {"reviewer_id": "rev1", "notes": "Initial review."}
        res1 = self.client.post(f"/api/v1/evidence/{art_id}/extractions/{cand_id}/confirm", json=confirm_payload)
        self.assertEqual(res1.status_code, 200)

        # Second confirmation must be rejected with 409
        res2 = self.client.post(f"/api/v1/evidence/{art_id}/extractions/{cand_id}/confirm", json=confirm_payload)
        self.assertEqual(res2.status_code, 409)
        self.assertEqual(res2.json()["detail"]["code"], "candidate_already_confirmed")

        # Exactly 1 assertion exists in database
        assertions = self.client.get(f"/api/v1/projects/{self.project_id}/assertions").json()
        self.assertEqual(len(assertions), 1)

    def test_concurrent_confirmation_safe(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier

        doc_bytes = self.create_sample_text_document()
        b64 = base64.b64encode(doc_bytes).decode("ascii")

        up_res = self.client.post(
            f"/api/v1/projects/{self.project_id}/evidence/upload",
            json={"filename": "Sanction.txt", "document_type": "UTILITY_SANCTION", "content_base64": b64},
        )
        art_id = up_res.json()["id"]
        ext_res = self.client.post(f"/api/v1/evidence/{art_id}/extract")
        cand_id = ext_res.json()["extraction_candidates"][0]["extraction_id"]

        barrier = Barrier(2)
        results = []

        def worker(rev_id: str):
            barrier.wait()
            res = self.client.post(
                f"/api/v1/evidence/{art_id}/extractions/{cand_id}/confirm",
                json={"reviewer_id": rev_id, "notes": f"Concurrent review by {rev_id}"},
            )
            return res.status_code, res.json()

        with ThreadPoolExecutor(max_workers=2) as executor:
            f1 = executor.submit(worker, "revA")
            f2 = executor.submit(worker, "revB")
            results = [f1.result(), f2.result()]

        statuses = [r[0] for r in results]
        self.assertIn(200, statuses)
        self.assertIn(409, statuses)

        # Invariant: exactly one assertion created
        assertions = self.client.get(f"/api/v1/projects/{self.project_id}/assertions").json()
        self.assertEqual(len(assertions), 1)

    def test_confirming_rejected_candidate_rejected_with_409(self):
        doc_bytes = self.create_sample_text_document()
        b64 = base64.b64encode(doc_bytes).decode("ascii")

        up_res = self.client.post(
            f"/api/v1/projects/{self.project_id}/evidence/upload",
            json={"filename": "Sanction.txt", "document_type": "UTILITY_SANCTION", "content_base64": b64},
        )
        art_id = up_res.json()["id"]
        ext_res = self.client.post(f"/api/v1/evidence/{art_id}/extract")
        cand_id = ext_res.json()["extraction_candidates"][0]["extraction_id"]

        # Reject candidate
        reject_res = self.client.post(
            f"/api/v1/evidence/{art_id}/extractions/{cand_id}/reject",
            json={"reviewer_id": "auditor", "notes": "Invalid parcel reference."},
        )
        self.assertEqual(reject_res.status_code, 200)

        # Attempt to confirm rejected candidate -> 409 candidate_already_rejected
        confirm_res = self.client.post(
            f"/api/v1/evidence/{art_id}/extractions/{cand_id}/confirm",
            json={"reviewer_id": "rev2", "notes": "Should fail."},
        )
        self.assertEqual(confirm_res.status_code, 409)
        self.assertEqual(confirm_res.json()["detail"]["code"], "candidate_already_rejected")

    def test_re_extraction_after_acceptance_blocked_with_409(self):
        doc_bytes = self.create_sample_text_document()
        b64 = base64.b64encode(doc_bytes).decode("ascii")

        up_res = self.client.post(
            f"/api/v1/projects/{self.project_id}/evidence/upload",
            json={"filename": "Sanction.txt", "document_type": "UTILITY_SANCTION", "content_base64": b64},
        )
        art_id = up_res.json()["id"]
        ext_res = self.client.post(f"/api/v1/evidence/{art_id}/extract")
        cand_id = ext_res.json()["extraction_candidates"][0]["extraction_id"]

        # Confirm candidate
        self.client.post(
            f"/api/v1/evidence/{art_id}/extractions/{cand_id}/confirm",
            json={"reviewer_id": "rev1", "notes": "Approved."},
        )

        # Re-extraction must be blocked to protect review state
        re_ext = self.client.post(f"/api/v1/evidence/{art_id}/extract")
        self.assertEqual(re_ext.status_code, 409)
        self.assertEqual(re_ext.json()["detail"]["code"], "extraction_has_reviewed_candidates")

    def test_re_extraction_after_rejection_blocked_with_409(self):
        doc_bytes = self.create_sample_text_document()
        b64 = base64.b64encode(doc_bytes).decode("ascii")

        up_res = self.client.post(
            f"/api/v1/projects/{self.project_id}/evidence/upload",
            json={"filename": "Sanction.txt", "document_type": "UTILITY_SANCTION", "content_base64": b64},
        )
        art_id = up_res.json()["id"]
        ext_res = self.client.post(f"/api/v1/evidence/{art_id}/extract")
        cand_id = ext_res.json()["extraction_candidates"][0]["extraction_id"]

        # Reject candidate
        self.client.post(
            f"/api/v1/evidence/{art_id}/extractions/{cand_id}/reject",
            json={"reviewer_id": "rev1", "notes": "Rejected."},
        )

        # Re-extraction must be blocked to protect rejection decision
        re_ext = self.client.post(f"/api/v1/evidence/{art_id}/extract")
        self.assertEqual(re_ext.status_code, 409)
        self.assertEqual(re_ext.json()["detail"]["code"], "extraction_has_reviewed_candidates")

    def test_oversized_raw_upload_with_and_without_content_length(self):
        doc_bytes = b"%PDF-1.4 " + b"0" * 100
        reg = self.client.post(
            f"/api/v1/projects/{self.project_id}/evidence",
            json={
                "document_type": "DPR",
                "filename": "Oversized.pdf",
                "mime_type": "application/pdf",
                "file_size_bytes": len(doc_bytes),
                "sha256": hashlib.sha256(doc_bytes).hexdigest(),
                "confidentiality": "confidential",
                "synthetic_demo": False,
                "uploaded_by": "user",
            },
        ).json()
        art_id = reg["id"]

        # 1. With Content-Length header declaring > 25MB
        res_with_cl = self.client.put(
            f"/api/v1/evidence/{art_id}/content",
            content=b"%PDF-1.4 small content",
            headers={"content-type": "application/pdf", "content-length": str(30 * 1024 * 1024)},
        )
        self.assertEqual(res_with_cl.status_code, 413)
        self.assertEqual(res_with_cl.json()["detail"]["code"], "file_too_large")

        # 2. Without Content-Length (or forged small header) streaming > 25MB
        oversized_data = b"%PDF-1.4 " + b"A" * (25 * 1024 * 1024 + 1024)
        res_no_cl = self.client.put(
            f"/api/v1/evidence/{art_id}/content",
            content=oversized_data,
            headers={"content-type": "application/pdf"},
        )
        self.assertEqual(res_no_cl.status_code, 413)
        self.assertEqual(res_no_cl.json()["detail"]["code"], "file_too_large")

    def test_oversized_base64_upload_rejected(self):
        # Base64 string longer than 36,000,000 characters
        huge_b64 = "A" * (36_000_000 + 10)
        res = self.client.post(
            f"/api/v1/projects/{self.project_id}/evidence/upload",
            json={"filename": "Huge.pdf", "document_type": "DPR", "content_base64": huge_b64},
        )
        self.assertIn(res.status_code, (413, 422))

    def test_atomic_write_failure_and_cleanup(self):
        from backend.app.services.document_storage import atomic_write_bytes

        target_file = self.storage_dir / "atomic_test.bin"
        with patch("os.replace", side_effect=OSError("Disk write error")):
            with self.assertRaises(OSError):
                atomic_write_bytes(target_file, b"test content")

        # Target file must not exist
        self.assertFalse(target_file.exists())
        # Temp file must have been cleaned up
        temp_files = list(self.storage_dir.glob("atomic_test.bin.tmp.*"))
        self.assertEqual(len(temp_files), 0)

    def test_no_automatic_independent_verification_and_audit(self):
        doc_bytes = self.create_sample_text_document()
        b64 = base64.b64encode(doc_bytes).decode("ascii")

        up_res = self.client.post(
            f"/api/v1/projects/{self.project_id}/evidence/upload",
            json={"filename": "Sanction.txt", "document_type": "UTILITY_SANCTION", "content_base64": b64},
        )
        art_id = up_res.json()["id"]
        ext_res = self.client.post(f"/api/v1/evidence/{art_id}/extract")
        cand_id = ext_res.json()["extraction_candidates"][0]["extraction_id"]

        # Confirm without review_outcome (pure candidate acceptance)
        confirm_res = self.client.post(
            f"/api/v1/evidence/{art_id}/extractions/{cand_id}/confirm",
            json={"reviewer_id": "operator", "notes": "Accepted extracted values."},
        )
        self.assertEqual(confirm_res.status_code, 200)
        assertion = confirm_res.json()

        # Invariant: status is DOCUMENTED, verification is EXTRACTED_RULE_BASED (NOT independent verification)
        self.assertEqual(assertion["status"], "DOCUMENTED")
        self.assertEqual(assertion["verification_method"], "EXTRACTED_RULE_BASED")

        # Audit engine flags unconfirmed extractions
        audit_res = self.client.get(f"/api/v1/projects/{self.project_id}/evidence-audit")
        self.assertEqual(audit_res.status_code, 200)
        findings = [f["code"] for f in audit_res.json()["findings"]]
        self.assertIn("EXTRACTION_UNCONFIRMED", findings)

    def test_cache_persistence_failure_rolls_back_assertion_and_retry_succeeds(self):
        """When cache persistence fails after assertion creation/flush, the DB transaction

        must be rolled back without leaving an orphan assertion, candidate remains PENDING,
        and subsequent retry succeeds with exactly 1 assertion.
        """
        doc_bytes = self.create_sample_text_document()
        b64 = base64.b64encode(doc_bytes).decode("ascii")

        up_res = self.client.post(
            f"/api/v1/projects/{self.project_id}/evidence/upload",
            json={"filename": "Sanction.txt", "document_type": "UTILITY_SANCTION", "content_base64": b64},
        )
        art_id = up_res.json()["id"]
        ext_res = self.client.post(f"/api/v1/evidence/{art_id}/extract")
        cand_id = ext_res.json()["extraction_candidates"][0]["extraction_id"]

        confirm_payload = {"reviewer_id": "operator", "notes": "Test fail rollback."}

        # 1. Simulate failure during save_extractions
        with patch("backend.app.routers.extraction.save_extractions", side_effect=IOError("Simulated disk error")):
            with self.assertRaises(IOError):
                self.client.post(
                    f"/api/v1/evidence/{art_id}/extractions/{cand_id}/confirm",
                    json=confirm_payload,
                )

        # 2. Assert no assertion was committed to the database
        assertions_after_fail = self.client.get(f"/api/v1/projects/{self.project_id}/assertions").json()
        self.assertEqual(len(assertions_after_fail), 0)

        # 3. Assert extraction candidate in storage remains PENDING
        cached = self.client.get(f"/api/v1/evidence/{art_id}/extractions").json()
        self.assertEqual(cached["extraction_candidates"][0]["review_status"], "PENDING")

        # 4. Retry confirmation succeeds cleanly
        retry_res = self.client.post(
            f"/api/v1/evidence/{art_id}/extractions/{cand_id}/confirm",
            json=confirm_payload,
        )
        self.assertEqual(retry_res.status_code, 200)

        # 5. Exactly 1 assertion exists in database (no duplicate assertion created)
        assertions_after_retry = self.client.get(f"/api/v1/projects/{self.project_id}/assertions").json()
        self.assertEqual(len(assertions_after_retry), 1)

    def test_db_existing_assertion_prevents_duplicate_on_desynced_cache(self):
        """If an assertion already exists in SQLite for a candidate, but the JSON cache

        is somehow reset or desynchronized to PENDING, retry must be rejected with 409
        and prevent creating a duplicate assertion.
        """
        doc_bytes = self.create_sample_text_document()
        b64 = base64.b64encode(doc_bytes).decode("ascii")

        up_res = self.client.post(
            f"/api/v1/projects/{self.project_id}/evidence/upload",
            json={"filename": "Sanction.txt", "document_type": "UTILITY_SANCTION", "content_base64": b64},
        )
        art_id = up_res.json()["id"]
        ext_res = self.client.post(f"/api/v1/evidence/{art_id}/extract")
        cand_id = ext_res.json()["extraction_candidates"][0]["extraction_id"]

        confirm_payload = {"reviewer_id": "operator", "notes": "First confirm."}
        res1 = self.client.post(
            f"/api/v1/evidence/{art_id}/extractions/{cand_id}/confirm",
            json=confirm_payload,
        )
        self.assertEqual(res1.status_code, 200)
        assertion_id = res1.json()["id"]

        # Simulate desynchronized cache: manually revert candidate review_status back to PENDING on disk
        from backend.app.services.document_storage import load_extractions, save_extractions
        cached = load_extractions(self.project_id, art_id)
        cached["extraction_candidates"][0]["review_status"] = "PENDING"
        cached["extraction_candidates"][0]["assertion_id"] = None
        save_extractions(self.project_id, art_id, cached)

        # Confirming again must be detected by DB guard and rejected with 409 candidate_already_confirmed
        res2 = self.client.post(
            f"/api/v1/evidence/{art_id}/extractions/{cand_id}/confirm",
            json=confirm_payload,
        )
        self.assertEqual(res2.status_code, 409)
        self.assertEqual(res2.json()["detail"]["code"], "candidate_already_confirmed")
        self.assertEqual(res2.json()["detail"]["assertion_id"], assertion_id)

        # Database still has exactly 1 assertion
        assertions = self.client.get(f"/api/v1/projects/{self.project_id}/assertions").json()
        self.assertEqual(len(assertions), 1)


