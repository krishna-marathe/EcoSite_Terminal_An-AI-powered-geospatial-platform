from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from uuid import UUID

from alembic import command
from fastapi.testclient import TestClient

from backend.app import db, main as api
from backend.tests.test_projects import migration_config

PUNE_GEOMETRY = {
    "type": "Polygon",
    "coordinates": [[[73.84, 18.51], [73.86, 18.51], [73.86, 18.53], [73.84, 18.53], [73.84, 18.51]]],
}


class EvidenceFoundationTests(unittest.TestCase):
    def setUp(self):
        self.temp = self.enterContext(tempfile.TemporaryDirectory())
        self.path = Path(self.temp) / "test_evidence.db"
        self.enterContext(unittest.mock.patch.object(api, "DB_PATH", self.path))
        self.enterContext(unittest.mock.patch.object(db, "DB_PATH", self.path))
        command.upgrade(migration_config(self.path), "head")

        async def local_app(scope, receive, send):
            if scope["type"] == "http":
                scope = {**scope, "client": ("127.0.0.1", 50000)}
            await api.app(scope, receive, send)

        self.client = self.enterContext(TestClient(local_app, base_url="http://127.0.0.1"))

        # Setup primary test project
        res = self.client.post(
            "/api/v1/projects",
            json={"name": "Evidence Test Campus", "organization_label": "EcoSite", "archetype": "hyperscale"},
        )
        self.assertEqual(res.status_code, 201, res.text)
        self.project = res.json()
        self.project_id = self.project["id"]

        # Setup site
        res = self.client.post(
            f"/api/v1/projects/{self.project_id}/sites",
            json={"name": "Pune Site Alpha", "geometry": PUNE_GEOMETRY, "state_code": "IN-MH", "district": "Pune"},
        )
        self.assertEqual(res.status_code, 201, res.text)
        self.site = res.json()
        self.site_id = self.site["id"]

        # Setup phase
        res = self.client.post(
            f"/api/v1/projects/{self.project_id}/phases",
            json={
                "sequence": 1,
                "name": "Phase 1 - 40 MW",
                "commissioning_date": "2027-06-01",
                "cumulative_it_mw": 40.0,
                "cumulative_facility_peak_mw": 56.0,
                "design_pue": 1.4,
                "average_water_kld": 120.0,
                "peak_summer_water_kld": 180.0,
                "cooling_type": "closed_loop_evaporative",
            },
        )
        self.assertEqual(res.status_code, 201, res.text)
        self.phase = res.json()
        self.phase_id = self.phase["id"]

    def create_artifact(self, **overrides):
        payload = {
            "site_id": self.site_id,
            "document_type": "UTILITY_SANCTION",
            "filename": "MSEDCL_Power_Sanction_50MW.pdf",
            "mime_type": "application/pdf",
            "file_size_bytes": 1048576,
            "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "issuer": "MSEDCL",
            "reference": "SE/O&M/HT/2026/9821",
            "issued_on": "2026-04-15",
            "valid_until": "2029-04-14",
            "visibility": "PROJECT_TEAM",
            "confidentiality": "confidential",
            "synthetic_demo": False,
            "uploaded_by": "krishna@ecosite.internal",
        }
        payload.update(overrides)
        res = self.client.post(f"/api/v1/projects/{self.project_id}/evidence", json=payload)
        return res

    def test_artifact_registration_list_detail_and_revision_patch(self):
        # Register artifact
        res = self.create_artifact()
        self.assertEqual(res.status_code, 201, res.text)
        artifact = res.json()
        UUID(artifact["id"])
        self.assertEqual(artifact["project_id"], self.project_id)
        self.assertEqual(artifact["site_id"], self.site_id)
        self.assertEqual(artifact["document_type"], "UTILITY_SANCTION")
        self.assertEqual(artifact["filename"], "MSEDCL_Power_Sanction_50MW.pdf")
        self.assertEqual(artifact["status"], "active")
        self.assertEqual(artifact["revision"], 1)

        # List artifacts
        list_res = self.client.get(f"/api/v1/projects/{self.project_id}/evidence")
        self.assertEqual(list_res.status_code, 200)
        items = list_res.json()
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["id"], artifact["id"])

        # Filter by site_id
        filtered = self.client.get(f"/api/v1/projects/{self.project_id}/evidence?site_id={self.site_id}").json()
        self.assertEqual(len(filtered), 1)

        # Get detail
        detail_res = self.client.get(f"/api/v1/evidence/{artifact['id']}")
        self.assertEqual(detail_res.status_code, 200)
        self.assertEqual(detail_res.json()["sha256"], artifact["sha256"])

        # Patch with revision conflict check
        conflict_patch = self.client.patch(
            f"/api/v1/evidence/{artifact['id']}",
            json={"expected_revision": 99, "visibility": "RESTRICTED_REVIEWER"},
        )
        self.assertEqual(conflict_patch.status_code, 409)
        self.assertEqual(conflict_patch.json()["detail"]["code"], "revision_conflict")

        # Successful patch
        valid_patch = self.client.patch(
            f"/api/v1/evidence/{artifact['id']}",
            json={"expected_revision": 1, "visibility": "RESTRICTED_REVIEWER", "reference": "UPDATED-REF-01"},
        )
        self.assertEqual(valid_patch.status_code, 200)
        updated = valid_patch.json()
        self.assertEqual(updated["revision"], 2)
        self.assertEqual(updated["visibility"], "RESTRICTED_REVIEWER")
        self.assertEqual(updated["reference"], "UPDATED-REF-01")

        # Archive artifact
        archived = self.client.patch(
            f"/api/v1/evidence/{artifact['id']}",
            json={"expected_revision": 2, "status": "archived"},
        ).json()
        self.assertEqual(archived["status"], "archived")

        # List hides archived by default
        active_list = self.client.get(f"/api/v1/projects/{self.project_id}/evidence").json()
        self.assertEqual(len(active_list), 0)
        with_archived = self.client.get(f"/api/v1/projects/{self.project_id}/evidence?include_archived=true").json()
        self.assertEqual(len(with_archived), 1)

    def test_artifact_scope_isolation_and_validation(self):
        # Create second project
        other_project = self.client.post(
            "/api/v1/projects",
            json={"name": "Other Campus", "organization_label": "Tenant B", "archetype": "edge"},
        ).json()

        # Cannot assign site from Project 1 to Project 2's evidence
        invalid_res = self.client.post(
            f"/api/v1/projects/{other_project['id']}/evidence",
            json={
                "site_id": self.site_id,
                "document_type": "DPR",
                "filename": "DPR.pdf",
                "mime_type": "application/pdf",
                "file_size_bytes": 1000,
                "sha256": "a" * 64,
                "uploaded_by": "tester",
            },
        )
        self.assertEqual(invalid_res.status_code, 422)
        self.assertEqual(invalid_res.json()["detail"]["code"], "site_scope_mismatch")

    def test_assertion_lifecycle_linking_and_superseding(self):
        # Create supporting artifact
        art = self.create_artifact().json()

        # Create assertion linked to artifact
        assertion_body = {
            "site_id": self.site_id,
            "phase_id": self.phase_id,
            "field_key": "sanctioned_grid_mw",
            "value": "50 MW sanctioned at 220 kV substation",
            "numeric_value": 50.0,
            "unit": "MW",
            "scope_type": "PHASE",
            "scope_detail": "Phase 1 grid sanction",
            "status": "DECLARED",
            "verification_method": "EXTRACTED_RULE_BASED",
            "asserted_by": "samarth@ecosite.internal",
            "evidence_links": [{"artifact_id": art["id"], "page_number": 3}],
        }
        res = self.client.post(f"/api/v1/projects/{self.project_id}/assertions", json=assertion_body)
        self.assertEqual(res.status_code, 201, res.text)
        assertion = res.json()
        UUID(assertion["id"])
        # Because evidence links were attached, status automatically graduated to DOCUMENTED
        self.assertEqual(assertion["status"], "DOCUMENTED")
        self.assertEqual(assertion["verification_method"], "EXTRACTED_RULE_BASED")
        self.assertEqual(len(assertion["evidence_links"]), 1)
        self.assertEqual(assertion["evidence_links"][0]["artifact_id"], art["id"])
        self.assertEqual(assertion["evidence_links"][0]["page_number"], 3)

        # List assertions with filters
        by_key = self.client.get(f"/api/v1/projects/{self.project_id}/assertions?field_key=sanctioned_grid_mw").json()
        self.assertEqual(len(by_key), 1)

        # Supersede assertion with an updated sanction
        updated_body = {
            "site_id": self.site_id,
            "phase_id": self.phase_id,
            "field_key": "sanctioned_grid_mw",
            "value": "60 MW upgraded sanction",
            "numeric_value": 60.0,
            "unit": "MW",
            "scope_type": "PHASE",
            "status": "DOCUMENTED",
            "verification_method": "EXTRACTED_RULE_BASED",
            "asserted_by": "samarth@ecosite.internal",
            "supersedes_assertion_id": assertion["id"],
            "evidence_links": [{"artifact_id": art["id"], "page_number": 4}],
        }
        res2 = self.client.post(f"/api/v1/projects/{self.project_id}/assertions", json=updated_body)
        self.assertEqual(res2.status_code, 201, res2.text)
        new_assertion = res2.json()
        self.assertEqual(new_assertion["supersedes_assertion_id"], assertion["id"])

        # Verify old assertion marked SUPERSEDED
        old_fetched = self.client.get(f"/api/v1/assertions/{assertion['id']}").json()
        self.assertEqual(old_fetched["status"], "SUPERSEDED")

    def test_assertion_review_deterministic_verification(self):
        art = self.create_artifact().json()
        assertion = self.client.post(
            f"/api/v1/projects/{self.project_id}/assertions",
            json={
                "site_id": self.site_id,
                "field_key": "water_allocation_kld",
                "value": "200 KLD allocated from MIDC pipeline",
                "numeric_value": 200.0,
                "unit": "KLD",
                "scope_type": "SITE",
                "status": "DECLARED",
                "asserted_by": "analyst@ecosite.internal",
                "evidence_links": [{"artifact_id": art["id"], "page_number": 1}],
            },
        ).json()
        self.assertEqual(assertion["status"], "DOCUMENTED")

        # Submit simulated review
        review_res = self.client.post(
            f"/api/v1/assertions/{assertion['id']}/reviews",
            json={
                "reviewer_id": "reviewer_pune_utility@ecosite.internal",
                "review_status": "APPROVED",
                "is_simulated": True,
                "notes": "Verified against MIDC sanction letter reference no. MIDC/WT/2026/41. Verified for Phase 1 campus.",
            },
        )
        self.assertEqual(review_res.status_code, 200, review_res.text)
        reviewed_assertion = review_res.json()

        # Status updated to VERIFIED_WITHIN_SCOPE and verification_method to SIMULATED_REVIEW
        self.assertEqual(reviewed_assertion["status"], "VERIFIED_WITHIN_SCOPE")
        self.assertEqual(reviewed_assertion["verification_method"], "SIMULATED_REVIEW")
        self.assertEqual(len(reviewed_assertion["reviews"]), 1)
        self.assertTrue(reviewed_assertion["reviews"][0]["is_simulated"])
        self.assertEqual(reviewed_assertion["revision"], 2)

    def test_deterministic_evidence_audit_findings(self):
        # Empty project audit: flags critical resource gaps (Phase 1 exists without power or water assertions)
        empty_audit = self.client.get(f"/api/v1/projects/{self.project_id}/evidence-audit").json()
        codes = [f["code"] for f in empty_audit["findings"]]
        self.assertIn("RESOURCE_POWER_EVIDENCE_MISSING", codes)
        self.assertIn("RESOURCE_WATER_EVIDENCE_MISSING", codes)
        self.assertFalse(empty_audit["has_synthetic_evidence"])

        # Add synthetic artifact
        synth_art = self.create_artifact(
            synthetic_demo=True,
            filename="Demo_Synthetic_Power_Letter.pdf",
            valid_until="2020-01-01",  # Expired
        ).json()

        # Add unreviewed extraction
        self.client.post(
            f"/api/v1/projects/{self.project_id}/assertions",
            json={
                "field_key": "sanctioned_grid_mw",
                "value": "40 MW",
                "numeric_value": 40.0,
                "unit": "MW",
                "scope_type": "CAMPUS",
                "status": "DOCUMENTED",
                "verification_method": "EXTRACTED_RULE_BASED",
                "asserted_by": "ml_service",
                "evidence_links": [{"artifact_id": synth_art["id"]}],
            },
        )

        audit_res = self.client.get(f"/api/v1/projects/{self.project_id}/evidence-audit").json()
        codes = [f["code"] for f in audit_res["findings"]]
        self.assertIn("SYNTHETIC_EVIDENCE", codes)
        self.assertIn("ARTIFACT_EXPIRED", codes)
        self.assertIn("EXTRACTION_UNCONFIRMED", codes)
        self.assertTrue(audit_res["has_synthetic_evidence"])
        self.assertTrue(audit_res["has_unreviewed_extractions"])

        # Comparative mode blocks comparison due to synthetic evidence and unconfirmed extraction
        comp_audit = self.client.get(f"/api/v1/projects/{self.project_id}/evidence-audit?comparative_mode=true").json()
        self.assertTrue(comp_audit["comparative_assertion_blocked"])
        comp_codes = [f["code"] for f in comp_audit["findings"]]
        self.assertIn("UNSUPPORTED_COMPARATIVE_ASSERTION", comp_codes)
        self.assertIn("COMPARISON_REQUIRES_HUMAN_REVIEW", comp_codes)


if __name__ == "__main__":
    unittest.main()
