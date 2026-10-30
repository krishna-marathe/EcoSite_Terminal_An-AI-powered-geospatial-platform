import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Printer, FileSpreadsheet } from 'lucide-react';
import './Reports.css';
import { useDashboardStore } from '../stores/dashboardStore';
import { getPilotCity, SCORING_VERSION } from '../data/pilotCities';
import { downloadCsv, downloadFile } from '../utils/csvExport';
import { buildPlanningDossier } from '../utils/planningReport';
import { Button } from '../components/ui/Button';
import { DataModeBadge, RiskBadge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Input } from '../components/ui/Field';
import { DefinitionRow } from '../components/ui/MetricTile';
import { PageHeader, PageShell } from '../components/ui/PageHeader';
import { EmptyState, ErrorState, InlineAlert } from '../components/ui/StateViews';
import { DATA_STATUS_LABELS, FACILITY_TYPE_LABELS } from '../theme/tokens';
import { readPlan, inContext } from '../utils/savedContext';

/**
 * Scenario severity ladder — one mapping shared by the on-screen
 * "Sensitivity scenario" label and the candidates CSV severity column, so a
 * row labelled "None" exports 0 and an applied scenario exports 1–4
 * monotonically: none 0 · low 1 · moderate 2 · high 3 · critical 4.
 * The scenario engine ranges over 10–80% stress; percentage bands map onto the
 * ladder as: ≤20 low, ≤40 moderate, ≤60 high, >60 critical.
 */
const SCENARIO_SEVERITY_CODES = { none: 0, low: 1, moderate: 2, high: 3, critical: 4 } as const;
type ScenarioSeverityLevel = keyof typeof SCENARIO_SEVERITY_CODES;

const scenarioSeverityLevel = (severityPercent: number | null): ScenarioSeverityLevel => {
  if (severityPercent === null) return 'none';
  if (severityPercent <= 20) return 'low';
  if (severityPercent <= 40) return 'moderate';
  if (severityPercent <= 60) return 'high';
  return 'critical';
};

