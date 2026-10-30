import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getProjects,
  createProject,
  getSites,
  saveSite,
  archiveSite,
  projectError,
  type Project,
  type CandidateSite,
  type PolygonGeometry,
} from '../services/projects';
import { PolygonEditor } from '../components/site-analysis/PolygonEditor';
import { PageHeader, PageShell } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PhaseEditor } from '../components/projects/PhaseEditor';
import { EnvironmentalObservations } from '../components/projects/EnvironmentalObservations';
import { EvidenceWorkspace } from '../components/projects/EvidenceWorkspace';
import { ResourceReadinessTimeline } from '../components/projects/ResourceReadinessTimeline';
import { ExtractionReviewDrawer } from '../components/projects/ExtractionReviewDrawer';
import { SiteComparisonMatrix } from '../components/projects/SiteComparisonMatrix';
import { SitePassport } from '../components/projects/SitePassport';
import { IndustryBenchmarksSection } from '../components/projects/IndustryBenchmarksSection';
import { SiteConstraintsModal } from '../components/projects/SiteConstraintsModal';
import { EnergyWaterScenarioCalculator } from '../components/projects/EnergyWaterScenarioCalculator';
import { getSiteObservations, type Observation } from '../services/observations';
import { evidenceService } from '../services/evidence';
import { readinessService, formatReadinessError } from '../services/readiness';
import type { EvidenceUploadMetadata } from '../types/evidence';
import { getPhases } from '../services/phases';
import { ShieldCheck, SlidersHorizontal } from 'lucide-react';

function useMounted() {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}

