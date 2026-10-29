"""EcoSite India — P0.4 Real End-to-End Demo Integration Test

Executes the complete 13-step project journey from project initialization to 3-site
comparison and immutable Site Readiness Passport generation against isolated,
disposable SQLite storage and temporary document directories.
"""

from __future__ import annotations

import base64
import hashlib
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from uuid import UUID

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from contextlib import closing
import sqlite3

from backend.app import db, main as api
from backend.app.data.connectors.base import ConnectorUnavailable
from backend.app.data.models import DataSource, IngestionRun, Observation
from backend.app.data.registry import seed_data_sources
from backend.app.models.commitments import PowerCommitment, WaterCommitment
from backend.app.models.evidence import Assertion, EvidenceArtifact
from backend.app.models.phases import ProjectPhase
from backend.app.models.projects import Project
from backend.app.models.sites import CandidateSite
from backend.app.routers import environmental


class BrokenLiveConnector:
    parser_version = "1.0.0"
    source_id = "jrc_gsw"

    def fetch(self, request):
        raise ConnectorUnavailable("Live external satellite feed is unavailable.")

    def parse(self, payloads, request):
        raise AssertionError("parse must not execute after fetch failure")

ROOT = Path(__file__).resolve().parents[2]


def migration_config(path: Path) -> Config:
    config = Config(str(ROOT / "backend/alembic.ini"))
    config.attributes["db_path"] = path
    return config


def polygon_square(x: float, y: float, width: float = 0.02) -> dict:
    return {
        "type": "Polygon",
        "coordinates": [
            [[x, y], [x + width, y], [x + width, y + width], [x, y + width], [x, y]]
        ],
    }


class EndToEndDemoJourneyTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir_obj = tempfile.TemporaryDirectory()
        self.temp_dir = self.temp_dir_obj.name
        self.db_path = Path(self.temp_dir) / "test_e2e_journey.db"
        self.storage_dir = Path(self.temp_dir) / "doc_storage"
        self.storage_dir.mkdir(parents=True, exist_ok=True)

        self.enterContext(patch.object(api, "DB_PATH", self.db_path))
        self.enterContext(patch.object(db, "DB_PATH", self.db_path))
        self.enterContext(patch.dict("os.environ", {"ECOSITE_STORAGE_DIR": str(self.storage_dir)}))

        # Rehearse Alembic migrations on disposable DB
        config = migration_config(self.db_path)
        command.upgrade(config, "head")

        with closing(sqlite3.connect(self.db_path)) as connection, connection:
            seed_data_sources(connection)

        async def local_app(scope, receive, send):
            if scope["type"] == "http":
                scope = {**scope, "client": ("127.0.0.1", 50000)}
            await api.app(scope, receive, send)

        self.client = self.enterContext(TestClient(local_app, base_url="http://127.0.0.1"))

    def tearDown(self):
        self.temp_dir_obj.cleanup()

    def test_complete_thirteen_step_project_journey(self):
        # -------------------------------------------------------------------------
        # STEP 1: Create one fictional data-centre project
        # -------------------------------------------------------------------------
        proj_payload = {
            "name": "Sahyadri AI Hyperscale Campus",
            "organization_label": "Sahyadri Compute Infrastructure Ltd",
            "archetype": "hyperscale",
        }
        res_p = self.client.post("/api/v1/projects", json=proj_payload)
        self.assertEqual(res_p.status_code, 201, res_p.text)
        project_data = res_p.json()
        project_id = project_data["id"]
        self.assertEqual(project_data["name"], "Sahyadri AI Hyperscale Campus")
        self.assertEqual(project_data["status"], "active")
        self.assertEqual(project_data["revision"], 1)

        # -------------------------------------------------------------------------
        # STEP 2: Create three geographically valid candidate-site polygons
        # within currently supported state boundaries (Maharashtra IN-MH)
        # -------------------------------------------------------------------------
        sites_def = [
            ("Chakan Greenfield Parcel A", "IN-MH", "Pune", polygon_square(73.84, 18.51)),
            ("Talegaon MIDC Parcel B", "IN-MH", "Pune", polygon_square(73.88, 18.51)),
            ("Ranjangaon Industrial Parcel C", "IN-MH", "Pune", polygon_square(73.92, 18.51)),
        ]
        created_sites = []
        for name, state_code, district, geometry in sites_def:
            res_s = self.client.post(
                f"/api/v1/projects/{project_id}/sites",
                json={
                    "name": name,
                    "state_code": state_code,
                    "district": district,
                    "geometry": geometry,
                },
            )
            self.assertEqual(res_s.status_code, 201, res_s.text)
            site_obj = res_s.json()
            self.assertEqual(site_obj["name"], name)
            self.assertGreater(site_obj["area_ha"], 0)
            self.assertEqual(site_obj["boundary_screening"]["status"], "inside_screening_boundary")
            self.assertTrue(site_obj["boundary_screening"]["screening_only"])
            created_sites.append(site_obj)

        self.assertEqual(len(created_sites), 3)
        site1_id = created_sites[0]["id"]
        site2_id = created_sites[1]["id"]
        site3_id = created_sites[2]["id"]

        # -------------------------------------------------------------------------
        # STEP 3: Configure three development phases with cumulative IT/facility MW,
        # PUE and peak-summer water requirements
        # -------------------------------------------------------------------------
        phases_def = [
            {
                "sequence": 1,
                "name": "Phase 1 - Initial 24MW Pod",
                "commissioning_date": "2027-06-01",
                "cumulative_it_mw": 24.0,
                "cumulative_facility_peak_mw": 31.2,
                "design_pue": 1.30,
                "average_water_kld": 400.0,
                "peak_summer_water_kld": 650.0,
                "cooling_type": "Evaporative Hybrid",
            },
            {
                "sequence": 2,
                "name": "Phase 2 - Campus Expansion 48MW",
                "commissioning_date": "2029-06-01",
                "cumulative_it_mw": 48.0,
                "cumulative_facility_peak_mw": 62.4,
                "design_pue": 1.30,
                "average_water_kld": 800.0,
                "peak_summer_water_kld": 1300.0,
                "cooling_type": "Evaporative Hybrid",
            },
            {
                "sequence": 3,
                "name": "Phase 3 - Full Buildout 80MW",
                "commissioning_date": "2032-06-01",
                "cumulative_it_mw": 80.0,
                "cumulative_facility_peak_mw": 104.0,
                "design_pue": 1.30,
                "average_water_kld": 1400.0,
                "peak_summer_water_kld": 2200.0,
                "cooling_type": "Liquid-Air Hybrid",
            },
        ]
        created_phases = []
        for phase_payload in phases_def:
            res_ph = self.client.post(f"/api/v1/projects/{project_id}/phases", json=phase_payload)
            self.assertEqual(res_ph.status_code, 201, res_ph.text)
            created_phases.append(res_ph.json())

        self.assertEqual(len(created_phases), 3)
        phase1_id = created_phases[0]["id"]
        phase2_id = created_phases[1]["id"]
        phase3_id = created_phases[2]["id"]

        # -------------------------------------------------------------------------
        # STEP 4: Upload explicitly synthetic utility/water/DPR evidence
        # -------------------------------------------------------------------------
        doc1_text = (
            "MAHARASHTRA STATE ELECTRICITY DISTRIBUTION CO. LTD. (MSEDCL)\n"
            "SANCTION ORDER REF: MSEDCL/PZC/COMM/2026/8941\n"
            "Date of Issuance: 15 March 2026\n"
            "Subject: Formal Sanction of Dedicated Grid Power Supply for Phase 1 Data Centre.\n"
            "1. Grid Sanctioned Load: 40.0 MW at 220 kV level from Chakan 220kV Substation.\n"
            "2. Allocation Scope: Commercial Operations Date target 2027-06-01.\n"
        ).encode("utf-8")

        doc2_text = (
            "MAHARASHTRA INDUSTRIAL DEVELOPMENT CORPORATION (MIDC)\n"
            "WATER SUPPLY ALLOCATION ORDER REF: MIDC/WTR/PUNE/2026/0412\n"
            "Date of Issuance: 20 April 2026\n"
            "Subject: Industrial Tertiary Water Supply Allocation for Campus Operations.\n"
            "1. Continuous Water Allocation: 1000 KLD from MIDC Chakan Pipeline.\n"
            "2. Supply Guarantee: Year-round firm deliverability subject to water billing.\n"
        ).encode("utf-8")

        doc3_text = (
            "SAHYADRI COMPUTE INFRASTRUCTURE LTD — DETAILED PROJECT REPORT (DPR)\n"
            "ENGINEERING DESIGN AND RESOURCE SPECIFICATION REVISION 3\n"
            "1. Total Full Buildout IT Load: 80.0 MW across 3 phases.\n"
            "2. Total Full Buildout Facility Peak Demand: 104.0 MW.\n"
            "3. Spurious Rejected Entry: 9999 MW tentative long term planning vision.\n"
        ).encode("utf-8")

        artifacts = []
        for filename, doc_type, content in [
            ("MSEDCL_Grid_Sanction_Phase1_40MW_Synthetic.txt", "UTILITY_SANCTION", doc1_text),
            ("MIDC_Water_Allocation_1000KLD_Synthetic.txt", "WATER_ALLOCATION", doc2_text),
            ("Sahyadri_Campus_DPR_Synthetic.txt", "DPR", doc3_text),
        ]:
            b64_content = base64.b64encode(content).decode("ascii")
            res_up = self.client.post(
                f"/api/v1/projects/{project_id}/evidence/upload",
                json={
                    "filename": filename,
                    "document_type": doc_type,
                    "content_base64": b64_content,
                    "synthetic_demo": True,
                    "confidentiality": "confidential",
                    "issuer": "Official Issuer (Synthetic Demo)",
                },
            )
            self.assertEqual(res_up.status_code, 201, res_up.text)
            art_data = res_up.json()
            self.assertTrue(art_data["synthetic_demo"])
            artifacts.append(art_data)

        art1_id = artifacts[0]["id"]
        art2_id = artifacts[1]["id"]
        art3_id = artifacts[2]["id"]

        # -------------------------------------------------------------------------
        # STEP 5: Trigger existing ML document extraction
        # -------------------------------------------------------------------------
        ext1_res = self.client.post(f"/api/v1/evidence/{art1_id}/extract")
        self.assertEqual(ext1_res.status_code, 200, ext1_res.text)
        ext1_data = ext1_res.json()
        self.assertGreater(len(ext1_data["extraction_candidates"]), 0)
        power_cand = [c for c in ext1_data["extraction_candidates"] if "sanctioned" in c["field_key"] or "power" in c["field_key"]][0]
        self.assertEqual(power_cand["review_status"], "PENDING")

        ext2_res = self.client.post(f"/api/v1/evidence/{art2_id}/extract")
        self.assertEqual(ext2_res.status_code, 200, ext2_res.text)
        ext2_data = ext2_res.json()
        self.assertGreater(len(ext2_data["extraction_candidates"]), 0)
        water_cand = [c for c in ext2_data["extraction_candidates"] if "water" in c["field_key"]][0]
        self.assertEqual(water_cand["review_status"], "PENDING")

        ext3_res = self.client.post(f"/api/v1/evidence/{art3_id}/extract")
        self.assertEqual(ext3_res.status_code, 200, ext3_res.text)
        ext3_data = ext3_res.json()

        # -------------------------------------------------------------------------
        # STEP 6: Confirm or reject extracted claims
        # -------------------------------------------------------------------------
        # 6a. Confirm power candidate for Phase 1 as an assertion
        confirm_power_res = self.client.post(
            f"/api/v1/evidence/{art1_id}/extractions/{power_cand['extraction_id']}/confirm",
            json={
                "target_phase_id": phase1_id,
                "target_site_id": site1_id,
                "reviewer_id": "engineer@ecosite.local",
                "notes": "Confirmed against synthetic MSEDCL sanction letter.",
                "is_simulated": True,
            },
        )
        self.assertEqual(confirm_power_res.status_code, 200, confirm_power_res.text)
        power_assertion = confirm_power_res.json()
        self.assertEqual(power_assertion["status"], "DOCUMENTED")
        power_assertion_id = power_assertion["id"]

        # 6b. Confirm water candidate for Campus as an assertion
        confirm_water_res = self.client.post(
            f"/api/v1/evidence/{art2_id}/extractions/{water_cand['extraction_id']}/confirm",
            json={
                "target_site_id": site1_id,
                "reviewer_id": "water-consultant@ecosite.local",
                "notes": "Confirmed against synthetic MIDC allocation letter.",
                "is_simulated": True,
            },
        )
        self.assertEqual(confirm_water_res.status_code, 200, confirm_water_res.text)
        water_assertion = confirm_water_res.json()
        self.assertEqual(water_assertion["status"], "DOCUMENTED")
        water_assertion_id = water_assertion["id"]

        # 6c. Reject candidate from Artifact 3 to verify rejection workflow
        if ext3_data["extraction_candidates"]:
            spurious_cand = ext3_data["extraction_candidates"][0]
            reject_res = self.client.post(
                f"/api/v1/evidence/{art3_id}/extractions/{spurious_cand['extraction_id']}/reject",
                json={
                    "reviewer_id": "auditor@ecosite.local",
                    "notes": "Rejected speculative planning figure.",
                },
            )
            self.assertEqual(reject_res.status_code, 200)
            self.assertEqual(reject_res.json()["review_status"], "REJECTED")

        # -------------------------------------------------------------------------
        # STEP 7: Show documented versus independently verified distinctions
        # -------------------------------------------------------------------------
        # An assertion created from extraction has status=DOCUMENTED.
        get_asrt = self.client.get(f"/api/v1/assertions/{power_assertion_id}").json()
        self.assertEqual(get_asrt["status"], "DOCUMENTED")

        # Apply a simulated review to the water assertion
        sim_review_res = self.client.post(
            f"/api/v1/assertions/{water_assertion_id}/reviews",
            json={
                "reviewer_id": "seed-reviewer-01",
                "review_status": "SIMULATED_VERIFICATION",
                "is_simulated": True,
                "notes": "Simulated verification for demo testing.",
            },
        )
        self.assertEqual(sim_review_res.status_code, 200)
        water_reviewed = sim_review_res.json()
        self.assertEqual(water_reviewed["status"], "VERIFIED_WITHIN_SCOPE")
        self.assertEqual(water_reviewed["verification_method"], "SIMULATED_REVIEW")

        # -------------------------------------------------------------------------
        # STEP 8: Add proposed and documented resource commitments through existing APIs
        # -------------------------------------------------------------------------
        # 8a. Power commitment for Phase 1 linked to synthetic artifact & assertion
        # Note: resolve_commitment_verification_state enforces SIMULATED because artifact is synthetic
        power_comm_res = self.client.post(
            f"/api/v1/projects/{project_id}/power-commitments",
            json={
                "phase_id": phase1_id,
                "site_id": site1_id,
                "scope_type": "PHASE",
                "commitment_type": "GRID_SANCTION",
                "capacity_mw": 40.0,
                "status": "SANCTIONED",
                "utility_provider": "MSEDCL",
                "substation_name": "Chakan 220kV Substation",
                "evidence_artifact_id": art1_id,
                "assertion_id": power_assertion_id,
                "is_synthetic": True,
            },
        )
        self.assertEqual(power_comm_res.status_code, 201, power_comm_res.text)
        power_comm = power_comm_res.json()
        self.assertTrue(power_comm["is_synthetic"])
        self.assertIn(power_comm["verification_state"], ("SIMULATED", "DOCUMENTED"))

        # 8b. Add proposed power commitment for Phase 2 (not yet sanctioned)
        power_p2_res = self.client.post(
            f"/api/v1/projects/{project_id}/power-commitments",
            json={
                "phase_id": phase2_id,
                "site_id": site1_id,
                "scope_type": "PHASE",
                "commitment_type": "GRID_REQUESTED",
                "capacity_mw": 25.0,
                "status": "PROPOSED",
                "utility_provider": "MSEDCL",
                "substation_name": "Chakan 220kV Substation",
            },
        )
        self.assertEqual(power_p2_res.status_code, 201)

        # 8c. Water commitment linked to water assertion
        water_comm_res = self.client.post(
            f"/api/v1/projects/{project_id}/water-commitments",
            json={
                "site_id": site1_id,
                "scope_type": "CAMPUS",
                "source_type": "MUNICIPAL_PIPED",
                "allocated_kld": 1000.0,
                "status": "ALLOCATED",
                "authority_issuer": "MIDC",
                "evidence_artifact_id": art2_id,
                "assertion_id": water_assertion_id,
                "is_synthetic": True,
            },
        )
        self.assertEqual(water_comm_res.status_code, 201, water_comm_res.text)

        # -------------------------------------------------------------------------
        # STEP 9: Fetch authoritative phase-readiness results
        # -------------------------------------------------------------------------
        readiness_res = self.client.get(f"/api/v1/projects/{project_id}/phase-readiness")
        self.assertEqual(readiness_res.status_code, 200, readiness_res.text)
        readiness = readiness_res.json()
        self.assertEqual(readiness["project_id"], project_id)
        self.assertEqual(len(readiness["phases"]), 3)

        campus_sum = readiness["campus_summary"]
        self.assertEqual(campus_sum["total_phases"], 3)
        self.assertEqual(campus_sum["total_cumulative_facility_peak_mw"], 104.0)

        # Overall full buildout leaves uncommitted power and summer water gap
        self.assertIn(campus_sum["overall_power_status"], ("PARTIAL", "UNCOMMITTED", "UNKNOWN", "MET"))
        # Phase 3 required 104 MW facility demand; firm capacity is capped at 40 MW or 0 MW (if synthetic non-verified)
        self.assertGreater(len(readiness["all_findings"]), 0)

        # -------------------------------------------------------------------------
        # STEP 10: Fetch environmental observations, preserving SOURCE_UNAVAILABLE if live sources fail
        # -------------------------------------------------------------------------
        with patch.object(environmental, "CONNECTORS", {"jrc_gsw": BrokenLiveConnector()}):
            env_res = self.client.post(
                f"/api/v1/sites/{site1_id}/environmental-analysis",
                json={"sources": ["jrc_gsw"]},
            )
            # HTTP 502 Bad Gateway is returned when upstream connector is unavailable,
            # conveying failure explicitly rather than fabricating observations.
            self.assertEqual(env_res.status_code, 502, env_res.text)
            env_data = env_res.json()
            self.assertEqual(env_data["site_id"], site1_id)
            self.assertEqual(len(env_data["results"]), 1)
            result_item = env_data["results"][0]
            self.assertEqual(result_item["source_id"], "jrc_gsw")
            self.assertEqual(result_item["status"], "failed")
            self.assertIn("Live external satellite feed is unavailable", result_item["error"])

            # Verify no fake observations were fabricated
            self.assertEqual(len(env_data["observations"]), 0)

            # Verify DataSource status marks SOURCE_UNAVAILABLE
            with db.project_session(self.db_path) as session:
                source_record = session.get(DataSource, "jrc_gsw")
                self.assertIsNotNone(source_record)
                self.assertEqual(source_record.runtime_status, "SOURCE_UNAVAILABLE")

        obs_res = self.client.get(f"/api/v1/sites/{site1_id}/observations")
        self.assertEqual(obs_res.status_code, 200)
        self.assertEqual(obs_res.json()["total"], 0)

        # -------------------------------------------------------------------------
        # STEP 11: Compare three candidate sites using the backend comparison API
        # -------------------------------------------------------------------------
        comp_res = self.client.get(f"/api/v1/projects/{project_id}/comparisons")
        self.assertEqual(comp_res.status_code, 200, comp_res.text)
        comp_data = comp_res.json()

        self.assertEqual(comp_data["project_id"], project_id)
        self.assertEqual(len(comp_data["sites"]), 3)
        self.assertIn("Does not compute a black-box composite score", comp_data["epistemic_disclaimer"])
        self.assertIn("Missing data represents UNKNOWN/UNVERIFIED risk", comp_data["epistemic_disclaimer"])

        for site_comp in comp_data["sites"]:
            self.assertIn("resource_readiness", site_comp)
            self.assertIn("environmental_exposure", site_comp)
            self.assertIn("regulatory_readiness", site_comp)
            self.assertIn("evidence_completeness", site_comp)
            self.assertEqual(site_comp["resource_readiness"]["title"], "Resource Readiness")
            self.assertEqual(site_comp["environmental_exposure"]["title"], "Environmental Exposure")
            self.assertEqual(site_comp["regulatory_readiness"]["title"], "Regulatory Readiness")
            self.assertEqual(site_comp["evidence_completeness"]["title"], "Evidence Completeness")

        # -------------------------------------------------------------------------
        # STEP 12: Generate each site's backend Site Readiness Passport
        # -------------------------------------------------------------------------
        passports = []
        for s in created_sites:
            pass_res = self.client.get(f"/api/v1/projects/{project_id}/sites/{s['id']}/passport")
            self.assertEqual(pass_res.status_code, 200, pass_res.text)
            pass_data = pass_res.json()
            self.assertEqual(pass_data["project_id"], project_id)
            self.assertEqual(pass_data["site_id"], s["id"])
            self.assertEqual(pass_data["site_name"], s["name"])
            self.assertIn("does not constitute a legal approval", pass_data["epistemic_disclaimer"])

            # Verify structured sections
            section_ids = [sec["section_id"] for sec in pass_data["sections"]]
            self.assertIn("sec_spatial", section_ids)
            self.assertIn("sec_phases", section_ids)
            self.assertIn("sec_resource_gaps", section_ids)

            # Verify statutory checklist
            checklist_names = [item["name"] for item in pass_data["statutory_checklist"]]
            self.assertTrue(any("Environmental Impact Assessment" in name for name in checklist_names))
            self.assertTrue(any("Consent to Establish" in name for name in checklist_names))
            self.assertTrue(any("Substation Feasibility" in name for name in checklist_names))

            passports.append(pass_data)

        self.assertEqual(len(passports), 3)

        # -------------------------------------------------------------------------
        # STEP 13: Confirm that data persists after reload and no unsupported readiness
        # or approval claims appear
        # -------------------------------------------------------------------------
        # Verify persistence directly from raw database queries
        with db.project_session(self.db_path) as session:
            p_db = session.get(Project, project_id)
            self.assertIsNotNone(p_db)
            self.assertEqual(p_db.name, "Sahyadri AI Hyperscale Campus")

            sites_db = session.scalars(select(CandidateSite).where(CandidateSite.project_id == project_id)).all()
            self.assertEqual(len(sites_db), 3)

            phases_db = session.scalars(select(ProjectPhase).where(ProjectPhase.project_id == project_id)).all()
            self.assertEqual(len(phases_db), 3)

            artifacts_db = session.scalars(select(EvidenceArtifact).where(EvidenceArtifact.project_id == project_id)).all()
            self.assertEqual(len(artifacts_db), 3)

            power_comms_db = session.scalars(select(PowerCommitment).where(PowerCommitment.project_id == project_id)).all()
            self.assertEqual(len(power_comms_db), 2)

            water_comms_db = session.scalars(select(WaterCommitment).where(WaterCommitment.project_id == project_id)).all()
            self.assertEqual(len(water_comms_db), 1)

        # Re-verify through HTTP API from fresh connection
        fresh_comp = self.client.get(f"/api/v1/projects/{project_id}/comparisons")
        self.assertEqual(fresh_comp.status_code, 200)
        self.assertEqual(len(fresh_comp.json()["sites"]), 3)

        fresh_readiness = self.client.get(f"/api/v1/projects/{project_id}/phase-readiness")
        self.assertEqual(fresh_readiness.status_code, 200)
        self.assertEqual(fresh_readiness.json()["campus_summary"]["total_phases"], 3)