export const Reports: React.FC = () => {
  const { cityId, dataMode, facilities, facilitiesStatus, facilitiesError, savedCandidates, savedScenarios, storageNotice, selectedFacilityId, setSelectedFacilityId, setDataMode } = useDashboardStore();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const city = getPilotCity(cityId);
  const selectedFacility = facilities.find((facility) => facility.id === (params.get('facility') || selectedFacilityId)) || facilities[0];
  const savedPlan = selectedFacility ? readPlan(dataMode, cityId, selectedFacility.id) : null;
  const dossier = buildPlanningDossier({ cityId, dataMode, facilities, candidateSites: savedCandidates, scenario: savedScenarios.find(record => inContext(record, dataMode, cityId)) ?? null, mitigationPlan: savedPlan?.record });
  const plan = dossier.mitigationPlan;
  const scenario = dossier.scenario;
  const filtered = dossier.facilities.filter((facility) => `${facility.name} ${facility.type} ${facility.district}`.toLowerCase().includes(search.toLowerCase()));
  const filename = `ecosite-${dataMode}-${cityId}-${new Date().toISOString().slice(0, 10)}`;
  const measurement = (value: number | null, suffix = '') => value == null ? 'Unavailable' : `${value.toLocaleString()}${suffix}`;
  const canExport = facilitiesStatus === 'ready';

  const scenarioLevel = scenarioSeverityLevel(scenario ? scenario.severity : null);
  const scenarioSummary = scenario
    ? `${scenario.type.replaceAll('_', ' ')} · ${scenarioLevel} severity · ${scenario.severity}% stress applied`
    : 'None applied';

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `Eco Terminal dossier — ${city.name}`;
    return () => { document.title = previousTitle; };
  }, [city.name]);

  const exportFacilities = () => downloadCsv(`${filename}-facilities.csv`, [
    ['Mode', 'City', 'ID', 'Name', 'Type', 'Longitude', 'Latitude', 'Capacity MW', 'Risk index /100', 'Data status', 'Source', 'Updated', 'Scoring version'],
    ...filtered.map((f) => [dataMode, cityId, f.id, f.name, f.type, ...f.coordinates, f.capacityMw ?? null, f.overallRiskScore, f.provenance.dataStatus, f.provenance.sourceOrganization, f.provenance.lastUpdated, SCORING_VERSION]),
  ]);
  const exportCandidates = () => downloadCsv(`${filename}-candidates.csv`, [
    ['Mode', 'City', 'Name', 'Longitude', 'Latitude', 'Suitability /100', 'Status', 'Substation km', 'Protected area km', 'Population 5km', 'Data status', 'Scenario', 'Scenario severity level (0 none – 4 critical)'],
    ...dossier.candidateSites.map((site) => [dataMode, cityId, site.name, ...site.coordinates, site.suitabilityScore, site.suitabilityStatus, site.substationDistanceKm, site.protectedAreaDistanceKm, site.population5km, site.dataStatus, scenario ? scenario.type.replaceAll('_', ' ') : 'None', SCENARIO_SEVERITY_CODES[scenarioLevel]]),
  ]);

  const facilityRows = filtered.map((f) => [
    <button type="button" onClick={() => setSelectedFacilityId(f.id)} className="text-left text-eco-primary hover:underline">
      {f.name}
    </button>,
    FACILITY_TYPE_LABELS[f.type],
    <RiskBadge level={f.riskLevel} score={f.overallRiskScore} />,
    DATA_STATUS_LABELS[f.provenance.dataStatus],
    <span>
      {f.provenance.sourceOrganization}
      <br />
      <span className="text-meta text-eco-muted">{f.provenance.lastUpdated}</span>
    </span>,
  ]);

  return (
    <PageShell>
      <article className="planning-report space-y-6">
        <PageHeader
          eyebrow="Output"
          title={`${city.name} planning dossier`}
          purpose="Printable dossier of planning context, facility register, saved candidates and the saved mitigation plan."
          meta={
            <>
              <DataModeBadge mode={dataMode} />
              <span className="font-mono text-meta text-eco-muted">Scoring version {SCORING_VERSION}</span>
              <span className="font-mono text-meta text-eco-muted">{dossier.facilities.length} facilities</span>
            </>
          }
          actions={
            <div className="print-hidden flex flex-wrap items-center gap-2">
              <Button disabled={!canExport} icon={<Download className="h-4 w-4" />} onClick={() => downloadFile(`${filename}-dossier.json`, JSON.stringify(dossier, null, 2), 'application/json')}>Export planning dossier</Button>
              <Button disabled={!canExport} icon={<FileSpreadsheet className="h-4 w-4" />} onClick={exportFacilities}>Export visible facilities CSV</Button>
              <Button onClick={exportCandidates} disabled={!dossier.candidateSites.length}>Export candidates CSV</Button>
              <Button icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print</Button>
            </div>
          }
        />

        {/* Print-only header: browser print headers use document.title, this block repeats the context on paper. */}
        <div className="print-only space-y-1 border-b border-eco-border pb-3">
          <p className="text-h2 font-semibold text-eco-text">{city.name} planning dossier</p>
          <p className="text-meta text-eco-muted">
            Generated {dossier.generatedAt} · Data mode: {dataMode === 'demo' ? 'Synthetic demo' : 'Backend API'} · Scoring version {SCORING_VERSION}
          </p>
        </div>

        <InlineAlert tone="warning">
          {dataMode === 'demo'
            ? 'Demo mode: synthetic planning examples. Saved candidates and scenarios are stored in this browser only.'
            : 'API mode: individual sources may still contain synthetic or estimated data. Saved candidates and scenarios are stored in this browser only.'}
        </InlineAlert>

        {storageNotice && <InlineAlert tone="warning">{storageNotice}</InlineAlert>}
        {savedPlan?.notice && <InlineAlert tone="warning">{savedPlan.notice}</InlineAlert>}
        <Card title="Planning context">
          <dl className="grid gap-x-8 sm:grid-cols-2">
            <DefinitionRow label="Planning area" value={city.name} />
            <DefinitionRow label="Scoring version" value={SCORING_VERSION} />
            <DefinitionRow label="Facilities in scope" value={dossier.facilities.length} />
            <DefinitionRow label="Saved candidates" value={dossier.candidateSites.length} />
            <DefinitionRow label="Sensitivity scenario" value={scenarioSummary} />
          </dl>
          <p className="pt-2 text-meta text-eco-muted">{dossier.scenarioMethodology}</p>
        </Card>

        <Card title="Facility register" status={`${dossier.facilities.length} facilities`}>
          <div className="space-y-3">
            <div className="print-hidden w-full max-w-sm space-y-1">
              <label htmlFor="report-facility-search" className="block text-meta font-medium text-eco-text">Search facilities</label>
              <Input
                id="report-facility-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, type or district"
              />
            </div>
            {facilitiesStatus === 'loading' ? (
              <DataTable columns={[{ key: 'facility', header: 'Facility' }]} rows={[]} loading />
            ) : facilitiesStatus === 'error' ? (
              <ErrorState
                title="Facility data could not be loaded"
                cause={facilitiesError ?? 'Reconnect to the backend or switch to synthetic demo mode.'}
                onDemo={() => setDataMode('demo')}
              />
            ) : (
              <DataTable
                columns={[
                  { key: 'facility', header: 'Facility' },
                  { key: 'type', header: 'Type' },
                  { key: 'risk', header: 'Risk index' },
                  { key: 'status', header: 'Data status' },
                  { key: 'source', header: 'Source / updated' },
                ]}
                rows={facilityRows}
                empty={
                  <EmptyState
                    title={dossier.facilities.length ? 'No facilities match this search.' : `No facilities in ${city.name} for this data mode.`}
                    body="Clear the search or switch city and data mode."
                  />
                }
              />
            )}
          </div>
        </Card>

        <Card title="Saved candidate comparison" status={`${dossier.candidateSites.length} candidates`}>
          <DataTable
            columns={[
              { key: 'candidate', header: 'Candidate' },
              { key: 'status', header: 'Status' },
              { key: 'suitability', header: 'Suitability /100', align: 'right', mono: true },
              { key: 'substation', header: 'Substation km', align: 'right', mono: true },
              { key: 'protected', header: 'Protected area km', align: 'right', mono: true },
              { key: 'population', header: 'Population (people)', align: 'right', mono: true },
            ]}
            rows={dossier.candidateSites.map((site) => [
              site.name,
              <span>
                {site.suitabilityStatus}
                <br />
                <span className="text-meta text-eco-muted">{DATA_STATUS_LABELS[site.dataStatus]}</span>
              </span>,
              measurement(site.suitabilityScore),
              measurement(site.substationDistanceKm),
              measurement(site.protectedAreaDistanceKm),
              measurement(site.population5km),
            ])}
            empty={
              <EmptyState
                title={`No saved candidates in ${city.name}.`}
                body="Evaluate a site to add it to this comparison."
                action={{ label: 'Evaluate a site', to: '/site-analysis' }}
              />
            }
          />
        </Card>

        <Card title={`Mitigation plan${selectedFacility ? ` · ${selectedFacility.name}` : ''}`}>
          {plan ? (
            <div className="space-y-3">
              <p className="text-meta text-eco-muted">
                Source: {plan.source === 'ai' ? 'AI-generated advice (unverified)' : 'Illustrative intervention catalogue'} · Generated: {plan.generatedAt} · Constraints: {plan.constraints || 'None supplied'}. Benefits require site-specific verification.
              </p>
              <Button className="print-hidden" onClick={() => downloadCsv(`${filename}-mitigation.csv`, [['Mode', 'City', 'Facility', 'Action', 'Priority', 'Benefit assumption', 'Verification', 'Source'], ...plan.recommendations.map((rec) => [dataMode, cityId, selectedFacility.name, rec.title, rec.priority, rec.expectedBenefit, rec.verificationRequirements, plan.source])])}>Export mitigation CSV</Button>
              <ul className="space-y-3">
                {plan.recommendations.map((rec) => (
                  <li key={rec.id} className="rounded-sm border border-eco-border p-3">
                    <p className="text-body font-medium text-eco-text">{rec.title}</p>
                    <p className="text-meta text-eco-text">{rec.expectedBenefit}</p>
                    <p className="text-meta text-eco-muted">Verify: {rec.verificationRequirements}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState
              title={`No saved plan for ${selectedFacility ? selectedFacility.name : 'this facility'}.`}
              body="Prepare a mitigation plan to include it in this dossier."
              action={{ label: 'Prepare a mitigation plan', to: selectedFacility ? `/mitigation?facility=${encodeURIComponent(selectedFacility.id)}` : '/mitigation' }}
            />
          )}
        </Card>

        <Card title="Evidence and limitations">
          <ul className="list-disc space-y-1 pl-5 text-meta text-eco-muted">
            {dossier.limitations.map((note) => <li key={note}>{note}</li>)}
          </ul>
          <p className="pt-2 text-meta text-eco-muted">Generated {dossier.generatedAt}. This dossier records planning assumptions and does not establish environmental clearance.</p>
        </Card>
      </article>
    </PageShell>
  );
};
