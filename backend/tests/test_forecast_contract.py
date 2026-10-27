import re
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from backend.app import main as api


class ForecastContractTests(unittest.TestCase):
    def setUp(self):
        # Forecasts do not need database startup or a persistent database.
        self.client = TestClient(api.app)
        self.addCleanup(self.client.close)

    def test_every_frontend_metric_is_accepted_with_unchanged_calculations(self):
        source = (Path(__file__).resolve().parents[2] / 'frontend/src/services/forecasts.ts').read_text(encoding='utf-8')
        offered = re.findall(r'^  (\w+): \{ label:', source, re.MULTILINE)
        contract = {
            'electricity_demand': ('MW', 1000, 18),
            'air_quality': ('µg/m³', 45, 0.3),
            'groundwater_depletion': ('m bgl', 12, 0.08),
            'temperature_heat': ('°C', 30, 0.05),
            'environmental_risk_index': ('index', 50, 0.2),
        }
        self.assertEqual(set(offered), set(contract))
        with patch.object(api, 'date') as clock:
            clock.today.return_value = date(2026, 12, 15)
            clock.side_effect = date
            for metric in offered:
                unit, baseline, step = contract[metric]
                for city in ('pune', 'mumbai'):
                    for horizon in (1, 6, 12, 24, 60):
                        with self.subTest(metric=metric, city=city, horizon=horizon):
                            response = self.client.post('/api/v1/forecasts', json=dict(location_id=city, metric=metric, horizon_months=horizon))
                            self.assertEqual(response.status_code, 200)
                            result = response.json()
                            self.assertEqual(result['metric'], metric)
                            self.assertEqual(result['unit'], unit)
                            self.assertEqual(result['locationId'], city)
                            self.assertEqual(result['horizonMonths'], horizon)
                            self.assertEqual(result['dataStatus'], 'synthetic')
                            self.assertEqual(result['modelVersion'], 'demo-v2')
                            self.assertIn('not calibrated', result['methodologyNotes'])
                            self.assertEqual(len(result['forecast']), horizon)
                            for i, point in enumerate(result['forecast']):
                                month = 2026 * 12 + 11 + i
                                prediction = round(baseline + i * step, 2)
                                self.assertEqual(point, dict(date=date(month // 12, month % 12 + 1, 1).isoformat(), prediction=prediction, lower_bound=round(prediction * 0.9, 2), upper_bound=round(prediction * 1.1, 2)))

    def test_unsupported_metrics_and_horizons_return_422(self):
        for metric in ('groundwater', 'temperature', 'environmental_risk', 'unknown', 'toString'):
            response = self.client.post('/api/v1/forecasts', json=dict(location_id='pune', metric=metric, horizon_months=12))
            self.assertEqual(response.status_code, 422)
            self.assertIn('detail', response.json())
        for horizon in (0, 61, 1.5):
            self.assertEqual(self.client.post('/api/v1/forecasts', json=dict(location_id='pune', metric='air_quality', horizon_months=horizon)).status_code, 422)
