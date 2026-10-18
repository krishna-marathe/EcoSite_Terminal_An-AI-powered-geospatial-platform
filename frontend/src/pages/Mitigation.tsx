import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, Sparkles } from 'lucide-react';
import { useDashboardStore } from '../stores/dashboardStore';
import { getMitigationRecommendations, generateAIMitigationPlan } from '../services/mitigation';
import type { CityId, Facility, MitigationRecommendation } from '../types';
import { Badge, DataModeBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, Select, Textarea } from '../components/ui/Field';
import { PageHeader, PageShell } from '../components/ui/PageHeader';
import { EmptyState, ErrorState, InlineAlert, LoadingSkeleton } from '../components/ui/StateViews';
import { DATA_STATUS_LABELS } from '../theme/tokens';

const PAGE_PURPOSE =
  'Illustrative intervention catalogue per facility, with optional AI advice that is never presented as verified.';

/** Labeled definition line for catalogue evidence fields (label above the value). */
const LabeledLine = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-0.5">
    <p className="text-meta text-eco-muted">{label}</p>
    <p className="text-meta text-eco-text">{value}</p>
  </div>
);

const priorityTone = (priority: MitigationRecommendation['priority']) => {
  if (priority === 'High') return 'critical' as const;
  if (priority === 'Medium') return 'warning' as const;
  return 'secondary' as const;
};

export function Mitigation() {
  const { cityId, dataMode, facilities, facilitiesStatus, facilitiesError, setDataMode } = useDashboardStore();
  const [params, setParams] = useSearchParams();
  const facility = facilities.find(f => f.id === params.get('facility')) ?? facilities[0];

  const header = (
    <PageHeader
      eyebrow="Mitigation"
      title="Mitigation catalogue and optional AI advice"
      purpose={PAGE_PURPOSE}
      meta={
        facility ? (
          <>
            <DataModeBadge mode={dataMode} />
            <span className="text-meta text-eco-muted">
              Facility input status: {DATA_STATUS_LABELS[facility.provenance.dataStatus]} ·{' '}
              {facility.provenance.sourceOrganization}
            </span>
          </>
        ) : null
      }
    />
  );

  if (!facility) {
    return (
      <PageShell>
        {header}
        <Card title="Facility mitigation plan">
          {facilitiesStatus === 'loading' ? (
            <LoadingSkeleton rows={4} />
          ) : facilitiesStatus === 'error' ? (
            <ErrorState
              title="Facility data could not be loaded"
              cause={facilitiesError ?? 'The facility request failed before any records were returned.'}
              onDemo={() => setDataMode('demo')}
            />
          ) : (
            <EmptyState
              title="No facilities available in this city and data mode."
              body="Switch city or data mode to open a mitigation plan."
            />
          )}
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {header}

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Facility" htmlFor="mitigation-facility" className="w-full max-w-md">
          <Select
            id="mitigation-facility"
            value={facility.id}
            onChange={event => setParams({ facility: event.target.value })}
          >
            {facilities.map(item => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <FacilityMitigation key={`${cityId}-${dataMode}-${facility.id}`} cityId={cityId} facility={facility} />
    </PageShell>
  );
}

function FacilityMitigation({ cityId, facility }: { cityId: CityId; facility: Facility }) {
  const [recommendations, setRecommendations] = useState<MitigationRecommendation[]>([]);
  const [constraints, setConstraints] = useState('');
  const [source, setSource] = useState<'catalog' | 'ai'>('catalog');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [catalogSettled, setCatalogSettled] = useState(false);
  const active = useRef(true);
  const storageKey = `ecosite-mitigation-${cityId}-${facility.id}`;

  useEffect(() => {
    active.current = true;
    getMitigationRecommendations(facility.type).then(items => {
      if (active.current) {
        setRecommendations(items);
        setCatalogSettled(true);
        try { localStorage.setItem(storageKey, JSON.stringify({ recommendations: items, source: 'catalog', constraints: '', generatedAt: new Date().toISOString() })); } catch { setError('Plan could not be saved in this browser.'); }
      }
    });
    return () => { active.current = false; };
  }, [facility.type, storageKey]);

  const generate = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const items = await generateAIMitigationPlan({ facility_id: facility.id, facility_type: facility.type, constraints }, facility);
      if (!active.current) return;
      setRecommendations(items); setSource('ai');
      try { localStorage.setItem(storageKey, JSON.stringify({ recommendations: items, source: 'ai', constraints, generatedAt: new Date().toISOString() })); } catch { setError('AI advice received, but could not be saved in this browser.'); }
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : 'AI request failed.'); }
    finally { if (active.current) setBusy(false); }
  };

  return (
    <>
      {error && <InlineAlert tone="critical">{error}</InlineAlert>}

      <Card
        title={source === 'catalog' ? 'Illustrative intervention catalogue' : 'AI-generated advice — unverified'}
        subtitle={facility.name}
        icon={<ClipboardList className="h-4 w-4" />}
        status={`${recommendations.length} actions`}
        statusTone={source === 'ai' ? 'warning' : 'neutral'}
        footer="Recommendations require engineering and regulatory verification; benefits are unverified."
      >
        {source === 'ai' && (
          <InlineAlert tone="warning" className="mb-3">
            Generated by an AI model from the constraints below; no site inspection or engineering
            review has validated these actions.
          </InlineAlert>
        )}

        {!catalogSettled && source === 'catalog' ? (
          <LoadingSkeleton rows={3} />
        ) : recommendations.length === 0 ? (
          <EmptyState title="No catalogue actions match this facility type." />
        ) : (
          <ul className="space-y-3">
            {recommendations.map((item, index) => (
              <li
                key={`${item.id}-${index}`}
                className="space-y-2 rounded-sm border border-eco-border bg-eco-surface-secondary/50 p-3"
              >
                <h4 className="text-body font-medium text-eco-text">{item.title}</h4>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{item.category}</Badge>
                  <Badge variant={priorityTone(item.priority)}>{item.priority} priority</Badge>
                  <Badge variant="outline">{item.timeframe}</Badge>
                </div>
                <div className="space-y-2">
                  <LabeledLine label="Expected benefit" value={item.expectedBenefit} />
                  <LabeledLine label="Evidence" value={item.supportingEvidence} />
                  <LabeledLine label="Verification" value={item.verificationRequirements} />
                  <LabeledLine label="Owner" value={item.responsibleStakeholder} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Optional AI advice"
        subtitle="Request a site-specific plan using your configured Google Gemini key"
        icon={<Sparkles className="h-4 w-4" />}
      >
        <form onSubmit={generate} className="space-y-3">
          <Field
            label="Optional constraints"
            htmlFor="mitigation-constraints"
            hint="Land availability, budget ceiling, water reuse targets or other planning limits."
          >
            <Textarea
              id="mitigation-constraints"
              value={constraints}
              onChange={event => setConstraints(event.target.value)}
            />
          </Field>
          <p className="text-meta text-eco-muted">
            Optional AI requests send this facility's indicators and constraints to Google using your
            configured key and model.
          </p>
          <Button type="submit" variant="primary" size="md" loading={busy}>
            {busy ? 'Requesting AI advice…' : 'Request optional AI advice'}
          </Button>
        </form>
      </Card>
    </>
  );
}
