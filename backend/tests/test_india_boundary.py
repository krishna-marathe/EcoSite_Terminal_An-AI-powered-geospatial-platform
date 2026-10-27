import hashlib
import json
import unittest
from unittest.mock import patch
from shapely.geometry import shape
from backend.app import geometry
from backend.tests.test_candidate_sites import square

class IndiaBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.enterContext(patch.dict('os.environ', {}, clear=True))

    def test_pinned_provenance_and_valid_multipolygon(self):
        data = geometry.bundled_metadata()
        raw = (geometry.BOUNDARY_DIR / data['file']).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), data['sha256'])
        boundary = geometry.load_boundary(str(geometry.BOUNDARY_DIR / data['file']), data['sha256'])
        self.assertTrue(boundary.is_valid)
        self.assertEqual(boundary.geom_type, 'MultiPolygon')
        self.assertIn('CC0', data['boundaryLicense'])
        self.assertEqual(data['version'], '9469f09')

    def test_inside_outside_coast_and_islands(self):
        for name,x,y,status in [('Pune',73.85,18.52,'inside_screening_boundary'),('Mumbai coast',72.83,18.94,'review_required'),('Andaman island',92.73,11.67,'inside_screening_boundary'),('Lakshadweep island',72.64,10.57,'review_required')]:
            with self.subTest(name=name):
                result=geometry.measure_polygon(square(x,y,.0001))
                self.assertEqual(result['boundary_screening']['status'],status)
                self.assertTrue(result['boundary_screening']['screening_only'])
                self.assertIn('CC0',result['boundary_screening']['licence'])
        with self.assertRaises(ValueError) as error:
            geometry.measure_polygon(square(0,51))
        self.assertNotIsInstance(error.exception, geometry.BoundaryReviewRequired)

    def test_boundary_crossing_requires_review_not_acceptance(self):
        data=geometry.bundled_metadata()
        boundary=geometry.load_boundary(str(geometry.BOUNDARY_DIR/data['file']),data['sha256'])
        x,y=boundary.geoms[0].exterior.coords[10]
        with self.assertRaises(geometry.BoundaryReviewRequired):
            geometry.measure_polygon(square(x-.001,y-.001,.002))

    def test_tampered_file_fails_closed(self):
        data=geometry.bundled_metadata()
        with self.assertRaises(geometry.BoundaryUnavailable):
            geometry.load_boundary(str(geometry.BOUNDARY_DIR/data['file']), '0'*64)
