import unittest
from fastapi.testclient import TestClient
from backend.app import main as api


class EnvironmentalLayerTests(unittest.TestCase):
    def test_backend_exposes_unavailable_metadata_not_observation_geometry(self):
        client = TestClient(api.app)
        self.addCleanup(client.close)
        response = client.get('/api/v1/environmental-layers')
        self.assertEqual(response.status_code, 200)
        layers = response.json()
        self.assertEqual(len(layers), 4)
        for layer in layers:
            self.assertFalse(layer['isAvailable'])
            self.assertEqual(layer['dataStatus'], 'unavailable')
            self.assertNotIn('geometry', layer)
            self.assertNotIn('features', layer)
