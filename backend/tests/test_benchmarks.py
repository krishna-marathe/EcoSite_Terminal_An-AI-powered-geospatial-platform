"""Tests for official data center industry benchmarks API."""
from __future__ import annotations

import unittest
from fastapi.testclient import TestClient

from backend.app import main as api


class IndustryBenchmarkTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(api.app)

    def test_list_all_benchmarks_covers_six_operators(self):
        response = self.client.get("/api/v1/benchmarks")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertGreaterEqual(data["total"], 12)
        operators = set(data["by_operator"].keys())
        expected_operators = {
            "Nxtra by Airtel",
            "STT GDC India",
            "CtrlS",
            "Google",
            "Microsoft",
            "AWS",
        }
        self.assertTrue(expected_operators.issubset(operators))

    def test_every_benchmark_carries_strict_provenance(self):
        response = self.client.get("/api/v1/benchmarks")
        self.assertEqual(response.status_code, 200)
        items = response.json()["items"]

        for item in items:
            self.assertTrue(item["id"])
            self.assertTrue(item["operator"])
            self.assertIsInstance(item["reporting_year"], int)
            self.assertTrue(item["metric"])
            self.assertTrue(item["unit"])
            self.assertIn(item["status"], {"PUBLISHED", "UNAVAILABLE", "ESTIMATED"})
            self.assertTrue(item["reporting_scope"])
            self.assertTrue(item["boundary_notes"])
            self.assertIsInstance(item["is_portfolio_average"], bool)
            self.assertTrue(item["document_title"])
            self.assertTrue(item["source_url"], f"{item['id']} missing source URL")
            self.assertTrue(item["page_or_reference"], f"{item['id']} missing page reference")

    def test_filter_by_operator(self):
        response = self.client.get("/api/v1/benchmarks?operator=Nxtra")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["total"], 2)
        for item in data["items"]:
            self.assertEqual(item["operator"], "Nxtra by Airtel")

    def test_filter_by_metric(self):
        response = self.client.get("/api/v1/benchmarks?metric=wue_liters_per_kwh")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["total"], 3)
        operators = {item["operator"] for item in data["items"]}
        self.assertEqual(operators, {"Google", "AWS", "CtrlS"})

    def test_unavailable_benchmark_preserved_without_fabrication(self):
        # CtrlS does not publicly audit numerical fleet WUE
        response = self.client.get("/api/v1/benchmarks/bmk-ctrls-wue-2024")
        self.assertEqual(response.status_code, 200)
        item = response.json()
        self.assertEqual(item["status"], "UNAVAILABLE")
        self.assertIsNone(item["value"])
        self.assertIn("refuses to fabricate", item["quality_notes"])

    def test_portfolio_average_is_explicitly_flagged(self):
        # Google fleet average PUE is a global portfolio average
        response = self.client.get("/api/v1/benchmarks/bmk-google-pue-2023")
        self.assertEqual(response.status_code, 200)
        item = response.json()
        self.assertEqual(item["value"], 1.10)
        self.assertTrue(item["is_portfolio_average"])
        self.assertIn("Must not be used as an assumed site-specific observation", item["quality_notes"])

    def test_get_benchmark_not_found(self):
        response = self.client.get("/api/v1/benchmarks/non-existent-benchmark-id")
        self.assertEqual(response.status_code, 404)
        error = response.json()
        self.assertEqual(error["detail"]["code"], "benchmark_not_found")

