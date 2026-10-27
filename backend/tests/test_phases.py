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
from sqlalchemy import text
from backend.app import db, main as api
from backend.app.routers import phases
from backend.tests.test_projects import migration_config

def body(sequence=1,mw=20):
    return dict(sequence=sequence,name=f'Phase {sequence}',commissioning_date=f'{2027+sequence}-01-01',cumulative_it_mw=mw,cumulative_facility_peak_mw=mw*1.5,design_pue=1.5,average_water_kld=100,peak_summer_water_kld=150,cooling_type='Hybrid')

class PhaseTests(unittest.TestCase):
    def setUp(self):
        self.temp=self.enterContext(tempfile.TemporaryDirectory())
        self.path=Path(self.temp)/'phases.db'
        self.enterContext(patch.object(api,'DB_PATH',self.path))
        self.enterContext(patch.object(db,'DB_PATH',self.path))
        command.upgrade(migration_config(self.path),'head')
        async def local_app(scope,receive,send):
            if scope['type']=='http': scope={**scope,'client':('127.0.0.1',12345)}
            await api.app(scope,receive,send)
        self.client=self.enterContext(TestClient(local_app,base_url='http://127.0.0.1'))
        self.project=self.client.post('/api/v1/projects',json=dict(name='Phase test',organization_label='QA',archetype='edge')).json()
        self.url='/api/v1/projects/'+self.project['id']+'/phases'
    def create(self,seq=1,mw=20):
        r=self.client.post(self.url,json=body(seq,mw))
        self.assertEqual(r.status_code,201,r.text)
        return r.json()
    def test_20_50_80_persistence_order_and_no_double_counting(self):
        records=[self.create(1,20),self.create(3,80),self.create(2,50)]
        result=self.client.get(self.url).json()
        self.assertEqual([p['cumulative_it_mw'] for p in result],[20,50,80])
        self.assertEqual([p['cumulative_facility_peak_mw'] for p in result],[30,75,120])
        self.assertEqual(result[-1]['cumulative_it_mw'],80)
        api.startup()
        self.assertEqual(self.client.get(self.url).json(),result)
        with closing(sqlite3.connect(self.path)) as c:
            self.assertEqual(c.execute('SELECT COUNT(*) FROM project_phases').fetchone()[0],3)
        self.assertEqual(self.client.get(self.url+'/'+records[0]['id']).json(),records[0])
    def test_invalid_fields_and_partial_update_rollback(self):
        for changes in [{'cumulative_it_mw':0},{'cumulative_it_mw':True},{'cumulative_it_mw':'20'},{'cumulative_facility_peak_mw':19},{'design_pue':.9},{'average_water_kld':-1},{'peak_summer_water_kld':99},{'sequence':True},{'commissioning_date':'invalid'},{'name':' '},{'cooling_type':''},{'unknown':1}]:
            self.assertEqual(self.client.post(self.url,json={**body(),**changes}).status_code,422,changes)
        phase=self.create();url=self.url+'/'+phase['id']
        for changes in [{'cumulative_it_mw':31},{'average_water_kld':151},{'sequence':2},{'name':None}]:
            self.assertEqual(self.client.patch(url,json={'expected_revision':1,**changes}).status_code,422)
            self.assertEqual(self.client.get(url).json(),phase)
    def test_chronology_and_both_cumulative_loads(self):
        first=self.create(1,20);self.create(3,80)
        for changes in [{'commissioning_date':'2028-01-01'},{'commissioning_date':'2031-01-01'},{'cumulative_it_mw':20},{'cumulative_facility_peak_mw':121}]:
            r=self.client.post(self.url,json={**body(2,50),**changes})
            self.assertEqual(r.status_code,422,r.text)
        r=self.client.patch(self.url+'/'+first['id'],json={'expected_revision':1,'cumulative_it_mw':81,'cumulative_facility_peak_mw':122})
        self.assertEqual(r.status_code,422)
        self.assertEqual(self.client.get(self.url+'/'+first['id']).json(),first)
    def test_pue_warning_preserves_inputs_and_water_can_decrease(self):
        self.create()
        response=self.client.post(self.url,json={**body(2,50),'design_pue':1.2,'average_water_kld':0,'peak_summer_water_kld':0})
        self.assertEqual(response.status_code,201,response.text)
        phase=response.json()
        self.assertEqual(phase['design_pue'],1.2)
        self.assertEqual(phase['cumulative_facility_peak_mw'],75)
        self.assertEqual(len(phase['warnings']),1)
        self.assertEqual(self.client.get(self.url+'/'+phase['id']).json()['warnings'],phase['warnings'])
    def test_revisions_archive_restore_and_sequence_reservation(self):
        phase=self.create();url=self.url+'/'+phase['id']
        self.assertEqual(self.client.patch(url,json={'expected_revision':1,'name':'Edited'}).status_code,200)
        self.assertEqual(self.client.patch(url,json={'expected_revision':1,'name':'Stale'}).status_code,409)
        self.assertEqual(self.client.delete(url+'?expected_revision=1').status_code,409)
        self.assertEqual(self.client.delete(url+'?expected_revision=2').status_code,200)
        self.assertEqual(self.client.get(self.url).json(),[])
        self.assertEqual(len(self.client.get(self.url+'?include_archived=true').json()),1)
        self.assertEqual(self.client.post(self.url,json=body()).status_code,409)
        self.create(2,10)
        self.assertEqual(self.client.patch(url,json={'expected_revision':3,'status':'active'}).status_code,422)
        self.assertEqual(self.client.get(url).json()['revision'],3)
    def test_nested_access_and_archived_parent(self):
        phase=self.create()
        wrong='/api/v1/projects/'+str(uuid4())+'/phases/'+phase['id']
        self.assertEqual(self.client.get(wrong).status_code,404)
        self.assertEqual(self.client.patch(wrong,json={'expected_revision':1,'name':'X'}).status_code,404)
        self.assertEqual(self.client.get(self.url,headers={'Origin':'https://evil.example'}).status_code,403)
        self.client.delete('/api/v1/projects/'+self.project['id']+'?expected_revision=1')
        self.assertEqual(self.client.post(self.url,json=body(2,50)).status_code,409)
    def test_concurrent_sequence_and_revision_conflicts(self):
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses=list(pool.map(lambda _:self.client.post(self.url,json=body()),range(2)))
        self.assertEqual(sorted(r.status_code for r in responses),[201,409])
        phase=self.client.get(self.url).json()[0]
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses=list(pool.map(lambda name:self.client.patch(self.url+'/'+phase['id'],json={'expected_revision':1,'name':name}),['A','B']))
        self.assertEqual(sorted(r.status_code for r in responses),[200,409])
    def test_failure_rolls_back_and_migration_metadata_matches(self):
        original=phases.validate_timeline
        def fail(session,*args):
            original(session,*args)
            session.execute(text("INSERT INTO missing_table VALUES (1)"))
        with patch.object(phases,'validate_timeline',side_effect=fail):
            self.assertEqual(self.client.post(self.url,json=body()).status_code,503)
        self.assertEqual(self.client.get(self.url).json(),[])
        command.check(migration_config(self.path))
        self.path.unlink()