export function Projects() {
  const mounted = useMounted();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();

  const projects = useQuery({
    queryKey: ['local-projects'],
    queryFn: ({ signal }) => getProjects(signal),
    retry: false,
  });

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const projectId = params.get('project') || '';
  const project = projects.data?.items.find((item) => item.id === projectId);

  return (
    <PageShell>
      <PageHeader
        title="Four-state data-centre site planning"
        purpose="Create and compare candidate polygons in Maharashtra, Telangana, Karnataka and Tamil Nadu. Screening evidence supports planning; it is not a legal clearance."
        eyebrow="Projects"
      />
      <p className="text-body text-eco-muted">
        Candidate projects are stored in the local backend and remain separate from the public operating-facility registry.
      </p>

      {projects.isPending && <p className="text-meta text-eco-muted">Loading projects…</p>}
      {projects.error && <p role="alert" className="text-meta text-eco-accent">{projectError(projects.error)}</p>}

      <Card
        title="Candidate Portfolio & Project Selector"
        subtitle="Select an active planning project or initialize a new candidate portfolio"
        className="my-3"
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="block text-meta font-medium text-eco-text">
              Project
              <select
                aria-label="Project"
                value={projectId}
                disabled={busy}
                onChange={(e) => setParams({ project: e.target.value })}
                className="mt-1 block w-full rounded border border-eco-border bg-eco-surface-secondary px-3 py-2 text-body text-eco-text shadow-sm focus:border-eco-primary focus:outline-none"
              >
                <option value="">Select a project</option>
                {projects.data?.items.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>

            {projects.data?.items && projects.data.items.length > 0 && !projectId && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-micro uppercase tracking-wide text-eco-muted">Quick open:</span>
                {projects.data.items.slice(0, 3).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setParams({ project: item.id })}
                    className="inline-flex items-center gap-1.5 rounded border border-eco-border bg-eco-surface px-2.5 py-1 text-meta text-eco-primary hover:border-eco-primary/50"
                  >
                    <span>{item.name}</span>
                    <span className="text-micro text-eco-muted capitalize">({item.archetype})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {projects.data && projects.data.total > projects.data.items.length && (
            <p className="text-micro text-eco-muted">Showing the first 100 projects.</p>
          )}

          <details className="rounded border border-eco-border bg-eco-surface-secondary/40 p-3">
            <summary className="cursor-pointer font-medium text-eco-primary hover:underline">Create project</summary>
            <form
              className="mt-3 space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                setBusy(true);
                setError('');
                try {
                  const result = await createProject({
                    name: String(data.get('name')),
                    organization_label: String(data.get('organization')),
                    archetype: String(data.get('archetype')),
                  });
                  await queryClient.invalidateQueries({ queryKey: ['local-projects'] });
                  if (mounted.current) setParams({ project: result.id });
                } catch (err) {
                  setError(projectError(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-meta font-medium text-eco-text">
                  Project name
                  <input
                    name="name"
                    required
                    maxLength={200}
                    disabled={busy}
                    className="mt-1 block w-full rounded border border-eco-border bg-eco-surface px-3 py-1.5 text-body text-eco-text"
                  />
                </label>
                <label className="block text-meta font-medium text-eco-text">
                  Organization label
                  <input
                    name="organization"
                    required
                    maxLength={200}
                    disabled={busy}
                    className="mt-1 block w-full rounded border border-eco-border bg-eco-surface px-3 py-1.5 text-body text-eco-text"
                  />
                </label>
                <label className="block text-meta font-medium text-eco-text">
                  Data-centre archetype
                  <select
                    name="archetype"
                    disabled={busy}
                    className="mt-1 block w-full rounded border border-eco-border bg-eco-surface px-3 py-1.5 text-body text-eco-text"
                  >
                    {['enterprise', 'colocation', 'hyperscale', 'edge', 'other'].map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </label>
              </div>
              <Button disabled={busy}>Create project</Button>
            </form>
          </details>

          {error && <p role="alert" className="text-meta text-eco-accent">{error}</p>}
        </div>
      </Card>

      {projectId && !projects.isPending && projects.data && !project && (
        <p role="alert" className="text-meta text-eco-accent">Selected project is unavailable or archived.</p>
      )}

      {project && <PhaseEditor key={`phases:${project.id}`} projectId={project.id} />}
      {project && <ProjectSites key={project.id} project={project} onBusy={setBusy} />}
      {project && <ProjectEvidence key={`evidence:${project.id}`} projectId={project.id} onBusy={setBusy} />}
    </PageShell>
  );
}

function ProjectEvidence({ projectId, onBusy }: { projectId: string; onBusy: (busy: boolean) => void }) {
  const queryClient = useQueryClient();
  const [isReviewDrawerOpen, setIsReviewDrawerOpen] = useState(false);

  const artifactsQuery = useQuery({
    queryKey: ['evidence-artifacts', projectId],
    queryFn: () => evidenceService.getArtifacts(projectId),
  });

  const assertionsQuery = useQuery({
    queryKey: ['evidence-assertions', projectId],
    queryFn: () => evidenceService.getAssertions(projectId),
  });

  const extractionsQuery = useQuery({
    queryKey: ['evidence-extractions', projectId],
    queryFn: () => evidenceService.getExtractions(projectId),
  });

  const readinessQuery = useQuery({
    queryKey: ['project-readiness', projectId],
    queryFn: ({ signal }) => readinessService.getProjectReadiness(projectId, undefined, signal),
    enabled: Boolean(projectId),
  });

  const handleUpload = async (file: File, metadata: EvidenceUploadMetadata) => {
    onBusy(true);
    try {
      await evidenceService.uploadArtifact(projectId, file, metadata);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['evidence-artifacts', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['evidence-assertions', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['evidence-extractions', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['project-readiness', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['project-comparisons', projectId] }),
      ]);
    } finally {
      onBusy(false);
    }
  };

  const handleReview = async (assertionId: string, decision: 'VERIFIED_WITHIN_SCOPE' | 'REJECTED' | 'FLAG_CONFLICT') => {
    onBusy(true);
    try {
      await evidenceService.reviewAssertion({
        assertion_id: assertionId,
        decision,
        reviewer_role: 'CONSULTANT',
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['evidence-assertions', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['project-readiness', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['project-comparisons', projectId] }),
      ]);
    } finally {
      onBusy(false);
    }
  };

  const handleConfirmExtraction = async (
    extractionId: string,
    decision: 'ACCEPTED' | 'REJECTED',
    adjustedValue?: string | number
  ) => {
    onBusy(true);
    try {
      await evidenceService.confirmExtraction(extractionId, decision, adjustedValue, undefined, projectId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['evidence-extractions', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['evidence-assertions', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['project-readiness', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['project-comparisons', projectId] }),
      ]);
    } finally {
      onBusy(false);
    }
  };

  const phasesQuery = useQuery({
    queryKey: ['project-phases', projectId],
    queryFn: () => getPhases(projectId),
  });

  return (
    <div className="space-y-4">
      <ResourceReadinessTimeline
        phases={phasesQuery.data || []}
        assertions={assertionsQuery.data || []}
        readinessReport={readinessQuery.data}
        loading={readinessQuery.isPending && phasesQuery.isPending}
        error={readinessQuery.error ? formatReadinessError(readinessQuery.error) : null}
      />
      <EvidenceWorkspace
        projectId={projectId}
        artifacts={artifactsQuery.data || []}
        assertions={assertionsQuery.data || []}
        onUpload={handleUpload}
        onReviewAssertion={handleReview}
        onOpenReviewer={() => setIsReviewDrawerOpen(true)}
        busy={artifactsQuery.isFetching || assertionsQuery.isFetching}
      />
      <ExtractionReviewDrawer
        isOpen={isReviewDrawerOpen}
        onClose={() => setIsReviewDrawerOpen(false)}
        extractions={extractionsQuery.data || []}
        onConfirm={handleConfirmExtraction}
      />
    </div>
  );
}

function ProjectSites({ project, onBusy }: { project: Project; onBusy: (busy: boolean) => void }) {
  const mounted = useMounted();
  const queryClient = useQueryClient();
  const sites = useQuery({
    queryKey: ['project-sites', project.id],
    queryFn: () => getSites(project.id),
  });
  const data = sites.data || [];

  const [selectedId, selectId] = useState<string | undefined>();
  const [selected, setSelected] = useState<CandidateSite | undefined>();
  const [name, setName] = useState('');
  const [state, setState] = useState('IN-MH');
  const [district, setDistrict] = useState('');
  const [geometry, setGeometry] = useState<PolygonGeometry | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, updateBusy] = useState(false);

  const setBusy = (value: boolean) => {
    updateBusy(value);
    onBusy(value);
  };
  const [editorVersion, setEditorVersion] = useState(0);

  const choose = (site?: CandidateSite) => {
    selectId(site?.id);
    setEditorVersion((n) => n + 1);
    setSelected(site);
    setName(site?.name || '');
    setState(site?.state_code || 'IN-MH');
    setDistrict(site?.district || '');
    setGeometry(site?.geometry || null);
    setError('');
    setMessage('');
  };

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['project-sites', project.id] }),
      queryClient.invalidateQueries({ queryKey: ['project-comparisons', project.id] }),
      queryClient.invalidateQueries({ queryKey: ['project-readiness', project.id] }),
    ]);

  const [passportSite, setPassportSite] = useState<CandidateSite | null>(null);
  const [constraintsSite, setConstraintsSite] = useState<CandidateSite | null>(null);
  const [showScenarios, setShowScenarios] = useState(false);

  const phasesQuery = useQuery({
    queryKey: ['project-phases', project.id],
    queryFn: () => getPhases(project.id),
  });
  const assertionsQuery = useQuery({
    queryKey: ['evidence-assertions', project.id],
    queryFn: () => evidenceService.getAssertions(project.id),
  });
  const artifactsQuery = useQuery({
    queryKey: ['evidence-artifacts', project.id],
    queryFn: () => evidenceService.getArtifacts(project.id),
  });
  const comparisonsQuery = useQuery({
    queryKey: ['project-comparisons', project.id],
    queryFn: ({ signal }) => readinessService.getProjectComparisons(project.id, signal),
    enabled: Boolean(project.id),
  });
  const passportQuery = useQuery({
    queryKey: ['site-passport', project.id, passportSite?.id],
    queryFn: ({ signal }) => readinessService.getSitePassport(project.id, passportSite!.id, signal),
    enabled: Boolean(passportSite?.id),
  });
  const siteObservationsQuery = useQuery({
    queryKey: ['candidate-observations-map', data.map((s) => s.id).join(',')],
    queryFn: async () => {
      const map: Record<string, Observation[]> = {};
      await Promise.all(
        data.map(async (s) => {
          try {
            const res = await getSiteObservations(s.id);
            map[s.id] = res.items;
          } catch {
            map[s.id] = [];
          }
        })
      );
      return map;
    },
    enabled: data.length > 0,
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Saved candidate polygons">
          <p className="text-body text-eco-muted mb-3">{data.length} / 3 active candidates</p>
          <Button type="button" disabled={busy} onClick={() => choose()}>
            New candidate
          </Button>
          <div className="mt-3 space-y-3">
            {data.map((site) => (
              <div key={site.id} className="rounded border border-eco-border bg-eco-surface-secondary/30 p-3 space-y-2">
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <Button type="button" disabled={busy} onClick={() => choose(site)}>
                    {site.name}
                  </Button>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => setPassportSite(site)}
                      className="text-micro py-1 px-2 border-eco-primary text-eco-primary hover:bg-eco-primary/10"
                    >
                      📜 Passport
                    </Button>
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => setConstraintsSite(site)}
                      className="text-micro py-1 px-2 border-amber-500/50 text-amber-300 hover:bg-amber-500/10"
                    >
                      <ShieldCheck className="h-3 w-3 inline mr-1" />
                      Constraints
                    </Button>
                  </div>
                </div>
                <p className="text-meta text-eco-muted">{site.area_ha.toFixed(4)} ha · {site.state_code} · revision {site.revision}</p>
                <p className="text-micro text-eco-muted">Boundary screening: {site.boundary_source}. State/district are user supplied. Screening only, not official legal boundary verification.</p>
                <p className="text-micro text-eco-text">
                  {site.boundary_screening?.status === 'inside_screening_boundary'
                    ? 'Inside screening boundary; no legal verification.'
                    : 'Boundary review required — consult Survey of India.'}
                  {' '}
                  {site.boundary_screening?.version}
                  {' '}
                  {site.boundary_screening?.licence}
                </p>
                <Button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    if (!window.confirm(`Archive candidate ${site.name}?`)) return;
                    setBusy(true);
                    setError('');
                    try {
                      await archiveSite(site);
                      if (!mounted.current) return;
                      if (selected?.id === site.id) choose();
                      await invalidate();
                    } catch (err) {
                      setError(projectError(err));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Archive {site.name}
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card title={selected ? 'Edit candidate polygon' : 'New candidate polygon'}>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!geometry) return;
              setBusy(true);
              setError('');
              setMessage('');
              try {
                const site = await saveSite(project.id, { name, state_code: state, district: district || null, geometry }, selected);
                if (!mounted.current) return;
                choose(site);
                await invalidate();
                setMessage('Candidate saved to the local backend.');
              } catch (err) {
                setError(projectError(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="block text-meta font-medium text-eco-text">
              Candidate name
              <input
                required
                maxLength={200}
                value={name}
                disabled={busy}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded border border-eco-border bg-eco-surface px-3 py-1.5 text-body text-eco-text"
              />
            </label>
            <label className="block text-meta font-medium text-eco-text">
              State
              <select
                aria-label="State"
                required
                value={state}
                disabled={busy}
                onChange={(e) => setState(e.target.value)}
                className="mt-1 block w-full rounded border border-eco-border bg-eco-surface px-3 py-1.5 text-body text-eco-text"
              >
                <option value="IN-MH">Maharashtra</option>
                <option value="IN-TG">Telangana</option>
                <option value="IN-KA">Karnataka</option>
                <option value="IN-TN">Tamil Nadu</option>
              </select>
            </label>
            <label className="block text-meta font-medium text-eco-text">
              District (optional)
              <input
                maxLength={100}
                value={district}
                disabled={busy}
                onChange={(e) => setDistrict(e.target.value)}
                className="mt-1 block w-full rounded border border-eco-border bg-eco-surface px-3 py-1.5 text-body text-eco-text"
              />
            </label>
            <PolygonEditor key={editorVersion} value={geometry} disabled={busy} onChange={(value) => { setGeometry(value); setMessage(''); }} />
            <Button disabled={busy || !geometry || (!selected && data.length >= 3)}>
              {busy ? 'Saving…' : 'Save candidate polygon'}
            </Button>
            {error && <p role="alert" className="text-meta text-eco-accent">{error}</p>}
            {message && <p role="status" className="text-meta text-eco-primary">{message}</p>}
            <p className="text-micro text-eco-muted">Invalid or out-of-boundary polygons are rejected by the backend. Unsaved drafts are not restored after reload.</p>
          </form>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => setShowScenarios(!showScenarios)}
          className="text-xs py-1.5 px-3 border border-eco-border hover:bg-eco-surface-secondary"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 inline mr-1.5" />
          {showScenarios ? 'Hide Energy & Water Scenarios' : 'Explore Energy & Water Scenarios (OpenDC-LCA)'}
        </Button>
      </div>

      {showScenarios && (
        <EnergyWaterScenarioCalculator
          initialItMw={40}
          initialParcelAreaHa={selected?.area_ha || 15}
          siteName={selected?.name}
        />
      )}

      {data.length > 0 && (
        <SiteComparisonMatrix
          sites={data}
          phases={phasesQuery.data || []}
          assertions={assertionsQuery.data || []}
          comparisonData={comparisonsQuery.data}
          siteObservations={siteObservationsQuery.data || {}}
          loading={comparisonsQuery.isPending}
          error={comparisonsQuery.error ? formatReadinessError(comparisonsQuery.error) : null}
          onGeneratePassport={(id) => {
            const s = data.find((item) => item.id === id);
            if (s) setPassportSite(s);
          }}
        />
      )}

      <IndustryBenchmarksSection />

      {selected && <EnvironmentalObservations key={selected.id} site={selected} />}

      {passportSite && (
        <SitePassport
          project={project}
          site={passportSite}
          phases={phasesQuery.data || []}
          assertions={assertionsQuery.data || []}
          artifacts={artifactsQuery.data || []}
          observations={passportSite ? (siteObservationsQuery.data?.[passportSite.id] || []) : undefined}
          passportData={passportQuery.data}
          loading={passportQuery.isPending}
          error={passportQuery.error ? formatReadinessError(passportQuery.error) : null}
          onClose={() => setPassportSite(null)}
        />
      )}

      {constraintsSite && (
        <SiteConstraintsModal
          isOpen={Boolean(constraintsSite)}
          onClose={() => setConstraintsSite(null)}
          site={constraintsSite}
          observations={constraintsSite ? (siteObservationsQuery.data?.[constraintsSite.id] || []) : undefined}
          assertions={assertionsQuery.data || []}
        />
      )}
    </div>
  );
}
