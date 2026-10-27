import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  ExternalLink,
  ShieldCheck,
  Building,
  Zap,
  Droplets,
  Layers,
  Search,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Scale,
  Sparkles,
} from 'lucide-react';
import { PageHeader, PageShell } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import {
  fetchDataSources,
  fetchOfficialDocuments,
  fetchStateRegulatoryPacks,
  fetchEnvironmentalDatasets,
  getOfficialDocumentDownloadUrl,
} from '../services/dataSources';
import type {
  DataSourceItem,
  OfficialDocumentItem,
  StateRegulatoryPack,
  EnvironmentalDatasetsResponse,
} from '../types/dataSources';

type TabView = 'documents' | 'state_packs' | 'environmental' | 'registry';

const FOCUS_STATES = [
  { key: 'all', label: 'All Focus States' },
  { key: 'Telangana', label: 'Telangana' },
  { key: 'Maharashtra', label: 'Maharashtra' },
  { key: 'Karnataka', label: 'Karnataka' },
  { key: 'Tamil Nadu', label: 'Tamil Nadu' },
  { key: 'National', label: 'National Framework' },
];

/**
 * One grid-factor tile. A payload may omit a factor; that is rendered as
 * "Unavailable" rather than crashing or substituting zero.
 */
function FactorTile({
  label,
  value,
  caption,
  valueClassName = 'text-eco-primary',
}: {
  label: string;
  value: number | undefined;
  caption: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-md border border-eco-border bg-eco-surface-secondary p-3">
      <div className="text-micro text-eco-muted uppercase">{label}</div>
      <div className={`mt-1 text-h2 font-mono font-bold ${valueClassName}`}>
        {value === undefined ? (
          <span className="font-sans text-meta font-normal text-eco-muted">Unavailable</span>
        ) : (
          <>
            <span>{value}</span>{' '}
            <span className="text-meta font-normal text-eco-muted">tCO₂/MWh</span>
          </>
        )}
      </div>
      <div className="mt-1 text-micro text-eco-muted">{caption}</div>
    </div>
  );
}

