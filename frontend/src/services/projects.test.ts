import { afterEach, expect, it, vi } from 'vitest';
import { apiClient } from './api';
import { parsePolygon, getSites, saveSite, archiveSite, projectError, type CandidateSite } from './projects';
vi.mock('./api', () => ({ apiClient: { get:vi.fn(), post:vi.fn(), patch:vi.fn(), delete:vi.fn() } }));
const geometry = {type:'Polygon' as const,coordinates:[[[73,18],[74,18],[74,19],[73,18]] as [number,number][]]};
afterEach(()=>vi.clearAllMocks());
it('uses project-scoped list/create, individual revisioned update/archive and cancellation',async()=>{
  vi.mocked(apiClient.get).mockResolvedValue({data:[]});
  vi.mocked(apiClient.post).mockResolvedValue({data:{id:'site'}});
  vi.mocked(apiClient.patch).mockResolvedValue({data:{id:'site',revision:3}});
  vi.mocked(apiClient.delete).mockResolvedValue({data:{id:'site',status:'archived'}});
  const signal=new AbortController().signal;
  await getSites('project',signal);
  expect(apiClient.get).toHaveBeenCalledWith('/projects/project/sites',{signal});
  const body={name:'Site',geometry,state_code:'IN-MH',district:null};
  await saveSite('project',body);
  expect(apiClient.post).toHaveBeenCalledWith('/projects/project/sites',body);
  const existing={id:'site',revision:2} as CandidateSite;
  await saveSite('project',body,existing);
  expect(apiClient.patch).toHaveBeenCalledWith('/sites/site',{...body,expected_revision:2});
  await archiveSite(existing);
  expect(apiClient.delete).toHaveBeenCalledWith('/sites/site',{params:{expected_revision:2}});
});
it('accepts a Polygon/Feature but rejects unsupported CRS, nonfinite and unclosed geometry',()=>{
  expect(parsePolygon(geometry)).toEqual(geometry);
  expect(parsePolygon({type:'Feature',geometry})).toEqual(geometry);
  for(const value of [{type:'MultiPolygon',coordinates:[]},{...geometry,crs:'EPSG:3857'},{type:'Feature',geometry,crs:'EPSG:3857'},{type:'Polygon',coordinates:[[[73,18],[74,18],[74,19]]]},{type:'Polygon',coordinates:[[[NaN,18],[74,18],[74,19],[NaN,18]]]}]) expect(()=>parsePolygon(value)).toThrow();
});
it('returns controlled API errors and never replaces rejected saves with demo geometry',async()=>{
  const error={isAxiosError:true,response:{status:409,data:{detail:{code:'candidate_limit',message:'At most three active candidates.'}}}};
  vi.mocked(apiClient.post).mockRejectedValue(error);
  await expect(saveSite('project',{name:'Site',geometry,state_code:'IN-MH',district:null})).rejects.toBe(error);
  expect(projectError(error)).toBe('At most three active candidates.');
});
