import React, { useState } from 'react';
import type { ExtractionCandidate } from '../../types/evidence';
import { Button } from '../ui/Button';

interface ExtractionReviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  extractions: ExtractionCandidate[];
  onConfirm: (extractionId: string, decision: 'ACCEPTED' | 'REJECTED', adjustedValue?: number | string) => Promise<void>;
  busy?: boolean;
}

export function ExtractionReviewDrawer({
  isOpen,
  onClose,
  extractions,
  onConfirm,
  busy = false,
}: ExtractionReviewDrawerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editingValue, setEditingValue] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [actionError, setActionError] = useState('');

  if (!isOpen) return null;

  const current = extractions[selectedIndex] || extractions[0];

  const handleAction = async (decision: 'ACCEPTED' | 'REJECTED') => {
    if (!current) return;
    setActionError('');
    try {
      const val = isEditing ? (Number(editingValue) || editingValue) : undefined;
      await onConfirm(current.id, decision, val);
      setIsEditing(false);
      if (selectedIndex < extractions.length - 1) {
        setSelectedIndex(selectedIndex + 1);
      }
    } catch (err: any) {
      setActionError(err?.message || 'Failed to record extraction review decision.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="review-drawer-title">
      <div className="flex h-full w-full max-w-4xl flex-col bg-eco-surface border-l border-eco-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-eco-border bg-eco-surface-2 px-6 py-4">
          <div>
            <h2 id="review-drawer-title" className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <span>🔍</span> Document Intelligence Extraction Review
            </h2>
            <p className="text-xs text-eco-muted mt-0.5">
              Review AI/Parser extracted facts against original source document pages before accepting as assertions.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close review drawer"
            className="text-slate-400 hover:text-slate-100 text-lg p-1"
          >
            ✕
          </button>
        </div>

        {/* Content Body: Split View */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Document Page Simulation / Snippet Inspector */}
          <div className="flex-1 border-r border-eco-border bg-slate-950/60 p-6 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between border-b border-eco-border pb-2 mb-4 text-xs text-eco-muted">
                <span className="font-mono text-slate-300">📄 {current?.document_name}</span>
                <span className="rounded bg-slate-800 px-2 py-0.5 font-mono">Page {current?.page_number || 1}</span>
              </div>

              {/* Simulated Document Page Rendering */}
              <div className="rounded border border-slate-700 bg-slate-900/90 p-6 shadow-inner font-serif text-slate-300 text-sm leading-relaxed relative">
                <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-4 pb-2 border-b border-slate-800 flex justify-between">
                  <span>Document Page {current?.page_number} Extract</span>
                  <span>Authentic Evidence View</span>
                </div>

                <p className="text-slate-400 text-xs mb-3 italic">
                  [Section 4.2 — Interconnection Agreement & Allocation Terms]
                </p>

                <p className="mb-4">
                  The competent authority, having reviewed the applicant's Detailed Project Report and technical load flow studies, hereby records the following determination for the proposed data-centre campus.
                </p>

                {/* Highlighted Bounding Box / Snippet */}
                <div className="rounded border-2 border-emerald-400/80 bg-emerald-500/10 p-3 my-4 relative shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                  <span className="absolute -top-2.5 right-2 rounded bg-emerald-600 px-1.5 py-0.2 text-[9px] font-mono text-white uppercase tracking-wider">
                    Target Extraction Box
                  </span>
                  <p className="font-mono text-emerald-200 font-medium">
                    "{current?.raw_text}"
                  </p>
                </div>

                <p className="text-xs text-slate-400 mt-4">
                  All approvals remain conditional on sub-transmission augmentation and compliance with the relevant State Electricity Regulatory Commission tariff orders.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded bg-eco-surface-2/60 p-3 border border-eco-border text-[11px] text-eco-muted">
              <strong>Extraction Provenance:</strong> Derived via <span className="font-mono text-slate-200">{current?.method}</span> {current?.confidence ? `(Confidence: ${(current.confidence * 100).toFixed(0)}%)` : ''}. A human reviewer must confirm this scope before inclusion in the Readiness Passport.
            </div>
          </div>

          {/* Right: Candidate Fact & Review Decision Controls */}
          <div className="w-80 flex flex-col justify-between bg-eco-surface p-5 overflow-y-auto">
            <div className="space-y-4">
              {/* Queue Selector */}
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-400 mb-2">
                  Extraction Candidates ({extractions.length})
                </p>
                <div className="space-y-1.5">
                  {extractions.map((ext, idx) => (
                    <button
                      key={ext.id}
                      type="button"
                      onClick={() => {
                        setSelectedIndex(idx);
                        setIsEditing(false);
                      }}
                      className={`w-full text-left rounded p-2 text-xs transition-colors border ${
                        selectedIndex === idx
                          ? 'border-eco-primary bg-eco-primary/10 text-slate-100'
                          : 'border-eco-border bg-eco-surface-2 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex justify-between font-medium">
                        <span className="truncate">{ext.field_label}</span>
                        <span className="font-mono text-[10px]">{ext.normalized_value} {ext.unit}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-eco-muted mt-1">
                        <span>p. {ext.page_number}</span>
                        <span className={ext.review_status === 'ACCEPTED' ? 'text-emerald-400' : ext.review_status === 'REJECTED' ? 'text-rose-400' : 'text-amber-400'}>
                          {ext.review_status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Current Extraction Details */}
              {current && (
                <div className="rounded border border-eco-border bg-eco-surface-2 p-3 space-y-3">
                  <h4 className="text-xs font-semibold text-slate-200 border-b border-eco-border pb-1">
                    Candidate Assertion
                  </h4>

                  <div>
                    <label className="text-[10px] text-eco-muted uppercase block">Semantic Field</label>
                    <p className="text-xs font-medium text-slate-200">{current.field_label}</p>
                    <p className="text-[10px] font-mono text-eco-muted">{current.field_key}</p>
                  </div>

                  <div>
                    <label className="text-[10px] text-eco-muted uppercase block">Normalized Fact</label>
                    {isEditing ? (
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="w-full rounded border border-eco-border bg-eco-surface p-1 text-xs text-slate-100 font-mono"
                        />
                        <span className="text-xs text-slate-300 font-mono">{current.unit}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-base font-bold font-mono text-emerald-400">
                          {current.normalized_value} <span className="text-xs font-normal text-slate-300">{current.unit}</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditing(true);
                            setEditingValue(String(current.normalized_value));
                          }}
                          className="text-[11px] text-sky-400 hover:underline"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] text-eco-muted uppercase block">Scope Applicability</label>
                    <p className="text-xs text-slate-300">{current.phase_scope || 'Campus Wide'}</p>
                  </div>
                </div>
              )}

              {actionError && (
                <p role="alert" className="text-xs text-rose-400">{actionError}</p>
              )}
            </div>

            {/* Decision Actions */}
            <div className="space-y-2 pt-4 border-t border-eco-border">
              <Button
                type="button"
                disabled={busy || !current}
                onClick={() => handleAction('ACCEPTED')}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2"
              >
                ✓ Confirm & Verify Field
              </Button>
              <Button
                type="button"
                disabled={busy || !current}
                onClick={() => handleAction('REJECTED')}
                className="w-full border-rose-500/40 text-rose-300 hover:bg-rose-500/20 py-2"
              >
                ✕ Reject Extraction
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
