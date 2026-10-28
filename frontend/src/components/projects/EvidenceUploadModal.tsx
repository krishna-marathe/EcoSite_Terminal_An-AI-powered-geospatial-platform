import React, { useState } from 'react';
import type { DocumentType } from '../../types/evidence';
import { Button } from '../ui/Button';

interface EvidenceUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File, metadata: {
    document_type: DocumentType;
    issuer?: string;
    reference?: string;
    valid_until?: string;
    notes?: string;
  }) => Promise<void>;
  busy?: boolean;
}

const DOCUMENT_TYPES: { value: DocumentType; label: string; desc: string }[] = [
  { value: 'UTILITY_SANCTION', label: 'Utility Grid Sanction', desc: 'Formal power sanction letter from DISCOM/STU (e.g. MSEDCL, TSTRANSCO)' },
  { value: 'UTILITY_APPLICATION', label: 'Grid Connection Application', desc: 'Pending load application or feasibility inquiry' },
  { value: 'WATER_ALLOCATION', label: 'Water Supply Allocation', desc: 'MIDC, municipal, or irrigation authority water reservation letter' },
  { value: 'WATER_STUDY', label: 'Hydrogeological Water Study', desc: 'Aquifer yield assessment or water balance report' },
  { value: 'DPR', label: 'Detailed Project Report (DPR)', desc: 'Campus engineering design, load schedules, and phase plan' },
  { value: 'PLANNING', label: 'Planning / Industrial Approval', desc: 'Zoning clearance, MIDC allotment order, or land-use change' },
  { value: 'EIA_STUDY', label: 'Environmental Impact Study', desc: 'Pre-construction ecological or flood risk assessment' },
  { value: 'OTHER', label: 'Other Technical Evidence', desc: 'Specialist survey, tariff agreement, or NOC' },
];

export function EvidenceUploadModal({ isOpen, onClose, onUpload, busy }: EvidenceUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentType>('UTILITY_SANCTION');
  const [issuer, setIssuer] = useState('');
  const [reference, setReference] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }
    setError('');
    try {
      await onUpload(file, {
        document_type: docType,
        issuer: issuer.trim() || undefined,
        reference: reference.trim() || undefined,
        valid_until: validUntil || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload document.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="upload-modal-title">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-lg border border-eco-border bg-eco-surface p-6 shadow-2xl">
        <div className="flex items-start justify-between border-b border-eco-border pb-3">
          <div>
            <h2 id="upload-modal-title" className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <span>📄</span> Upload Project Evidence Artifact
            </h2>
            <p className="text-xs text-eco-muted mt-1">
              Store supporting technical and regulatory documents. Uploaded documents grant at most <strong className="text-amber-400">DOCUMENTED</strong> status until verified.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close modal"
            className="text-slate-400 hover:text-slate-200 text-lg p-1"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Select Document File (.pdf, .docx, .png, .jpg) *
            </label>
            <input
              type="file"
              required
              disabled={busy}
              accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full rounded border border-eco-border bg-eco-surface-2 p-2 text-xs text-slate-200 file:mr-3 file:rounded file:border-0 file:bg-eco-primary/20 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-eco-primary hover:file:bg-eco-primary/30"
            />
            {file && (
              <p className="mt-1 text-[11px] text-eco-muted font-mono">
                {file.name} · {(file.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Document Category / Type *
            </label>
            <select
              value={docType}
              disabled={busy}
              onChange={(e) => setDocType(e.target.value as DocumentType)}
              className="w-full rounded border border-eco-border bg-eco-surface-2 p-2 text-xs text-slate-200"
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-eco-muted">
              {DOCUMENT_TYPES.find((t) => t.value === docType)?.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Issuing Authority / Agency
              </label>
              <input
                type="text"
                disabled={busy}
                placeholder="e.g. MSEDCL, MIDC, CPCB"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                className="w-full rounded border border-eco-border bg-eco-surface-2 p-2 text-xs text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Official Letter / Reference No.
              </label>
              <input
                type="text"
                disabled={busy}
                placeholder="e.g. SE/PZC/2026/890"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full rounded border border-eco-border bg-eco-surface-2 p-2 text-xs text-slate-200 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Validity Expiration Date (if applicable)
            </label>
            <input
              type="date"
              disabled={busy}
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full rounded border border-eco-border bg-eco-surface-2 p-2 text-xs text-slate-200"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Technical Scope / Extraction Notes
            </label>
            <textarea
              rows={2}
              disabled={busy}
              placeholder="e.g. Covers 40 MW phase 1 at 220kV Baramati feeder. Water allocation subject to tertiary treatment plant commissioning."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded border border-eco-border bg-eco-surface-2 p-2 text-xs text-slate-200"
            />
          </div>

          <div className="rounded border border-amber-500/20 bg-amber-500/10 p-2.5 text-[11px] text-amber-300">
            <strong>Honesty Disclaimer:</strong> Uploaded evidence is stored in local project storage. Synthetic/demo accounts produce <span className="underline">simulated verification</span> only. Proximity to infrastructure does not constitute utility capacity sanction.
          </div>

          {error && <p role="alert" className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2 border-t border-eco-border">
            <Button type="button" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={busy || !file}>
              {busy ? 'Uploading & Hashing…' : 'Upload Evidence Artifact'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
