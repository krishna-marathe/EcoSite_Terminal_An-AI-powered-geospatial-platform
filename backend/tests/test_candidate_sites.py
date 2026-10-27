import copy
import hashlib
import json
import os
import sqlite3
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from alembic import command
from fastapi.testclient import TestClient
from pyproj import Geod
from sqlalchemy import text

from backend.app import db, main as api, geometry
from backend.tests.test_projects import migration_config


def square(x=73.85, y=18.52, width=.01):
    return {"type": "Polygon", "coordinates": [[[x,y],[x+width,y],[x+width,y+width],[x,y+width],[x,y]]]}


class CandidateTests(unittest.TestCase):
    def setUp(self):
        self.temp = self.enterContext(tempfile.TemporaryDirectory())
        self.path = Path(self.temp) / "sites.db"
        self.boundary = Path(self.temp) / "test-only-boundary.json"
        self.boundary.write_text(json.dumps(square(72, 17, 4)), encoding="utf-8")
        self.env = {"ECOSITE_INDIA_BOUNDARY_PATH": str(self.boundary), "ECOSITE_INDIA_BOUNDARY_SHA256": hashlib.sha256(self.boundary.read_bytes()).hexdigest(), "ECOSITE_INDIA_BOUNDARY_SOURCE": "Synthetic TEST boundary only; not an India dataset"}
        self.enterContext(patch.dict(os.environ, self.env))
        self.enterContext(patch.object(api, "DB_PATH", self.path))
        self.enterContext(patch.object(db, "DB_PATH", self.path))
        command.upgrade(migration_config(self.path), "head")
        async def local_app(scope, receive, send):
            if scope["type"] == "http": scope = {**scope, "client": ("127.0.0.1", 50000)}
            await api.app(scope, receive, send)
        self.client = self.enterContext(TestClient(local_app, base_url="http://127.0.0.1"))
        self.project = self.client.post('/api/v1/projects', json={"name":"Test", "organization_label":"Test", "archetype":"edge"}).json()
        self.url = '/api/v1/projects/' + self.project['id'] + '/sites'
        self.body = {"name":"Candidate", "geometry":square(), "state_code":"IN-MH", "district":"Pune"}

    def create(self):
        response = self.client.post(self.url, json=self.body)
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def test_create_read_edit_archive_restore_and_reload(self):
        site = self.create()
        self.assertEqual(site['project_id'], self.project['id'])
        self.assertEqual(site['revision'], 1)
        self.assertGreater(site['area_ha'], 100)
        self.assertLess(site['area_ha'], 130)
        self.assertEqual(len(site['geometry_hash']), 64)
        self.assertEqual(self.client.get('/api/v1/sites/'+site['id']).json(), site)
        self.assertEqual(self.client.get(self.url+'/'+site['id']).json(), site)
        updated = self.client.patch('/api/v1/sites/'+site['id'], json={"expected_revision":1,"geometry":square(width=.02),"district":None}).json()
        self.assertEqual(updated['revision'],2)
        self.assertIsNone(updated['district'])
        self.assertGreater(updated['area_ha'],site['area_ha']*3.9)
        self.assertNotEqual(updated['geometry_hash'],site['geometry_hash'])
        command.upgrade(migration_config(self.path),'head')
        self.assertEqual(self.client.get(self.url).json(),[updated])
        response = self.client.delete(self.url+'/'+site['id']+'?expected_revision=2')
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(self.client.get(self.url).json(),[])
        self.assertEqual(len(self.client.get(self.url+'?include_archived=true').json()),1)
        restored = self.client.patch(self.url+'/'+site['id'], json={"expected_revision":3,"status":"active"})
        self.assertEqual(restored.status_code,200)
        self.assertEqual(restored.json()['revision'],4)

    def test_invalid_geometries_never_persist(self):
        invalid = [None, {}, {"type":"MultiPolygon","coordinates":[]}, {"type":"Polygon","coordinates":[]}, square()]
        invalid[-1]['coordinates'][0].pop()
        invalid += [{"type":"Polygon","coordinates":[[[73.85,18.52],[73.86,18.53],[73.85,18.53],[73.86,18.52],[73.85,18.52]]]}, square(0,0), square(73,75)]
        for geom in invalid:
            response = self.client.post(self.url,json={**self.body,"geometry":geom})
            self.assertEqual(response.status_code,422,response.text)
        self.assertEqual(self.client.get(self.url).json(),[])

    def test_boundary_crossing_holes_and_no_bbox_shortcut(self):
        boundary = square(72,17,4)
        boundary['coordinates'].append(square(73.8,18.4,.3)['coordinates'][0])
        self.boundary.write_text(json.dumps(boundary))
        with patch.dict(os.environ, {"ECOSITE_INDIA_BOUNDARY_SHA256":hashlib.sha256(self.boundary.read_bytes()).hexdigest()}):
            self.assertEqual(self.client.post(self.url,json=self.body).status_code,422)
            self.assertEqual(self.client.post(self.url,json={**self.body,'geometry':square(75.99,18,.02)}).status_code,422)

    def test_canonical_hash_and_geodesic_holes(self):
        original = geometry.measure_polygon(square())
        rotated = square()
        ring = rotated['coordinates'][0][:-1]
        ring = list(reversed(ring[1:]+ring[:1]))
        rotated['coordinates']=[ring+[ring[0]]]
        self.assertEqual(original['geometry_hash'],geometry.measure_polygon(rotated)['geometry_hash'])
        polygon = square(width=.04)
        polygon['coordinates'].append(square(73.86,18.53,.01)['coordinates'][0])
        area = geometry.measure_polygon(polygon)['area_ha']
        geod = Geod(ellps='WGS84')
        def ring_area(ring):
            return abs(geod.polygon_area_perimeter([p[0] for p in ring],[p[1] for p in ring])[0])/10000
        self.assertAlmostEqual(area,ring_area(polygon['coordinates'][0])-ring_area(polygon['coordinates'][1]),places=6)
        invalid = square()
        invalid['coordinates'].append(square(74,19,.01)['coordinates'][0])
        with self.assertRaises(ValueError): geometry.validate_polygon(invalid)

    def test_coordinate_types_bounds_and_limits(self):
        for value in (True,'73.85',float('nan'),float('inf'),181):
            polygon = square();polygon['coordinates'][0][1][0]=value
            with self.assertRaises(ValueError): geometry.validate_polygon(polygon)
        for extra in ({'crs':{'name':'EPSG:3857'}},{'bbox':[0,0,1,1]}):
            with self.assertRaises(ValueError): geometry.validate_polygon({**square(),**extra})
        polygon = square();polygon['coordinates'][0] = polygon['coordinates'][0][:-1]*501+[polygon['coordinates'][0][0]]
        with self.assertRaises(ValueError): geometry.validate_polygon(polygon)

    def test_three_candidate_limit_archive_slot_and_restore(self):
        sites = [self.create() for _ in range(3)]
        response = self.client.post(self.url,json=self.body)
        self.assertEqual(response.status_code,409,response.text)
        self.assertEqual(response.json()['detail']['code'],'candidate_limit')
        self.assertEqual(self.client.delete('/api/v1/sites/'+sites[0]['id']+'?expected_revision=1').status_code,200)
        self.create()
        response = self.client.patch('/api/v1/sites/'+sites[0]['id'],json={'expected_revision':2,'status':'active'})
        self.assertEqual(response.status_code,409)
        self.assertEqual(self.client.get('/api/v1/sites/'+sites[0]['id']).json()['revision'],2)
        self.assertEqual(len(self.client.get(self.url).json()),3)

    def test_limit_under_concurrent_creates(self):
        self.create();self.create()
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses=list(pool.map(lambda _:self.client.post(self.url,json=self.body),range(2)))
        self.assertEqual(sorted(r.status_code for r in responses),[201,409])
        self.assertEqual(len(self.client.get(self.url).json()),3)

    def test_revisions_parent_isolation_and_archived_project(self):
        site=self.create();url='/api/v1/sites/'+site['id']
        self.assertEqual(self.client.patch(url,json={'expected_revision':1,'name':'Winner'}).status_code,200)
        self.assertEqual(self.client.patch(url,json={'expected_revision':1,'name':'Stale'}).status_code,409)
        self.assertEqual(self.client.delete(url+'?expected_revision=1').status_code,409)
        wrong='/api/v1/projects/'+str(uuid4())+'/sites/'+site['id']
        self.assertEqual(self.client.get(wrong).status_code,404)
        self.assertEqual(self.client.patch(wrong,json={'expected_revision':2,'name':'Other project'}).status_code,404)
        self.client.delete('/api/v1/projects/'+self.project['id']+'?expected_revision=1')
        self.assertEqual(self.client.post(self.url,json=self.body).status_code,409)
        self.assertEqual(self.client.patch(url,json={'expected_revision':2,'name':'X'}).status_code,409)

    def test_boundary_configuration_fails_closed_and_transaction_rollback(self):
        with patch.dict(os.environ,{'ECOSITE_INDIA_BOUNDARY_PATH':''}):
            response=self.client.post(self.url,json=self.body)
            self.assertEqual(response.status_code,503)
            self.assertEqual(response.json()['detail']['code'],'boundary_unavailable')
        with patch.dict(os.environ,{'ECOSITE_INDIA_BOUNDARY_SHA256':'0'*64}):
            self.assertEqual(self.client.post(self.url,json=self.body).status_code,503)
        self.assertEqual(self.client.get(self.url).json(),[])
        with db.project_session(self.path) as session:
            self.assertEqual(session.scalar(text('PRAGMA foreign_keys')),1)

    def test_api_validation_and_no_remote_access(self):
        for changes in ({'name':' '},{'state_code':'XX'},{'area_ha':123},{'geometry_hash':'fake'},{'project_id':str(uuid4())}):
            self.assertEqual(self.client.post(self.url,json={**self.body,**changes}).status_code,422)
        self.assertEqual(self.client.post(self.url,json=self.body,headers={'Origin':'https://evil.example'}).status_code,403)
        self.assertEqual(self.client.get('/api/v1/projects/'+str(uuid4())+'/sites').status_code,404)

    def test_second_migration_preserves_existing_project_and_facilities(self):
        command.check(migration_config(self.path))
        with closing(sqlite3.connect(self.path)) as c:
            self.assertEqual(c.execute('PRAGMA integrity_check').fetchone()[0],'ok')
            self.assertEqual(c.execute('SELECT COUNT(*) FROM facilities').fetchone()[0],6)
            self.assertEqual(c.execute('SELECT COUNT(*) FROM projects').fetchone()[0],1)
        self.path.unlink()

    def test_bundled_screening_provenance_persists_and_review_error_is_controlled(self):
        with patch.dict(os.environ, {}, clear=True):
            site = self.create()
            self.assertEqual(site['boundary_screening']['version'], '9469f09')
            self.assertEqual(site['boundary_screening']['status'], 'inside_screening_boundary')
            self.assertEqual(self.client.get('/api/v1/sites/'+site['id']).json()['boundary_screening'], site['boundary_screening'])
            metadata = geometry.bundled_metadata()
            boundary = geometry.load_boundary(str(geometry.BOUNDARY_DIR/metadata['file']), metadata['sha256'])
            x,y=boundary.geoms[0].exterior.coords[10]
            response=self.client.post(self.url,json={**self.body,'geometry':square(x-.001,y-.001,.002)})
            self.assertEqual(response.status_code,422)
            self.assertEqual(response.json()['detail']['code'],'boundary_review_required')
            self.assertEqual(len(self.client.get(self.url).json()),1)
