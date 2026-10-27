import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

from backend.app import db, main as api

ROOT = Path(__file__).resolve().parents[2]
P0_IDS = {"jrc_gsw", "nasa_srtmgl1", "copernicus_stac", "cgwb_assessment", "developer_evidence"}


def migration_config(path):
    config = Config(str(ROOT / "backend/alembic.ini"))
    config.attributes["db_path"] = path
    return config


class DataSourceTests(unittest.TestCase):
    def setUp(self):
        self.temp = self.enterContext(tempfile.TemporaryDirectory())
        self.path = Path(self.temp) / "data-sources.db"
        self.enterContext(patch.object(api, "DB_PATH", self.path))
        self.enterContext(patch.object(db, "DB_PATH", self.path))
        command.upgrade(migration_config(self.path), "head")
        self.client = self.enterContext(TestClient(api.app))

    def registry(self):
        response = self.client.get("/api/v1/data-sources")
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_registry_lists_every_roadmap_source(self):
        body = self.registry()
        self.assertEqual(body["total"], 14)
        self.assertEqual(body["by_priority"], {"P0": 5, "P1": 6, "P2": 3})
        self.assertEqual({source["id"] for source in body["items"] if source["priority"] == "P0"}, P0_IDS)

    def test_every_source_carries_licence_resolution_and_maturity(self):
        for source in self.registry()["items"]:
            for field in (
                "provider",
                "dataset_name",
                "dataset_version",
                "licence",
                "attribution",
                "resolution",
                "temporal_resolution",
                "coverage",
                "observation_period",
                "join_key_or_geometry",
                "test_status",
                "runtime_status",
                "fallback",
                "owner",
                "next_action",
                "quality_notes",
            ):
                self.assertTrue(source[field], f"{source['id']} is missing {field}")
            self.assertIn(source["test_status"], {"DISCOVERED", "ACCESS_TESTED", "PROCESSING_TESTED", "VALIDATED", "INTEGRATED"})
            self.assertIn(source["runtime_status"], {"NOT_CONNECTED", "CONNECTED", "STALE", "SOURCE_UNAVAILABLE"})

    def test_no_source_overstates_its_maturity(self):
        items = {source["id"]: source for source in self.registry()["items"]}
        # JRC and STAC were each verified against a real Pune polygon on 2026-10-27,
        # so they may claim PROCESSING_TESTED. This deployment has not scheduled
        # either connector, so runtime_status remains NOT_CONNECTED.
        for source_id in ("jrc_gsw", "copernicus_stac"):
            self.assertEqual(items[source_id]["test_status"], "PROCESSING_TESTED")
            self.assertEqual(items[source_id]["runtime_status"], "NOT_CONNECTED")
        for source_id, source in items.items():
            if source_id in {"jrc_gsw", "copernicus_stac"}:
                continue
            self.assertNotIn(source["test_status"], {"PROCESSING_TESTED", "VALIDATED", "INTEGRATED"})
        for source in items.values():
            self.assertEqual(source["runtime_status"], "NOT_CONNECTED")
        # No source may claim validation or dashboard integration yet.
        self.assertFalse(
            {source_id for source_id, source in items.items() if source["test_status"] in {"VALIDATED", "INTEGRATED"}}
        )

    def test_scope_is_the_four_focus_states(self):
        body = self.registry()
        self.assertEqual(
            body["scope"]["states"],
            {
                "IN-MH": "Maharashtra",
                "IN-TG": "Telangana",
                "IN-KA": "Karnataka",
                "IN-TN": "Tamil Nadu",
            },
        )
        self.assertTrue(body["scope"]["screening_only"])
        scope = self.client.get("/api/v1/data-sources/scope")
        self.assertEqual(scope.status_code, 200, scope.text)
        self.assertEqual(scope.json()["boundary_version"], "9469f09")

    def test_single_source_returns_detail_and_empty_runs(self):
        response = self.client.get("/api/v1/data-sources/jrc_gsw")
        self.assertEqual(response.status_code, 200, response.text)
        source = response.json()
        self.assertEqual(source["priority"], "P0")
        self.assertEqual(source["access_method"], "download")
        self.assertEqual(source["recent_runs"], [])
        self.assertIn("flood return-period", source["quality_notes"])

    def test_unknown_source_returns_404(self):
        response = self.client.get("/api/v1/data-sources/not-a-source")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"]["code"], "data_source_not_found")

    def test_filters_do_not_hide_registry_totals(self):
        response = self.client.get("/api/v1/data-sources?priority=P0")
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["total"], 5)
        self.assertEqual(body["by_priority"], {"P0": 5, "P1": 6, "P2": 3})
        self.assertTrue(all(source["priority"] == "P0" for source in body["items"]))

    def test_seed_is_idempotent(self):
        api.startup()
        api.startup()
        with closing(sqlite3.connect(self.path)) as connection:
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM data_sources").fetchone()[0], 14)
        self.assertEqual(self.registry()["total"], 14)

    def test_list_official_documents(self):
        response = self.client.get("/api/v1/data-sources/documents")
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertGreaterEqual(body["total"], 8)
        self.assertEqual(body["focus_states"], ["Telangana", "Maharashtra", "Karnataka", "Tamil Nadu"])
        doc_ids = {d["id"] for d in body["documents"]}
        self.assertIn("niti_aayog_framework_2026", doc_ids)
        self.assertIn("telangana_dc_policy", doc_ids)
        self.assertIn("maharashtra_it_ites_policy_2023", doc_ids)
        self.assertIn("karnataka_dc_policy_2022_2027", doc_ids)
        self.assertIn("tamil_nadu_dc_policy_2021", doc_ids)
        self.assertIn("cea_co2_baseline_v22_guide", doc_ids)

    def test_filter_official_documents_by_state(self):
        response = self.client.get("/api/v1/data-sources/documents?state=Telangana")
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        for doc in body["documents"]:
            self.assertIn("Telangana", doc["jurisdiction"])

    def test_get_official_document_detail_and_download(self):
        detail_resp = self.client.get("/api/v1/data-sources/documents/niti_aayog_framework_2026")
        self.assertEqual(detail_resp.status_code, 200, detail_resp.text)
        doc = detail_resp.json()
        self.assertEqual(doc["title"], "Data Centre Evaluation Framework to Help States Plan for Sustainable Growth")
        self.assertTrue(doc["file_available"])
        self.assertIn("pillar_1_power", doc["key_clauses"])

        download_resp = self.client.get("/api/v1/data-sources/documents/niti_aayog_framework_2026/download")
        self.assertEqual(download_resp.status_code, 200)
        self.assertEqual(download_resp.headers["content-type"], "application/pdf")
        self.assertGreater(len(download_resp.content), 1000000)

    def test_state_regulatory_packs_endpoint(self):
        response = self.client.get("/api/v1/data-sources/state-packs")
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["focus_states"], ["Telangana", "Maharashtra", "Karnataka", "Tamil Nadu"])
        for state_key in ("telangana", "maharashtra", "karnataka", "tamil_nadu"):
            self.assertIn(state_key, body["packs"])
            pack = body["packs"][state_key]
            self.assertTrue(pack["primary_data_centre_clusters"])
            self.assertTrue(pack["key_authorities"])
            self.assertTrue(pack["siting_and_infrastructure_rules"])

        single_resp = self.client.get("/api/v1/data-sources/state-packs/maharashtra")
        self.assertEqual(single_resp.status_code, 200)
        self.assertEqual(single_resp.json()["state_name"], "Maharashtra")

    def test_environmental_datasets_endpoint(self):
        response = self.client.get("/api/v1/data-sources/environmental")
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertIn("groundwater_cgwb", body)
        self.assertIn("air_quality_cpcb", body)
        self.assertIn("carbon_factors_cea", body)
        self.assertIn("terrain_and_elevation_srtm", body)
        self.assertIn("water_tariffs_and_allocations", body)

        cea = body["carbon_factors_cea"]
        self.assertEqual(cea["version"], "22.0 (August 2026)")
        self.assertEqual(cea["fiscal_year"], "2025-26")
        factors = cea["national_grid_factors"]
        self.assertAlmostEqual(factors["weighted_average_tco2_per_mwh"], 0.675)
        self.assertAlmostEqual(factors["operating_margin_om_tco2_per_mwh"], 0.963)
        self.assertAlmostEqual(factors["build_margin_bm_tco2_per_mwh"], 0.446)
        self.assertAlmostEqual(factors["combined_margin_cm_tco2_per_mwh"], 0.705)
        # CEA v22.0 publishes one unified Indian grid; regional factors are not current.
        self.assertNotIn("regional_grid_factors", cea)
        self.assertIn("unified Indian grid", cea["grid_scope"])

        # The national factors are traceable to the bundled workbook by cell reference.
        cea_provenance = cea["provenance"]
        self.assertEqual(cea_provenance["verification_status"], "VERIFIED_AGAINST_BUNDLED_SOURCE")
        self.assertEqual(cea_provenance["worksheet"], "Results")
        self.assertEqual(cea_provenance["cells"]["weighted_average_tco2_per_mwh"]["cell"], "AA14")
        self.assertEqual(len(cea_provenance["source_sha256"]), 64)

        # The payload as a whole is still not ground truth: CGWB, CPCB and the
        # water tariffs have no stored source table, page or station code.
        provenance = body["provenance"]
        self.assertEqual(provenance["verification_status"], "UNVERIFIED_REFERENCE_VALUES")
        self.assertFalse(provenance["used_in_scoring"])
        self.assertEqual(provenance["verified_sections"], ["carbon_factors_cea"])
        self.assertIn("used in any score", provenance["note"])


if __name__ == "__main__":
    unittest.main()
