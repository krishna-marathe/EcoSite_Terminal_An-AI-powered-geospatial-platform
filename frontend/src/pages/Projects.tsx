import { PhaseEditor } from '../components/projects/PhaseEditor';
import { EnvironmentalObservations } from '../components/projects/EnvironmentalObservations';
import { EvidenceWorkspace } from '../components/projects/EvidenceWorkspace';
import { ResourceReadinessTimeline } from '../components/projects/ResourceReadinessTimeline';
import { ExtractionReviewDrawer } from '../components/projects/ExtractionReviewDrawer';
import { SiteComparisonMatrix } from '../components/projects/SiteComparisonMatrix';
import { SitePassport } from '../components/projects/SitePassport';
import { evidenceService } from '../services/evidence';
import { getPhases } from '../services/phases';
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
import type { EvidenceUploadMetadata } from '../components/projects/EvidenceWorkspace';
import { Compass, Layers, MapPin } from 'lucide-react';

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
                <label className="block text-meta text-eco-text">
                  Project name
                  <input
                    name="name"
                    required
                    maxLength={200}
                    disabled={busy}
                    placeholder="e.g. Pune Hyperscale Campus"
                    className="mt-1 block w-full rounded border border-eco-border bg-eco-surface px-3 py-1.5 text-body text-eco-text focus:border-eco-primary focus:outline-none"
                  />
                </label>
                <label className="block text-meta text-eco-text">
                  Organization label
                  <input
                    name="organization"
                    required
                    maxLength={200}
                    disabled={busy}
                    placeholder="e.g. West Coast Infrastructure"
                    className="mt-1 block w-full rounded border border-eco-border bg-eco-surface px-3 py-1.5 text-body text-eco-text focus:border-eco-primary focus:outline-none"
                  />
                </label>
                <label className="block text-meta text-eco-text">
                  Data-centre archetype
                  <select
                    name="archetype"
                    disabled={busy}
                    className="mt-1 block w-full rounded border border-eco-border bg-eco-surface px-3 py-1.5 text-body text-eco-text focus:border-eco-primary focus:outline-none"
                  >
                    {['enterprise', 'colocation', 'hyperscale', 'edge', 'other'].map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </label>
              </div>
              <Button disabled={busy} variant="primary" size="sm">Create project</Button>
            </form>
          </details>
          {error && <p role="alert" className="text-meta text-eco-accent">{error}</p>}
        </div>
      </Card>

      {projectId && !projects.isPending && projects.data && !project && (
        <p role="alert" className="my-3 text-meta text-eco-accent">Selected project is unavailable or archived.</p>
      )}

      {!project && (
        <div className="my-4 grid gap-4 md:grid-cols-3">
          <Card title="1. Candidate Land Polygons" subtitle="Geospatial Parcel Drafting" icon={<MapPin className="h-4 w-4 text-eco-primary" />}>
            <p className="text-meta text-eco-muted">
              Draw candidate land boundaries directly on the interactive map or import GeoJSON polygons across Maharashtra, Telangana, Karnataka, or Tamil Nadu.
            </p>
          </Card>
          <Card title="2. Automated Terrain & NDVI" subtitle="Earth Observation Screening" icon={<Layers className="h-4 w-4 text-eco-primary" />}>
            <p className="text-meta text-eco-muted">
              Compute NASA SRTM 30m elevation and slope profiles alongside Sentinel-2 cloud-masked green-cover verification to prevent steep slope hazards.
            </p>
          </Card>
          <Card title="3. Multi-Phase Infrastructure" subtitle="Capacity Ramp-Up Milestones" icon={<Compass className="h-4 w-4 text-eco-primary" />}>
            <p className="text-meta text-eco-muted">
              Schedule phased power ramp-ups (IT MW), peak summer cooling water consumption (KLD), and target design PUE across commissioning horizons.
            </p>
          </Card>
        </div>
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

  const handleUpload = async (file: File, metadata: EvidenceUploadMetadata) => {
    onBusy(true);
    try {
      await evidenceService.uploadArtifact(projectId, file, metadata);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['evidence-artifacts', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['evidence-assertions', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['evidence-extractions', projectId] }),
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
      await queryClient.invalidateQueries({ queryKey: ['evidence-assertions', projectId] });
    } finally {
      onBusy(false);
    }
  };

  const handleConfirmExtraction = async (extractionId: string, decision: 'ACCEPTED' | 'REJECTED', adjustedValue?: string | number) => {
    onBusy(true);
    try {
      await evidenceService.confirmExtraction(extractionId, decision, adjustedValue);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['evidence-extractions', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['evidence-assertions', projectId] }),
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
      <ResourceReadinessTimeline phases={phasesQuery.data || []} assertions={assertionsQuery.data || []} />
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
        busy={extractionsQuery.isFetching}
      />
    </div>
  );
}

function ProjectSites({ project, onBusy }: { project: Project; onBusy: (busy: boolean) => void }) {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();

  const sites = useQuery({
    queryKey: ['project-sites', project.id],
    queryFn: ({ signal }) => getSites(project.id, signal),
    retry: false,
  });

  if (sites.isPending) return <p>Loading candidates…</p>;
  if (sites.error || !sites.data) return <p role="alert">{projectError(sites.error)}</p>;

  const requested = params.get('site');
  const initialSite = sites.data.find((site) => site.id === requested);

  return (
    <LoadedProjectSites
      key={project.id + ':' + (requested || 'new')}
      project={project}
      onBusy={onBusy}
      initialSite={initialSite}
      data={sites.data}
      selectId={(id) => setParams(id ? { project: project.id, site: id } : { project: project.id })}
      queryClient={queryClient}
    />
  );
}

function LoadedProjectSites({
  project,
  onBusy,
  initialSite,
  data,
  selectId,
  queryClient,
}: {
  project: Project;
  onBusy: (busy: boolean) => void;
  initialSite?: CandidateSite;
  data: CandidateSite[];
  selectId: (id?: string) => void;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const mounted = useMounted();
  const [selected, setSelected] = useState<CandidateSite | undefined>(initialSite);
  const [name, setName] = useState(initialSite?.name || '');
  const [state, setState] = useState(initialSite?.state_code || 'IN-MH');
  const [district, setDistrict] = useState(initialSite?.district || '');
  const [geometry, setGeometry] = useState<PolygonGeometry | null>(initialSite?.geometry || null);
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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['project-sites', project.id] });
  const [passportSite, setPassportSite] = useState<CandidateSite | null>(null);

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

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Saved candidate polygons">
          <p>{data.length} / 3 active candidates</p>
          <Button type="button" disabled={busy} onClick={() => choose()}>
            New candidate
          </Button>
          {data.map((site) => (
            <div key={site.id} className="border p-3 space-y-2">
              <div className="flex justify-between items-start">
                <Button type="button" disabled={busy} onClick={() => choose(site)}>
                  {site.name}
                </Button>
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => setPassportSite(site)}
                  className="text-micro py-1 px-2 border-eco-primary text-eco-primary hover:bg-eco-primary/10"
                >
                  📜 Passport
                </Button>
              </div>
              <p>{site.area_ha.toFixed(4)} ha · {site.state_code} · revision {site.revision}</p>
              <p>Boundary screening: {site.boundary_source}. State/district are user supplied. Screening only, not official legal boundary verification.</p>
              <p>
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
            <label className="block">
              Candidate name
              <input
                required
                maxLength={200}
                value={name}
                disabled={busy}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="block">
              State
              <select aria-label="State" required value={state} disabled={busy} onChange={(e) => setState(e.target.value)}>
                <option value="IN-MH">Maharashtra</option>
                <option value="IN-TG">Telangana</option>
                <option value="IN-KA">Karnataka</option>
                <option value="IN-TN">Tamil Nadu</option>
              </select>
            </label>
            <label className="block">
              District (optional)
              <input maxLength={100} value={district} disabled={busy} onChange={(e) => setDistrict(e.target.value)} />
            </label>
            <PolygonEditor key={editorVersion} value={geometry} disabled={busy} onChange={(value) => { setGeometry(value); setMessage(''); }} />
            <Button disabled={busy || !geometry || (!selected && data.length >= 3)}>
              {busy ? 'Saving…' : 'Save candidate polygon'}
            </Button>
            {error && <p role="alert" className="text-meta text-eco-accent">{error}</p>}
            {message && <p role="status" className="text-meta text-eco-primary">{message}</p>}
            <p className="text-meta text-eco-muted">Invalid or out-of-boundary polygons are rejected by the backend. Unsaved drafts are not restored after reload.</p>
          </form>
        </Card>
      </div>

      {data.length > 1 && (
        <SiteComparisonMatrix
          sites={data}
          phases={phasesQuery.data || []}
          assertions={assertionsQuery.data || []}
          onGeneratePassport={(id) => {
            const s = data.find((item) => item.id === id);
            if (s) setPassportSite(s);
          }}
        />
      )}

      {selected && <EnvironmentalObservations key={selected.id} site={selected} />}

      {passportSite && (
        <SitePassport
          project={project}
          site={passportSite}
          phases={phasesQuery.data || []}
          assertions={assertionsQuery.data || []}
          artifacts={artifactsQuery.data || []}
          onClose={() => setPassportSite(null)}
        />
      )}
    </div>
  );
}