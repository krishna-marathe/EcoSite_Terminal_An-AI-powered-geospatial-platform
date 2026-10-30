import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useDashboardStore } from '../stores/dashboardStore';
import { getPilotCity, isInCity } from '../data/pilotCities';
import { assessProposedSite, type SiteAssessmentRequest } from '../services/siteAssessments';
import { SiteMapPicker } from '../components/site-analysis/SiteMapPicker';
import { PageHeader, PageShell } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DataModeBadge, SourceTag } from '../components/ui/Badge';
import { Field, Input } from '../components/ui/Field';
import { DefinitionRow, MetricTile } from '../components/ui/MetricTile';
import { DataTable, type DataTableColumn } from '../components/ui/DataTable';
import { EmptyState, InlineAlert, LoadingSkeleton } from '../components/ui/StateViews';
import { DATA_STATUS_LABELS, FACILITY_TYPE_LABELS } from '../theme/tokens';
import type { CityId, DataMode, ProposedSite } from '../types';

/** Missing values stay explicit in tables — never rendered as 0. */
const numberCell = (value: number | null) =>
  value === null ? <span className="text-eco-muted">Unavailable</span> : value.toLocaleString();

const savedColumns: DataTableColumn[] = [
  { key: 'candidate', header: 'Candidate' },
  { key: 'status', header: 'Status' },
  { key: 'suitability', header: 'Suitability /100', align: 'right', mono: true },
  { key: 'substation', header: 'Substation distance km', align: 'right', mono: true },
  { key: 'population', header: 'Population people', align: 'right', mono: true },
  { key: 'source', header: 'Source' },
  { key: 'action', header: 'Action', align: 'right' },
];

const decimal = (value: number | null) => value === null ? null : value.toLocaleString();

export function SiteAnalysis() {
  const { cityId, dataMode } = useDashboardStore();
  return <CitySiteAnalysis key={`${cityId}-${dataMode}`} cityId={cityId} dataMode={dataMode} />;
}

