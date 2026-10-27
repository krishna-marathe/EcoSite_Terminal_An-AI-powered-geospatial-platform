import hashlib
import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

from alembic import command
from fastapi.testclient import TestClient
from shapely.geometry import shape

from backend.app import db, main as api, geometry
from backend.app.data.registry import seed_data_sources
from backend.app.state_scope import (
    FOCUS_STATES,
    StateScopeError,
    bundled_manifest,
    load_focus_states,
    state_scope,
)
from backend.tests.test_projects import migration_config


def square(x, y, width=0.02):
    return {
        "type": "Polygon",
        "coordinates": [[[x, y], [x + width, y], [x + width, y + width], [x, y + width], [x, y]]],
    }


PUNE = square(73.84, 18.51)
HYDERABAD = square(78.45, 17.35)
BENGALURU = square(77.58, 12.96)
CHENNAI = square(80.20, 13.00)
GUJARAT = square(72.50, 23.00)
CROSS_BORDER = square(74.4, 16.4, 0.2)


class StateBoundaryTests(unittest.TestCase):
    def test_manifest_is_pinned_and_complete(self):
        manifest = bundled_manifest()
        raw = (geometry.BOUNDARY_DIR / manifest["file"]).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), manifest["sha256"])
        self.assertEqual(manifest["version"], "9469f09")
        self.assertEqual(set(manifest["states"]), set(FOCUS_STATES))
        self.assertEqual(len(load_focus_states()), 4)

    def test_all_four_states_accept_a_polygon_inside_them(self):
        for polygon, code in (
            (PUNE, "IN-MH"),
            (HYDERABAD, "IN-TG"),
            (BENGALURU, "IN-KA"),
            (CHENNAI, "IN-TN"),
        ):
            result = state_scope(shape(polygon), code)
            self.assertEqual(result["state_code"], code)
            self.assertEqual(result["status"], "inside_focus_state")
            self.assertTrue(result["screening_only"])

    def test_polygon_in_one_focus_state_cannot_be_declared_as_another(self):
        with self.assertRaises(StateScopeError) as caught:
            state_scope(shape(PUNE), "IN-KA")
        self.assertIn("lies in Maharashtra", str(caught.exception))

    def test_polygon_outside_the_four_states_is_rejected(self):
        with self.assertRaises(StateScopeError) as caught:
            state_scope(shape(GUJARAT), "IN-MH")
        self.assertIn("outside the four-state scope", str(caught.exception))

    def test_polygon_crossing_a_state_boundary_is_rejected(self):
        with self.assertRaises(StateScopeError) as caught:
            state_scope(shape(CROSS_BORDER), "IN-MH")
        self.assertIn("crosses the Maharashtra boundary", str(caught.exception))

    def test_measure_polygon_carries_the_state_screening(self):
        measured = geometry.measure_polygon(PUNE, "IN-MH")
        screening = measured["boundary_screening"]["state_scope"]
        self.assertEqual(screening["state_name"], "Maharashtra")
        self.assertEqual(screening["version"], "9469f09")


class StateScopeApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = self.enterContext(tempfile.TemporaryDirectory())
        self.path = Path(self.temp) / "state-scope.db"
        self.enterContext(patch.object(api, "DB_PATH", self.path))
        self.enterContext(patch.object(db, "DB_PATH", self.path))
        command.upgrade(migration_config(self.path), "head")
        with closing(sqlite3.connect(self.path)) as connection, connection:
            seed_data_sources(connection)

        async def local_app(scope, receive, send):
            if scope["type"] == "http":
                scope = {**scope, "client": ("127.0.0.1", 50000)}
            await api.app(scope, receive, send)

        self.client = self.enterContext(TestClient(local_app, base_url="http://127.0.0.1"))
        project = self.client.post(
            "/api/v1/projects",
            json={"name": "State scope", "organization_label": "EcoSite", "archetype": "edge"},
        ).json()
        self.url = f"/api/v1/projects/{project['id']}/sites"

    def test_state_code_outside_the_four_states_is_rejected_by_schema(self):
        response = self.client.post(
            self.url,
            json={"name": "Gujarat", "geometry": GUJARAT, "state_code": "IN-GJ"},
        )
        self.assertEqual(response.status_code, 422, response.text)

    def test_gujarat_polygon_declared_as_maharashtra_is_rejected(self):
        response = self.client.post(
            self.url,
            json={"name": "Misdeclared", "geometry": GUJARAT, "state_code": "IN-MH"},
        )
        self.assertEqual(response.status_code, 422, response.text)
        self.assertEqual(response.json()["detail"]["code"], "state_scope")
        self.assertIn("outside the four-state scope", response.json()["detail"]["message"])

    def test_pune_polygon_is_saved_with_state_screening(self):
        response = self.client.post(
            self.url,
            json={"name": "Pune", "geometry": PUNE, "state_code": "IN-MH", "district": "Pune"},
        )
        self.assertEqual(response.status_code, 201, response.text)
        body = response.json()
        self.assertEqual(body["boundary_screening"]["state_scope"]["state_code"], "IN-MH")
        self.assertEqual(body["boundary_screening"]["state_scope"]["status"], "inside_focus_state")


if __name__ == "__main__":
    unittest.main()