export function DataSources(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<TabView>('documents');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [documents, setDocuments] = useState<OfficialDocumentItem[]>([]);
  const [dataSources, setDataSources] = useState<DataSourceItem[]>([]);
  const [statePacks, setStatePacks] = useState<Record<string, StateRegulatoryPack>>({});
  const [environmental, setEnvironmental] = useState<EnvironmentalDatasetsResponse | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadAllData() {
      setLoading(true);
      setError(null);
      try {
        const [docsRes, sourcesRes, packsRes, envRes] = await Promise.all([
          fetchOfficialDocuments(),
          fetchDataSources(),
          fetchStateRegulatoryPacks(),
          fetchEnvironmentalDatasets(),
        ]);
        if (isMounted) {
          setDocuments(docsRes.documents);
          setDataSources(sourcesRes.items);
          setStatePacks(packsRes.packs);
          setEnvironmental(envRes);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Failed to load official data sources';
          setError(message);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadAllData();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredDocs = documents.filter((doc) => {
    const matchesState =
      selectedState === 'all' ||
      doc.state.toLowerCase() === selectedState.toLowerCase() ||
      doc.jurisdiction.toLowerCase().includes(selectedState.toLowerCase());

    const query = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      doc.title.toLowerCase().includes(query) ||
      doc.issuing_authority.toLowerCase().includes(query) ||
      doc.description.toLowerCase().includes(query) ||
      doc.filename.toLowerCase().includes(query);

    return matchesState && matchesQuery;
  });

  const cea = environmental?.carbon_factors_cea;
  const ceaVerified =
    cea?.provenance?.verification_status === 'VERIFIED_AGAINST_BUNDLED_SOURCE';

  const filteredSources = dataSources.filter((src) => {
    const query = searchQuery.trim().toLowerCase();
    return (
      !query ||
      src.dataset_name.toLowerCase().includes(query) ||
      src.provider.toLowerCase().includes(query) ||
      src.quality_notes.toLowerCase().includes(query) ||
      src.data_category.toLowerCase().includes(query)
    );
  });

  const activePacks = Object.entries(statePacks).filter(([key, pack]) => {
    if (selectedState === 'all' || selectedState === 'National') return true;
    return pack.state_name.toLowerCase() === selectedState.toLowerCase() || key.toLowerCase() === selectedState.toLowerCase();
  });

  return (
    <PageShell>
      <div className="space-y-6">
        <PageHeader
          title="Data Sources & Official Documents"
          purpose="Verified government policies, statutory baselines, and environmental datasets for data centres across Telangana, Maharashtra, Karnataka, and Tamil Nadu."
          eyebrow="Credible Data Intelligence"
        />

        {/* Focus State & Scope Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-eco-border bg-eco-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-meta font-medium text-eco-muted">Jurisdiction Filter:</span>
            {FOCUS_STATES.map((st) => (
              <button
                key={st.key}
                onClick={() => setSelectedState(st.key)}
                className={`rounded-md px-3 py-1.5 text-meta font-medium transition-colors ${
                  selectedState === st.key
                    ? 'border border-eco-primary/40 bg-eco-primary/10 text-eco-primary'
                    : 'border border-eco-border bg-eco-surface-secondary text-eco-muted hover:text-eco-text'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 font-mono text-micro text-eco-muted">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>4 Focus States Pinned (IN-TG, IN-MH, IN-KA, IN-TN)</span>
          </div>
        </div>

        {/* Navigation Tabs & Search */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2 border-b border-eco-border pb-2">
            <button
              onClick={() => setActiveTab('documents')}
              className={`flex items-center gap-2 border-b-2 px-3 py-2 text-body font-medium transition-colors ${
                activeTab === 'documents'
                  ? 'border-eco-primary text-eco-primary'
                  : 'border-transparent text-eco-muted hover:text-eco-text'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Official Government Documents ({documents.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('state_packs')}
              className={`flex items-center gap-2 border-b-2 px-3 py-2 text-body font-medium transition-colors ${
                activeTab === 'state_packs'
                  ? 'border-eco-primary text-eco-primary'
                  : 'border-transparent text-eco-muted hover:text-eco-text'
              }`}
            >
              <Scale className="h-4 w-4" />
              <span>State Regulatory Packs (4 States)</span>
            </button>

            <button
              onClick={() => setActiveTab('environmental')}
              className={`flex items-center gap-2 border-b-2 px-3 py-2 text-body font-medium transition-colors ${
                activeTab === 'environmental'
                  ? 'border-eco-primary text-eco-primary'
                  : 'border-transparent text-eco-muted hover:text-eco-text'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>Environmental Baselines (CGWB, CPCB, CEA)</span>
            </button>

            <button
              onClick={() => setActiveTab('registry')}
              className={`flex items-center gap-2 border-b-2 px-3 py-2 text-body font-medium transition-colors ${
                activeTab === 'registry'
                  ? 'border-eco-primary text-eco-primary'
                  : 'border-transparent text-eco-muted hover:text-eco-text'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Source Registry &amp; Maturity ({dataSources.length})</span>
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-eco-muted" />
            <input
              type="text"
              placeholder="Search policies, authorities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-md border border-eco-border bg-eco-surface pl-9 pr-3 text-meta text-eco-text placeholder:text-eco-muted focus-visible:border-eco-primary/60"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-md border border-eco-critical/40 bg-eco-critical/10 p-4 text-eco-critical">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex h-48 items-center justify-center text-eco-muted">
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-eco-primary border-t-transparent" />
              <span>Loading authentic government data sources and documents...</span>
            </div>
          </div>
        ) : (
          <>
            {/* TAB 1: OFFICIAL GOVERNMENT DOCUMENTS */}
            {activeTab === 'documents' && (
              <div className="space-y-4">
                <div className="rounded-lg border border-eco-border/80 bg-eco-surface/60 p-4 text-meta text-eco-muted">
                  <span className="font-semibold text-eco-text">Official Government Documents Repository: </span>
                  Every document listed below is stored locally in <code className="font-mono text-eco-primary">data/official_documents/</code>,
                  verified with its SHA-256 cryptographic checksum, and available for direct download.
                </div>

                <div className="grid gap-4">
                  {filteredDocs.map((doc) => {
                    const isExpanded = expandedDocId === doc.id;
                    const isXlsx = doc.filename.endsWith('.xlsx');
                    return (
                      <Card key={doc.id} className="transition-all hover:border-eco-primary/40">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="primary" size="xs">
                                  {doc.state}
                                </Badge>
                                <Badge variant="neutral" size="xs">
                                  {doc.instrument_type}
                                </Badge>
                                <span className="font-mono text-micro text-eco-muted">
                                  {doc.publication_date}
                                </span>
                              </div>
                              <h3 className="text-h3 font-semibold text-eco-text">{doc.title}</h3>
                              <p className="text-meta text-eco-muted">
                                Issued by <span className="text-eco-text font-medium">{doc.issuing_authority}</span>
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              {doc.file_available ? (
                                <a
                                  href={getOfficialDocumentDownloadUrl(doc.id)}
                                  download={doc.filename}
                                  className="inline-flex items-center gap-1.5 rounded-md border border-eco-primary/40 bg-eco-primary/10 px-3 py-1.5 text-meta font-medium text-eco-primary hover:bg-eco-primary/20 transition-colors"
                                >
                                  {isXlsx ? <FileSpreadsheet className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                                  <span>Download {doc.file_format}</span>
                                </a>
                              ) : (
                                <Badge variant="warning" size="sm">File Absent</Badge>
                              )}

                              {doc.official_source_url && (
                                <a
                                  href={doc.official_source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-md border border-eco-border bg-eco-surface px-2.5 py-1.5 text-meta text-eco-muted hover:text-eco-text"
                                  title="Open Official Government Portal"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                          </div>

                          <p className="text-body text-eco-text/90">{doc.description}</p>

                          {/* Technical & Verification Meta */}
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border border-eco-border/60 bg-eco-surface-secondary/40 px-3 py-2 font-mono text-micro text-eco-muted">
                            <div>
                              File: <span className="text-eco-text">{doc.filename}</span>
                            </div>
                            <div>
                              Size:{' '}
                              <span className="text-eco-text">
                                {(doc.file_size_bytes / 1024 / 1024).toFixed(2)} MB
                              </span>
                            </div>
                            {doc.page_count && (
                              <div>
                                Pages: <span className="text-eco-text">{doc.page_count}</span>
                              </div>
                            )}
                            <div className="truncate max-w-xs xl:max-w-md" title={doc.sha256}>
                              SHA256: <span className="text-eco-primary">{doc.sha256.slice(0, 16)}…</span>
                            </div>
                            <div>
                              Status: <span className="text-emerald-500 font-semibold">{doc.credibility_rating}</span>
                            </div>
                          </div>

                          {/* Expandable Key Clauses */}
                          {doc.key_clauses && Object.keys(doc.key_clauses).length > 0 && (
                            <div>
                              <button
                                onClick={() => setExpandedDocId(isExpanded ? null : doc.id)}
                                className="flex items-center gap-1.5 text-meta font-medium text-eco-primary hover:underline"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                <span>
                                  {isExpanded
                                    ? 'Hide key regulatory clauses & covenants'
                                    : `View extracted key clauses & provisions (${Object.keys(doc.key_clauses).length})`}
                                </span>
                              </button>

                              {isExpanded && (
                                <div className="mt-3 space-y-2 rounded-md border border-eco-border bg-eco-surface-secondary p-3">
                                  {Object.entries(doc.key_clauses).map(([clauseKey, clauseText]) => (
                                    <div key={clauseKey} className="text-meta">
                                      <span className="font-semibold uppercase tracking-wide text-eco-primary">
                                        {clauseKey.replace(/_/g, ' ')}:{' '}
                                      </span>
                                      <span className="text-eco-text">{clauseText}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                  {filteredDocs.length === 0 && (
                    <div className="py-12 text-center text-eco-muted">
                      No official documents found matching the filter criteria.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: STATE REGULATORY PACKS (4 FOCUS STATES) */}
            {activeTab === 'state_packs' && (
              <div className="space-y-6">
                <div className="rounded-lg border border-eco-border/80 bg-eco-surface/60 p-4 text-meta text-eco-muted">
                  <span className="font-semibold text-eco-text">Four Focus State Regulatory Intelligence: </span>
                  Data centre development in India operates under state-level industrial, electricity, and water policies.
                  Below are the specific rules, thresholds, and statutory clearance pathways for Telangana, Maharashtra, Karnataka, and Tamil Nadu.
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  {activePacks.map(([key, pack]) => (
                    <Card key={key} className="space-y-4">
                      <div className="flex items-start justify-between border-b border-eco-border pb-3">
                        <div>
                          <Badge variant="primary" size="sm" className="mb-1">
                            {pack.state_name}
                          </Badge>
                          <h3 className="text-h3 font-semibold text-eco-text">{pack.governing_policy.policy_name}</h3>
                          <p className="text-meta text-eco-muted">
                            Ref: {pack.governing_policy.official_reference} · Status:{' '}
                            <span className="text-emerald-500 font-medium">{pack.governing_policy.status}</span>
                          </p>
                        </div>
                      </div>

                      {/* Primary Clusters */}
                      <div>
                        <h4 className="text-meta font-semibold uppercase tracking-wide text-eco-muted mb-1.5 flex items-center gap-1.5">
                          <Building className="h-3.5 w-3.5 text-eco-primary" />
                          <span>Key Data Centre Clusters</span>
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {pack.primary_data_centre_clusters.map((cluster) => (
                            <span
                              key={cluster}
                              className="rounded-sm border border-eco-border bg-eco-surface-secondary px-2 py-0.5 text-meta text-eco-text"
                            >
                              {cluster}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Power Covenants */}
                      <div className="rounded-md border border-eco-border/60 bg-eco-surface-secondary/40 p-3 space-y-1.5 text-meta">
                        <div className="flex items-center gap-1.5 font-semibold text-amber-500">
                          <Zap className="h-4 w-4" />
                          <span>Power Grid &amp; Electricity Rules</span>
                        </div>
                        {Object.entries(pack.siting_and_infrastructure_rules.power_connectivity_covenants).map(
                          ([k, v]) => (
                            <p key={k} className="text-eco-muted">
                              <strong className="text-eco-text capitalize">{k.replace(/_/g, ' ')}:</strong> {v}
                            </p>
                          )
                        )}
                      </div>

                      {/* Water & Environmental */}
                      <div className="rounded-md border border-eco-border/60 bg-eco-surface-secondary/40 p-3 space-y-1.5 text-meta">
                        <div className="flex items-center gap-1.5 font-semibold text-cyan-500">
                          <Droplets className="h-4 w-4" />
                          <span>Water Siting &amp; Cooling Covenants</span>
                        </div>
                        {Object.entries(pack.siting_and_infrastructure_rules.water_and_environmental_rules).map(
                          ([k, v]) => (
                            <p key={k} className="text-eco-muted">
                              <strong className="text-eco-text capitalize">{k.replace(/_/g, ' ')}:</strong> {v}
                            </p>
                          )
                        )}
                      </div>

                      {/* Statutory Clearances Flow */}
                      <div className="space-y-1.5">
                        <h4 className="text-meta font-semibold uppercase tracking-wide text-eco-muted flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          <span>Statutory Approval Sequence (NOCs)</span>
                        </h4>
                        <ol className="list-decimal list-inside space-y-1 text-meta text-eco-text/90">
                          {pack.statutory_clearances_sequence.map((step, idx) => (
                            <li key={idx} className="pl-1 leading-relaxed">
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: ENVIRONMENTAL BASELINES */}
            {activeTab === 'environmental' && environmental && (
              <div className="space-y-6">
                <div className="rounded-lg border border-eco-border/80 bg-eco-surface/60 p-4 text-meta text-eco-muted">
                  <span className="font-semibold text-eco-text">Environmental reference values: </span>
                  CGWB, CPCB, CEA and water-tariff context for the 4 focus states. The CEA national
                  grid factors are traced to the bundled v22.0 workbook; the CGWB, CPCB and tariff
                  values are <strong className="text-eco-warning">not verified</strong> against a
                  stored source table, page or station code. No value here is used in a score. The
                  registry tracks each source&apos;s real maturity gate separately.
                </div>

                {environmental.provenance?.verification_status !== 'VERIFIED' && (
                  <div className="flex items-start gap-3 rounded-md border border-eco-warning/40 bg-eco-warning/10 p-4 text-meta text-eco-warning">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-semibold">Some sections are unverified — check each card.</p>
                      <p className="mt-1 text-eco-text/90">
                        {environmental.provenance?.note ??
                          'This payload does not declare provenance. Treat every value as unverified and do not use it in a score.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* 1. CEA Grid Emission Factors */}
                <Card
                  title="CEA Grid Emission Factors (Version 22.0, August 2026)"
                  status={
                    ceaVerified ? (
                      <Badge variant="primary" size="xs">Verified · CEA v22.0</Badge>
                    ) : (
                      <Badge variant="warning" size="xs">Unverified</Badge>
                    )
                  }
                >
                  <div className="space-y-3">
                    <p className="text-meta text-eco-muted">
                      Source: Central Electricity Authority, Ministry of Power · FY 2025-26 ·
                      including imports · intended for Scope 2 greenhouse-gas and CUE calculations,
                      not yet used in a score.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <FactorTile
                        label="Weighted Average"
                        value={environmental.carbon_factors_cea.national_grid_factors?.weighted_average_tco2_per_mwh}
                        caption="310.58 BU renewable generation included"
                      />
                      <FactorTile
                        label="Operating Margin (OM)"
                        value={environmental.carbon_factors_cea.national_grid_factors?.operating_margin_om_tco2_per_mwh}
                        caption="Simple operating margin"
                        valueClassName="text-emerald-400"
                      />
                      <FactorTile
                        label="Build Margin (BM)"
                        value={environmental.carbon_factors_cea.national_grid_factors?.build_margin_bm_tco2_per_mwh}
                        caption="Build margin"
                        valueClassName="text-amber-400"
                      />
                      <FactorTile
                        label="Combined Margin (CM)"
                        value={environmental.carbon_factors_cea.national_grid_factors?.combined_margin_cm_tco2_per_mwh}
                        caption="Combined margin"
                      />
                    </div>
                    <div className="rounded-md border border-eco-border/70 bg-eco-surface/40 p-3 text-micro text-eco-muted">
                      <p>
                        {environmental.carbon_factors_cea.grid_scope ??
                          'CEA publishes a single unified Indian grid; regional grid factors are not current.'}
                      </p>
                      {cea?.provenance && (
                        <p className="mt-1">
                          Verified against{' '}
                          <code className="text-eco-text">{cea.provenance.source_document}</code>{' '}
                          worksheet <code className="text-eco-text">{cea.provenance.worksheet}</code>,
                          cells{' '}
                          <code className="text-eco-text">
                            {cea.provenance.cells.weighted_average_tco2_per_mwh?.cell ?? 'AA14'}–
                            {cea.provenance.cells.combined_margin_cm_tco2_per_mwh?.cell ?? 'AA17'}
                          </code>
                          . Regional factors are not shown or used.
                        </p>
                      )}
                    </div>
                  </div>
                </Card>

                {/* 2. CGWB Groundwater Stress Table */}
                <Card title="CGWB Ground Water Resource Assessment (2025 Release)" status={<Badge variant="warning" size="xs">Unverified</Badge>}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-meta">
                      <thead className="border-b border-eco-border font-mono text-micro uppercase text-eco-muted">
                        <tr>
                          <th className="py-2 pr-3">State</th>
                          <th className="py-2 pr-3">District</th>
                          <th className="py-2 pr-3">Assessment Units / Talukas</th>
                          <th className="py-2 pr-3">Extraction %</th>
                          <th className="py-2 pr-3">Category</th>
                          <th className="py-2 pr-3">Water Table Depth</th>
                          <th className="py-2">Legal Entitlement Covenant</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-eco-border/60">
                        {environmental.groundwater_cgwb.categories_by_cluster.map((rec, i) => (
                          <tr key={i} className="hover:bg-eco-surface-secondary/40">
                            <td className="py-2.5 pr-3 font-semibold text-eco-text">{rec.state}</td>
                            <td className="py-2.5 pr-3 text-eco-muted">{rec.district}</td>
                            <td className="py-2.5 pr-3 text-eco-text">{rec.assessment_units.join(', ')}</td>
                            <td className="py-2.5 pr-3 font-mono">{rec.stage_of_extraction_pct}%</td>
                            <td className="py-2.5 pr-3">
                              <Badge
                                variant={
                                  rec.category === 'Over-Exploited'
                                    ? 'critical'
                                    : rec.category === 'Critical'
                                      ? 'warning'
                                      : 'primary'
                                }
                                size="xs"
                              >
                                {rec.category}
                              </Badge>
                            </td>
                            <td className="py-2.5 pr-3 font-mono text-eco-muted">{rec.groundwater_depth_bgl_m} m</td>
                            <td className="py-2.5 text-eco-muted leading-tight">{rec.entitlement_note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* 3. CPCB Ambient Air Quality Stations */}
                <Card title="CPCB Continuous Ambient Air Quality (CAAQMS) Observations" status={<Badge variant="warning" size="xs">Unverified</Badge>}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-meta">
                      <thead className="border-b border-eco-border font-mono text-micro uppercase text-eco-muted">
                        <tr>
                          <th className="py-2 pr-3">State / City</th>
                          <th className="py-2 pr-3">Station Name</th>
                          <th className="py-2 pr-3">Annual PM2.5</th>
                          <th className="py-2 pr-3">Annual PM10</th>
                          <th className="py-2 pr-3">Annual NO2</th>
                          <th className="py-2 pr-3">Air Quality Category</th>
                          <th className="py-2">Data Centre Filtration Recommendation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-eco-border/60">
                        {environmental.air_quality_cpcb.cluster_monitoring_stations.map((st, i) => (
                          <tr key={i} className="hover:bg-eco-surface-secondary/40">
                            <td className="py-2.5 pr-3 font-semibold text-eco-text">
                              {st.city}, {st.state}
                            </td>
                            <td className="py-2.5 pr-3 text-eco-muted">{st.station_name}</td>
                            <td className="py-2.5 pr-3 font-mono">
                              {st.annual_avg_pm25} <span className="text-micro text-eco-muted">µg/m³</span>
                            </td>
                            <td className="py-2.5 pr-3 font-mono">
                              {st.annual_avg_pm10} <span className="text-micro text-eco-muted">µg/m³</span>
                            </td>
                            <td className="py-2.5 pr-3 font-mono">
                              {st.annual_avg_no2} <span className="text-micro text-eco-muted">µg/m³</span>
                            </td>
                            <td className="py-2.5 pr-3">
                              <Badge
                                variant={
                                  st.air_quality_category.includes('Poor')
                                    ? 'critical'
                                    : st.air_quality_category === 'Moderate'
                                      ? 'warning'
                                      : 'primary'
                                }
                                size="xs"
                              >
                                {st.air_quality_category}
                              </Badge>
                            </td>
                            <td className="py-2.5 text-eco-muted leading-tight">{st.filtration_recommendation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* 4. Industrial Bulk Water Tariffs */}
                <Card title="Industrial Bulk Water Allocations &amp; Tariffs" status={<Badge variant="warning" size="xs">Unverified</Badge>}>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {Object.entries(environmental.water_tariffs_and_allocations.tariffs_by_state).map(
                      ([stKey, val]) => (
                        <div key={stKey} className="rounded-md border border-eco-border bg-eco-surface-secondary p-3 space-y-1">
                          <div className="font-semibold text-eco-text capitalize">{stKey}</div>
                          <div className="text-micro text-eco-muted">{val.provider}</div>
                          <div className="mt-2 text-meta">
                            Fresh Industrial Rate: <span className="font-mono font-bold text-eco-primary">₹{val.bulk_industrial_rate_inr_per_kl}/KL</span>
                          </div>
                          <div className="text-meta">
                            Recycled TTRO Rate: <span className="font-mono text-cyan-400">₹{val.treated_recycled_rate_inr_per_kl}/KL</span>
                          </div>
                          <div className="text-micro text-eco-muted pt-1 border-t border-eco-border/40">
                            {val.reliability}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </Card>
              </div>
            )}

            {/* TAB 4: DATA SOURCES REGISTRY & MATURITY */}
            {activeTab === 'registry' && (
              <div className="space-y-4">
                <div className="rounded-lg border border-eco-border/80 bg-eco-surface/60 p-4 text-meta text-eco-muted">
                  <span className="font-semibold text-eco-text">Roadmap Maturity Pipeline: </span>
                  Every source progresses through five strict gates:{' '}
                  <code className="text-eco-primary">Discovered → Access Tested → Processing Tested → Validated → Integrated</code>.
                  Missing datasets return <code className="text-eco-primary">SOURCE_UNAVAILABLE</code> without synthesizing zeros.
                </div>

                <div className="grid gap-4">
                  {filteredSources.map((source) => (
                    <Card key={source.id}>
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="primary" size="xs">
                                {source.priority}
                              </Badge>
                              <Badge variant="neutral" size="xs">
                                {source.data_category}
                              </Badge>
                              <Badge
                                variant={
                                  source.test_status === 'PROCESSING_TESTED' || source.test_status === 'VALIDATED'
                                    ? 'primary'
                                    : 'secondary'
                                }
                                size="xs"
                              >
                                {source.test_status}
                              </Badge>
                            </div>
                            <h3 className="text-h3 font-semibold text-eco-text mt-1">{source.dataset_name}</h3>
                            <p className="text-meta text-eco-muted">
                              Provider: <span className="text-eco-text font-medium">{source.provider}</span> · Version:{' '}
                              <span className="text-eco-text font-mono">{source.dataset_version}</span>
                            </p>
                          </div>

                          {source.base_url && (
                            <a
                              href={source.base_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-md border border-eco-border bg-eco-surface px-3 py-1.5 text-meta text-eco-muted hover:text-eco-text"
                            >
                              <span>Official URL</span>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>

                        <div className="rounded-md border border-eco-border/60 bg-eco-surface-secondary/40 p-3 text-meta text-eco-muted">
                          <strong className="text-eco-text">Scientific Limitation &amp; Quality Notes:</strong>{' '}
                          {source.quality_notes}
                        </div>

                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-micro font-mono text-eco-muted">
                          <div>Resolution: <span className="text-eco-text">{source.resolution}</span></div>
                          <div>Coverage: <span className="text-eco-text">{source.coverage}</span></div>
                          <div>Access Method: <span className="text-eco-text uppercase">{source.access_method}</span></div>
                          <div>Licence: <span className="text-eco-text">{source.licence}</span></div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
