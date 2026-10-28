from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import UUID

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

from backend.app import db, main as api


ROOT = Path(__file__).resolve().parents[2]


def migration_config(path: Path) -> Config:
    config = Config(str(ROOT / "backend/alembic.ini"))
    config.attributes["db_path"] = path
    return config


class TestComparisonAndPassportEndpoints(unittest.TestCase):
    def setUp(self):
        self.temp_dir_obj = tempfile.TemporaryDirectory()
        self.temp_dir = self.temp_dir_obj.name
        self.db_path = Path(self.temp_dir) / "test_comparison.db"

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

    def tearDown(self):
        self.temp_dir_obj.cleanup()

    def test_comparison_endpoint_empty_and_populated(self):
        # Create a project
        proj_res = self.client.post("/api/v1/projects", json={
            "name": "Telangana Hyperscale Campus",
            "organization_label": "Hyperscale Infra Ltd",
            "archetype": "hyperscale"
        })
        self.assertEqual(proj_res.status_code, 201)
        project_id = proj_res.json()["id"]

        # Comparison with no sites
        comp_res = self.client.get(f"/api/v1/projects/{project_id}/comparisons")
        self.assertEqual(comp_res.status_code, 200)
        data = comp_res.json()
        self.assertEqual(data["project_id"], project_id)
        self.assertEqual(len(data["sites"]), 0)
        self.assertIn("Missing data represents UNKNOWN/UNVERIFIED risk", data["epistemic_disclaimer"])

        # Create two candidate sites
        site1_res = self.client.post(f"/api/v1/projects/{project_id}/sites", json={
            "name": "Shamshabad Greenfield",
            "state_code": "IN-TG",
            "district": "Rangareddy",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[78.4, 17.2], [78.45, 17.2], [78.45, 17.25], [78.4, 17.25], [78.4, 17.2]]]
            }
        })
        self.assertEqual(site1_res.status_code, 201)
        site1_id = site1_res.json()["id"]

        site2_res = self.client.post(f"/api/v1/projects/{project_id}/sites", json={
            "name": "Medchal Industrial",
            "state_code": "IN-TG",
            "district": "Medchal",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[78.5, 17.5], [78.55, 17.5], [78.55, 17.55], [78.5, 17.55], [78.5, 17.5]]]
            }
        })
        self.assertEqual(site2_res.status_code, 201)
        site2_id = site2_res.json()["id"]

        # Comparison with sites
        comp_res2 = self.client.get(f"/api/v1/projects/{project_id}/comparisons")
        self.assertEqual(comp_res2.status_code, 200)
        data2 = comp_res2.json()
        self.assertEqual(len(data2["sites"]), 2)
        
        # Check independent dimensions structure
        site_eval = data2["sites"][0]
        self.assertEqual(site_eval["resource_readiness"]["title"], "Resource Readiness")
        self.assertEqual(site_eval["environmental_exposure"]["title"], "Environmental Exposure")
        self.assertEqual(site_eval["regulatory_readiness"]["title"], "Regulatory Readiness")
        self.assertEqual(site_eval["evidence_completeness"]["title"], "Evidence Completeness")

    def test_passport_generation(self):
        # Create project and site
        proj_res = self.client.post("/api/v1/projects", json={
            "name": "Navi Mumbai AI Hub",
            "organization_label": "State Data Grid",
            "archetype": "enterprise"
        })
        self.assertEqual(proj_res.status_code, 201)
        project_id = proj_res.json()["id"]

        site_res = self.client.post(f"/api/v1/projects/{project_id}/sites", json={
            "name": "Airoli MIDC Site",
            "state_code": "IN-MH",
            "district": "Thane",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[73.0, 19.1], [73.05, 19.1], [73.05, 19.15], [73.0, 19.15], [73.0, 19.1]]]
            }
        })
        self.assertEqual(site_res.status_code, 201)
        site_id = site_res.json()["id"]

        # Add a campus phase
        phase_res = self.client.post(f"/api/v1/projects/{project_id}/phases", json={
            "sequence": 1,
            "name": "Phase 1 - Initial Data Hall",
            "commissioning_date": "2027-01-01",
            "cumulative_it_mw": 20.0,
            "cumulative_facility_peak_mw": 26.0,
            "design_pue": 1.3,
            "average_water_kld": 150.0,
            "peak_summer_water_kld": 250.0,
            "cooling_type": "hybrid_closed_loop"
        })
        self.assertEqual(phase_res.status_code, 201)

        # Get passport
        passport_res = self.client.get(f"/api/v1/projects/{project_id}/sites/{site_id}/passport")
        self.assertEqual(passport_res.status_code, 200)
        passport = passport_res.json()
        self.assertEqual(passport["project_id"], project_id)
        self.assertEqual(passport["site_id"], site_id)
        self.assertTrue(passport["passport_id"].startswith("pass-"))
        self.assertEqual(passport["site_name"], "Airoli MIDC Site")
        self.assertEqual(passport["state_code"], "IN-MH")

        # Sections check
        section_titles = [s["title"] for s in passport["sections"]]
        self.assertIn("Spatial & Boundary Screening", section_titles)
        self.assertIn("Campus Lifecycle & Phasing Progression", section_titles)
        self.assertIn("Deliverability & Deficit Balance", section_titles)
        self.assertEqual(len(passport["statutory_checklist"]), 4)
        self.assertIn("preliminary screening only", passport["epistemic_disclaimer"])

    def test_comparison_404_handling(self):
        # Unknown project comparison
        res = self.client.get(f"/api/v1/projects/{UUID(int=12345)}/comparisons")
        self.assertEqual(res.status_code, 404)

        # Unknown site passport
        res = self.client.get(f"/api/v1/projects/{UUID(int=12345)}/sites/{UUID(int=67890)}/passport")
        self.assertEqual(res.status_code, 404)


if __name__ == "__main__":
    unittest.main()
