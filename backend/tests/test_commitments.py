from __future__ import annotations

import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch
from uuid import UUID, uuid4

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app import db, main as api


ROOT = Path(__file__).resolve().parents[2]


def migration_config(path: Path) -> Config:
    config = Config(str(ROOT / "backend/alembic.ini"))
    config.attributes["db_path"] = path
    return config


class ResourceCommitmentsAndReadinessTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = self.enterContext(tempfile.TemporaryDirectory())
        self.db_path = Path(self.temp_dir) / "test_commitments.db"

        self.enterContext(patch.object(api, "DB_PATH", self.db_path))
        self.enterContext(patch.object(db, "DB_PATH", self.db_path))

        # Run Alembic migrations on disposable DB
        config = migration_config(self.db_path)
        command.upgrade(config, "head")

        async def local_app(scope, receive, send):
            if scope["type"] == "http":
                scope = {**scope, "client": ("127.0.0.1", 50000)}
            await api.app(scope, receive, send)

        self.client = self.enterContext(TestClient(local_app, base_url="http://127.0.0.1"))

        # Setup standard Project
        proj_res = self.client.post(
            "/api/v1/projects",
            json={"name": "Hyderabad Hyper Compute", "organization_label": "OneEarth", "archetype": "hyperscale"},
        )
        self.assertEqual(proj_res.status_code, 201)
        self.project_id = proj_res.json()["id"]

        # Setup Phase 1: 20 MW IT, 26 MW Facility Peak, 260 KLD Peak Summer Water
        self.p1_res = self.client.post(
            f"/api/v1/projects/{self.project_id}/phases",
            json={
                "sequence": 1,
                "name": "Phase 1 - Initial Build",
                "commissioning_date": "2027-06-01",
                "cumulative_it_mw": 20.0,
                "cumulative_facility_peak_mw": 26.0,
                "design_pue": 1.3,
                "average_water_kld": 150.0,
                "peak_summer_water_kld": 260.0,
                "cooling_type": "Direct Evaporative",
            },
        )
        self.assertEqual(self.p1_res.status_code, 201)
        self.phase1_id = self.p1_res.json()["id"]

        # Setup Phase 2: 50 MW IT, 65 MW Facility Peak, 650 KLD Peak Summer Water
        self.p2_res = self.client.post(
            f"/api/v1/projects/{self.project_id}/phases",
            json={
                "sequence": 2,
                "name": "Phase 2 - Expansion",
                "commissioning_date": "2029-01-01",
                "cumulative_it_mw": 50.0,
                "cumulative_facility_peak_mw": 65.0,
                "design_pue": 1.3,
                "average_water_kld": 375.0,
                "peak_summer_water_kld": 650.0,
                "cooling_type": "Direct Evaporative",
            },
        )
        self.assertEqual(self.p2_res.status_code, 201)
        self.phase2_id = self.p2_res.json()["id"]

    def test_power_commitment_crud_and_optimistic_locking(self):
        # 1. Create valid power commitment
        create_res = self.client.post(
            f"/api/v1/projects/{self.project_id}/power-commitments",
            json={
                "phase_id": self.phase1_id,
                "scope_type": "PHASE",
                "commitment_type": "GRID_SANCTION",
                "capacity_mw": 30.0,
                "status": "SANCTIONED",
                "utility_provider": "TGSPDCL",
                "substation_name": "Gachibowli 220kV",
                "voltage_kv": 220.0,
                "effective_date": "2027-01-01",
                "verification_state": "DOCUMENTED",
                "notes": "Formal grid sanction letter received.",
            },
        )
        self.assertEqual(create_res.status_code, 201)
        data = create_res.json()
        cid = data["id"]
        self.assertEqual(data["capacity_mw"], 30.0)
        self.assertEqual(data["revision"], 1)

        # 2. Get detail
        get_res = self.client.get(f"/api/v1/projects/{self.project_id}/power-commitments/{cid}")
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.json()["utility_provider"], "TGSPDCL")

        # 3. Patch with correct expected_revision
        patch_res = self.client.patch(
            f"/api/v1/projects/{self.project_id}/power-commitments/{cid}",
            json={"expected_revision": 1, "capacity_mw": 35.0},
        )
        self.assertEqual(patch_res.status_code, 200)
        self.assertEqual(patch_res.json()["capacity_mw"], 35.0)
        self.assertEqual(patch_res.json()["revision"], 2)

        # 4. Patch with stale revision -> 409
        stale_res = self.client.patch(
            f"/api/v1/projects/{self.project_id}/power-commitments/{cid}",
            json={"expected_revision": 1, "capacity_mw": 40.0},
        )
        self.assertEqual(stale_res.status_code, 409)
        self.assertEqual(stale_res.json()["detail"]["code"], "stale_revision")

        # 5. Archive (delete)
        del_res = self.client.delete(f"/api/v1/projects/{self.project_id}/power-commitments/{cid}?expected_revision=2")
        self.assertEqual(del_res.status_code, 200)
        self.assertEqual(del_res.json()["status_record"], "archived")

        # 6. Listing excludes archived records
        list_res = self.client.get(f"/api/v1/projects/{self.project_id}/power-commitments")
        self.assertEqual(list_res.json()["total"], 0)

    def test_water_commitment_crud_and_validation(self):
        # 1. Create valid water commitment
        create_res = self.client.post(
            f"/api/v1/projects/{self.project_id}/water-commitments",
            json={
                "scope_type": "CAMPUS",
                "source_type": "INDUSTRIAL_RECYCLED",
                "allocated_kld": 700.0,
                "status": "ALLOCATED",
                "authority_issuer": "TSIIC",
                "allocation_reference": "TSIIC/CETP/2027/089",
                "effective_date": "2027-01-01",
                "verification_state": "DOCUMENTED",
            },
        )
        self.assertEqual(create_res.status_code, 201)
        data = create_res.json()
        wid = data["id"]
        self.assertEqual(data["allocated_kld"], 700.0)

        # 2. Rejection on negative allocation
        neg_res = self.client.post(
            f"/api/v1/projects/{self.project_id}/water-commitments",
            json={"allocated_kld": -50.0, "source_type": "MUNICIPAL_PIPED"},
        )
        self.assertEqual(neg_res.status_code, 422)

    def test_project_and_scope_isolation(self):
        # Create second project
        proj2 = self.client.post(
            "/api/v1/projects",
            json={"name": "Second Project", "organization_label": "Eco", "archetype": "colocation"},
        ).json()["id"]

        # Attempt to link Phase 1 from Project 1 into Project 2 commitment -> 404 phase_not_found
        cross_res = self.client.post(
            f"/api/v1/projects/{proj2}/power-commitments",
            json={
                "scope_type": "PHASE",
                "phase_id": self.phase1_id,
                "capacity_mw": 20.0,
                "commitment_type": "GRID_SANCTION",
                "status": "SANCTIONED",
            },
        )
        self.assertEqual(cross_res.status_code, 404)
        self.assertEqual(cross_res.json()["detail"]["code"], "phase_not_found")

    def test_missing_demand_and_uncommitted_capacity_returns_insufficient_or_uncommitted(self):
        # 1. Unassessed commitment inventory: no commitments registered for project
        # Priority 3 requirement: returns UNKNOWN with null gap, not proof of zero physical capacity
        unassessed_res = self.client.get(f"/api/v1/projects/{self.project_id}/phase-readiness")
        self.assertEqual(unassessed_res.status_code, 200)
        report = unassessed_res.json()
        p1 = report["phases"][0]
        self.assertEqual(p1["power"]["demand_mw"], 26.0)
        self.assertIsNone(p1["power"]["power_gap_mw"])
        self.assertEqual(p1["power"]["status"], "UNKNOWN")
        self.assertIsNone(p1["water"]["water_gap_kld"])
        self.assertEqual(p1["water"]["status"], "UNKNOWN")
        codes = [f["code"] for f in p1["findings"]]
        self.assertIn("COMMITMENT_INVENTORY_NOT_ASSESSED", codes)

        # 2. Now register an unverified/proposed commitment so inventory is assessed:
        # Phase 1 demand is 26 MW, but zero qualifying firm capacity is delivered.
        # Must report UNCOMMITTED with exact evidence-backed gap matching demand.
        self.client.post(
            f"/api/v1/projects/{self.project_id}/power-commitments",
            json={
                "scope_type": "CAMPUS",
                "commitment_type": "GRID_SANCTION",
                "capacity_mw": 10.0,
                "status": "PROPOSED",
                "verification_state": "UNVERIFIED",
            },
        )
        self.client.post(
            f"/api/v1/projects/{self.project_id}/water-commitments",
            json={
                "scope_type": "CAMPUS",
                "source_type": "MUNICIPAL_PIPED",
                "allocated_kld": 100.0,
                "status": "PROPOSED",
                "verification_state": "UNVERIFIED",
            },
        )
        assessed_res = self.client.get(f"/api/v1/projects/{self.project_id}/phase-readiness")
        self.assertEqual(assessed_res.status_code, 200)
        p1_assessed = assessed_res.json()["phases"][0]
        self.assertEqual(p1_assessed["power"]["power_gap_mw"], 26.0)
        self.assertEqual(p1_assessed["power"]["status"], "UNCOMMITTED")
        self.assertEqual(p1_assessed["water"]["water_gap_kld"], 260.0)
        self.assertEqual(p1_assessed["water"]["status"], "UNCOMMITTED")
        assessed_codes = [f["code"] for f in p1_assessed["findings"]]
        self.assertIn("POWER_UNCOMMITTED", assessed_codes)
        self.assertIn("WATER_UNCOMMITTED", assessed_codes)

    def test_proposed_power_and_water_excluded_from_firm_capacity(self):
        # Add proposed power (30 MW) and proposed water (300 KLD)
        self.client.post(
            f"/api/v1/projects/{self.project_id}/power-commitments",
            json={
                "scope_type": "CAMPUS",
                "commitment_type": "GRID_ALLOCATION_PROPOSED",
                "capacity_mw": 30.0,
                "status": "PROPOSED",
                "verification_state": "DOCUMENTED",
            },
        )
        self.client.post(
            f"/api/v1/projects/{self.project_id}/water-commitments",
            json={
                "scope_type": "CAMPUS",
                "source_type": "MUNICIPAL_PIPED",
                "allocated_kld": 300.0,
                "status": "PROPOSED",
                "verification_state": "DOCUMENTED",
            },
        )

        readiness = self.client.get(f"/api/v1/projects/{self.project_id}/phase-readiness").json()
        p1 = readiness["phases"][0]

        # Proposed capacity is tracked under proposed, NOT firm!
        self.assertEqual(p1["power"]["proposed_capacity_mw"], 30.0)
        self.assertEqual(p1["power"]["qualifying_firm_capacity_mw"], 0.0)
        self.assertEqual(p1["power"]["status"], "UNCOMMITTED")

        self.assertEqual(p1["water"]["proposed_kld"], 300.0)
        self.assertEqual(p1["water"]["qualifying_firm_allocated_kld"], 0.0)
        self.assertEqual(p1["water"]["status"], "UNCOMMITTED")

        codes = [f["code"] for f in p1["findings"]]
        self.assertIn("PROPOSED_POWER_EXCLUDED", codes)
        self.assertIn("PROPOSED_WATER_EXCLUDED", codes)

    def test_expired_commitments_excluded_from_firm_capacity(self):
        # Commitment expired in 2026, before Phase 1 commissioning date 2027-06-01
        self.client.post(
            f"/api/v1/projects/{self.project_id}/power-commitments",
            json={
                "scope_type": "CAMPUS",
                "commitment_type": "GRID_SANCTION",
                "capacity_mw": 40.0,
                "status": "SANCTIONED",
                "effective_date": "2025-01-01",
                "expiry_date": "2026-12-31",
                "verification_state": "DOCUMENTED",
            },
        )
        readiness = self.client.get(f"/api/v1/projects/{self.project_id}/phase-readiness").json()
        p1 = readiness["phases"][0]
        self.assertEqual(p1["power"]["qualifying_firm_capacity_mw"], 0.0)
        codes = [f["code"] for f in p1["findings"]]
        self.assertIn("EXPIRED_POWER_COMMITMENT", codes)

    def test_synthetic_and_unverified_commitments_excluded_from_firm_capacity(self):
        # 1. Synthetic commitment
        self.client.post(
            f"/api/v1/projects/{self.project_id}/power-commitments",
            json={
                "scope_type": "CAMPUS",
                "commitment_type": "GRID_SANCTION",
                "capacity_mw": 50.0,
                "status": "SANCTIONED",
                "is_synthetic": True,
                "verification_state": "DOCUMENTED",
            },
        )
        # 2. Unverified commitment
        self.client.post(
            f"/api/v1/projects/{self.project_id}/power-commitments",
            json={
                "scope_type": "CAMPUS",
                "commitment_type": "GRID_SANCTION",
                "capacity_mw": 50.0,
                "status": "SANCTIONED",
                "is_synthetic": False,
                "verification_state": "UNVERIFIED",
            },
        )

        readiness = self.client.get(f"/api/v1/projects/{self.project_id}/phase-readiness").json()
        p1 = readiness["phases"][0]
        self.assertEqual(p1["power"]["qualifying_firm_capacity_mw"], 0.0)
        codes = [f["code"] for f in p1["findings"]]
        self.assertIn("SYNTHETIC_COMMITMENT_EXCLUDED", codes)
        self.assertIn("UNVERIFIED_EVIDENCE_EXCLUDED", codes)

    def test_groundwater_noc_unverified_exclusion(self):
        # Groundwater claimed without authenticated clearance must be excluded
        self.client.post(
            f"/api/v1/projects/{self.project_id}/water-commitments",
            json={
                "scope_type": "CAMPUS",
                "source_type": "GROUNDWATER_NOC",
                "allocated_kld": 500.0,
                "status": "ALLOCATED",
                "verification_state": "UNVERIFIED",
            },
        )
        readiness = self.client.get(f"/api/v1/projects/{self.project_id}/phase-readiness").json()
        p1 = readiness["phases"][0]
        self.assertEqual(p1["water"]["qualifying_firm_allocated_kld"], 0.0)
        codes = [f["code"] for f in p1["findings"]]
        self.assertIn("GROUNDWATER_PERMIT_UNVERIFIED", codes)

    def test_substation_proximity_without_sanction_warning(self):
        self.client.post(
            f"/api/v1/projects/{self.project_id}/power-commitments",
            json={
                "scope_type": "CAMPUS",
                "commitment_type": "GRID_REQUESTED",
                "capacity_mw": 20.0,
                "status": "REQUESTED",
                "substation_name": "Kondapur 400kV GIS",
                "verification_state": "UNVERIFIED",
            },
        )
        readiness = self.client.get(f"/api/v1/projects/{self.project_id}/phase-readiness").json()
        p1 = readiness["phases"][0]
        codes = [f["code"] for f in p1["findings"]]
        self.assertIn("SUBSTATION_PROXIMITY_NOT_SPARE_CAPACITY", codes)

    def test_phase_1_sanction_does_not_imply_full_campus_deliverability(self):
        # Phase 1 demand is 26 MW, Phase 2 cumulative demand is 65 MW.
        # Add a 26 MW sanction scoped specifically to Phase 1.
        self.client.post(
            f"/api/v1/projects/{self.project_id}/power-commitments",
            json={
                "phase_id": self.phase1_id,
                "scope_type": "PHASE",
                "commitment_type": "GRID_SANCTION",
                "capacity_mw": 26.0,
                "status": "SANCTIONED",
                "verification_state": "DOCUMENTED",
            },
        )

        readiness = self.client.get(f"/api/v1/projects/{self.project_id}/phase-readiness").json()
        p1 = readiness["phases"][0]
        p2 = readiness["phases"][1]

        # Phase 1 is MET (26 MW qualifying for 26 MW demand)
        self.assertEqual(p1["power"]["demand_mw"], 26.0)
        self.assertEqual(p1["power"]["qualifying_firm_capacity_mw"], 26.0)
        self.assertEqual(p1["power"]["power_gap_mw"], 0.0)
        self.assertEqual(p1["power"]["status"], "MET")

        # Phase 2 is UNCOMMITTED (has 65 MW cumulative demand, 0 qualifying firm capacity scoped to Phase 2)
        self.assertEqual(p2["power"]["demand_mw"], 65.0)
        self.assertEqual(p2["power"]["qualifying_firm_capacity_mw"], 0.0)
        self.assertEqual(p2["power"]["power_gap_mw"], 65.0)
        self.assertEqual(p2["power"]["status"], "UNCOMMITTED")

        # Crucial check: finding PHASE_1_SANCTION_ONLY is present
        all_codes = [f["code"] for f in readiness["all_findings"]]
        self.assertIn("PHASE_1_SANCTION_ONLY", all_codes)

    def test_duplicate_counting_prevention_on_shared_evidence(self):
        # Create an EvidenceArtifact first
        reg_art = self.client.post(
            f"/api/v1/projects/{self.project_id}/evidence",
            json={
                "document_type": "UTILITY_SANCTION",
                "filename": "Sanction.pdf",
                "mime_type": "application/pdf",
                "file_size_bytes": 1000,
                "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                "confidentiality": "confidential",
                "uploaded_by": "user",
            },
        ).json()
        art_id = reg_art["id"]

        # Commit 1 references evidence artifact
        self.client.post(
            f"/api/v1/projects/{self.project_id}/power-commitments",
            json={
                "scope_type": "CAMPUS",
                "commitment_type": "GRID_SANCTION",
                "capacity_mw": 15.0,
                "status": "SANCTIONED",
                "evidence_artifact_id": art_id,
                "verification_state": "DOCUMENTED",
            },
        )
        # Commit 2 references the exact same evidence artifact
        self.client.post(
            f"/api/v1/projects/{self.project_id}/power-commitments",
            json={
                "scope_type": "CAMPUS",
                "commitment_type": "GRID_SANCTION",
                "capacity_mw": 15.0,
                "status": "SANCTIONED",
                "evidence_artifact_id": art_id,
                "verification_state": "DOCUMENTED",
            },
        )

        readiness = self.client.get(f"/api/v1/projects/{self.project_id}/phase-readiness").json()
        p1 = readiness["phases"][0]
        codes = [f["code"] for f in p1["findings"]]
        self.assertIn("DUPLICATE_EVIDENCE_REFERENCE", codes)

    def test_single_phase_readiness_endpoint(self):
        res = self.client.get(f"/api/v1/projects/{self.project_id}/phases/{self.phase1_id}/readiness")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["phase_id"], self.phase1_id)
        self.assertEqual(data["phase_sequence"], 1)
        self.assertEqual(data["power"]["demand_mw"], 26.0)

    def test_documented_extraction_evidence_not_independently_verified(self):
        # 1. Create artifact and confirmed extracted assertion (DOCUMENTED, EXTRACTED_RULE_BASED)
        reg_art = self.client.post(
            f"/api/v1/projects/{self.project_id}/evidence",
            json={
                "document_type": "UTILITY_SANCTION",
                "filename": "Sanction.pdf",
                "mime_type": "application/pdf",
                "file_size_bytes": 1000,
                "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                "confidentiality": "confidential",
                "uploaded_by": "user",
            },
        ).json()
        art_id = reg_art["id"]

        ass_res = self.client.post(
            f"/api/v1/projects/{self.project_id}/assertions",
            json={
                "field_key": "sanctioned_grid_mw",
                "value": "26.0",
                "numeric_value": 26.0,
                "unit": "MW",
                "scope_type": "CAMPUS",
                "status": "DOCUMENTED",
                "verification_method": "EXTRACTED_RULE_BASED",
                "asserted_by": "Extraction Engine",
                "evidence_links": [{"artifact_id": art_id}],
            },
        )
        self.assertEqual(ass_res.status_code, 201)
        ass_id = ass_res.json()["id"]

        # 2. Create commitment linked to this assertion, claiming "VERIFIED"
        com_res = self.client.post(
            f"/api/v1/projects/{self.project_id}/power-commitments",
            json={
                "scope_type": "CAMPUS",
                "commitment_type": "GRID_SANCTION",
                "capacity_mw": 26.0,
                "status": "SANCTIONED",
                "assertion_id": ass_id,
                "verification_state": "VERIFIED",  # Client tries to claim verified
            },
        )
        self.assertEqual(com_res.status_code, 201)
        # Invariant: system does NOT trust client; sets DOCUMENTED based on actual DB assertion
        self.assertEqual(com_res.json()["verification_state"], "DOCUMENTED")

        # 3. In readiness: verified capacity is 0.0, documented is 26.0
        readiness = self.client.get(f"/api/v1/projects/{self.project_id}/phase-readiness").json()
        p1 = readiness["phases"][0]
        self.assertEqual(p1["power"]["verified_capacity_mw"], 0.0)
        self.assertEqual(p1["power"]["documented_capacity_mw"], 26.0)
        codes = [f["code"] for f in p1["findings"]]
        self.assertIn("DOCUMENTED_NOT_INDEPENDENTLY_VERIFIED", codes)

    def test_simulated_review_exclusion(self):
        # Create assertion with simulated review
        reg_art = self.client.post(
            f"/api/v1/projects/{self.project_id}/evidence",
            json={
                "document_type": "UTILITY_SANCTION",
                "filename": "Sanction.pdf",
                "mime_type": "application/pdf",
                "file_size_bytes": 1000,
                "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                "confidentiality": "confidential",
                "uploaded_by": "user",
            },
        ).json()
        ass_res = self.client.post(
            f"/api/v1/projects/{self.project_id}/assertions",
            json={
                "field_key": "sanctioned_grid_mw",
                "value": "26.0",
                "numeric_value": 26.0,
                "unit": "MW",
                "scope_type": "CAMPUS",
                "status": "DOCUMENTED",
                "verification_method": "EXTRACTED_RULE_BASED",
                "asserted_by": "Extraction Engine",
                "evidence_links": [{"artifact_id": reg_art["id"]}],
            },
        )
        self.assertEqual(ass_res.status_code, 201)
        ass = ass_res.json()

        # Add simulated review
        rev = self.client.post(
            f"/api/v1/assertions/{ass['id']}/reviews",
            json={
                "reviewer_id": "demo_reviewer",
                "review_status": "APPROVED",
                "is_simulated": True,
                "notes": "Simulated acceptance.",
            },
        )
        self.assertEqual(rev.status_code, 200)

        # Create commitment
        com = self.client.post(
            f"/api/v1/projects/{self.project_id}/power-commitments",
            json={
                "scope_type": "CAMPUS",
                "commitment_type": "GRID_SANCTION",
                "capacity_mw": 26.0,
                "status": "SANCTIONED",
                "assertion_id": ass["id"],
                "verification_state": "VERIFIED",
            },
        ).json()
        self.assertEqual(com["verification_state"], "SIMULATED")

        # In readiness: excluded from verified capacity
        readiness = self.client.get(f"/api/v1/projects/{self.project_id}/phase-readiness").json()
        p1 = readiness["phases"][0]
        self.assertEqual(p1["power"]["verified_capacity_mw"], 0.0)
        codes = [f["code"] for f in p1["findings"]]
        self.assertIn("SIMULATED_REVIEW_EXCLUDED", codes)

    def test_duplicate_underlying_sanction_and_energized_overlap(self):
        # Commitment 1: 50 MW SANCTIONED on Gachibowli 220kV
        self.client.post(
            f"/api/v1/projects/{self.project_id}/power-commitments",
            json={
                "scope_type": "CAMPUS",
                "commitment_type": "GRID_SANCTION",
                "capacity_mw": 50.0,
                "status": "SANCTIONED",
                "utility_provider": "TGSPDCL",
                "substation_name": "Gachibowli 220kV",
                "voltage_kv": 220.0,
                "verification_state": "DOCUMENTED",
            },
        )
        # Commitment 2: 20 MW ENERGIZED on the exact same substation/grid connection
        self.client.post(
            f"/api/v1/projects/{self.project_id}/power-commitments",
            json={
                "scope_type": "CAMPUS",
                "commitment_type": "GRID_ENERGIZED",
                "capacity_mw": 20.0,
                "status": "ENERGIZED",
                "utility_provider": "TGSPDCL",
                "substation_name": "Gachibowli 220kV",
                "voltage_kv": 220.0,
                "verification_state": "DOCUMENTED",
            },
        )

        readiness = self.client.get(f"/api/v1/projects/{self.project_id}/phase-readiness").json()
        p1 = readiness["phases"][0]

        # Invariant: Sanctioned and Energized of same entitlement are deduplicated to max(50, 20) = 50 MW, NOT 70 MW!
        self.assertEqual(p1["power"]["qualifying_firm_capacity_mw"], 50.0)
        codes = [f["code"] for f in p1["findings"]]
        self.assertIn("SANCTIONED_ENERGIZED_OVERLAP_DEDUPLICATED", codes)

    def test_null_or_ambiguous_scope_validation(self):
        # 1. Scope 'PHASE' without phase_id -> 422
        res1 = self.client.post(
            f"/api/v1/projects/{self.project_id}/power-commitments",
            json={
                "scope_type": "PHASE",
                "capacity_mw": 20.0,
            },
        )
        self.assertEqual(res1.status_code, 422)
        self.assertEqual(res1.json()["detail"]["code"], "phase_id_required")

        # 2. Scope 'CAMPUS' with phase_id -> 422
        res2 = self.client.post(
            f"/api/v1/projects/{self.project_id}/power-commitments",
            json={
                "scope_type": "CAMPUS",
                "phase_id": self.phase1_id,
                "capacity_mw": 20.0,
            },
        )
        self.assertEqual(res2.status_code, 422)
        self.assertEqual(res2.json()["detail"]["code"], "ambiguous_scope")

        # 3. Scope 'SITE' without site_id -> 422
        res3 = self.client.post(
            f"/api/v1/projects/{self.project_id}/power-commitments",
            json={
                "scope_type": "SITE",
                "capacity_mw": 20.0,
            },
        )
        self.assertEqual(res3.status_code, 422)
        self.assertEqual(res3.json()["detail"]["code"], "site_id_required")

    def test_not_yet_effective_commitment_excluded(self):
        # Phase 1 commissioning date is 2027-06-01
        # Commitment effective on 2028-01-01 (effective for Phase 2, but not Phase 1)
        self.client.post(
            f"/api/v1/projects/{self.project_id}/power-commitments",
            json={
                "scope_type": "CAMPUS",
                "commitment_type": "GRID_SANCTION",
                "capacity_mw": 30.0,
                "status": "SANCTIONED",
                "effective_date": "2028-01-01",
                "verification_state": "DOCUMENTED",
            },
        )

        readiness = self.client.get(f"/api/v1/projects/{self.project_id}/phase-readiness").json()
        p1 = readiness["phases"][0]
        p2 = readiness["phases"][1]

        # For Phase 1 (2027-06-01): Not yet effective!
        self.assertEqual(p1["power"]["qualifying_firm_capacity_mw"], 0.0)
        codes_p1 = [f["code"] for f in p1["findings"]]
        self.assertIn("COMMITMENT_NOT_YET_EFFECTIVE", codes_p1)

        # For Phase 2 (2029-01-01): Effective!
        self.assertEqual(p2["power"]["qualifying_firm_capacity_mw"], 30.0)

    def test_gross_water_demand_and_unverified_reuse_flagged(self):
        # Add water commitment
        self.client.post(
            f"/api/v1/projects/{self.project_id}/water-commitments",
            json={
                "scope_type": "CAMPUS",
                "source_type": "MUNICIPAL_PIPED",
                "allocated_kld": 300.0,
                "status": "ALLOCATED",
                "authority_issuer": "HMWS&SB",
                "verification_state": "DOCUMENTED",
            },
        )
        readiness = self.client.get(f"/api/v1/projects/{self.project_id}/phase-readiness").json()
        p1 = readiness["phases"][0]
        self.assertEqual(p1["water"]["peak_summer_demand_kld"], 260.0)
        codes = [f["code"] for f in p1["findings"]]
        # Invariant: water readiness evaluates gross peak-summer demand; reuse is flagged unassessed
        self.assertIn("GROSS_DEMAND_ONLY_REUSE_UNASSESSED", codes)

    def test_client_cannot_patch_verified_state_without_verified_evidence(self):
        # Create unverified commitment
        res = self.client.post(
            f"/api/v1/projects/{self.project_id}/power-commitments",
            json={
                "scope_type": "CAMPUS",
                "commitment_type": "GRID_SANCTION",
                "capacity_mw": 25.0,
                "status": "SANCTIONED",
                "verification_state": "UNVERIFIED",
            },
        )
        self.assertEqual(res.status_code, 201)
        cid = res.json()["id"]

        # Attempt to PATCH verification_state to VERIFIED without underlying DB assertion
        patch_res = self.client.patch(
            f"/api/v1/projects/{self.project_id}/power-commitments/{cid}",
            json={"expected_revision": 1, "verification_state": "VERIFIED"},
        )
        self.assertEqual(patch_res.status_code, 200)
        # Invariant: System overrides client spoofing; remains UNVERIFIED
        self.assertEqual(patch_res.json()["verification_state"], "UNVERIFIED")

    def test_conflicting_evidence_excluded_from_firm_capacity(self):
        # Create artifact and conflicting assertion
        art = self.client.post(
            f"/api/v1/projects/{self.project_id}/evidence",
            json={
                "document_type": "UTILITY_SANCTION",
                "filename": "Conflicting_Letter.pdf",
                "mime_type": "application/pdf",
                "file_size_bytes": 1000,
                "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                "uploaded_by": "user",
            },
        ).json()

        ass = self.client.post(
            f"/api/v1/projects/{self.project_id}/assertions",
            json={
                "field_key": "sanctioned_grid_mw",
                "value": "26.0",
                "numeric_value": 26.0,
                "unit": "MW",
                "scope_type": "CAMPUS",
                "status": "CONFLICTING",  # Conflicting provenance
                "asserted_by": "Audit Engine",
                "evidence_links": [{"artifact_id": art["id"]}],
            },
        ).json()

        # Create commitment linking to conflicting assertion
        self.client.post(
            f"/api/v1/projects/{self.project_id}/power-commitments",
            json={
                "scope_type": "CAMPUS",
                "commitment_type": "GRID_SANCTION",
                "capacity_mw": 26.0,
                "status": "SANCTIONED",
                "assertion_id": ass["id"],
                "verification_state": "DOCUMENTED",
            },
        )

        readiness = self.client.get(f"/api/v1/projects/{self.project_id}/phase-readiness").json()
        p1 = readiness["phases"][0]
        # Invariant: conflicting evidence is excluded from firm capacity
        self.assertEqual(p1["power"]["qualifying_firm_capacity_mw"], 0.0)
        codes = [f["code"] for f in p1["findings"]]
        self.assertIn("CONFLICTING_EVIDENCE_EXCLUDED", codes)

    def test_overlapping_phase_and_campus_entitlement_deduplication(self):
        # Campus commitment on TGSPDCL Gachibowli 220kV (50 MW)
        self.client.post(
            f"/api/v1/projects/{self.project_id}/power-commitments",
            json={
                "scope_type": "CAMPUS",
                "commitment_type": "GRID_SANCTION",
                "capacity_mw": 50.0,
                "status": "SANCTIONED",
                "utility_provider": "TGSPDCL",
                "substation_name": "Gachibowli 220kV",
                "verification_state": "DOCUMENTED",
            },
        )
        # Phase 1 commitment on same substation with lowercase casing (20 MW)
        self.client.post(
            f"/api/v1/projects/{self.project_id}/power-commitments",
            json={
                "phase_id": self.phase1_id,
                "scope_type": "PHASE",
                "commitment_type": "GRID_SANCTION",
                "capacity_mw": 20.0,
                "status": "SANCTIONED",
                "utility_provider": "tgspdcl",
                "substation_name": "gachibowli 220kv",
                "verification_state": "DOCUMENTED",
            },
        )

        readiness = self.client.get(f"/api/v1/projects/{self.project_id}/phase-readiness").json()
        p1 = readiness["phases"][0]
        # Invariant: 50 MW campus and 20 MW phase sharing the same substation entitlement are deduplicated to 50 MW
        self.assertEqual(p1["power"]["qualifying_firm_capacity_mw"], 50.0)
        codes = [f["code"] for f in p1["findings"]]
        self.assertIn("DUPLICATE_ENTITLEMENT_DEDUPLICATED", codes)

    def test_missing_demand_returns_insufficient_data_with_null_gap(self):
        # Test unit-level evaluate_phase_power and evaluate_phase_water when demand is None/missing
        from unittest.mock import MagicMock
        from backend.app.services.readiness_engine import evaluate_phase_power, evaluate_phase_water

        mock_phase = MagicMock()
        mock_phase.id = "mock-phase-uuid"
        mock_phase.sequence = 1
        mock_phase.commissioning_date = "2027-01-01"
        mock_phase.cumulative_facility_peak_mw = None
        mock_phase.peak_summer_water_kld = None
        mock_phase.average_water_kld = None

        p_readiness, p_findings = evaluate_phase_power(
            phase=mock_phase,
            previous_phase=None,
            active_power_commitments=[],
            has_project_power_inventory=True,
            assertions_by_id={},
            artifacts_by_id={},
        )
        # Invariant: missing demand returns INSUFFICIENT_DATA with null gap
        self.assertIsNone(p_readiness.demand_mw)
        self.assertIsNone(p_readiness.power_gap_mw)
        self.assertEqual(p_readiness.status, "INSUFFICIENT_DATA")
        p_codes = [f.code for f in p_findings]
        self.assertIn("INSUFFICIENT_DATA", p_codes)

        w_readiness, w_findings = evaluate_phase_water(
            phase=mock_phase,
            active_water_commitments=[],
            has_project_water_inventory=True,
            assertions_by_id={},
            artifacts_by_id={},
        )
        self.assertIsNone(w_readiness.peak_summer_demand_kld)
        self.assertIsNone(w_readiness.water_gap_kld)
        self.assertEqual(w_readiness.status, "INSUFFICIENT_DATA")
        w_codes = [f.code for f in w_findings]
        self.assertIn("INSUFFICIENT_DATA", w_codes)

    def test_groundwater_authorization_jurisdiction_appropriate(self):
        # 1. Groundwater with State Authority (HWRA) and no issuer warning
        gw_res = self.client.post(
            f"/api/v1/projects/{self.project_id}/water-commitments",
            json={
                "scope_type": "CAMPUS",
                "source_type": "GROUNDWATER_NOC",
                "allocated_kld": 200.0,
                "status": "ALLOCATED",
                "authority_issuer": "Haryana Water Resources Authority (HWRA)",
                "allocation_reference": "HWRA/NOC/2026/044",
                "verification_state": "DOCUMENTED",
            },
        )
        self.assertEqual(gw_res.status_code, 201)
        readiness = self.client.get(f"/api/v1/projects/{self.project_id}/phase-readiness").json()
        p1 = readiness["phases"][0]
        self.assertEqual(p1["water"]["qualifying_firm_allocated_kld"], 200.0)
        codes = [f["code"] for f in p1["findings"]]
        self.assertNotIn("GROUNDWATER_AUTHORITY_UNSPECIFIED", codes)

        # 2. Groundwater without authority issuer specified triggers warning
        self.client.post(
            f"/api/v1/projects/{self.project_id}/water-commitments",
            json={
                "scope_type": "CAMPUS",
                "source_type": "GROUNDWATER_NOC",
                "allocated_kld": 50.0,
                "status": "ALLOCATED",
                "verification_state": "DOCUMENTED",
            },
        )
        readiness2 = self.client.get(f"/api/v1/projects/{self.project_id}/phase-readiness").json()
        p1_2 = readiness2["phases"][0]
        codes2 = [f["code"] for f in p1_2["findings"]]
        self.assertIn("GROUNDWATER_AUTHORITY_UNSPECIFIED", codes2)

    def test_phase_1_water_allocation_does_not_satisfy_later_phases(self):
        # Scoped specifically to Phase 1: 260 KLD
        self.client.post(
            f"/api/v1/projects/{self.project_id}/water-commitments",
            json={
                "phase_id": self.phase1_id,
                "scope_type": "PHASE",
                "source_type": "MUNICIPAL_PIPED",
                "allocated_kld": 260.0,
                "status": "ALLOCATED",
                "authority_issuer": "HMWS&SB",
                "verification_state": "DOCUMENTED",
            },
        )
        readiness = self.client.get(f"/api/v1/projects/{self.project_id}/phase-readiness").json()
        p1 = readiness["phases"][0]
        p2 = readiness["phases"][1]
        self.assertEqual(p1["water"]["status"], "MET")
        self.assertEqual(p2["water"]["status"], "UNCOMMITTED")
        all_codes = [f["code"] for f in readiness["all_findings"]]
        self.assertIn("PHASE_1_ALLOCATION_ONLY", all_codes)

    def test_deterministic_findings(self):
        # Run calculation twice and assert exact reproducibility
        r1 = self.client.get(f"/api/v1/projects/{self.project_id}/phase-readiness").json()
        r2 = self.client.get(f"/api/v1/projects/{self.project_id}/phase-readiness").json()
        self.assertEqual(r1["campus_summary"]["overall_power_status"], r2["campus_summary"]["overall_power_status"])
        self.assertEqual(len(r1["all_findings"]), len(r2["all_findings"]))
        for f1, f2 in zip(r1["all_findings"], r2["all_findings"]):
            self.assertEqual(f1["code"], f2["code"])
            self.assertEqual(f1["domain"], f2["domain"])
            self.assertEqual(f1["severity"], f2["severity"])
            self.assertEqual(f1["message"], f2["message"])
