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
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProjects, createProject, getSites, saveSite, archiveSite, projectError, type Project, type CandidateSite, type PolygonGeometry } from '../services/projects';
import { PolygonEditor } from '../components/site-analysis/PolygonEditor';
import { PageHeader, PageShell } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import type { EvidenceUploadMetadata } from '../components/projects/EvidenceWorkspace';

function useMounted() {
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return mounted;
}

export function Projects() {
  const mounted = useMounted();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const projects = useQuery({ queryKey: ['local-projects'], queryFn: ({ signal }) => getProjects(signal), retry: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const projectId = params.get('project') || '';
  const project = projects.data?.items.find(item => item.id === projectId);
  return <PageShell><PageHeader title="Project candidate polygons" purpose="Local single-user API records. Separate from synthetic demo comparisons; no readiness assessment." eyebrow="Projects" />
    <Link to="/site-analysis">Legacy point screening</Link>
    <p>Project records are always stored in the local backend, independent of the global Demo/API display setting.</p>
    {projects.isPending && <p>Loading projects…</p>}{projects.error && <p role="alert">{projectError(projects.error)}</p>}
    <label>Project<select aria-label="Project" value={projectId} disabled={busy} onChange={e => setParams({ project: e.target.value })}><option value="">Select a project</option>{projects.data?.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {projects.data && projects.data.total > projects.data.items.length && <p>Showing the first 100 projects.</p>}
    <details><summary>Create project</summary><form className="space-y-2" onSubmit={async e => { e.preventDefault(); const data = new FormData(e.currentTarget); setBusy(true); setError(''); try { const result = await createProject({ name: String(data.get('name')), organization_label: String(data.get('organization')), archetype: String(data.get('archetype')) }); await queryClient.invalidateQueries({ queryKey: ['local-projects'] }); if (mounted.current) setParams({ project: result.id }); } catch (err) { setError(projectError(err)); } finally { setBusy(false); } }}>
      <label>Project name<input name="name" required maxLength={200} disabled={busy} /></label><label>Organization label<input name="organization" required maxLength={200} disabled={busy} /></label>
      <label>Data-centre archetype<select name="archetype" disabled={busy}>{['enterprise', 'colocation', 'hyperscale', 'edge', 'other'].map(a => <option key={a}>{a}</option>)}</select></label><Button disabled={busy}>Create project</Button>
    </form></details>{error && <p role="alert">{error}</p>}
    {projectId && !projects.isPending && projects.data && !project && <p role="alert">Selected project is unavailable or archived.</p>}
    {project && <PhaseEditor key={"phases:" + project.id} projectId={project.id} />}
    {project && <ProjectSites key={project.id} project={project} onBusy={setBusy} />}
    {project && <ProjectEvidence key={"evidence:" + project.id} projectId={project.id} onBusy={setBusy} />}
  </PageShell>;
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
      <ResourceReadinessTimeline
        phases={phasesQuery.data || []}
        assertions={assertionsQuery.data || []}
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
        busy={extractionsQuery.isFetching}
      />
    </div>
  );
}

function ProjectSites({ project, onBusy }: { project: Project; onBusy: (busy: boolean) => void }) {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const sites = useQuery({ queryKey: ['project-sites', project.id], queryFn: ({ signal }) => getSites(project.id, signal), retry: false });
  if (sites.isPending) return <p>Loading candidates…</p>;
  if (sites.error || !sites.data) return <p role="alert">{projectError(sites.error)}</p>;
  const requested = params.get('site');
  const initialSite = sites.data.find(site => site.id === requested);
  return <LoadedProjectSites key={project.id + ':' + (requested || 'new')} project={project} onBusy={onBusy} initialSite={initialSite} data={sites.data} selectId={id => setParams(id ? { project: project.id, site: id } : { project: project.id })} queryClient={queryClient} />;
}

function LoadedProjectSites({ project, onBusy, initialSite, data, selectId, queryClient }: { project: Project; onBusy: (busy: boolean) => void; initialSite?: CandidateSite; data: CandidateSite[]; selectId: (id?: string) => void; queryClient: ReturnType<typeof useQueryClient> }) {
  const mounted = useMounted();
  const [selected, setSelected] = useState<CandidateSite | undefined>(initialSite);
  const [name, setName] = useState(initialSite?.name || '');
  const [state, setState] = useState(initialSite?.state_code || 'IN-MH');
  const [district, setDistrict] = useState(initialSite?.district || '');
  const [geometry, setGeometry] = useState<PolygonGeometry | null>(initialSite?.geometry || null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, updateBusy] = useState(false);
  const setBusy = (value: boolean) => { updateBusy(value); onBusy(value); };
  const [editorVersion, setEditorVersion] = useState(0);
  const choose = (site?: CandidateSite) => { selectId(site?.id); setEditorVersion(n => n + 1); setSelected(site); setName(site?.name || ''); setState(site?.state_code || 'IN-MH'); setDistrict(site?.district || ''); setGeometry(site?.geometry || null); setError(''); setMessage(''); };
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

  return <div className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-2"><Card title="Saved candidate polygons">
    <p>{data.length} / 3 active candidates</p>
    <Button type="button" disabled={busy} onClick={() => choose()}>New candidate</Button>
    {data.map(site => <div key={site.id} className="border p-3 space-y-2"><div className="flex justify-between items-start"><Button type="button" disabled={busy} onClick={() => choose(site)}>{site.name}</Button><Button type="button" disabled={busy} onClick={() => setPassportSite(site)} className="text-[11px] py-1 px-2 border-eco-primary text-eco-primary hover:bg-eco-primary/10">📜 Passport</Button></div><p>{site.area_ha.toFixed(4)} ha · {site.state_code} · revision {site.revision}</p><p>Boundary screening: {site.boundary_source}. State/district are user supplied. Screening only, not official legal boundary verification.</p><p>{site.boundary_screening?.status === "inside_screening_boundary" ? "Inside screening boundary; no legal verification." : "Boundary review required — consult Survey of India."} {site.boundary_screening?.version} {site.boundary_screening?.licence}</p>
      <Button type="button" disabled={busy} onClick={async () => { if (!window.confirm('Archive candidate ' + site.name + '?')) return; setBusy(true); setError(''); try { await archiveSite(site); if (!mounted.current) return; if (selected?.id === site.id) choose(); await invalidate(); } catch (err) { setError(projectError(err)); } finally { setBusy(false); } }}>Archive {site.name}</Button>
    </div>)}
  </Card><Card title={selected ? 'Edit candidate polygon' : 'New candidate polygon'}><form className="space-y-3" onSubmit={async e => { e.preventDefault(); if (!geometry) return; setBusy(true); setError(''); setMessage(''); try { const site = await saveSite(project.id, { name, state_code: state, district: district || null, geometry }, selected); if (!mounted.current) return; choose(site); await invalidate(); setMessage('Candidate saved to the local backend.'); } catch (err) { setError(projectError(err)); } finally { setBusy(false); } }}>
    <label className="block">Candidate name<input required maxLength={200} value={name} disabled={busy} onChange={e => setName(e.target.value)} /></label>
    <label className="block">State code<input required pattern="IN-[A-Z]{2}" value={state} disabled={busy} onChange={e => setState(e.target.value)} /></label>
    <label className="block">District (optional)<input maxLength={100} value={district} disabled={busy} onChange={e => setDistrict(e.target.value)} /></label>
    <PolygonEditor key={editorVersion} value={geometry} disabled={busy} onChange={value => { setGeometry(value); setMessage(''); }} />
    <Button disabled={busy || !geometry || (!selected && data.length >= 3)}>{busy ? 'Saving…' : 'Save candidate polygon'}</Button>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <p>Invalid or out-of-boundary polygons are rejected by the backend. Unsaved drafts are not restored after reload.</p>
  </form></Card></div>
  {data.length > 1 && (
    <SiteComparisonMatrix
      sites={data}
      phases={phasesQuery.data || []}
      assertions={assertionsQuery.data || []}
      onGeneratePassport={(id) => {
        const s = data.find(item => item.id === id);
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
  </div>;
}
