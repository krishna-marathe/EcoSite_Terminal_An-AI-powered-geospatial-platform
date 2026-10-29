import React, { useState } from 'react';
import type { Assertion, AssertionStatus, EvidenceArtifact, EvidenceUploadMetadata } from '../../types/evidence';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { EvidenceUploadModal } from './EvidenceUploadModal';

interface EvidenceWorkspaceProps {
  projectId: string;
  artifacts: EvidenceArtifact[];
  assertions: Assertion[];
  onUpload: (file: File, metadata: EvidenceUploadMetadata) => Promise<void>;
  onReviewAssertion?: (assertionId: string, decision: 'VERIFIED_WITHIN_SCOPE' | 'REJECTED' | 'FLAG_CONFLICT') => Promise<void>;
  onOpenReviewer?: () => void;
  busy?: boolean;
}

export function EvidenceWorkspace({
  artifacts,
  assertions,
  onUpload,
  onReviewAssertion,
  onOpenReviewer,
  busy = false,
}: EvidenceWorkspaceProps) {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);

  const statusBadge = (status: AssertionStatus) => {
    switch (status) {
      case 'VERIFIED_WITHIN_SCOPE':
        return <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/30">✓ Verified within Scope</span>;
      case 'DOCUMENTED':
        return <span className="inline-flex items-center gap-1 rounded bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-400 border border-sky-500/30">📄 Documented</span>;
      case 'CONFLICTING':
        return <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-400 border border-rose-500/30">⚠️ Conflicting</span>;
      case 'EXPIRED':
        return <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400 border border-amber-500/30">⌛ Expired</span>;
      case 'DECLARED':
      default:
        return <span className="inline-flex items-center gap-1 rounded bg-slate-500/10 px-2 py-0.5 text-[11px] font-medium text-slate-400 border border-slate-500/30">📝 Declared</span>;
    }
  };

  return (
    <div className="space-y-4">
      <Card title="Project Evidence & Document Vault">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-eco-border pb-3 mb-4">
          <div>
            <p className="text-xs text-eco-muted">
              Evidence artifacts substantiate engineering and resource claims. Every claim retains provenance, issue dates, and revision history.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onOpenReviewer && (
              <Button
                type="button"
                disabled={busy}
                onClick={onOpenReviewer}
                className="whitespace-nowrap border-eco-border hover:bg-eco-surface-2"
              >
                🔍 Review Extractions
              </Button>
            )}
            <Button
              type="button"
              disabled={busy}
              onClick={() => setIsUploadOpen(true)}
              className="whitespace-nowrap"
            >
              + Upload Evidence
            </Button>
          </div>
        </div>

        {/* Assertions Matrix */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
            <span>Substantiated Resource Assertions ({assertions.length})</span>
            <span className="text-[11px] font-normal text-eco-muted">
              {assertions.filter(a => a.status === 'VERIFIED_WITHIN_SCOPE').length} Verified · {assertions.filter(a => a.status === 'CONFLICTING').length} Conflicting
            </span>
          </h4>

          {assertions.length === 0 ? (
            <p className="text-xs text-eco-muted py-2">No resource claims or assertions recorded yet.</p>
          ) : (
            <div className="overflow-x-auto rounded border border-eco-border">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-eco-surface-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-eco-border">
                  <tr>
                    <th className="p-2.5">Claim / Metric</th>
                    <th className="p-2.5">Scope</th>
                    <th className="p-2.5">Value</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Supporting Artifacts</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-eco-border/60">
                  {assertions.map((assertion) => {
                    const linkedArtifacts = artifacts.filter(a => assertion.evidence_artifact_ids.includes(a.id));
                    return (
                      <tr key={assertion.id} className="hover:bg-eco-surface-2/40 transition-colors">
                        <td className="p-2.5">
                          <p className="font-medium text-slate-200">{assertion.field_label}</p>
                          <p className="text-[11px] text-eco-muted font-mono">{assertion.field_key}</p>
                        </td>
                        <td className="p-2.5">
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 font-mono">
                            {assertion.scope_type}
                          </span>
                          {assertion.scope_detail && (
                            <p className="text-[11px] text-eco-muted mt-0.5">{assertion.scope_detail}</p>
                          )}
                        </td>
                        <td className="p-2.5 font-mono font-medium text-slate-100">
                          {assertion.value} {assertion.unit}
                        </td>
                        <td className="p-2.5">
                          {statusBadge(assertion.status)}
                          {assertion.status === 'CONFLICTING' && (
                            <p className="text-[10px] text-rose-300 mt-0.5">Discrepancy detected between DPR & Sanction</p>
                          )}
                        </td>
                        <td className="p-2.5">
                          {linkedArtifacts.length === 0 ? (
                            <span className="text-[11px] text-eco-muted italic">No document attached</span>
                          ) : (
                            <div className="space-y-1">
                              {linkedArtifacts.map((a) => (
                                <button
                                  key={a.id}
                                  type="button"
                                  onClick={() => setSelectedArtifactId(a.id)}
                                  className="block text-[11px] text-eco-primary hover:underline truncate max-w-[200px]"
                                  title={a.filename}
                                >
                                  📄 {a.filename}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-right">
                          {onReviewAssertion && assertion.status !== 'VERIFIED_WITHIN_SCOPE' && (
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                disabled={busy}
                                onClick={() => onReviewAssertion(assertion.id, 'VERIFIED_WITHIN_SCOPE')}
                                className="text-[11px] py-1 px-2"
                              >
                                Verify
                              </Button>
                              <Button
                                type="button"
                                disabled={busy}
                                onClick={() => onReviewAssertion(assertion.id, 'FLAG_CONFLICT')}
                                className="text-[11px] py-1 px-2 border-rose-500/40 text-rose-300 hover:bg-rose-500/20"
                              >
                                Flag
                              </Button>
                            </div>
                          )}
                          {assertion.status === 'VERIFIED_WITHIN_SCOPE' && (
                            <span className="text-[11px] text-emerald-400 font-mono">Rev {assertion.revision}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Uploaded Documents List */}
        <div className="mt-6 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Uploaded Artifact Vault ({artifacts.length})
          </h4>

          {artifacts.length === 0 ? (
            <p className="text-xs text-eco-muted py-2">No documents uploaded yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {artifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  className={`rounded border p-3 transition-colors ${
                    selectedArtifactId === artifact.id
                      ? 'border-eco-primary bg-eco-surface-2'
                      : 'border-eco-border bg-eco-surface hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded bg-eco-primary/10 px-1.5 py-0.5 text-[10px] font-mono text-eco-primary uppercase">
                      {artifact.document_type.replace(/_/g, ' ')}
                    </span>
                    {artifact.synthetic_demo && (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-mono text-amber-400 border border-amber-500/30">
                        SYNTHETIC_DEMO
                      </span>
                    )}
                  </div>

                  <p className="font-medium text-xs text-slate-200 mt-2 truncate" title={artifact.filename}>
                    {artifact.filename}
                  </p>

                  <div className="text-[11px] text-eco-muted space-y-0.5 mt-2">
                    {artifact.issuer && <p>Issuer: <span className="text-slate-300">{artifact.issuer}</span></p>}
                    {artifact.reference && <p>Ref: <span className="font-mono text-slate-300">{artifact.reference}</span></p>}
                    {artifact.issued_on && <p>Issued: {artifact.issued_on} {artifact.valid_until ? `· Valid to ${artifact.valid_until}` : ''}</p>}
                    <p className="font-mono text-[10px] truncate" title={artifact.sha256}>
                      SHA: {artifact.sha256.substring(0, 16)}…
                    </p>
                  </div>

                  {artifact.notes && (
                    <p className="text-[11px] text-slate-400 mt-2 bg-slate-900/40 p-1.5 rounded italic">
                      "{artifact.notes}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <EvidenceUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUpload={onUpload}
        busy={busy}
      />
    </div>
  );
}
