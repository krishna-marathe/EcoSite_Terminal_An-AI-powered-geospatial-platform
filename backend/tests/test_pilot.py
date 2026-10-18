import copy
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from backend.app import main as api


class PilotTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db = patch.object(api, 'DB_PATH', Path(self.temp.name) / 'test.db')
        self.db.start()
        self.env = patch.dict(os.environ, {'ECOSITE_INGESTION_KEY': 'test-secret'})
        self.env.start()
        self.client = TestClient(api.app)
        self.client.__enter__()
        self.headers = {'X-Ingestion-Key': 'test-secret'}

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.env.stop()
        self.db.stop()
        self.temp.cleanup()

    def record(self, identifier='new-facility'):
        record = copy.deepcopy(api.PILOT['facilities'][0])
        record['id'] = identifier
        return record

    def ingest(self, records, headers=None):
        return self.client.post('/api/v1/ingestion/facilities', json={'sourceOrganization': 'Test source', 'records': records}, headers=headers or {})

    def test_ingestion_auth_fails_closed(self):
        self.assertEqual(self.ingest([self.record()]).status_code, 401)
        self.assertEqual(self.ingest([self.record()], {'X-Ingestion-Key': 'wrong'}).status_code, 401)
        with patch.dict(os.environ, {'ECOSITE_INGESTION_KEY': ''}):
            self.assertEqual(self.ingest([self.record()], self.headers).status_code, 503)
        self.assertEqual(self.client.get('/api/v1/facilities/new-facility').status_code, 404)

    def test_ingestion_validates_whole_batch_and_classifies(self):
        invalid = self.record('invalid')
        invalid['cityId'] = 'mumbai'
        self.assertEqual(self.ingest([self.record(), invalid], self.headers).status_code, 422)
        self.assertEqual(self.client.get('/api/v1/facilities/new-facility').status_code, 404)
        record = self.record()
        del record['cityId']
        self.assertEqual(self.ingest([record], self.headers).status_code, 200)
        result = self.client.get('/api/v1/facilities/new-facility').json()
        self.assertEqual(result['cityId'], 'pune')
        self.assertEqual(result['provenance']['sourceOrganization'], 'Test source')
        self.assertEqual(self.ingest([record, record], self.headers).status_code, 422)
        record['coordinates'] = [181, 20]
        self.assertEqual(self.ingest([record], self.headers).status_code, 422)

    def test_database_failure_rolls_back_batch(self):
        original = api.upsert_facility
        def fail_second(record, connection=None):
            if record.id == 'second':
                raise sqlite3.IntegrityError('injected failure')
            original(record, connection)
        with patch.object(api, 'upsert_facility', side_effect=fail_second):
            with self.assertRaises(sqlite3.IntegrityError):
                self.ingest([self.record('first'), self.record('second')], self.headers)
        self.assertEqual(self.client.get('/api/v1/facilities/first').status_code, 404)

    def test_city_filter_pagination_and_seed_preservation(self):
        self.assertEqual(len(self.client.get('/api/v1/cities').json()), 2)
        for city in ('pune', 'mumbai'):
            rows = self.client.get('/api/v1/facilities', params={'city': city}).json()
            self.assertEqual(len(rows), 3)
            self.assertTrue(all(row['cityId'] == city for row in rows))
            pages = [self.client.get('/api/v1/facilities', params={'city': city, 'page_size': 1, 'page': n}).json()[0]['id'] for n in (1,2,3)]
            self.assertEqual(len(set(pages)), 3)
        self.assertEqual(self.client.get('/api/v1/facilities?city=unknown').status_code, 422)
        record = self.record('legacy')
        record.pop('cityId')
        record['coordinates'] = [73.0169, 19.1075]
        self.ingest([record], self.headers)
        api.seed_facilities()
        self.assertEqual(self.client.get('/api/v1/facilities/legacy').status_code, 200)
        self.assertEqual(len(self.client.get('/api/v1/facilities?city=mumbai').json()), 3)

    def test_sites_only_measure_substations_and_preserve_zero(self):
        request = dict(cityId='pune', name='Candidate', type='industrial', longitude=73.8567, latitude=18.5204, capacityMw=0, waterDemandKld=0, powerDemandMw=0)
        result = self.client.post('/api/v1/site-assessments', json=request).json()
        self.assertGreater(result['substationDistanceKm'], 0)
        self.assertEqual(result['waterDemandKld'], 0)
        self.assertEqual(result['suitabilityStatus'], 'Insufficient data')
        for key in ('suitabilityScore', 'population5km', 'protectedAreaDistanceKm'):
            self.assertIsNone(result[key])
        with api.get_connection() as connection:
            connection.execute("DELETE FROM facilities WHERE type = 'substation'")
        self.assertIsNone(self.client.post('/api/v1/site-assessments', json=request).json()['substationDistanceKm'])
        request['cityId'] = 'mumbai'
        self.assertEqual(self.client.post('/api/v1/site-assessments', json=request).status_code, 422)
        request.pop('cityId')
        self.assertEqual(self.client.post('/api/v1/site-assessments', json=request).status_code, 422)

    def test_forecasts_units_horizons_calendar_and_rejections(self):
        units = {'electricity_demand': 'MW', 'groundwater_depletion': 'm bgl', 'air_quality': 'µg/m³', 'temperature_heat': '°C', 'environmental_risk_index': 'index'}
        for metric, unit in units.items():
            for horizon in (6, 12, 24):
                result = self.client.post('/api/v1/forecasts', json=dict(location_id='pune', metric=metric, horizon_months=horizon)).json()
                self.assertEqual(result['unit'], unit)
                dates = [point['date'] for point in result['forecast']]
                self.assertEqual(len(set(dates)), horizon)
                self.assertTrue(all(day.endswith('-01') for day in dates))
                months = [int(day[:4])*12+int(day[5:7]) for day in dates]
                self.assertTrue(all(b-a == 1 for a,b in zip(months, months[1:])))
                self.assertIn('not calibrated', result['methodologyNotes'])
        self.assertEqual(self.client.post('/api/v1/forecasts', json=dict(location_id='unknown', metric='air_quality', horizon_months=6)).status_code, 422)
        self.assertEqual(self.client.post('/api/v1/forecasts', json=dict(location_id='pune', metric='unknown', horizon_months=6)).status_code, 422)

    def test_sector_scoring_consistent_across_api(self):
        for record in self.client.get('/api/v1/facilities').json():
            assessment = self.client.get('/api/v1/risk-assessments/'+record['id']).json()
            expected = int(sum(record['indicators'][key]*weight for key, weight in api.PILOT['sectorWeights'][record['type']].items()) + .5)
            self.assertEqual(record['overallRiskScore'], expected)
            self.assertEqual(assessment['overallScore'], expected)
            self.assertEqual(assessment['scoringVersion'], api.PILOT['scoringVersion'])
        indicators = api.Indicators(**{key: 0 for key in api.PILOT['sectorWeights']['industrial']})
        indicators.landSensitivity = 10
        self.assertEqual(api.weighted_risk(indicators, 'industrial'), 1)


if __name__ == '__main__':
    unittest.main()
