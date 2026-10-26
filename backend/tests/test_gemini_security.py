import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from backend.app import main as api


class GeminiSecurityTests(unittest.TestCase):
    def setUp(self):
        # This endpoint needs no database; do not run the database startup lifespan.
        self.client = TestClient(api.app)
        self.addCleanup(self.client.close)
        self.provider = self.enterContext(patch.object(api.urllib.request, 'urlopen'))

    def post(self, payload):
        return self.client.post('/api/v1/mitigation-plans/gemini', json=payload)

    def test_disabled_by_default_and_server_environment_cannot_activate(self):
        for env in ({}, {'GEMINI_API_KEY': 'server-test-secret', 'ECOSITE_GEMINI_ENABLED': 'true'}):
            with self.subTest(env_configured=bool(env)), patch.dict(os.environ, env, clear=True):
                response = self.post({'constraints': 'Reduce water demand'})
                self.assertEqual(response.status_code, 503)
                self.assertIn('Standard mitigation recommendations remain accessible.', response.json()['detail'])
                self.assertNotIn('server-test-secret', response.text)
        self.provider.assert_not_called()

    def test_rejects_legacy_credentials_without_echoing_values(self):
        for field in ('api_key', 'apiKey', 'unexpected'):
            with self.subTest(field=field):
                response = self.post({field: 'private-test-secret'})
                self.assertEqual(response.status_code, 422)
                self.assertNotIn('private-test-secret', response.text)
        self.provider.assert_not_called()

    def test_validates_lengths_types_and_malformed_json_without_echo(self):
        for payload in ({'constraints': 'x' * 4001}, {'facility_id': 'x' * 201},
                        {'focus_area': 'x' * 201}, {'facility_type': 'invalid'},
                        {'constraints': {'secret': 'private-test-secret'}}):
            self.assertEqual(self.post(payload).status_code, 422)
        response = self.client.post('/api/v1/mitigation-plans/gemini', content='{"api_key":"private-test-secret"')
        self.assertEqual(response.status_code, 422)
        self.assertNotIn('private-test-secret', response.text)
        self.assertEqual(self.post({'constraints': 'x' * 17000}).status_code, 413)
        self.assertEqual(self.post({'constraints': 'x' * 4000, 'focus_area': 'x' * 200}).status_code, 503)
        self.provider.assert_not_called()

    def test_client_provider_header_cannot_activate_execution(self):
        response = self.client.post('/api/v1/mitigation-plans/gemini', json={}, headers={'x-goog-api-key': 'private-test-secret'})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('private-test-secret', response.text)
        self.provider.assert_not_called()

    def test_standard_mitigation_is_independent(self):
        response = self.client.post('/api/v1/mitigation-plans', json={'facility_type': 'data_centre'})
        self.assertEqual(response.status_code, 200)
        self.assertGreater(len(response.json()['recommendations']), 0)
        self.provider.assert_not_called()
