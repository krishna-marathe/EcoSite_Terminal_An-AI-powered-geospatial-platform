import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PhaseEditor } from './PhaseEditor';
import * as service from '../../services/phases';
vi.mock('../../services/phases');
const phase = (sequence: number, mw: number): service.ProjectPhase => ({ id: String(sequence), project_id:'p1', sequence, name:'Phase '+sequence, commissioning_date:(2027+sequence)+'-01-01', cumulative_it_mw:mw, cumulative_facility_peak_mw:mw*1.5, design_pue:1.5, average_water_kld:100, peak_summer_water_kld:150, cooling_type:'Hybrid', revision:1, status:'active', warnings:[], created_at:'2026-01-01',updated_at:'2026-01-01' });
let records: service.ProjectPhase[];
const mount = (id='p1') => render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><PhaseEditor key={id} projectId={id}/></QueryClientProvider>);
beforeEach(() => {
  records=[]; vi.resetAllMocks();
  vi.mocked(service.getPhases).mockImplementation(async () => records.map(p=>({...p})));
  vi.mocked(service.savePhase).mockImplementation(async (_id,body,existing) => { const saved={...phase(body.sequence,body.cumulative_it_mw),...body,revision:(existing?.revision??0)+1}; records=[...records.filter(p=>p.id!==saved.id),saved].sort((a,b)=>a.sequence-b.sequence); return saved; });
  vi.mocked(service.archivePhase).mockImplementation(async p => { const archived={...p,status:'archived' as const,revision:p.revision+1}; records=records.map(r=>r.id===p.id?archived:r); return archived; });
});
afterEach(cleanup);
async function fill(sequence=1,mw=20) {
  await screen.findByLabelText('Phase name');
  for(const [label,value] of Object.entries({'Phase sequence':sequence,'Phase name':'Phase '+sequence,'Commissioning date':(2027+sequence)+'-01-01','Cumulative IT MW':mw,'Cumulative facility peak MW':mw*1.5,'Design PUE':1.5,'Average campus water KLD':100,'Peak-summer campus water KLD':150,'Cooling type':'Hybrid'})) fireEvent.change(screen.getByLabelText(label),{target:{value:String(value)}});
}
it('creates 20 → 50 → 80 cumulative milestones and restores the timeline after reload',async()=>{
  const view=mount();
  for(const [seq,mw] of [[1,20],[2,50],[3,80]]) { await fill(seq,mw);fireEvent.click(screen.getByRole('button',{name:'Create phase'}));await waitFor(()=>expect(records).toHaveLength(seq));await screen.findByRole('button',{name:'Edit phase '+seq}); }
  expect(records.map(p=>p.cumulative_it_mw)).toEqual([20,50,80]);
  expect(screen.getByText(/80 MW IT.*120 MW facility peak/)).toBeTruthy();
  view.unmount();mount();await screen.findByRole('button',{name:'Edit phase 3'});
  expect(screen.getByText(/final campus total of 80 MW, not 150 MW/)).toBeTruthy();
});
it('edits with the saved revision and archives without deleting history',async()=>{
  records=[phase(1,20)];mount();fireEvent.click(await screen.findByRole('button',{name:'Edit phase 1'}));
  fireEvent.change(screen.getByLabelText('Phase name'),{target:{value:'Revised'}});
  fireEvent.click(screen.getByRole('button',{name:'Save phase changes'}));
  await waitFor(()=>expect(records[0].revision).toBe(2));
  expect(vi.mocked(service.savePhase).mock.calls[0][2]?.revision).toBe(1);
  vi.spyOn(window,'confirm').mockReturnValue(true);fireEvent.click(screen.getByRole('button',{name:'Archive phase 1'}));
  await waitFor(()=>expect(records[0].status).toBe('archived'));
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Edit phase 1'})).toBeNull());
});
it('retains a draft and clears busy on a controlled conflict',async()=>{
  vi.mocked(service.savePhase).mockRejectedValue(new Error('Phase changed. Reload before retrying.'));
  mount();await fill();fireEvent.click(screen.getByRole('button',{name:'Create phase'}));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent','Phase changed. Reload before retrying.');
  expect((screen.getByLabelText('Cumulative IT MW') as HTMLInputElement).value).toBe('20');
  expect((screen.getByRole('button',{name:'Create phase'}) as HTMLButtonElement).disabled).toBe(false);
});
it('displays PUE warnings without replacing supplied values',async()=>{
  records=[{...phase(1,20),design_pue:1.2,warnings:['Review PUE assumptions']}];mount();
  expect(await screen.findByText('Review PUE assumptions')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Edit phase 1'}));
  expect((screen.getByLabelText('Design PUE') as HTMLInputElement).value).toBe('1.2');
});
it('does not let a late save from an unmounted project alter another project',async()=>{
  let resolve!: (p:service.ProjectPhase)=>void;
  vi.mocked(service.savePhase).mockReturnValue(new Promise(r=>{resolve=r;}));
  const view=mount();await fill();fireEvent.click(screen.getByRole('button',{name:'Create phase'}));view.unmount();
  mount('p2');await screen.findByLabelText('Phase name');
  await act(async()=>resolve(phase(1,20)));
  expect(screen.queryByText('Phase saved. Campus totals were not summed or adjusted.')).toBeNull();
  expect((screen.getByLabelText('Phase name') as HTMLInputElement).value).toBe('');
});
