import { expect, it, vi } from 'vitest';
import { apiClient } from './api';
import { getPhases, savePhase, archivePhase, type ProjectPhase } from './phases';
vi.mock('./api',()=>({apiClient:{get:vi.fn(),post:vi.fn(),patch:vi.fn(),delete:vi.fn()}}));
it('uses project-scoped paths, cancellation and revisions without resending immutable sequence',async()=>{
  vi.mocked(apiClient.get).mockResolvedValue({data:[]});vi.mocked(apiClient.post).mockResolvedValue({data:{}});vi.mocked(apiClient.patch).mockResolvedValue({data:{}});vi.mocked(apiClient.delete).mockResolvedValue({data:{}});
  const signal=new AbortController().signal;await getPhases('p1',signal);
  expect(apiClient.get).toHaveBeenCalledWith('/projects/p1/phases',{signal,params:{include_archived:true}});
  const body={sequence:1,name:'Phase',commissioning_date:'2028-01-01',cumulative_it_mw:20,cumulative_facility_peak_mw:30,design_pue:1.5,average_water_kld:0,peak_summer_water_kld:0,cooling_type:'Dry'};
  const existing={...body,id:'a',project_id:'p1',revision:3} as ProjectPhase;
  await savePhase('p1',body);expect(apiClient.post).toHaveBeenCalledWith('/projects/p1/phases',body);
  await savePhase('p1',body,existing);expect(apiClient.patch).toHaveBeenCalledWith('/projects/p1/phases/a',expect.objectContaining({expected_revision:3,cumulative_it_mw:20}));expect(vi.mocked(apiClient.patch).mock.calls[0][1]).not.toHaveProperty('sequence');
  await archivePhase(existing);expect(apiClient.delete).toHaveBeenCalledWith('/projects/p1/phases/a',{params:{expected_revision:3}});
});
