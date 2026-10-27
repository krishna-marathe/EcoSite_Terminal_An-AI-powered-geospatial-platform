import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { getPhases, savePhase, archivePhase, type ProjectPhase, type PhaseInput } from '../../services/phases';
import { projectError } from '../../services/projects';

const numbers = [
  ['cumulative_it_mw', 'Cumulative IT MW', 0.000001],
  ['cumulative_facility_peak_mw', 'Cumulative facility peak MW', 0.000001],
  ['design_pue', 'Design PUE', 1],
  ['average_water_kld', 'Average campus water KLD', 0],
  ['peak_summer_water_kld', 'Peak-summer campus water KLD', 0],
] as const;

export function PhaseEditor({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const phases = useQuery({ queryKey: ['project-phases', projectId], queryFn: ({ signal }) => getPhases(projectId, signal), retry: false });
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [editing, setEditing] = useState<ProjectPhase>();
  const [formVersion, setFormVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const choose = (phase?: ProjectPhase) => { setEditing(phase); setFormVersion(n => n + 1); setError(''); setMessage(''); };
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['project-phases', projectId] });
  const failure = (err: unknown) => { const message = projectError(err); return message.startsWith('Invalid candidate') ? 'Invalid phase fields. Check dates, cumulative loads and water values.' : message; };
  return <Card title="Development phases">
    <p>All MW values are cumulative campus demand, not incremental additions. 20 → 50 → 80 MW means a final campus total of 80 MW, not 150 MW. Water values are campus totals in KLD.</p>
    <p>Dates and both cumulative MW values must increase in sequence order. Water may decrease with efficiency changes. These are planning inputs, not verified readiness.</p>
    {phases.isPending && <p>Loading development phases…</p>}
    {phases.error && <p role="alert">{failure(phases.error)}</p>}
    <Button type="button" disabled={busy} onClick={() => { choose(); void refresh(); }}>Reload phases</Button>
    {phases.data && <>
      <ol aria-label="Development phase timeline">{phases.data.map(phase => <li key={phase.id} className="border p-3 my-2">
        <strong>{phase.sequence}. {phase.name}</strong> · {phase.commissioning_date} · {phase.status}
        <p>{phase.cumulative_it_mw} MW IT / {phase.cumulative_facility_peak_mw} MW facility peak (cumulative) · PUE {phase.design_pue}</p>
        <p>{phase.average_water_kld} / {phase.peak_summer_water_kld} KLD average / peak summer · {phase.cooling_type} · revision {phase.revision}</p>
        {phase.warnings.map(warning => <p role="status" key={warning}>{warning}</p>)}
        {phase.status === 'active' && <><Button type="button" disabled={busy} onClick={() => choose(phase)}>Edit phase {phase.sequence}</Button>
          <Button type="button" disabled={busy} onClick={async () => { if (!window.confirm('Archive phase ' + phase.name + '?')) return; setBusy(true); setError(''); try { await archivePhase(phase); if (!mounted.current) return; choose(); await refresh(); } catch (err) { if (mounted.current) setError(failure(err)); } finally { if (mounted.current) setBusy(false); } }}>Archive phase {phase.sequence}</Button></>}
      </li>)}</ol>
      <Button type="button" disabled={busy} onClick={() => choose()}>New phase</Button>
      <form key={formVersion} className="grid gap-3 sm:grid-cols-2" aria-label="Development phase editor" onSubmit={async event => {
        event.preventDefault(); if (busy) return;
        const form = new FormData(event.currentTarget);
        const body: PhaseInput = { sequence: editing?.sequence ?? Number(form.get('sequence')), name: String(form.get('name')), commissioning_date: String(form.get('commissioning_date')), cooling_type: String(form.get('cooling_type')), cumulative_it_mw: Number(form.get('cumulative_it_mw')), cumulative_facility_peak_mw: Number(form.get('cumulative_facility_peak_mw')), design_pue: Number(form.get('design_pue')), average_water_kld: Number(form.get('average_water_kld')), peak_summer_water_kld: Number(form.get('peak_summer_water_kld')) };
        setBusy(true); setError(''); setMessage('');
        try { await savePhase(projectId, body, editing); if (!mounted.current) return; choose(); await refresh(); if (mounted.current) setMessage('Phase saved. Campus totals were not summed or adjusted.'); }
        catch (err) { if (mounted.current) setError(failure(err)); }
        finally { if (mounted.current) setBusy(false); }
      }}>
        <label>Phase sequence<input name="sequence" type="number" min="1" step="1" required readOnly={!!editing} disabled={busy} defaultValue={editing?.sequence ?? Math.max(0, ...phases.data.map(p => p.sequence)) + 1} /></label>
        <label>Phase name<input name="name" required maxLength={200} disabled={busy} defaultValue={editing?.name ?? ''} /></label>
        <label>Commissioning date<input name="commissioning_date" type="date" required disabled={busy} defaultValue={editing?.commissioning_date ?? ''} /></label>
        {numbers.map(([name, label, min]) => <label key={name}>{label}<input name={name} type="number" step="any" min={min} required disabled={busy} defaultValue={editing?.[name] ?? ''} /></label>)}
        <label>Cooling type<input name="cooling_type" required maxLength={100} disabled={busy} defaultValue={editing?.cooling_type ?? ''} /></label>
        <Button disabled={busy}>{busy ? 'Saving phase…' : editing ? 'Save phase changes' : 'Create phase'}</Button>
      </form>
    </>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </Card>;
}
