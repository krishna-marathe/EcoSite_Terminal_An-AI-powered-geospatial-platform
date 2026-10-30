import { useMemo, useState } from 'react';
import { ExternalLink, List, Map as MapIcon, MapPin, Search, Server } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PublicFacilityMap } from '../components/facilities';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Input, Select } from '../components/ui/Field';
import { PageHeader, PageShell } from '../components/ui/PageHeader';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState, ErrorState, InlineAlert, LoadingSkeleton } from '../components/ui/StateViews';
import { getPublicFacilities, getPublicFacilitySummary } from '../services/publicFacilities';
import type { CapacityType, PublicFacility, PublicStateCode } from '../types/publicFacilities';

const STATES: Array<{ code: PublicStateCode; name: string }> = [
  { code: 'IN-MH', name: 'Maharashtra' }, { code: 'IN-TG', name: 'Telangana' },
  { code: 'IN-KA', name: 'Karnataka' }, { code: 'IN-TN', name: 'Tamil Nadu' },
];
const CAPACITY_LABELS: Record<CapacityType, string> = { it_load: 'IT load', total_power: 'Total power', power_capacity: 'Power capacity', power_capacity_unspecified: 'Published capacity' };
const capacityText = (facility: PublicFacility) => facility.capacityDisclosures.length
  ? facility.capacityDisclosures.map((item) => `${item.value} ${item.unit} ${CAPACITY_LABELS[item.capacityType]}`).join(' · ')
  : 'Not publicly disclosed';
const provenanceLabel = (facility: PublicFacility) => ({ government_verified: 'Government verified', public_operator_confirmed: 'Operator confirmed', credible_public_report: 'Credible public source' })[facility.verification.status];

export function PublicFacilities() {
  const navigate = useNavigate();
  const [state, setState] = useState<PublicStateCode | 'all'>('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'map' | 'list'>(() => {
    try {
      const saved = localStorage.getItem('eco-public-facilities-view');
      if (saved === 'map' || saved === 'list') return saved;
    } catch {}
    return 'list';
  });

  const handleSetView = (nextView: 'map' | 'list') => {
    setView(nextView);
    try {
      localStorage.setItem('eco-public-facilities-view', nextView);
    } catch {}
  };

  const facilities = useQuery({ queryKey: ['public-facilities', state], queryFn: () => getPublicFacilities(state === 'all' ? {} : { state }), retry: false });
  const summary = useQuery({ queryKey: ['public-facility-summary'], queryFn: getPublicFacilitySummary, retry: false });
  const filtered = useMemo(() => {
    const records = facilities.data?.items ?? [];
    const needle = query.trim().toLowerCase();
    return needle ? records.filter((facility) => [facility.name, facility.operator, facility.city, facility.locality, facility.state].some((value) => value.toLowerCase().includes(needle))) : records;
  }, [facilities.data, query]);
  const operators = new Set(filtered.map((facility) => facility.operator)).size;

  return <PageShell>
    <PageHeader eyebrow="Public registry" title="Operational data centres" purpose="Publicly disclosed operating facilities in the four-state scope, with source and verification freshness." meta={<><Badge variant="primary" size="xs">Operational only</Badge><Badge variant="outline" size="xs">Locality-level map data</Badge></>} />
    <InlineAlert>Capacity values retain the publisher&apos;s original measurement boundary. IT load, total power and campus design capacity are not added together.</InlineAlert>
    {summary.isLoading ? <LoadingSkeleton variant="tiles" rows={3} /> : summary.error ? <ErrorState title="Registry summary unavailable" cause="Start the Eco Terminal backend and retry." onRetry={() => void summary.refetch()} /> : <div className="grid gap-3 sm:grid-cols-3">
      <Card title="Operating facilities"><p className="font-mono text-h1 text-eco-primary">{summary.data?.operationalFacilityCount ?? 0}</p><p className="text-meta text-eco-muted">Verified within the last 90 days</p></Card>
      <Card title="Operators"><p className="font-mono text-h1 text-eco-text">{summary.data?.operatorCount ?? 0}</p><p className="text-meta text-eco-muted">Across public records</p></Card>
      <Card title="Geographic scope"><p className="font-mono text-h1 text-eco-text">4</p><p className="text-meta text-eco-muted">Target states</p></Card>
    </div>}
    <Card title="Facility registry" subtitle={`${facilities.data?.total ?? filtered.length} facilities · ${operators} operators`} actions={<div className="flex rounded border border-eco-border p-0.5"><button type="button" aria-pressed={view === 'map'} onClick={() => handleSetView('map')} className={`flex items-center gap-1 rounded px-2 py-1 text-meta ${view === 'map' ? 'bg-eco-surface-secondary text-eco-primary' : 'text-eco-muted'}`}><MapIcon className="h-3.5 w-3.5" />Map</button><button type="button" aria-pressed={view === 'list'} onClick={() => handleSetView('list')} className={`flex items-center gap-1 rounded px-2 py-1 text-meta ${view === 'list' ? 'bg-eco-surface-secondary text-eco-primary' : 'text-eco-muted'}`}><List className="h-3.5 w-3.5" />List</button></div>}>
      <div className="mb-4 grid gap-3 md:grid-cols-[220px_1fr]"><Select aria-label="Filter by state" value={state} onChange={(event) => setState(event.target.value as PublicStateCode | 'all')}><option value="all">All four states</option>{STATES.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</Select><div className="relative"><Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-eco-muted" /><Input aria-label="Search public registry" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search facility, operator, city or locality" className="pl-8" /></div></div>
      {facilities.isLoading ? <LoadingSkeleton rows={6} /> : facilities.error ? <ErrorState title="Public registry unavailable" cause="The read-only registry API could not be reached." onRetry={() => void facilities.refetch()} /> : view === 'map' ? (
        filtered.length ? <PublicFacilityMap facilities={filtered} onSelectFacility={(facility) => navigate(`/public-facilities/${facility.id}`)} /> : <EmptyState title="No operating facilities match" body="Change the state or search filters." icon={<Server className="h-5 w-5" />} />
      ) : <DataTable dense columns={[{ key: 'facility', header: 'Facility' }, { key: 'location', header: 'Public location' }, { key: 'capacity', header: 'Published capacity' }, { key: 'source', header: 'Provenance' }]} rows={filtered.map((facility) => [
        <div key="facility"><Link to={`/public-facilities/${facility.id}`} className="font-medium text-eco-primary hover:underline">{facility.name}</Link><p className="text-meta text-eco-muted">{facility.operator}</p></div>,
        <div key="location" className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-eco-muted" /><span>{facility.locality}, {facility.state}<span className="block text-micro uppercase text-eco-muted">Generalised {facility.locationPrecision}</span></span></div>,
        <span key="capacity" className="text-meta">{capacityText(facility)}</span>,
        <div key="source"><a href={facility.verification.source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-eco-primary hover:underline">{provenanceLabel(facility)}<ExternalLink className="h-3 w-3" /></a><p className="text-micro text-eco-muted">Checked {facility.verification.verifiedAt} · expires {facility.verification.expiresAt}</p></div>,
      ])} empty={<EmptyState title="No operating facilities match" body="Change the state or search filters." icon={<Server className="h-5 w-5" />} />} />}
    </Card>
  </PageShell>;
}