function CitySiteAnalysis({ cityId, dataMode }: { cityId: CityId; dataMode: DataMode }) {
  const city = getPilotCity(cityId);
  const { candidateSites: allCandidates, storageNotice, addCandidateSite, removeCandidateSite, clearCandidateSites } = useDashboardStore();
  const candidateSites = allCandidates.filter(site => site.cityId === cityId);
  const [form, setForm] = useState<SiteAssessmentRequest>({ cityId, name: `${city.name} candidate`, type: 'data_centre', longitude: city.center[0], latitude: city.center[1], capacityMw: 100, waterDemandKld: 0, powerDemandMw: 100 });
  const [result, setResult] = useState<ProposedSite | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'invalidated' | 'success' | 'error'>('idle');
  const busy = status === 'loading';
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => {
    request.current++;
    controller.current?.abort();
  }, []);
  const updateForm = (changes: Partial<SiteAssessmentRequest>) => {
    request.current++;
    controller.current?.abort();
    setForm(current => ({ ...current, ...changes }));
    setResult(null);
    setError('');
    setStatus(current => current === 'idle' ? 'idle' : 'invalidated');
  };
  const coordinatesInCity = isInCity([form.longitude, form.latitude], cityId);
  const evaluate = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = ++request.current;
    controller.current?.abort();
    const currentController = new AbortController();
    controller.current = currentController;
    const snapshot = { ...form };
    setStatus('loading'); setError(''); setResult(null);
    try {
      const value = await assessProposedSite(snapshot, dataMode, currentController.signal);
      if (token === request.current) { setResult(value); setStatus('success'); }
    } catch (e) {
      if (token === request.current) {
        setError(e instanceof Error ? e.message : 'Assessment unavailable.');
        setStatus('error');
      }
    } finally {
      if (token === request.current) controller.current = null;
    }
  };
  const presets = cityId === 'pune' ? [{ name: 'Pune central candidate', longitude: 73.86, latitude: 18.52 }, { name: 'Pune western candidate', longitude: 73.74, latitude: 18.59 }] : [{ name: 'Mumbai central candidate', longitude: 72.88, latitude: 19.08 }, { name: 'Navi Mumbai candidate', longitude: 73.02, latitude: 19.12 }];
  return <PageShell>
    <PageHeader
      actions={<Link to="/projects">Persistent project polygons</Link>}
      eyebrow="Analysis"
      title={`${city.name} candidate site evaluation`}
      purpose="Screen a candidate site against pilot evidence, then save the result for side-by-side comparison."
      meta={<>
        <DataModeBadge mode={dataMode} />
        <span className="text-meta text-eco-muted">Saved comparisons are stored in this browser</span>
      </>}
    />
    {storageNotice && <InlineAlert tone="warning">{storageNotice}</InlineAlert>}
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Candidate parameters" footer={`Pilot extent: ${city.extentDescription}`}>
        <form onSubmit={evaluate} className="space-y-4">
          <SiteMapPicker latitude={form.latitude} longitude={form.longitude} siteName={form.name} onCoordinatesChange={coords => updateForm(coords)} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-meta text-eco-muted">Presets</span>
            {presets.map(p => <Button type="button" variant="secondary" size="xs" key={p.name} onClick={() => updateForm(p)}>{p.name}</Button>)}
          </div>
          <Field label="Project name" htmlFor="candidate-name" required>
            <Input id="candidate-name" required value={form.name} onChange={e => updateForm({ name: e.target.value })} />
          </Field>
          <Field label="Infrastructure type" htmlFor="candidate-type">
            <Input id="candidate-type" value={FACILITY_TYPE_LABELS.data_centre} disabled readOnly />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Latitude (°)" htmlFor="candidate-latitude" hint="Decimal degrees; negative values are south.">
              <Input id="candidate-latitude" type="number" step="any" required value={form.latitude} onChange={e => updateForm({ latitude: Number(e.target.value) })} />
            </Field>
            <Field label="Longitude (°)" htmlFor="candidate-longitude" hint="Decimal degrees; negative values are west.">
              <Input id="candidate-longitude" type="number" step="any" required value={form.longitude} onChange={e => updateForm({ longitude: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Capacity (MW)" htmlFor="candidate-capacity">
              <Input id="candidate-capacity" type="number" step="any" min={0} required value={form.capacityMw} onChange={e => updateForm({ capacityMw: Number(e.target.value) })} />
            </Field>
            <Field label="Water demand (kL/day)" htmlFor="candidate-water">
              <Input id="candidate-water" type="number" step="any" min={0} required value={form.waterDemandKld} onChange={e => updateForm({ waterDemandKld: Number(e.target.value) })} />
            </Field>
            <Field label="Power demand (MW)" htmlFor="candidate-power">
              <Input id="candidate-power" type="number" step="any" min={0} required value={form.powerDemandMw} onChange={e => updateForm({ powerDemandMw: Number(e.target.value) })} />
            </Field>
          </div>
          {!coordinatesInCity && (
            <InlineAlert tone="warning">
              Outside {city.name} pilot bounds — pick a point on the map or choose another preset.
            </InlineAlert>
          )}
          <Button type="submit" variant="primary" size="md" className="w-full" loading={busy} disabled={!coordinatesInCity}>
            {busy ? 'Evaluating…' : 'Evaluate candidate'}
          </Button>
        </form>
      </Card>
      <Card
        title="Screening result"
        subtitle={result?.name}
        footer={result ? <SourceTag organization="" status={result.dataStatus} /> : undefined}
      >
        <div aria-live="polite" className="space-y-4">
          {error && <InlineAlert tone="critical">{error}</InlineAlert>}
          {busy && !result && <LoadingSkeleton rows={4} />}
          {!busy && !result && !error && (
            <EmptyState
              title={status === 'invalidated' ? 'Inputs changed — evaluate again for current evidence' : 'Evaluate coordinates to see available evidence'}
              body="Missing environmental observations prevent a suitability ranking."
            />
          )}
          {result && <>
            <InlineAlert tone="info">Assessment completed for current inputs.{result.suitabilityScore === null ? ' Suitability remains unavailable because evidence is insufficient.' : ''}</InlineAlert>
            <MetricTile
              label="Suitability"
              value={result.suitabilityScore === null ? null : result.suitabilityScore.toLocaleString()}
              unit="/100"
              caption={result.suitabilityStatus}
            />
            <dl className="space-y-1">
              <DefinitionRow label="Nearest recorded substation" value={decimal(result.substationDistanceKm)} unit="km" unavailableReason="No recorded substation is available for this candidate." />
              <DefinitionRow label="Protected area distance" value={decimal(result.protectedAreaDistanceKm)} unit="km" unavailableReason="Protected-area distance is not available for this candidate." />
              <DefinitionRow label="Population within 5 km" value={decimal(result.population5km)} unit="people" unavailableReason="Population within 5 km is not available for this candidate." />
              <DefinitionRow label="Groundwater classification" value={result.groundwaterZone === 'Unavailable' ? null : result.groundwaterZone} unavailableReason="Groundwater classification is not available for this candidate." />
            </dl>
            {result.flags.length > 0 && <div className="space-y-1">
              <h4 className="text-meta font-medium text-eco-text">Flags</h4>
              <ul className="space-y-1">
                {result.flags.map(flag => <li key={flag} className="text-meta text-eco-muted">{flag}</li>)}
              </ul>
            </div>}
            <Button type="button" variant="secondary" size="sm" onClick={() => addCandidateSite(result)}>Save to comparison</Button>
          </>}
        </div>
      </Card>
    </div>
    <Card
      title={`Saved ${city.name} candidates (${candidateSites.length})`}
      actions={<Button type="button" variant="secondary" size="xs" onClick={clearCandidateSites}>Clear this city</Button>}
      bodyClassName="p-0"
    >
      <DataTable
        columns={savedColumns}
        rows={candidateSites.map(site => [
          site.name,
          site.suitabilityStatus,
          numberCell(site.suitabilityScore),
          numberCell(site.substationDistanceKm),
          numberCell(site.population5km),
          <span className="text-meta text-eco-muted">{DATA_STATUS_LABELS[site.dataStatus]}</span>,
          <Button type="button" variant="ghost" size="xs" onClick={() => removeCandidateSite(site.id)}>Remove</Button>,
        ])}
        empty={<EmptyState title="No saved candidates in this city." body="Evaluate a candidate and use Save to comparison to build a comparison list." />}
      />
    </Card>
  </PageShell>;
}
